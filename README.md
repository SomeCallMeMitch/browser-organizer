# Browser Organizer

A standalone, local Chrome extension for finding old research and organizing it into projects and tags. No ChatGPT subscription, account, API key, server, Base44 backend or REA is required.

**v0.1 development checkpoint:** Milestone 1 is implemented: an independent history archive, search/filters, visit details, projects and tags. Portable backups, workspace recovery and tab operations are not implemented yet. See [STATUS](docs/STATUS.md) for verified results and remaining checks. No store release or installation on your computer has occurred.

## Build and load in Chrome

Use Node 22+ and npm. All runtime assets are bundled; npm is needed to build, not to use the extension.

```sh
git clone https://github.com/SomeCallMeMitch/browser-organizer.git
cd browser-organizer
git switch feat/local-history-foundation
npm ci
npm run check
```

1. Open `chrome://extensions` in Chrome 120 or newer.
2. Enable **Developer mode**, select **Load unpacked**, and choose this repository's `dist` folder. Keep that folder in a stable location.
3. Click the extension's toolbar action (pin it if helpful). It opens/focuses the dashboard.
4. Read the independent-archive policy, check the acknowledgement, then click **Allow history & start import**. Approve Chrome's history permission prompt.
5. Leave the dashboard open for faster importing. Progress is checkpointed. With it closed, the worker continues small batches through a 30-second alarm; Chrome may delay alarms. Pause/resume from the dashboard.

To use a packaged build, unzip `browser-organizer-unpacked-v0.1.0.zip` and load the extracted `browser-organizer` folder containing manifest.json. Do not try to load the ZIP itself. `npm run package` generates unpacked and source ZIPs under artifacts/ (Python 3 required). After rebuilding, click Reload on chrome://extensions and reload the dashboard. Rebuilding preserves the installed extension database as long as the extension identity/path is retained; uninstalling it does not.

## What works in this milestone

- Import currently exposed history without an arbitrary 10,000-record ceiling. Crowded timestamps are handled by overlapping time subdivision and adaptive query sizes. Interrupted imports resume; repeat imports do not add duplicate visits.
- Capture future visits while enabled and authorized. Pending events and checkpoints are persisted in IndexedDB. The UI reports API/storage errors and missing visit details.
- Search all words across titles and exact URLs; filter by domain substring, last archived visit dates, project, tag or no project. Sort by recency, title, domain or archived visit count. Results show 50 URLs per page with visit details.
- Create, rename and delete projects/tags; add/remove assignments to up to 50 selected records at a time. Pages can belong to multiple projects. Assignments survive later imports.
- Explicitly forget selected records or the entire history archive without changing Chrome history. Old forgotten visits stay excluded on future imports; new visits remain eligible.

Domain search is a substring filter. Date bounds apply to the **last archived visit per URL**, in your local timezone. “Archived visits” counts distinct saved visit events; Chrome's reported visit total is displayed separately in details. Query parameters and fragments are preserved rather than merged.

## Privacy, retention and limitations

**Clearing Chrome history does not delete this independent archive.** Delete archived records here with Forget. Selected deletion keeps a private URL/cutoff marker so reimport cannot restore old visits. Forget all clears URL markers and retains a single cutoff timestamp; projects and tags stay. Capture continues for new visits. There is no automatic retention expiry in v0.1.

The archive covers what Chrome exposes plus events captured while enabled. Chrome cannot recover expired/deleted history through this extension. Incognito and other Chrome profiles are excluded. Synced history exposed by Chrome can include visits from other devices; visit details show the origin flag when provided. Disabled periods, revoked permissions, disk failures and browser-event gaps can miss visits; reimport reconciles what is still available. Because history events fire before load, titles can be missing or stale until a later import.

All data stays in this extension's IndexedDB. There are no analytics, remote scripts, page scraping, content scripts, cloud uploads or AI calls. Titles/URLs render as text; only http/https results are clickable. No private history, browser profiles or backups belong in Git.

**Local storage is not a backup.** Removing the extension/profile or losing the device can erase data. Portable JSON backups and workspace snapshots are the next milestone and are not available in v0.1. Do not rely on this development build as the only copy of important research. Safe grouping, consolidation and restoration will follow after the backup milestone; this build performs no bulk browser mutations.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `history` (optional) | Read history metadata and visits after explicit onboarding permission. Although Chrome grants a read/write history API, this extension never calls history deletion or addition APIs in production. Synthetic browser tests do so only in a disposable profile. |
| `alarms` | Resume durable import/capture work after the dashboard closes or the worker restarts. |
| `unlimitedStorage` | Keep substantial IndexedDB archives without ordinary quota/eviction limits. This does not protect against uninstall, profile loss, disk-full or device loss. |

No `tabs`, `tabGroups`, host, browsing-data, downloads or storage permission is requested in this milestone. The toolbar uses Chrome's full-page options route. Small settings live alongside checkpoints in IndexedDB, so chrome.storage is not needed yet.

## Development and validation

```sh
npm ci
npm run check
npx playwright install --with-deps chromium
npm run test:browser
npm run package
```

React, Tailwind and lucide provide the UI. Native Chrome APIs and IndexedDB replace Base44 SDKs, as authorized by the build brief. esbuild, Tailwind CLI, Playwright and fake-indexeddb are build/test tooling only. Dependencies are pinned in package-lock.json. No runtime network access is required.

[Validation instructions](docs/VALIDATION.md) distinguish synthetic tests from native Chrome checks. GitHub Actions uploads the loadable dist directory and synthetic screenshots. Browser automation always uses a fresh test profile, never your connected browser. Packaging includes only dist assets and Git-tracked source; it excludes profiles and private data.

## Project record

- [Working rules](AGENTS.md)
- [Current state / next action](docs/STATUS.md)
- [Build instructions](docs/BUILD_PROMPT.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/DECISIONS.md)
- [Implemented architecture](docs/architecture.md)
- [Verified API references](docs/API_NOTES.md)
- [Validation](docs/VALIDATION.md)
- [Worklog](docs/WORKLOG.md)

Repository: https://github.com/SomeCallMeMitch/browser-organizer
