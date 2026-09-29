# ZDB Preference Memory Research

Status: **ZDB-03 OFFLINE RESEARCH CONTRACT ONLY**

This directory is reserved for future ZDB-03 offline preference fixtures and prototype code after the ZDB-03 activation receives Owner Review.

Core invariant:

\`Explicit User Truth != Preference != Rule\`

Preference evidence is:

- synthetic/non-sensitive in Phase 1;
- scoped;
- chronological;
- revisable;
- conflict-aware;
- allowed to abstain.

Preference evidence is not production authority.

## First target

The first implementation slice should focus on:

1. \`existing_folder_choice\`;
2. \`suggested_action\`.

Objective/safety-dominant decisions are controls, not targets for preference override.

## Forbidden

Do not add here:

- production persistence;
- real user history;
- product telemetry;
- connected-account data;
- hidden personalization;
- product runtime imports;
- frozen-test-derived preference rules.

See \`docs/project/tasks/ZDB-03-PREFERENCE-MEMORY-OFFLINE-HYPOTHESIS-ACTIVATION.md\` for the authoritative contract.
