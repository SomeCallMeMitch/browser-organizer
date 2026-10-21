// All durable data lives in this extension-origin database, including worker checkpoints.
export const DB_VERSION = 1;
const STORES = ['meta', 'urls', 'visits', 'projects', 'tags', 'suppressed', 'pending'];
export const request = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export class ArchiveDB {
  constructor(name = 'browser-organizer') { this.name = name; this.connection = null; }
  open() {
    if (this.connection) return this.connection;
    this.connection = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const urls = db.createObjectStore('urls', {keyPath: 'url'});
        for (const [name, path] of Object.entries({earliest: ['firstVisitTime', 'url'], recent: ['lastVisitTime', 'url'], title: ['titleSort', 'url'], domain: ['domain', 'url'], visits: ['visitCount', 'url']})) urls.createIndex(name, path);
        const visits = db.createObjectStore('visits', {keyPath: 'key'});
        visits.createIndex('url', 'url');
        for (const name of ['projects', 'tags']) db.createObjectStore(name, {keyPath: 'id'});
        for (const name of ['meta', 'suppressed', 'pending']) db.createObjectStore(name);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); this.connection = null; };
        resolve(db);
      };
      req.onerror = () => { this.connection = null; reject(req.error); };
      req.onblocked = () => { this.connection = null; reject(new Error('Database upgrade blocked. Close other organizer tabs and reopen.')); };
    });
    return this.connection;
  }
  async tx(names, mode, fn) {
    const db = await this.open();
    const tx = db.transaction(names, mode);
    const done = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted; no changes saved.'));
      tx.onerror = () => {}; // abort is the single error boundary
    });
    // Observe early rejection while the callback is still awaiting a request.
    done.catch(() => {});
    const stores = Object.fromEntries(names.map(name => [name, tx.objectStore(name)]));
    return Promise.resolve().then(() => fn(stores)).then(async value => { await done; return value; }, async error => {
      if (tx.readyState !== 'done') { /* abort may throw after a completed transaction */
        await Promise.resolve().then(() => tx.abort()).catch(() => {});
      }
      await done.catch(() => {});
      throw error;
    });
  }
  getState() { return this.tx(['meta'], 'readonly', async s => ({consent: false, deletedBefore: 0, revision: 0, ...(await request(s.meta.get('state')) || {})})); }
  changeState(change) { return this.tx(['meta'], 'readwrite', async s => {
    const state = {consent: false, deletedBefore: 0, revision: 0, ...(await request(s.meta.get('state')) || {})};
    const next = {...state, ...change}; s.meta.put(next, 'state'); return next;
  }); }
  async stats() {
    return this.tx(['urls', 'visits', 'projects', 'tags', 'pending'], 'readonly', async s => {
      const [urls, visits, projects, tags, pending, oldest, newest] = await Promise.all([
        request(s.urls.count()), request(s.visits.count()), request(s.projects.getAll()), request(s.tags.getAll()), request(s.pending.count()),
        request(s.urls.index('earliest').openCursor()), request(s.urls.index('recent').openCursor(null, 'prev'))
      ]);
      return {urls, visits, projects, tags, pending, oldest: oldest?.value?.firstVisitTime, newest: newest?.value?.lastVisitTime};
    });
  }
  enqueue(item) { return this.tx(['pending'], 'readwrite', s => { if (item?.url) s.pending.put(item, item.url); }); }
  nextPending() { return this.tx(['pending'], 'readonly', async s => (await request(s.pending.openCursor()))?.value); }
  acknowledge(url) { return this.tx(['pending'], 'readwrite', s => s.pending.delete(url)); }
  async ingest(item, rawVisits, checkpoint) {
    if (!item?.url) throw new Error('Chrome returned a history item without a URL. Retry the import.');
    return this.tx(['urls', 'visits', 'meta', 'suppressed'], 'readwrite', async s => {
      const state = {deletedBefore: 0, revision: 0, ...(await request(s.meta.get('state')) || {})};
      const cutoff = Math.max(state.deletedBefore, (await request(s.suppressed.get(item.url))) || 0);
      const old = await request(s.urls.get(item.url));
      let changedVisits = false;
      for (const visit of rawVisits || []) {
        if (typeof visit?.visitId !== 'string' || !Number.isFinite(visit.visitTime)) continue;
        if (visit.visitTime <= cutoff) continue;
        // Never normalize away query strings or fragments; visit IDs distinguish visits.
        const key = JSON.stringify([item.url, visit.visitId]);
        const record = {key, url: item.url, visitId: visit.visitId, visitTime: visit.visitTime, transition: visit.transition || 'unknown', isLocal: visit.isLocal ?? null};
        const existing = await request(s.visits.get(key));
        if (!existing || existing.visitTime !== record.visitTime || existing.transition !== record.transition || existing.isLocal !== record.isLocal) {
          s.visits.put(record); changedVisits = true;
        }
      }
      const stored = await request(s.visits.index('url').getAll(item.url));
      if (stored.length) {
        let domain = '';
        // Chrome may return non-web URLs. Parsing failure must not discard an available record.
        domain = URL.canParse(item.url) ? new URL(item.url).hostname : '(other)';
        const title = item.title || old?.title || item.url;
        let firstVisitTime = Infinity, lastVisitTime = 0;
        for (const v of stored) { firstVisitTime = Math.min(firstVisitTime, v.visitTime); lastVisitTime = Math.max(lastVisitTime, v.visitTime); }
        const record = {url: item.url, title, titleSort: title.toLocaleLowerCase(), domain: domain || '(local)',
          visitCount: stored.length, browserVisitCount: item.visitCount ?? null, firstVisitTime, lastVisitTime,
          projectIds: old?.projectIds || [], tagIds: old?.tagIds || []};
        if (JSON.stringify(record) !== JSON.stringify(old) || changedVisits) {
          s.urls.put(record);
          s.meta.put({...state, revision: state.revision + 1, lastCapturedAt: Date.now()}, 'state');
        }
      }
      if (checkpoint) { const {page, ...position} = checkpoint; s.meta.put({...position, hasPage: Array.isArray(page)}, 'import'); }
      return {archived: stored.length > 0, unavailable: !rawVisits?.length};
    });
  }
  job() { return this.tx(['meta'], 'readonly', async s => {
    const saved = await request(s.meta.get('import'));
    if (!saved) return undefined;
    const {hasPage, ...job} = saved;
    return {...job, page: hasPage ? await request(s.meta.get('import-page')) : null};
  }); }
  setJob(job) { return this.tx(['meta'], 'readwrite', s => {
    const {page, ...position} = job;
    s.meta.put({...position, hasPage: Array.isArray(page)}, 'import');
    if (Array.isArray(page)) s.meta.put(page, 'import-page'); else s.meta.delete('import-page');
  }); }
  visitDetails(url) { return this.tx(['visits'], 'readonly', async s => (await request(s.visits.index('url').getAll(url))).sort((a,b) => b.visitTime - a.visitTime)); }
  query(filters = {}) {
    return this.tx(['urls'], 'readonly', s => new Promise((resolve, reject) => {
      const index = ['recent','title','domain','visits'].includes(filters.sort) ? filters.sort : 'recent';
      const cursor = s.urls.index(index).openCursor(null, ['recent','visits'].includes(index) ? 'prev' : 'next');
      const words = String(filters.text || '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const offset = Math.max(0, Number(filters.page) || 0) * 50;
      const items = []; let total = 0;
      cursor.onerror = () => reject(cursor.error);
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) { resolve({items, total, pageSize: 50}); return; }
        const r = c.value;
        const text = `${r.title} ${r.url}`.toLocaleLowerCase();
        const matches = words.every(w => text.includes(w)) && (!filters.domain || r.domain.includes(filters.domain.toLocaleLowerCase())) &&
          (!filters.from || r.lastVisitTime >= filters.from) && (!filters.to || r.lastVisitTime < filters.to) &&
          (!filters.project || r.projectIds.includes(filters.project)) && (!filters.tag || r.tagIds.includes(filters.tag)) &&
          (!filters.unassigned || r.projectIds.length === 0);
        if (matches) { if (total >= offset && items.length < 50) items.push(r); total++; }
        c.continue();
      };
    }));
  }
  saveLabel(kind, id, name) {
    if (!['projects','tags'].includes(kind)) throw new Error('Unknown label type.');
    const clean = String(name || '').trim();
    if (!clean || clean.length > 80) throw new Error('Use a name between 1 and 80 characters.');
    return this.tx([kind, 'meta'], 'readwrite', async s => {
      const labels = await request(s[kind].getAll());
      if (labels.some(l => l.id !== id && l.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('That name already exists.');
      if (id && !labels.some(l => l.id === id)) throw new Error('This label no longer exists. Refresh the page.');
      s[kind].put({id: id || crypto.randomUUID(), name: clean});
      const state = await request(s.meta.get('state')) || {}; s.meta.put({...state, revision: (state.revision || 0) + 1}, 'state');
    });
  }
  deleteLabel(kind, id) {
    if (!['projects','tags'].includes(kind)) throw new Error('Unknown label type.');
    return this.tx([kind, 'urls', 'meta'], 'readwrite', async s => {
      s[kind].delete(id);
      const key = kind === 'projects' ? 'projectIds' : 'tagIds';
      await new Promise((resolve, reject) => {
        const req = s.urls.openCursor(); req.onerror = () => reject(req.error);
        req.onsuccess = () => { const c = req.result; if (!c) return resolve(); if (c.value[key].includes(id)) c.update({...c.value, [key]: c.value[key].filter(x => x !== id)}); c.continue(); };
      });
      const state = await request(s.meta.get('state')) || {}; s.meta.put({...state, revision: (state.revision || 0) + 1}, 'state');
    });
  }
  assign(urls, kind, id, remove = false) {
    if (!['projects','tags'].includes(kind) || !Array.isArray(urls) || urls.length > 50) throw new Error('Select up to one results page at a time.');
    return this.tx([kind,'urls','meta'], 'readwrite', async s => {
      if (!await request(s[kind].get(id))) throw new Error('This label no longer exists.');
      const key = kind === 'projects' ? 'projectIds' : 'tagIds';
      for (const url of urls) {
        const r = await request(s.urls.get(url));
        if (r) s.urls.put({...r, [key]: remove ? r[key].filter(x => x !== id) : [...new Set([...r[key], id])]});
      }
      const state = await request(s.meta.get('state')) || {}; s.meta.put({...state, revision: (state.revision || 0) + 1}, 'state');
    });
  }
  forget(urls, now = Date.now()) {
    return this.tx(['urls','visits','suppressed','meta','pending'], 'readwrite', async s => {
      const state = await request(s.meta.get('state')) || {};
      if (urls === null) {
        s.urls.clear(); s.visits.clear(); s.suppressed.clear(); s.pending.clear();
        s.meta.put({...state, deletedBefore: now, revision: (state.revision || 0) + 1}, 'state');
      } else {
        if (!Array.isArray(urls) || urls.length > 50) throw new Error('Select up to 50 records.');
        for (const url of urls) {
          s.urls.delete(url); s.pending.delete(url); s.suppressed.put(now, url);
          const keys = await request(s.visits.index('url').getAllKeys(url)); for (const key of keys) s.visits.delete(key);
        }
        s.meta.put({...state, revision: (state.revision || 0) + 1}, 'state');
      }
      // Prevent a staged import from immediately repopulating intentionally forgotten visits.
      s.meta.delete('import'); s.meta.delete('import-page');
    });
  }
  async close() { const db = await this.connection; db?.close(); this.connection = null; }
}
export { STORES };
