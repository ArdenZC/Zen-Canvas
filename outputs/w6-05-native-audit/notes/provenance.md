# W6-05 Provenance

The required `git fetch origin master` completed before the audit.

Governance instruction HEAD:

- commit: `78eac408c4bd812848db0bb0dad73575e8251bb7`
- tree: `371e618dfd3dcb52af5ab4f0d0e64191fe8d384c`

Audited production baseline:

- commit: `ee1163fbf32f23cc95150adca4e1cb5a53081654`
- tree: `57dc0ac45810477c8477542512c3c65a60605fb9`

The exact baseline-to-governance comparison was documentation-only. The changed paths were:

- `docs/project/ROADMAP.md`
- `docs/project/STATUS.md`
- `docs/project/initiatives/W6-product-maturity-audit.md`
- `docs/project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-ACTIVATION.md`
- `docs/project/tasks/W6-05-WHOLE-PRODUCT-NATIVE-EXPERIENCE-AUDIT-CODEX.md`
- `docs/project/tasks/W6-05-WINDOWS-COMPUTER-SURFACE-CONTROL-AMENDMENT.md`

The product was built and launched from the detached production worktree, not from the stale common `master` checkout.
