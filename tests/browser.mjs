// Real Chromium extension integration. Never attaches to an existing user profile.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('artifacts/browser-tests'); await mkdir(root,{recursive:true});
// Keep the OS temp directory short: Unix domain sockets have a ~108-byte path limit.
// Set TMPDIR explicitly to a short writable path only in restricted local runtimes.
const profiles = new WeakMap();
const launch = async (extension, existingProfile) => {
  const profile=existingProfile || await mkdtemp(path.join(root,'profile-'));
  const context = await chromium.launchPersistentContext(profile,{channel: 'chromium', ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath: process.env.CHROMIUM_EXECUTABLE} : {}), headless:true,
    ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox','--disable-dev-shm-usage']});
  profiles.set(context,profile); return context;
};
const workerFor = async context => context.serviceWorkers()[0] || context.waitForEvent('serviceworker',{timeout:15000});
const open = async context => { const worker=await workerFor(context); const id=new URL(worker.url()).host; const page=await context.newPage(); await page.goto(`chrome-extension://${id}/dashboard.html`); return {worker,id,page}; };
const call = (page,type,payload) => page.evaluate(async ({type,payload}) => {
  const result=await chrome.runtime.sendMessage({type,payload}); if(!result?.ok) throw new Error(result?.error || 'Worker response missing'); return result.data;
},{type,payload});
const syntheticRows = page => call(page,'query',{domain:'example.test'});
const syntheticVisitCount = async page => (await syntheticRows(page)).items.reduce((sum,row)=>sum+row.visitCount,0);
const until = async (action, predicate, label) => {
  const end=Date.now()+20000;
  while(Date.now()<end){const value=await action();if(predicate(value))return value;await new Promise(r=>setTimeout(r,100));}
  throw new Error(`Timed out: ${label}`);
};
const errors=[];
const track=page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};
// First load the exact production build: validate startup/CSP and consent gating.
const production=await launch(path.resolve('dist'));
try {
  const {page,worker}=await open(production); track(page);
  await page.getByText('Keep your research within reach.',{exact:true}).waitFor();
  assert.equal((await call(page,'status')).permission,false);
  await assert.rejects(call(page,'enable'),/Allow history access/);
  await worker.evaluate(()=>chrome.runtime.openOptionsPage());
  await worker.evaluate(()=>chrome.runtime.openOptionsPage());
  assert.equal(production.pages().filter(p=>p.url().endsWith('/dashboard.html')).length,1,'Toolbar route focuses the existing dashboard');
  await page.screenshot({path:path.join(root,'onboarding.png'),fullPage:true});
  console.log('PASS production manifest: startup, onboarding, consent gate, options focus, CSP');
} finally {await production.close();}
// Only this disposable fixture elevates optional history permission to required.
// The native user-facing permission prompt remains a manual check.
const fixture=await mkdtemp(path.join(root,'extension-')); await cp('dist',fixture,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(fixture,'manifest.json'),'utf8'));
manifest.permissions.push('history'); manifest.optional_permissions=[];
await writeFile(path.join(fixture,'manifest.json'),JSON.stringify(manifest));
let context=await launch(fixture);
try {
  let {page,worker}=await open(context); track(page);
  await worker.evaluate(async()=>{
    await chrome.history.addUrl({url:'https://example.test/research?q=one'});
    await chrome.history.addUrl({url:'https://example.test/research?q=two'});
  });
  await page.getByRole('checkbox',{name:/I understand/}).check();
  await page.getByRole('button',{name:'Allow history & start import'}).click();
  await until(()=>call(page,'status'),s=>s.job?.status==='complete','initial available history import');
  assert.equal((await syntheticRows(page)).total,2); assert.equal(await syntheticVisitCount(page),2);
  await call(page,'import'); await until(()=>call(page,'status'),s=>s.job?.status==='complete','repeat import');
  assert.equal(await syntheticVisitCount(page),2);
  await call(page,'label:save',{kind:'projects',name:'Synthetic Research'});
  await call(page,'label:save',{kind:'tags',name:'Synthetic Review'});
  const labels=(await call(page,'status')).stats;
  await call(page,'assign',{urls:['https://example.test/research?q=one'],kind:'projects',id:labels.projects[0].id});
  assert.equal((await call(page,'query',{text:'example research',project:labels.projects[0].id})).total,1);
  await worker.evaluate(()=>chrome.history.addUrl({url:'https://example.test/future'}));
  await until(()=>syntheticRows(page),s=>s.total===3,'onVisited continuous capture');
  await worker.evaluate(()=>chrome.history.deleteAll());
  await until(()=>call(page,'status'),s=>s.state.browserDeletion?.allHistory,'browser deletion event');
  assert.equal((await syntheticRows(page)).total,3,'independent archive retained');
  await page.getByRole('button',{name:'Projects & tags'}).click();
  await page.getByText('Synthetic Research',{exact:true}).waitFor();
  await page.getByRole('button',{name:'History',exact:false}).first().click();
  await page.getByLabel('Search titles and URLs').fill('research one');
  await page.getByRole('cell',{name:'https://example.test/research?q=one',exact:false}).waitFor();
  await page.screenshot({path:path.join(root,'history.png'),fullPage:true});
  // A browser restart terminates the worker and reopens the same disposable profile.
  const profilePath=profiles.get(context); await context.close();
  context=await launch(fixture,profilePath); ({page,worker}=await open(context)); track(page);
  assert.equal((await syntheticRows(page)).total,3);
  await call(page,'forget',{urls:['https://example.test/research?q=one'],confirm:'FORGET'});
  assert.equal((await syntheticRows(page)).total,2);
  console.log('PASS elevated synthetic fixture: real Chrome history import/reimport, capture, browser deletion retention, assignments, search UI, browser/worker restart persistence, forget');
} finally {await context.close();}
assert.deepEqual(errors,[],'No uncaught UI errors or CSP violations');
console.log('PASS browser integration. Native optional permission prompt and forced worker termination require manual checks.');
