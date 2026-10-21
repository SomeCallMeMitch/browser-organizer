import { ArchiveDB } from './storage/db.js';
import { HistoryImporter, newImport } from './domain/importer.js';
import { historyBrowser, openDashboard } from './browser/chrome.js';
const db = new ArchiveDB();
const importer = new HistoryImporter(db, historyBrowser);
let tail = Promise.resolve();
const serial = action => { const result = tail.then(action); tail = result.catch(() => {}); return result; };
const messageOf = error => error?.message || String(error);
const noteFailure = error => db.changeState({captureError: messageOf(error)}).catch(e => console.error('Storage unavailable', e));
async function tick() {
  const state = await db.getState();
  if (!state.consent || !await historyBrowser.hasPermission()) return;
  // Bounded units; alarms and dashboard polling resume durable work after termination.
  for (let i = 0; i < 10; i++) {
    const pending = await db.nextPending(); if (!pending) break;
    const result = await db.ingest(pending, await historyBrowser.getVisits(pending.url));
    if (result.unavailable) {
      const latest = await db.getState();
      await db.changeState({captureGaps: (latest.captureGaps || 0) + 1, lastCaptureGapAt: Date.now()});
    }
    await db.acknowledge(pending.url);
  }
  const job = await db.job();
  if (job?.status === 'running') {
    await importer.step().catch(async error => { await db.setJob({...await db.job(), status: 'error', error: messageOf(error)}); });
  }
  if (state.captureError) await db.changeState({captureError: null});
}
let historyListening = false;
function listenHistory() {
  if (historyListening || !chrome.history) return;
  historyListening = true;
  chrome.history.onVisited.addListener(item => { serial(async () => {
    if (!(await db.getState()).consent) return;
    await db.enqueue(item); await tick();
  }).catch(noteFailure); });
  chrome.history.onVisitRemoved.addListener(removed => { serial(async () => {
    if (!(await db.getState()).consent) return;
    // Independent archive: Chrome deletion is recorded, never propagated to the archive.
    await db.changeState({browserDeletion: {at: Date.now(), allHistory: removed.allHistory, urlCount: removed.urls?.length || 0}});
  }).catch(noteFailure); });
}
listenHistory(); // Register synchronously at module evaluation for worker wake-up.
chrome.permissions.onAdded.addListener(() => { listenHistory(); serial(tick).catch(noteFailure); });
chrome.permissions.onRemoved.addListener(p => { if (p.permissions?.includes('history')) serial(() => db.changeState({permissionLostAt: Date.now()})).catch(noteFailure); });
const ensureAlarm = () => chrome.alarms.create('archive-maintenance', {periodInMinutes: 0.5});
chrome.runtime.onInstalled.addListener(() => { ensureAlarm().catch(noteFailure); });
chrome.runtime.onStartup.addListener(() => { ensureAlarm().catch(noteFailure); serial(async () => {
  if ((await db.getState()).consent) await db.changeState({lastBrowserStartup: Date.now()});
  await tick();
}).catch(noteFailure); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'archive-maintenance') serial(tick).catch(noteFailure); });
chrome.action.onClicked.addListener(() => openDashboard().catch(noteFailure));
async function handle(message) {
  const {type, payload = {}} = message || {};
  switch (type) {
    case 'status': return {state: await db.getState(), job: publicJob(await db.job()), stats: await db.stats(), permission: await historyBrowser.hasPermission()};
    case 'enable': {
      if (!await historyBrowser.hasPermission()) throw new Error('Allow history access in the permission prompt first.');
      await db.changeState({consent: true, consentAt: Date.now(), captureError: null}); listenHistory(); await ensureAlarm();
      if (!await db.job()) await db.setJob(newImport());
      return true;
    }
    case 'tick': await tick(); return true;
    case 'import': {
      if (!(await db.getState()).consent || !await historyBrowser.hasPermission()) throw new Error('Enable history access first.');
      const job = await db.job();
      if (job && ['paused','error','running'].includes(job.status)) await db.setJob({...job, status: 'running', error: null});
      else await db.setJob(newImport());
      return true;
    }
    case 'pause': { const job = await db.job(); if (job?.status === 'running') await db.setJob({...job, status: 'paused'}); return true; }
    case 'query': return db.query(payload);
    case 'visits': return db.visitDetails(payload.url);
    case 'label:save': await db.saveLabel(payload.kind, payload.id, payload.name); return true;
    case 'label:delete': await db.deleteLabel(payload.kind, payload.id); return true;
    case 'assign': await db.assign(payload.urls, payload.kind, payload.id, payload.remove); return true;
    case 'forget': {
      if (payload.confirm !== 'FORGET') throw new Error('Deletion confirmation is required.');
      await db.forget(payload.urls); return true;
    }
    default: throw new Error('Unknown organizer operation. Reload the extension and dashboard.');
  }
}
function publicJob(job) { if (!job) return null; const {page, ranges, ...rest} = job; return {...rest, pendingRanges: ranges.length, pageRemaining: Math.max(0, (page?.length || 0) - job.offset)}; }
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return false;
  serial(() => handle(message)).then(data => respond({ok: true, data}), error => respond({ok: false, error: messageOf(error)}));
  return true;
});
// Alarms can disappear across browser restarts. Recreate on every worker evaluation.
ensureAlarm().catch(noteFailure);
