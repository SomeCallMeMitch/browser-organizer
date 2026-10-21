import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Archive, ArrowUpRight, Check, ChevronLeft, ChevronRight, Database, Folder, History, Layers, Loader2, Search, Settings, ShieldCheck, Tag, X } from 'lucide-react';
import { send, prettyDate, prettyTime, safeLink } from './api.js';

const initialFilters = {text: '', domain: '', project: '', tag: '', from: '', to: '', unassigned: false, sort: 'recent', page: 0};
function Button({children, secondary = false, danger = false, ...props}) { return <button {...props} className={`${danger ? 'btn-danger' : secondary ? 'btn-secondary' : 'btn'} ${props.className || ''}`}>{children}</button>; }
function Field({label, children, ...props}) { return <label className="field"><span>{label}</span>{children || <input {...props}/>}</label>; }
function Dialog({title, children, onClose}) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={ref} onCancel={onClose} onClick={e => {if (e.target === ref.current) onClose();}} aria-label={title}>
    <div className="flex items-center justify-between gap-4 mb-5"><h2>{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
function App() {
  const [section, setSection] = useState('history');
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [results, setResults] = useState({items: [], total: 0});
  const [searching, setSearching] = useState(true);
  const [selected, setSelected] = useState([]);
  const [assignment, setAssignment] = useState('');
  const [dialog, setDialog] = useState(null);
  const [visits, setVisits] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const mounted = useRef(true);
  const refresh = useCallback(() => send('status').then(data => {if (mounted.current) setStatus(data);}), []);
  useEffect(() => {
    mounted.current = true; let timer; let stopped = false;
    const poll = async () => {
      await refresh().catch(e => setError(e.message));
      if (!stopped) { await send('tick').catch(e => setError(e.message)); timer = setTimeout(poll, 1500); }
    };
    poll(); return () => { stopped = true; mounted.current = false; clearTimeout(timer); };
  }, [refresh]);
  const revision = status?.state?.revision || 0;
  useEffect(() => {
    let canceled = false; setSearching(true);
    const timer = setTimeout(() => {
      const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : 0;
      const toDate = filters.to ? new Date(`${filters.to}T00:00:00`) : null;
      if (toDate) toDate.setDate(toDate.getDate() + 1);
      send('query', {...filters, from, to: toDate?.getTime() || 0}).then(r => {if (!canceled) {setResults(r); setSearching(false);}}, e => {if (!canceled) {setError(e.message); setSearching(false);}});
    }, 200);
    return () => {canceled = true; clearTimeout(timer);};
  }, [filters, revision]);
  const changeFilter = (key, value) => {setFilters(f => ({...f, [key]: value, page: key === 'page' ? value : 0})); setSelected([]);};
  const act = (action, success = '') => {
    setBusy(true); setError(''); setNotice('');
    return Promise.resolve().then(action).then(async () => {await refresh(); if (success) setNotice(success);}).catch(e => setError(e.message)).finally(() => setBusy(false));
  };
  const enable = () => {
    // Request directly from the click gesture, before messaging or awaiting storage.
    setBusy(true); setError('');
    chrome.permissions.request({permissions: ['history']}).then(granted => {
      if (!granted) throw new Error('History access was declined. Your archive is unchanged; you can try again.');
      return send('enable');
    }).then(refresh).catch(e => setError(e.message)).finally(() => setBusy(false));
  };
  const stats = status?.stats || {};
  const job = status?.job;
  const labels = [...(stats.projects || []).map(p => ({...p, kind: 'projects'})), ...(stats.tags || []).map(p => ({...p, kind: 'tags'}))];
  const openVisits = row => {setDialog({type: 'visits', row}); setVisits(null); send('visits', {url: row.url}).then(setVisits).catch(e => setError(e.message));};
  const closeDialog = () => {setDialog(null); setDeleteText('');};
  const assignmentAction = remove => {
    const label = labels.find(l => `${l.kind}:${l.id}` === assignment); if (!label) return;
    act(() => send('assign', {urls: selected, kind: label.kind, id: label.id, remove}), remove ? 'Assignment removed.' : 'Assignment saved.');
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#history" className="brand" onClick={() => setSection('history')}><span className="brand-icon"><Layers size={22}/></span><span>Browser<br/><b>Organizer</b></span></a>
      <div className="sidebar-label">YOUR LIBRARY</div>
      <nav aria-label="Main navigation">{[['history',History,'History'],['labels',Folder,'Projects & tags'],['settings',Settings,'Settings']].map(([id,Icon,title]) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}><Icon size={19}/><span>{title}</span>{id === 'history' && <small>{stats.urls?.toLocaleString() || 0}</small>}</button>)}</nav>
      <div className="sidebar-label mt-9">ON THE ROADMAP</div><p className="roadmap-item">Open tabs <small>Milestone 3</small></p><p className="roadmap-item">Workspaces & backups <small>Milestone 2</small></p>
      <div className="local-card"><ShieldCheck size={22}/><strong>Yours. On this device.</strong><p>No account, subscription or cloud connection required.</p><span className="local-badge"><span/> Local archive</span></div>
      <div className="sidebar-footer">BROWSER ORGANIZER <span>v0.1 · development</span></div>
    </aside>
    <main>
      <header className="topbar"><span>Personal library <ChevronRight size={14}/> {section === 'history' ? 'History' : section === 'labels' ? 'Projects & tags' : 'Settings'}</span><span className="privacy-note"><ShieldCheck size={15}/> Private by default</span></header>
      <div className="content">
        {error && <div role="alert" className="alert error"><strong>Something needs attention</strong><p>{error}</p><button onClick={() => setError('')}>Dismiss</button></div>}
        {notice && <div role="status" className="alert success"><Check size={17}/>{notice}<button onClick={() => setNotice('')}>Dismiss</button></div>}
        {!status ? <div className="empty"><Loader2 className="animate-spin"/>Opening your local library…</div> : <>
          {(!status.state.consent || !status.permission) && <section className="onboarding card">
            <span className="eyebrow">A LITTLE SETUP, A BETTER MEMORY</span><h2>Keep your research within reach.</h2><p>Allow access to history in this Chrome profile to import what Chrome currently exposes and capture future visits while enabled. Other profiles and incognito are outside this archive.</p>
            <div className="policy-grid"><p><strong>An independent archive</strong>Clearing Chrome history does <b>not</b> clear this archive. Use “Forget” here to remove archived visits. Old visits you forget stay excluded from future imports.</p><p><strong>Local is not a backup</strong>Removing the extension or profile can lose your data. Portable backups are not available in this development milestone. Chrome cannot recover history it no longer retains.</p></div>
            <label className="check-label"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/>I understand the separate archive and local data limitations.</label>
            <Button disabled={!accepted || busy} onClick={enable}>{busy ? <Loader2 className="animate-spin" size={16}/> : <History size={16}/>}Allow history & start import</Button>
          </section>}
          {section === 'history' && <>
            <div className="page-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h1>Your browsing, organized.</h1><p>Find the page. Keep the context. Make room for the next idea.</p></div><Button secondary disabled={busy || !status.permission || !status.state.consent} onClick={() => act(() => send('import'), 'Import queued. Leave this page open for faster progress.')}><History size={16}/>{['paused','error'].includes(job?.status) ? 'Resume import' : job?.status === 'running' ? 'Import running' : 'Import available history'}</Button></div>
            <div className="stats-grid"><Stat title="ARCHIVED PAGES" value={(stats.urls || 0).toLocaleString()} note="One record per exact URL"/><Stat title="ARCHIVED VISITS" value={(stats.visits || 0).toLocaleString()} note="Distinct visit events, never import totals"/><Stat title="PROJECTS" value={stats.projects?.length || 0} note="Give research a place to belong"/><Stat title="LATEST ARCHIVED VISIT" value={prettyDate(stats.newest)} note={stats.oldest ? `Earliest visit: ${prettyDate(stats.oldest)}` : 'Your library starts with permission'}/></div>
            {job && <div className={`import-status ${job.status === 'error' ? 'border-red-300' : ''}`} role="status"><span className="import-icon">{job.status === 'running' ? <Loader2 className="animate-spin" size={19}/> : <Database size={19}/>}</span><div><strong>History import · {job.status}</strong><p>{job.processed.toLocaleString()} URL checks · {job.pendingRanges} time ranges remaining. {job.status === 'complete' ? 'Available-history scan finished. This does not prove complete lifetime history.' : 'Counts grow as visits are saved. Closing this page slows progress; it does not reset it.'}</p>{!!job.unavailable && <p>{job.unavailable} URL checks returned no visit details; this is a coverage gap.</p>}{job.error && <p className="text-red-700">{job.error} Use Resume import to retry the same checkpoint.</p>}</div>{job.status === 'running' && <Button secondary disabled={busy} onClick={() => act(() => send('pause'))}>Pause</Button>}</div>}
            {status.state.captureError && <div className="alert error" role="alert">Capture needs a retry: {status.state.captureError}. Pending events remain queued; check permission and available storage.</div>}
            <section className="card history-card" aria-label="History explorer">
              <div className="search-row"><Search size={21}/><input aria-label="Search titles and URLs" placeholder="Search titles or URLs… every word counts" value={filters.text} onChange={e => changeFilter('text',e.target.value)}/><span className="search-hint">ALL WORDS</span></div>
              <div className="filters-grid">
                <Field label="Domain"><input placeholder="e.g. example.com" value={filters.domain} onChange={e => changeFilter('domain',e.target.value)}/></Field>
                <Field label="Project"><select value={filters.project} onChange={e => changeFilter('project',e.target.value)}><option value="">All projects</option>{stats.projects.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
                <Field label="Tag"><select value={filters.tag} onChange={e => changeFilter('tag',e.target.value)}><option value="">All tags</option>{stats.tags.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
                <Field label="Last visit from"><input type="date" value={filters.from} onChange={e => changeFilter('from',e.target.value)}/></Field>
                <Field label="Through"><input type="date" min={filters.from || undefined} value={filters.to} onChange={e => changeFilter('to',e.target.value)}/></Field>
              </div>
              <div className="result-toolbar"><div><strong>{results.total.toLocaleString()}</strong> matching pages {searching && <Loader2 size={14} className="inline animate-spin"/>}<label className="check-label"><input type="checkbox" checked={filters.unassigned} onChange={e => changeFilter('unassigned',e.target.checked)}/>No project</label></div><div><button className="text-button" onClick={() => {setFilters(initialFilters); setSelected([]);}}>Reset filters</button><label className="sr-only" htmlFor="sort">Sort results</label><select id="sort" value={filters.sort} onChange={e => changeFilter('sort',e.target.value)}><option value="recent">Most recent visit</option><option value="title">Title A–Z</option><option value="domain">Domain A–Z</option><option value="visits">Most archived visits</option></select></div></div>
              {!!selected.length && <div className="bulk-bar"><strong>{selected.length} selected</strong><select aria-label="Assignment" value={assignment} onChange={e => setAssignment(e.target.value)}><option value="">Choose project or tag</option>{labels.map(l => <option key={l.id} value={`${l.kind}:${l.id}`}>{l.kind === 'projects' ? 'Project' : 'Tag'}: {l.name}</option>)}</select><Button disabled={!assignment || busy} onClick={() => assignmentAction(false)}>Add</Button><Button secondary disabled={!assignment || busy} onClick={() => assignmentAction(true)}>Remove</Button><button className="text-button text-red-700" disabled={busy} onClick={() => setDialog({type:'forget', urls: selected})}>Forget selected</button></div>}
              <div className="table-wrap"><table><thead><tr><th className="w-12"><input type="checkbox" aria-label="Select this page of results" checked={!!results.items.length && results.items.every(r => selected.includes(r.url))} onChange={e => setSelected(e.target.checked ? results.items.map(r => r.url) : [])}/></th><th>PAGE & PROJECTS</th><th>ARCHIVED VISITS</th><th>LAST VISIT</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{results.items.map(row => <tr key={row.url}><td><input type="checkbox" aria-label={`Select ${row.title}`} checked={selected.includes(row.url)} onChange={e => setSelected(s => e.target.checked ? [...s,row.url] : s.filter(url => url !== row.url))}/></td><td><div className="page-cell"><span className="site-icon">{row.domain.slice(0,1).toUpperCase()}</span><div className="min-w-0"><div className="page-title">{safeLink(row.url) ? <a href={row.url} target="_blank" rel="noreferrer">{row.title}<ArrowUpRight size={13}/></a> : row.title}</div><div className="page-url" title={row.url}>{row.url}</div><div className="chips">{labels.filter(l => (l.kind === 'projects' ? row.projectIds : row.tagIds).includes(l.id)).map(l => <span key={l.id} className={l.kind === 'projects' ? 'chip' : 'chip tag'}>{l.kind === 'projects' ? <Folder size={11}/> : <Tag size={11}/>} {l.name}</span>)}</div></div></div></td><td className="tabular-nums">{row.visitCount.toLocaleString()}</td><td className="whitespace-nowrap">{prettyDate(row.lastVisitTime)}</td><td><button className="text-button" onClick={() => openVisits(row)}>Details</button></td></tr>)}</tbody></table></div>
              {!results.items.length && <div className="empty"><Search size={32}/><h3>{stats.urls ? 'No pages match these filters.' : 'A clear space for your research.'}</h3><p>{stats.urls ? 'Try fewer words, another date, or reset the filters.' : 'Allow history access above to build your local library.'}</p></div>}
              <div className="pagination"><span>50 pages per view · Dates filter the last archived visit</span><div><Button secondary aria-label="Previous results page" disabled={filters.page === 0 || searching} onClick={() => changeFilter('page', filters.page - 1)}><ChevronLeft size={16}/></Button><span>Page {filters.page + 1}</span><Button secondary aria-label="Next results page" disabled={(filters.page+1)*50 >= results.total || searching} onClick={() => changeFilter('page', filters.page + 1)}><ChevronRight size={16}/></Button></div></div>
            </section><p className="footnote"><ShieldCheck size={14}/> Titles and URLs only. No page scraping, tracking, or external AI. Visit counts reflect this archive; Chrome may retain different totals.</p>
          </>}
          {section === 'labels' && <>
            <div className="page-heading"><div><span className="eyebrow">CONTEXT THAT STAYS WITH YOU</span><h1>A place for every idea.</h1><p>Pages can belong to several projects and tags. Assign them from History.</p></div></div>
            <div className="label-columns">{[['projects',Folder,'Projects'],['tags',Tag,'Tags']].map(([kind,Icon,title]) => <section key={kind} className="card label-card"><div className="flex justify-between items-center mb-6"><h2 className="flex gap-2 items-center"><Icon size={20}/>{title}</h2><Button secondary onClick={() => setDialog({type:'label',kind, name:''})}>Create {kind === 'projects' ? 'project' : 'tag'}</Button></div>{stats[kind].length ? stats[kind].map(l => <div className="label-row" key={l.id}><strong>{l.name}</strong><div><button className="text-button" onClick={() => setDialog({type:'label',kind,id:l.id,name:l.name})}>Rename</button><button className="text-button text-red-700" onClick={() => setDialog({type:'deleteLabel',kind,id:l.id,name:l.name})}>Delete</button></div></div>) : <p className="text-slate-500">No {kind} yet. Create one to start organizing.</p>}</section>)}</div><p className="footnote">Assignments are manual and additive. Removing a label keeps the page and its visit history. Assignment rules are planned for a later milestone.</p>
          </>}
          {section === 'settings' && <>
            <div className="page-heading"><div><span className="eyebrow">KNOW WHERE YOUR DATA LIVES</span><h1>Local, by design.</h1><p>Your archive belongs to this extension in this Chrome profile.</p></div></div>
            <section className="card settings-card"><h2><ShieldCheck size={20}/>Privacy & retention</h2><p>Chrome history deletion does not delete this independent archive. Archived records are retained until you explicitly forget them here. Forgetting records does not change Chrome history.</p><p>History permission: <strong>{status.permission ? 'allowed' : 'not allowed'}</strong>. Permission can be revoked in Chrome’s extension settings. Capture stops when permission is revoked or the extension is disabled. Worker restarts resume saved imports and pending capture events; this does not guarantee capture during disabled periods.</p><p>Last browser startup: {prettyTime(status.state.lastBrowserStartup)}. Last saved capture: {prettyTime(status.state.lastCapturedAt)}. Pending capture URLs: {stats.pending}. Capture events without available visit details: {status.state.captureGaps || 0}.</p><p>Coverage reflects only the history Chrome exposes plus captured visits. Use “Import available history” after an interruption to reconcile available records. The history event arrives before a page finishes loading, so some titles may be missing or stale until a later import.</p>{status.state.browserDeletion && <p>Last observed Chrome deletion: {prettyTime(status.state.browserDeletion.at)} ({status.state.browserDeletion.allHistory ? 'all history' : `${status.state.browserDeletion.urlCount} URLs`}). Archived records were retained.</p>}</section>
            <section className="card settings-card"><h2><Archive size={20}/>Backups & recovery · upcoming</h2><p>Portable JSON backups and manual workspace snapshots are milestone 2 and are <strong>not available in v0.1</strong>. This archive is not an independent backup. Uninstalling the extension, deleting the profile or device loss may erase it.</p><p>The current build does not group, move, close or restore browser tabs. Safe workspace operations follow in milestone 3.</p></section>
            <section className="card settings-card danger-zone"><h2>Forget archived history</h2><p>Remove page records and visits locally. Projects and tags remain. Visits dated at or before deletion stay excluded from later imports; new visits can be captured. Per-URL deletion keeps a private URL/cutoff suppression marker; forgetting the entire archive clears those markers and uses one timestamp instead.</p><Button danger disabled={busy} onClick={() => setDialog({type:'forget',urls:null})}>Forget all archived history</Button></section>
          </>}
        </>}
      </div>
    </main>
    {dialog && <Dialog title={dialog.type === 'label' ? `${dialog.id ? 'Rename' : 'Create'} ${dialog.kind === 'projects' ? 'project' : 'tag'}` : dialog.type === 'deleteLabel' ? 'Delete this label?' : dialog.type === 'visits' ? 'Visit details' : 'Forget archived history?'} onClose={closeDialog}>
      {dialog.type === 'label' && <form onSubmit={e => {e.preventDefault(); act(async () => {await send('label:save',dialog); closeDialog();}, 'Label saved.');}}><Field label="Name"><input autoFocus required maxLength={80} value={dialog.name} onChange={e => setDialog({...dialog,name:e.target.value})}/></Field><div className="dialog-actions"><Button secondary type="button" onClick={closeDialog}>Cancel</Button><Button disabled={busy || !dialog.name.trim()}>Save</Button></div></form>}
      {dialog.type === 'deleteLabel' && <><p>Delete “{dialog.name}” and remove its assignments? Pages and visits remain in the archive.</p><div className="dialog-actions"><Button secondary onClick={closeDialog}>Cancel</Button><Button danger disabled={busy} onClick={() => act(async () => {await send('label:delete',dialog); if (filters.project === dialog.id || filters.tag === dialog.id) setFilters(initialFilters); closeDialog();}, 'Label deleted.')}>Delete label</Button></div></>}
      {dialog.type === 'forget' && <><p>Forget {dialog.urls === null ? 'all archived pages and visits' : `${dialog.urls.length} selected pages and their visits`}? This stops the current import. Chrome history is unchanged. Old visits you forget will not be restored by a later import.</p><Field label="Type FORGET to confirm"><input autoFocus value={deleteText} onChange={e => setDeleteText(e.target.value)}/></Field><div className="dialog-actions"><Button secondary onClick={closeDialog}>Cancel</Button><Button danger disabled={busy || deleteText !== 'FORGET'} onClick={() => act(async () => {await send('forget',{urls:dialog.urls,confirm:deleteText}); setSelected([]); closeDialog();}, 'Archived visits forgotten. Future visits remain eligible for capture.')}>Forget permanently</Button></div></>}
      {dialog.type === 'visits' && <><p className="break-all font-semibold">{dialog.row.title}</p><p className="page-url !whitespace-normal break-all">{dialog.row.url}</p><p className="text-sm my-4">{dialog.row.visitCount} archived visits · Chrome reported {dialog.row.browserVisitCount ?? 'unknown'} visits at the latest check. These totals can differ after expiration or archive deletion.</p>{visits === null ? <Loader2 className="animate-spin" aria-label="Loading visits"/> : <div className="visit-list">{visits.map(v => <div key={v.key}><span>{prettyTime(v.visitTime)}</span><span>{v.transition} · {v.isLocal === null ? 'origin unknown' : v.isLocal ? 'this device' : 'synced'}</span></div>)}</div>}</>}
    </Dialog>}
  </div>;
}
function Stat({title,value,note}) {return <div className="stat"><span>{title}</span><strong>{value}</strong><p>{note}</p></div>;}
createRoot(document.getElementById('root')).render(<App/>);
