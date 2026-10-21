# Decisions

## 2026-10-21 — Repository and continuity

**Adopted:** https://github.com/SomeCallMeMitch/browser-organizer is the canonical project record. Initialize documentation on main in the empty repository; use task branches and PRs thereafter. Keep state and next actions in STATUS; do not rely on chat memory.

## 2026-10-21 — Product direction

**Requested direction:** A standalone local Chrome extension combining history search/organization, tabs/windows, workspaces and backups. Core operation must not require ChatGPT or paid AI. No private browsing data in Git.

**Proposed, not yet API/runtime verified:** Manifest V3, React UI, IndexedDB archive, chrome.storage.local settings, additive restoration, least-privilege permissions. Verify platform details and resolve any applicable Base44 tooling restriction during implementation.

## 2026-10-21 — REA

**Recommendation carried forward:** REA (morluto/rea) is optional for a specific investigation, not a dependency or prerequisite. No new REA evaluation or runtime test was performed for this handoff.
