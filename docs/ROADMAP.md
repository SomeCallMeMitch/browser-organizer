# Roadmap

Full requirements are in [BUILD_PROMPT](BUILD_PROMPT.md). “Implemented” does not mean installed, released, or manually accepted.

1. **Foundation and history — implemented; automated validation passed.** MV3, local schema, optional permission onboarding, resumable available-history import, continuous capture, metadata search/filter/sort/pagination, manual projects/tags and explicit forgetting. All 11 Node tests, build checks and disposable native Chrome integration pass. Native optional prompt/revocation and forced mid-import termination remain manual checks in [VALIDATION](VALIDATION.md); current results are in STATUS.
2. **Backups — next / not started.** Manual workspace snapshots and versioned JSON export/import with type/size/scheme validation, merge/replace preview, transaction integrity and tested recovery round trips. Before calling this complete, test malformed/future backups and conflicting IDs. Add assignment-rule previews/explanations and additive manual precedence after backup safety is established.
3. **Tabs and recovery — not started.** Live normal-profile tabs/windows/groups, duplicate candidates without automatic closure, concrete operation previews, durable pre-operation snapshots that block mutations on failure, grouping/consolidation and additive restore. Test pins/order/groups, disappearing tabs, concurrency and honest partial results. Choose/disclose bounded automatic snapshot retention while preserving manual workspaces.
4. **Release readiness — not started (build/install instructions added early).** Native performance/accessibility checks, packaging, recovery documentation and full disposable-profile acceptance. Do not publish or merge without authorization. No store release exists.

Later: optional AI, semantic/content search, archive analytics, formula-safe CSV export. No mandatory paid service or REA dependency.
