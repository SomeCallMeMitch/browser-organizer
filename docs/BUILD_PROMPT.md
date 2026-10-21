# Browser Organizer — build instruction for the next chat

Build Browser Organizer as a working, standalone Chrome extension. Start implementation in this chat; do not stop after a proposal or a visual mockup. Work through the milestones below in order, preserving a useful, tested checkpoint and an actionable handoff if the full scope cannot fit in one session.

## 1. Start with the repository

Canonical repository: https://github.com/SomeCallMeMitch/browser-organizer

Verify the remote, default/current branch, latest commits, working-tree changes, and relevant open issues and pull requests. Read AGENTS.md, README.md, docs/STATUS.md, docs/ROADMAP.md, docs/DECISIONS.md, docs/architecture.md, and this build brief. The current repository state takes precedence over this starting brief. Preserve existing work and follow AGENTS.md for branches, validation, and documentation.

If access is blocked, explain exactly what cannot be verified and continue only with reliable work. Never invent a successful commit, test, installation, or release.

## 2. Product goal and boundaries

Create a practical tool for finding old research and managing open tabs across windows in the connected Chrome profile. Core features must work locally without ChatGPT, a paid subscription, an API key, a server, or a Base44 account.

The desired combination is:
- A history explorer with useful search, filters, sorting, projects, and tags.
- An archive of history available at installation plus future browsing while the extension is enabled.
- A live manager for tabs, windows, and tab groups.
- Saved workspaces, automatic safety snapshots before extension-initiated rearrangement, and portable backups.

