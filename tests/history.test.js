import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ArchiveDB, request } from '../src/storage/db.js';
import { HistoryImporter, newImport } from '../src/domain/importer.js';
const dbFor = () => new ArchiveDB(`test-${crypto.randomUUID()}`);
const item = (url = 'https://example.test/research?q=one', title = 'Research notes') => ({id:'1', url, title, visitCount: 13});
const visit = (id='1', time=100) => ({visitId:id,visitTime:time,transition:'link',isLocal:true});
async function drain(importer, limit = 10000) {
  for (let i=0; i<limit; i++) {const job = await importer.step(100); if (job?.status === 'complete') return job;}
  throw new Error('Import did not terminate.');
}
function browserFor(items, visits, exclusiveEnd = false) {
  const calls = [];
  return {calls, search: async q => {
    calls.push(q);
    // Deliberately return the global HistoryItem.lastVisitTime, rather than a pagination cursor.
    return items.filter(r => visits.get(r.url).some(v => v.visitTime >= q.startTime && (exclusiveEnd ? v.visitTime < q.endTime : v.visitTime <= q.endTime))).slice(0,q.maxResults);
  }, getVisits: async url => visits.get(url) || []};
}
test('stores visits separately, repeats are idempotent, distinct query parameters survive', async () => {
  const db = dbFor(); const a = item();
  await db.ingest(a,[visit(),visit('2',200)]); await db.ingest(a,[visit(),visit('2',200)]);
  await db.ingest(item('https://example.test/research?q=two'),[visit('3',150)]);
  const stats = await db.stats(); assert.equal(stats.urls,2); assert.equal(stats.visits,3); assert.equal(stats.oldest,100);
  const row = (await db.query()).items.find(r=>r.url===a.url);
  assert.equal(row.visitCount,2); assert.equal(row.browserVisitCount,13);
  await db.close();
});
for (const exclusiveEnd of [false,true]) test(`imports >10,000 URLs with timestamp collisions (${exclusiveEnd ? 'exclusive' : 'inclusive'} range end)`, async () => {
  const db = dbFor(); const items = []; const visits = new Map();
  for (let i=0; i<10021; i++) {
    const row = {...item(`https://example.test/page/${i}`), lastVisitTime:999}; items.push(row);
    // 1,205 URLs in a single timestamp bucket forces adaptive maxResults.
    visits.set(row.url,[visit(String(i),i < 1205 ? 500 : i)]);
  }
  const browser = browserFor(items,visits,exclusiveEnd); const importer = new HistoryImporter(db,browser);
  await db.setJob(newImport(20000)); const done = await drain(importer);
  assert.equal(done.status,'complete'); assert.equal((await db.stats()).urls,10021); assert.equal((await db.stats()).visits,10021);
  assert(browser.calls.some(q=>q.maxResults>1000));
  // A whole second import cannot inflate URL or visit totals.
  await db.setJob(newImport(20000)); await drain(importer);
  assert.equal((await db.stats()).visits,10021); await db.close();
});
test('checkpoint and dedup survive importer and database connection restart, and getVisits failure', async () => {
  const db = dbFor(); const rows = [item(),item('https://example.test/b')]; const visits = new Map(rows.map((r,i)=>[r.url,[visit(String(i),100+i)]]));
  const browser = browserFor(rows,visits); let importer = new HistoryImporter(db,browser);
  await db.setJob(newImport(1000)); await importer.step(); await importer.step(1);
  assert.equal((await db.job()).offset,1); await db.close();
  const reconnected = new ArchiveDB(db.name);
  const broken = {...browser,getVisits:async ()=>{throw new Error('Permission revoked');}};
  await assert.rejects(new HistoryImporter(reconnected,broken).step(),/Permission revoked/);
  assert.equal((await reconnected.job()).offset,1);
  importer = new HistoryImporter(reconnected,browser); await drain(importer);
  assert.equal((await reconnected.stats()).visits,2); await reconnected.close();
});
test('ingest and checkpoint abort together on persistence failure', async () => {
  const db = dbFor(); const original = newImport(1000); await db.setJob(original);
  // Non-cloneable checkpoint simulates transaction failure after visit writes were queued.
  await assert.rejects(db.ingest(item(),[visit()],{...original,invalid:()=>{}}));
  assert.equal((await db.stats()).visits,0); assert.deepEqual(await db.job(),original); await db.close();
});
test('manual multi-project/tag assignments, filtering, ordering, renames and deletes', async () => {
  const db = dbFor(); const a=item(); const b=item('https://other.test/b','Other notes');
  await db.ingest(a,[visit()]); await db.ingest(b,[visit('2',200)]);
  await db.saveLabel('projects',null,'Research'); await db.saveLabel('projects',null,'Reading'); await db.saveLabel('tags',null,'Review');
  let stats=await db.stats(); const [p,q]=stats.projects, [t]=stats.tags;
  await db.assign([a.url],'projects',p.id); await db.assign([a.url],'projects',q.id); await db.assign([a.url],'tags',t.id);
  assert.equal((await db.query({text:'research example',project:p.id,tag:t.id,domain:'example',from:90,to:101})).total,1);
  assert.equal((await db.query({text:'missing research'})).total,0);
  assert.equal((await db.query({unassigned:true})).items[0].url,b.url);
  assert.equal((await db.query({sort:'title'})).items[0].url,b.url);
  assert.equal((await db.query({sort:'recent'})).items[0].url,b.url);
  await db.saveLabel('projects',p.id,'Renamed'); await assert.rejects(db.saveLabel('projects',null,'Renamed'),/already exists/);
  await db.ingest(a,[visit(),visit('3',300)]); // capture preserves assignments
  assert.equal((await db.query({project:p.id})).total,1);
  await db.deleteLabel('projects',p.id); assert.equal((await db.query({project:p.id})).total,0); assert.equal((await db.stats()).urls,2);
  await db.assign([a.url],'tags',t.id,true); assert.equal((await db.query({tag:t.id})).total,0);
  await assert.rejects(db.assign([a.url],'projects','missing'),/no longer exists/); await db.close();
});
test('50-record pagination never requires retaining all results', async () => {
  const db=dbFor(); for(let i=0;i<105;i++) await db.ingest(item(`https://example.test/${i}`),[visit(`${i}`,100+i)]);
  const a=await db.query(), b=await db.query({page:1}), c=await db.query({page:2});
  assert.equal(a.total,105); assert.equal(a.items.length,50); assert.equal(b.items.length,50); assert.equal(c.items.length,5);
  assert.equal(new Set([...a.items,...b.items,...c.items].map(r=>r.url)).size,105); await db.close();
});
test('forget markers block old reimports, permit new visits, and full deletion clears URL markers', async () => {
  const db=dbFor(); const a=item(); await db.ingest(a,[visit()]); await db.enqueue(a); await db.setJob(newImport());
  await db.forget([a.url],200); assert.equal((await db.stats()).urls,0); assert.equal(await db.job(),undefined);
  await db.ingest(a,[visit(),visit('2',250)]); assert.equal((await db.stats()).visits,1);
  await db.forget(null,300); await db.ingest(a,[visit(),visit('2',250)]); assert.equal((await db.stats()).urls,0);
  assert.equal(await db.tx(['suppressed'],'readonly',s=>request(s.suppressed.count())),0);
  await db.ingest(a,[visit('3',350)]); assert.equal((await db.stats()).visits,1); await db.close();
});
test('unsupported schema version is rejected without resetting private data', async () => {
  const db=dbFor(); await db.ingest(item(),[visit()]); await db.close();
  const future=await new Promise((res,rej)=>{const r=indexedDB.open(db.name,2);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}); future.close();
  await assert.rejects(db.open(),{name:'VersionError'});
});

test('missing optional visit timestamps are reported as a coverage gap', async () => {
  const db=dbFor(); const browser={search:async()=>[item()],getVisits:async()=>[{visitId:'missing-time'}]};
  await db.setJob(newImport(1000)); const done=await drain(new HistoryImporter(db,browser));
  assert.equal(done.unavailable,1); assert.equal((await db.stats()).visits,0); await db.close();
});
