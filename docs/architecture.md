# Architecture

## Implemented in v0.1

Manifest V3, Chrome 120+, a bundled React/Tailwind/lucide dashboard and an ES module service worker. Native Chrome APIs replace platform-specific Base44 SDKs. No runtime server, account, network request, content script or AI dependency. The toolbar delegates open/focus to `runtime.openOptionsPage`. Only alarms/unlimitedStorage are required; history is optional and requested in the dashboard's direct click handler.

### Modules

- `src/browser/chrome.js`: Chrome metadata-history adapter and dashboard route.
- `src/domain/importer.js`: browser-independent interval traversal and resumable import units.
- `src/storage/db.js`: IndexedDB schema, atomic ingestion/checkpoints, metadata query and manual assignments.
- `src/worker.js`: synchronous event registration, single serialized write/operation queue, messages, alarms and error boundaries.
- `src/ui/`: local React dashboard, onboarding, search, label editing, deletion and capture/import status.

All persistent access is owned by the worker. UI messages are accepted only from this extension ID. A worker-local promise queue serializes imports, events, assignments and deletion; durable state does not depend on that queue surviving. Chrome starts one worker for the extension. There are no tab mutation APIs in this milestone.

### IndexedDB schema v1

| Store | Identity and contents |
| --- | --- |
| `urls` | Exact URL primary key; title, normalized search title, domain, first/last archived visit timestamps, archive visit count, separate Chrome-reported count, project/tag ID arrays. Indexed sort keys include the URL for deterministic ties. |
| `visits` | JSON tuple of exact URL and Chrome visitId. Timestamp, transition and isLocal origin flag. An index supports per-URL visit retrieval. Reimport overwrites only changed event metadata; it never sums aggregate counts. |
| `projects`, `tags` | Stable UUID and user-editable name; unique names checked per collection. Manual additive multi-membership. Deleting a label removes assignments, never history. |
| `meta` | Consent, revision, deletion cutoff, capture errors/gaps and browser-deletion observation; import ranges/position plus a separate staged page. The staged page is written once; per-URL checkpoints do not rewrite it. |
| `pending` | Latest queued HistoryItem per exact URL. `getVisits` reconciles all available events before acknowledging it. |
| `suppressed` | Per-URL deletion cutoff timestamps. Full archive deletion clears these URL markers and sets one global cutoff. |

New installs create v1 transactionally. Unexpected newer database versions fail to open; they are not reset. Future migrations must bump the schema and test upgrade/abort paths. No chrome.storage permission is needed because the few settings share IndexedDB with consistency-sensitive work. Unlimited storage reduces eviction/quota risk but cannot prevent full disks or data loss on removal.

### History import and counting

An import fixes an end time, starts at epoch zero, and stores a stack of unprocessed time intervals. Each search explicitly requests 1,000 URLs. A saturated interval splits in half, deliberately overlapping the boundary. A saturated interval no wider than 1ms instead doubles maxResults until the returned page is smaller. Reaching the signed API integer capacity produces a visible error rather than skipping collisions. No product limit on the archive size is imposed.

A non-saturated page is staged durably. Each URL's getVisits response is reconciled by stable keys; URL totals derive from saved events. Visit writes and the next offset commit in one IndexedDB transaction. Killing the worker before commit retries the same URL; killing it after commit resumes the next offset. Search failures stop at a visible retryable checkpoint. Empty getVisits results increment an unavailable-details counter.

The current worker processes up to 20 import URLs and 10 pending capture URLs per tick. Dashboard polling accelerates ticks while open; a 30-second repeating alarm continues background progress. Alarms are checked/recreated on evaluation and startup, and may run late. Import pauses do not pause future-event capture. A very large archive can import slowly with the dashboard closed.

Chrome returns URL aggregates and visit events with different semantics; HistoryItem.lastVisitTime is never used as a pagination cursor. The scan traverses currently exposed results, not a complete lifetime history promise. Capture/delete events and the search dataset can change during a scan. Reimport reconciles available history; it cannot reconstruct an unavailable gap. See [API notes](API_NOTES.md).

### Capture, deletion and privacy

History listeners register at module evaluation, with an additional registration check after optional permission grant if the namespace was absent initially. Capture first durably queues the HistoryItem, then reconciles visits and acknowledges it. If the worker dies between reconciliation and acknowledgement, replay is idempotent. A Chrome API failure retains the pending item and reports an error; an empty visit response is acknowledged as a counted gap. There remains an unavoidable browser-event-to-first-durable-write window. Startup/disabled periods do not prove continuous capture.

Chrome history deletions are observed (last time/all-vs-URL/count) without propagating them into the independent archive. Browser partial-range deletions are not all surfaced by the API; we do not claim a complete audit. Explicit extension deletion removes records and visits, cancels the current import and stores a cutoff to suppress old reimports. Future visits after that cutoff remain eligible. No Chrome history modification API is called in production.

Search scans a sorted IndexedDB cursor in the worker, retaining only 50 result objects while counting matches. Text matches all whitespace-separated words across title/URL; domain is a substring; dates apply to the URL's last archived visit. This bounds UI DOM/memory, but broad queries still scan O(N) records and run serially with worker operations. Million-record performance and per-URL histories with huge visit counts need later measurement/optimization. Details currently load all archived visits for one URL.

React renders values as text. Only http/https result links are navigable. CSP blocks network connections and remote scripts. Incognito is disabled; only the current profile's exposed history is read, including synced visits when Chrome returns them.

## Planned, not implemented

Milestone 2 introduces schema/format-versioned JSON export/import, transactional validation/merge/replace and manual workspace snapshots. Imported URL schemes/sizes/types must be validated before any writes. Backups contain private data and stay outside Git. Rules with preview/explanations and manual-assignment precedence remain pending.

Milestone 3 adds live inventory and safe mutations. Every mutation must first commit a durable snapshot and pass a user-reviewed plan with current-state validation. Persisted workspace UUIDs must be independent of temporary Chrome IDs. Preserve pinned/organizer tabs by default, serialize conflicting actions, report partial results and never claim atomic browser rollback. Restoration is additive into new windows and skips unsafe URLs. No automatic duplicate closure.

Manual workspaces must survive automatic-retention pruning. The automatic snapshot limit, metadata model and detailed restore behavior will be decided when implemented. Restored pages cannot guarantee forms, authenticated sessions, page memory, scroll positions or exact monitor placement.
