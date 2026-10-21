import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
function event() {const listeners=[]; return {listeners,addListener:f=>listeners.push(f),emit:(...args)=>listeners.forEach(f=>f(...args))};}
function fakeChrome(data, permitted = false) {
  const api = {
    runtime:{id:'synthetic-extension',onInstalled:event(),onStartup:event(),onMessage:event(),openOptionsPage:async()=>{}},
    action:{onClicked:event()},alarms:{onAlarm:event(),create:async()=>{}},
    permissions:{onAdded:event(),onRemoved:event(),contains:async()=>api.permitted},
    history:{onVisited:event(),onVisitRemoved:event(),search:async()=>[...data.values()].map(x=>x.item),getVisits:async({url})=>data.get(url)?.visits||[]},
    permitted
  }; return api;
}
function send(api,type,payload) {
  return new Promise(resolve=>api.runtime.onMessage.listeners[0]({type,payload},{id:api.runtime.id},resolve)).then(result=>{
    if (!result.ok) throw new Error(result.error); return result.data;
  });
}
test('worker listeners, consent gating, continuous capture, revocation queue, restart and browser deletion policy',async()=>{
  const a={id:'1',url:'https://example.test/synthetic',title:'Synthetic research'};
  const data=new Map([[a.url,{item:a,visits:[{visitId:'v1',visitTime:100,isLocal:true}]}]]);
  let api=globalThis.chrome=fakeChrome(data);
  await import(`../src/worker.js?test=${crypto.randomUUID()}`);
  assert.equal(api.history.onVisited.listeners.length,1); // registration at evaluation, not after an async read
  api.history.onVisited.emit(a);
  assert.equal((await send(api,'status')).stats.urls,0);
  await assert.rejects(send(api,'enable'),/Allow history access/);
  api.permitted=true; await send(api,'enable');
  for(let i=0;i<5;i++) await send(api,'tick');
  assert.equal((await send(api,'status')).stats.visits,1);
  data.get(a.url).visits.push({visitId:'v2',visitTime:200,isLocal:true}); api.history.onVisited.emit(a);
  assert.equal((await send(api,'status')).stats.visits,2);
  api.history.onVisitRemoved.emit({allHistory:true});
  const retained=await send(api,'status'); assert.equal(retained.stats.visits,2); assert.equal(retained.state.browserDeletion.allHistory,true);
  api.permitted=false; api.permissions.onRemoved.emit({permissions:['history']});
  data.get(a.url).visits.push({visitId:'v3',visitTime:300}); api.history.onVisited.emit(a);
  const paused=await send(api,'status'); assert.equal(paused.stats.pending,1); assert.equal(paused.stats.visits,2); assert(paused.state.permissionLostAt);
  // Re-evaluate the worker with no in-memory tail/importer/listeners, same IndexedDB.
  api=globalThis.chrome=fakeChrome(data,true); await import(`../src/worker.js?test=${crypto.randomUUID()}`);
  await send(api,'tick'); const resumed=await send(api,'status'); assert.equal(resumed.stats.visits,3); assert.equal(resumed.stats.pending,0);
  await assert.rejects(send(api,'forget',{urls:null}),/confirmation/);
  await send(api,'forget',{urls:null,confirm:'FORGET'});
  await send(api,'import'); for(let i=0;i<5;i++) await send(api,'tick');
  assert.equal((await send(api,'status')).stats.visits,0);
});
