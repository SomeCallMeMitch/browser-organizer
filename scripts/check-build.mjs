import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
const manifest = JSON.parse(await readFile('dist/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);
assert.deepEqual(manifest.permissions,['alarms','unlimitedStorage']);
assert.deepEqual(manifest.optional_permissions,['history']);
assert.equal(manifest.host_permissions,undefined);
assert.equal(manifest.incognito,'not_allowed');
for(const name of ['worker.js','dashboard.js','dashboard.css','dashboard.html']) assert((await stat(`dist/${name}`)).size>0);
const html=await readFile('dist/dashboard.html','utf8');
assert(!/<script[^>]*>([^<]+)<\/script>/.test(html),'No inline script');
for (const filename of await readdir('dist')) {
  if (!filename.endsWith('.js')) continue;
  const source=await readFile(`dist/${filename}`,'utf8');
  assert(!/\beval\(/.test(source),`${filename}: no eval`);
  assert(!/\bfetch\(/.test(source),`${filename}: no external requests`);
}
console.log('Manifest, bundled assets, no host permissions / remote requests / eval: PASS');