Existing history tools inspired the feature list; implement our own design and code. REA (https://github.com/morluto/rea) is an optional development aid for a specific unresolved investigation. Do not install it by default, make it a product dependency, or copy proprietary implementations.

This is a native extension project. It needs Chrome extension APIs and extension-local storage rather than Base44 Entities/Core SDKs. Use the allowed React/Tailwind/shadcn/lucide stack where practical; do not add unrelated runtime libraries. Use minimal necessary build/test tooling and record the choices. Never invent SDK methods. If a standing Base44 restriction prevents a required native capability, explain the conflict and identify the smallest exception before proceeding with that dependency.

## 3. Architecture and implementation quality

Verify current Chrome documentation before choosing API details, permissions, history pagination, persistence behavior, and packaging.

Use Manifest V3 with an extension dashboard and service worker. Prefer IndexedDB for the history archive and substantial workspace data, with chrome.storage.local for small settings where appropriate. Keep a browser adapter, persistence layer, domain models, and React components separate.

Persist durable state; service-worker memory is not a database. Make startup, worker restart, imports, and event processing idempotent. Register listeners correctly for worker lifecycle behavior. Version the schema and backup format, and provide safe migration/error behavior. Use stable internal IDs; Chrome tab/window/group IDs are temporary references, not durable workspace identities.

Request only permissions needed for implemented functionality. Explain each permission in the README and onboarding. Avoid broad page-content access, content scraping, remote scripts, and cloud services for the initial release. Bundle assets and follow extension CSP. Handle browser API failures and revoked permissions without silent data loss.

Use defensive null checks, accessible controls, loading/progress states, empty states, useful errors, and small focused components. Do not add broad try/catch wrappers; handle expected promise failures at clear operation boundaries and report partial success honestly.

## 4. History explorer

On explicit onboarding permission, import all history the browser currently exposes. Do not impose an arbitrary 10,000-record limit, silently truncate, or promise recovery of history Chrome no longer retains. Show import progress, counts, coverage dates, and any gaps or failures. Keep the UI responsive, allow retry, and make interrupted imports resumable.

Define the archive data model carefully: distinguish URLs, visit events, visit counts, last-visit timestamps, and import coverage. Verify API semantics before choosing pagination. Use stable deduplication keys and handle timestamp-boundary collisions; never inflate counts by treating repeated imports as new visits.

Capture future history events while enabled. Distinguish browser deletion events from explicit deletion in the extension. Choose and document a clear policy for whether clearing Chrome history also clears archived records; explain it during onboarding and provide explicit local archive deletion. Do not silently repopulate intentionally deleted archived data on a later import. Document extension-disabled periods and other capture gaps.

Provide:
- Search over stored titles and URLs, including multiple words.
- Filters for date range, domain, project, tag, and unassigned records.
- Sorting by recency, title, domain, and visit count, with clear meanings.
- Bulk assignment of projects and tags.
- URL-level results with visit details where available.
- Pagination or efficient rendering suited to large archives.
- Exact duplicate URL handling without deleting distinct visits or conflating meaningful query parameters.

Start with reliable metadata search. Page-content search, semantic search, and AI summaries are later enhancements.

## 5. Projects, tags, and rules

Allow project and tag creation, renaming, deletion, and multi-project membership. Rules can propose or apply assignments based on domain, URL patterns, and title keywords. Show why a rule matched, allow a preview before bulk application, and preserve manual assignments according to a documented precedence rule.

Use neutral synthetic projects in committed fixtures. Let me create or rename my own projects during use. Personal browsing records, project URLs, and browser snapshots must never be committed.

## 6. Live tabs and windows

Show accessible normal Chrome windows, tabs, groups, pinned state, and duplicate candidates. Background/minimized windows should be included when the browser API exposes them. State profile/incognito scope clearly; do not imply access to other profiles.

Support selecting tabs, assigning projects, creating/renaming/coloring groups, grouping in current windows, and consolidating selected topics into dedicated windows. Show a concrete preview before bulk changes: source, destination, affected tabs, pinned-tab treatment, and proposed group names.

Take a durable pre-operation snapshot before any extension-initiated tab mutation. If that snapshot fails, do not mutate tabs. Preserve pinned tabs and the organizer dashboard by default. Never close duplicates automatically. Closing tabs requires an explicit selection and confirmation.

Validate the plan against current browser state before applying it; handle tabs moving or closing meanwhile. Serialize or otherwise coordinate conflicting operations. If an operation partly fails, retain the recovery snapshot and show exactly what succeeded, failed, and can be retried. Do not claim atomic rollback.

## 7. Saved workspaces and recovery

Save named workspaces containing ordered windows and tabs, URLs, titles where available, pinned states, group names/colors, and useful layout metadata. Allow manual snapshots and label automatic pre-operation snapshots by date and action. Keep a bounded, disclosed automatic retention policy while preserving manually saved workspaces.

Make additive restoration into new windows the safe default. Restore order, grouping, pinned state, and window layout on a best-effort basis. Remap saved identities to newly created browser IDs. Show a restore preview and results. Skip/report unsupported or unsafe URLs; never execute javascript: URLs or imported HTML.

Restoration reopens pages; it does not guarantee unsent forms, authenticated sessions, page memory, scroll position, exact monitor placement, or recovery after profile loss. Say this plainly in the UI and docs. Saving in extension storage alone is not an independent backup.

## 8. Portable backups and privacy

Export/import versioned JSON containing projects, tags, rules, archive data, settings, and saved workspaces. Validate structure, types, sizes, schema version, and URL schemes before import. Preview counts and choose merge or replace; default to merge. Make replace clearly destructive, protect existing data, and prevent partial imports from corrupting the database.

Offer a history CSV export if it fits after reliable JSON backup/restore; protect against spreadsheet formula injection. Exported files contain private browsing data: explain this when exporting. Render titles and imported values as text, never trusted markup.

No analytics, external AI calls, account requirement, API keys, or server storage by default. Keep private archives and backups outside Git. Document that local data can be lost if the extension/profile is removed and recommend periodic exported backups.

## 9. Dashboard experience

Create a polished desktop dashboard with History, Open Tabs, Workspaces, Projects/Tags, and Settings/Backup sections. Prioritize fast search, clear filters, bulk actions, readable lists, and trustworthy progress/results. Include keyboard accessibility, visible focus, labeled controls, and responsive layouts.

The toolbar action should open/focus the organizer. Provide a useful onboarding flow for permission, initial import, archive retention/deletion behavior, and backups. A development-only synthetic demo mode may help testing, but make it unmistakable and never present demo data as imported history.

## 10. Build order and acceptance criteria

Milestone 1: runnable extension foundation, storage schema, permission onboarding, initial history import, continuous capture, and searchable/filterable history with projects/tags.

Milestone 2: manual workspace snapshots and validated JSON export/import, including a tested recovery path.

Milestone 3: live tab inventory, safe previews, durable pre-operation snapshots, grouping, consolidation, and additive workspace restoration.

Milestone 4: robustness, performance, accessibility, packaging, installation instructions, and a release checklist. Keep AI and advanced content search on a later roadmap.

Implement real persistence and browser behavior, not placeholder buttons. If time is limited, finish and validate the earliest milestone, record remaining acceptance criteria, and make the next action explicit.

## 11. Validation and delivery

Use synthetic fixtures and a disposable browser profile. Do not rearrange my real browser as an implicit test.

Test high-risk behavior: history imports exceeding an API page limit, repeated/interrupted imports and timestamp boundaries; visit counting; assignment rules; worker restart; deletion policy; malformed/unsupported backups and merge conflicts; snapshot persistence failure blocking mutation; disappearing tabs and partial operations; and snapshot/export/import/restore round trips preserving order, groups, and pinned states.

Check extension build, manifest, packaged assets, CSP, and startup. Run browser integration tests where tooling permits and document manual checks for inaccessible Chrome features. Do not call an operation tested merely because a mock passed.

Provide a loadable unpacked build and source, reproducible commands and lockfile, and instructions for chrome://extensions → Developer mode → Load unpacked. Do not publish to the Chrome Web Store or claim installation on my computer without a separate request and a successful result.

Before ending, review the diff and check for secrets/private data. Update STATUS, ROADMAP, WORKLOG, DECISIONS, and architecture as appropriate. Commit and push on a task branch and open a reviewable PR under AGENTS.md; never force-push or merge without authorization.

Report what is implemented, what was actually tested, what still requires manual verification, repository/PR/commit links, and the next concrete action.

Begin now by inspecting the repository, briefly stating the current milestone and any blocker, then implement.
