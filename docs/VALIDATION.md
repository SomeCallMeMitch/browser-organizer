# Validation and manual acceptance

Use synthetic records in a disposable profile. Never point tests at a real Chrome profile. No production demo data is bundled.

## Commands

Node 22+ and npm are needed. Python 3 is needed only for ZIP packaging.

```sh
npm ci
npm run check
npx playwright install --with-deps chromium
npm run test:browser
npm run package
```

The Node suite uses fake-indexeddb for actual repository transactions and a mock of the Chrome API. It checks imports above 10,000 URLs, timestamp collisions with inclusive/exclusive boundaries, repeated imports/counts, interrupted connection/checkpoint recovery, permission failure, atomic storage abort, filters/pagination, manual assignments, deletion exclusions, future-schema rejection and simulated worker re-evaluation. Mocked worker restarts are not native Chrome lifecycle validation.

The browser script loads the exact dist manifest first and checks startup/CSP, onboarding and the consent gate. A separate copied extension elevates history to a required permission *only in the disposable fixture*, allowing real `chrome.history` import/capture/deletion tests without automating Chrome's permission prompt. The native optional prompt remains manual. The script tests browser/worker restart persistence by reopening the same disposable test profile. Fixture manifests and profiles stay under ignored artifacts/.

GitHub Actions runs check and browser integration, uploading dist and synthetic screenshots for 14 days. See the task PR for run results. Do not infer a passed browser test from a workflow file merely existing.

## Manual checks before normal use

1. In a new disposable Chrome profile, load dist, click the toolbar icon twice, and confirm one dashboard is focused. Verify readable layout at narrow and wide window sizes; navigate with keyboard and close dialogs with Escape.
2. Check retention acknowledgement, decline history permission, retry, and grant it. Confirm the page remains usable and explains that clearing Chrome history retains the archive.
3. Browse only synthetic example/test pages. Import, pause, close the dashboard, reopen, resume, then reload the extension during import. Confirm counts do not inflate and progress resumes. Inspect worker errors in chrome://extensions.
4. Disable the extension briefly, browse a synthetic page, enable it and import again. Treat disabled time as a possible capture gap, not proof of continuous coverage.
5. Revoke history permission in Chrome settings. Confirm the archive remains searchable, no history API failures are hidden, and regrant/resume works.
6. Clear Chrome history and verify archived records remain. Forget selected records, reimport, then revisit one URL: old visits stay absent, a new visit appears. Forget all to remove URL suppression markers.
7. Create, rename, delete and bulk assign projects/tags. Try multiple words, date bounds, unassigned, sorting and more than 50 results. Verify dates apply to the last archived visit and visit details distinguish archive totals from Chrome's totals.
8. Confirm backups/workspaces/tab operations are clearly unavailable in this milestone. Never rely on extension storage as the only copy of important research.

## Not implemented / not validated yet

Backup validation/merge/replace/round trips, assignment rules, workspace snapshots, mutation safety/partial results, group/window restore, automated accessibility audits, very large native-profile performance, store packaging/release. These belong to later milestones; there is no Chrome Web Store release.

## Recorded result — 2026-10-21

[Passing CI run 39675640647](https://github.com/SomeCallMeMitch/browser-organizer/actions/runs/39675640647), code commit [9bbe7c9](https://github.com/SomeCallMeMitch/browser-organizer/commit/9bbe7c965fb8ebb171d648be36807ace40dd94dc):

- All 11 Node tests passed, including two 10,021-URL import/reimport cases and crowded timestamp expansion, transaction failures/checkpoint recovery, gap reporting, assignment/deletion/filter behavior and simulated worker restart/revocation/alarm preservation.
- Build, manifest, packaged asset and CSP-source checks passed; clean install/audit reported zero vulnerabilities.
- Native Chromium 156 passed production-manifest startup, consent gate, onboarding/CSP and existing-dashboard focus. A separate permission-elevated synthetic fixture passed real history import/reimport, capture, independent Chrome-deletion retention, assignments/search UI, browser/worker restart persistence and Forget.
- Onboarding and filtered history screenshots were visually inspected. No clipping or layout defects were observed. All five local dist files matched the passing CI artifact byte for byte. ZIP contents/integrity were checked; profiles and node_modules are excluded.

This does not claim a real native optional permission prompt was accepted, a permission was revoked in Chrome settings, or a worker was forcibly terminated during an unfinished import. Those remain explicit manual checks. Chrome 120 compatibility, large native-profile performance, narrow-screen/keyboard/screen-reader acceptance and later milestones remain unverified.

Earlier failed runs exposed test-harness socket path length, unexpected internal Chrome history records and a non-unique UI selector. Those harness issues were corrected before the passing run. The initial emulator heap failure was corrected by staging import pages once and avoiding unchanged record rewrites; high-volume repeats now pass.
