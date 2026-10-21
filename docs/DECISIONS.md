# Decisions

## 2026-10-21 — Repository and continuity

**Adopted:** https://github.com/SomeCallMeMitch/browser-organizer is the canonical project record. Initialize documentation on main in the empty repository; use task branches and PRs thereafter. Keep state and next actions in STATUS; do not rely on chat memory.

## 2026-10-21 — Product direction

**Requested direction:** A standalone local Chrome extension combining history search/organization, tabs/windows, workspaces and backups. Core operation must not require ChatGPT or paid AI. No private browsing data in Git.

**Proposed, not yet API/runtime verified:** Manifest V3, React UI, IndexedDB archive, chrome.storage.local settings, additive restoration, least-privilege permissions. Verify platform details and resolve any applicable Base44 tooling restriction during implementation.

## 2026-10-21 — REA

**Recommendation carried forward:** REA (morluto/rea) is optional for a specific investigation, not a dependency or prerequisite. No new REA evaluation or runtime test was performed for this handoff.

## 2026-10-21 — Implemented foundation choices

**Adopted for v0.1:** Native MV3, Chrome 120+, React/Tailwind/lucide UI, IndexedDB schema v1 and esbuild. These native APIs and minimal build/test tools are the smallest platform exceptions explicitly authorized by BUILD_PROMPT; no Base44 backend is introduced. REA is unused and optional.

History is an optional onboarding permission. Required alarms resume work; unlimitedStorage protects a substantial archive from ordinary quota/eviction. No tabs/hosts/storage permissions are needed yet. Small settings remain in IndexedDB for consistency and fewer permissions.

Keep the archive independent of Chrome deletion; explain that before consent. Explicit forgetting removes visit records and uses timestamp cutoffs to prevent old reimports while admitting new visits. Full forgetting clears URL suppression markers. Archive retention is indefinite until explicit deletion; automatic snapshots/retention do not exist yet.

Do not paginate using HistoryItem.lastVisitTime. Split saturated time intervals with overlap, expand queries within a crowded millisecond, and deduplicate URL+visitId. Derive archived counts from stored events; keep Chrome's aggregate separate. A staged page and transactional per-URL checkpoints allow restart without inflated totals.

Initial search is metadata-only, date filters use last archived visit, pages contain 50 results, and assignments are manual/additive. Rule previews and portable backups follow as recorded roadmap items. Search currently scans a sorted cursor, so large native-profile performance remains an explicit validation task.

**Validation boundary:** Node tests emulate IndexedDB and Chrome events. A real-browser script and CI workflow are included; native optional permission prompt acceptance remains a manual test. A local Chromium launch in this restricted workspace exited with SIGTRAP before startup; that attempt is not counted as a passed integration test.
