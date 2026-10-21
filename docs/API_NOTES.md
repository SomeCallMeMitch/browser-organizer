# Verified platform references

Consulted 2026-10-21. These are primary sources; the implementation's behavior and limitations are in [architecture](architecture.md). A documentation lookup is not a runtime test.

- [Chrome history](https://developer.chrome.com/docs/extensions/reference/api/history): `search` returns URL-level HistoryItems, default 100 results, optional start/end times; specify startTime 0 to avoid the default last 24 hours. `getVisits` provides visit IDs and timestamps. `visitCount` is Chrome's reported aggregate, not the archive count. `onVisited` fires before load; `onVisitRemoved` identifies URL/all-history removal, not every partial visit-range deletion.
- [Optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions): declare history optional; request from a direct user gesture after explaining retention. No host access is needed for metadata history search.
- [Worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle): memory can disappear; listeners must be registered at evaluation and durable work must checkpoint. The extension targets Chrome 120+.
- [Alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms): Chrome 120 supports a 30-second minimum period; alarms can be delayed. Ensure the alarm exists each worker start. We do not depend on the newer `persistAcrossSessions` flag.
- [Extension storage](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies): IndexedDB works in workers and is shared across extension contexts. Clearing browsing data does not clear extension storage. `unlimitedStorage` exempts quota/eviction limits; removal of the extension/profile and disk failures remain risks.
- [CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy): bundle scripts locally; no eval/remote scripts. Our connect-src is none and no content scripts are installed.
- [Full-page options](https://developer.chrome.com/docs/extensions/develop/ui/options-page): `options_ui.open_in_tab` and `runtime.openOptionsPage` provide the dashboard route without requesting the tabs permission. Repeated toolbar activation asks Chrome to focus that options page.

## Import choices and uncertainty

Chrome exposes no search cursor or total result count. We do not treat a HistoryItem's lastVisitTime as a pagination cursor: URL records can aggregate visits. Saturated search intervals are bisected with overlapping boundaries; once an interval is <=1 millisecond, maxResults doubles until a non-saturated page is returned. The only maximum is the API's signed integer capacity, at which point the import explicitly errors rather than claiming completion. Stable URL/visit-ID keys absorb overlap and repeated scans.

This relies on the documented maxResults contract. The API does not provide a proof that a browser build has exposed every lifetime visit. A finished scan means “scanned the currently exposed history,” not guaranteed complete lifetime coverage. Concurrent browsing/deletion can change results during a scan. Captured events and another explicit import reconcile what is still available. Unavailable visit details are counted as coverage gaps.
