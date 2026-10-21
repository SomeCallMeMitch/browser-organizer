# Repository working rules

## Start every task

Verify the exact remote, latest remote state, current branch and working-tree changes. Read this file, README.md, docs/STATUS.md and relevant task/technical documentation. Check relevant open issues and PRs. Preserve unrelated work. If access is unavailable, state what remains unverified.

## Source of truth and workflow

This repository is the project record. Follow the current roadmap unless the user changes scope. Distinguish proposed, implemented, tested and released work. The initial documentation bootstrap is on main because the repository was empty; subsequent work uses a descriptive task branch and a pull request. Commit and push authorized changes. Do not force-push, delete branches, overwrite others' work, or merge without authorization.

## Product constraints

The target is a standalone local Chrome extension with no required ChatGPT subscription, account, cloud service or Base44 backend. Native Chrome APIs are necessary; verify current official API documentation before implementation. Prefer the user's allowed React/Tailwind/shadcn/lucide UI stack; document any required tooling or platform exception. REA is optional, never a required dependency. See docs/BUILD_PROMPT.md for detailed requirements.

Protect user data. Never commit real browsing history, personal snapshots, credentials, API keys or session tokens. Use synthetic fixtures. Avoid analytics and external requests by default. Do not modify the user's live browser as a test. Require durable snapshots and a user-reviewed preview for bulk browser operations; do not close duplicates automatically.

## End every task

Update affected documentation; update STATUS when state, blockers or next action changes. Log substantive work and validation in WORKLOG, and update ROADMAP, DECISIONS and architecture where relevant. Run appropriate validation, review the diff for unintended changes and private data, and commit/push through the workflow. Report anything unsaved or unpublished. Do not create empty commits or repetitive logs when no meaningful change occurred.

STATUS must retain: date, objective, what works, active branch/PR, limitations/blockers, decisions awaiting input, next concrete action, validation, and supporting links.
