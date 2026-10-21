# Proposed architecture

This is a build brief, not an implemented or API-verified system.

- **Extension dashboard:** React UI for history, live tabs, projects/tags, workspaces and backups.
- **Manifest V3 worker:** Browser event listeners and coordinated operations; durable state survives worker termination.
- **Browser adapter:** Chrome history, tabs, windows, groups and permission interactions; exact APIs/permissions to verify against current official documentation.
- **Persistence:** Proposed IndexedDB for archives/workspaces; chrome.storage.local for small settings; versioned schema and migrations.
- **Data models:** Separate URL records from visits; stable project/tag/workspace IDs; saved tab order and group metadata with remapped runtime browser IDs.
- **Recovery:** Durable snapshot before extension-driven mutations; operation preview; partial-failure reporting; additive restore by default; portable versioned JSON backup.
- **Privacy:** No account/server/AI requirement. No page scraping or broad host access initially. User-facing deletion/retention policy must be explicit. Real data and backups stay out of Git.

Open design work: verify history import pagination and event semantics, archive deletion policy, transactional import strategy, permission list, operation reconciliation and snapshot retention. See [build prompt](BUILD_PROMPT.md).
