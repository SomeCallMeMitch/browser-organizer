# Roadmap

All implementation milestones are **proposed / not started**. Full acceptance criteria are in [BUILD_PROMPT.md](BUILD_PROMPT.md).

1. **Foundation and history:** Loadable Manifest V3 extension; durable schema; permission onboarding; complete available-history import with progress and repeat-safe capture; search, date/domain/project/tag filters; project/tag editing. Verify pagination, counts, interruption and worker restarts.
2. **Backups:** Manual workspace snapshots and versioned, validated JSON export/import with merge/replace previews and data integrity checks. Verify round trips and invalid imports.
3. **Tabs and recovery:** Live tab/window/group inventory; operation previews; durable pre-operation snapshots; grouping and project-window consolidation; additive workspace restore. Verify pinned tabs, order, concurrent changes, partial failure and snapshot failure.
4. **Release readiness:** Performance/accessibility checks, packaged build, install/backup instructions, disposable-profile smoke tests and documented limitations. No store publication without a request.

Later: optional AI, semantic/content search, expanded archive analytics, CSV export if not already implemented. No mandatory external service.
