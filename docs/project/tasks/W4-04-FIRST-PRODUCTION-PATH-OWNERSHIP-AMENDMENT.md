# W4-04 — First Production Preview-Handler Path Ownership Amendment

Status: **AUTHORIZED GOVERNANCE AMENDMENT — W4-04 implementation remains blocked until this amendment is independently accepted and merged**

Amendment base: `master@3f3d17c6f28cc2dd351b71528d31d4492858b68a`; tree `010c81e21a7bb03e944c87914d40af160038ffbb`.

This is a narrow binding amendment to:

- `W4-04-WINDOWS-EXPLORER-PREVIEW-HANDLER-PRODUCTION-INTEGRATION-CODEX.md`; and
- `W4-04-EXECUTION-BASELINE-AMENDMENT.md`.

It supersedes only the original W4-04 requirement that the first production implementation must recognize and migrate an unspecified earlier Zen-owned `InprocServer32` DLL path. Every other W4-04 product, architecture, identity, supported-format, foreign-ownership, installer, real-Explorer and acceptance requirement remains binding.

If this amendment appears to conflict with another W4-04 requirement outside the path-provenance scope below, **STOP** rather than broadening its meaning.

## 1. Why this amendment is required

W4-04 is the first Track that creates the durable production Windows Preview Handler identity and installed production DLL path.

Before W4-04 merges, Zen Canvas has no released production Preview Handler installation whose previous `InprocServer32` path can be proven as durable product-owned history.

W4-03 v1/v2 identities, HKCU seams, controlled harness paths and spike artifacts are test/evidence history. They are **not** a prior installed production path contract and MUST NOT be imported as ownership authority.

The original W4-04 taskbook nevertheless required an upgrade-state fixture that could use “an old installed DLL path” and required that Zen replace “Zen's own old InprocServer32 path.” In the absence of a frozen historical production path, an implementation cannot prove that an arbitrary non-current filesystem path is Zen-owned merely because surrounding CLSID/AppID/friendly-name markers still look like Zen.

Treating those surrounding markers as delete/migration authority creates an elevated foreign-file risk: a third party or corrupted state could leave the Zen registry markers intact while changing `InprocServer32` to an unrelated DLL path.

Therefore W4-04 must prefer exact, provable ownership over hypothetical first-release migration.

## 2. Binding W4-04 first-production ownership rule

For the first W4-04 production release, the canonical installed handler path remains the path frozen by the package/registration contract under the Zen installation root, conceptually:

```text
$INSTDIR\native\zen_canvas_windows_preview_handler.dll
```

The exact package representation remains governed by the existing registration/build contracts.

At install, same-version repair and uninstall:

- an absent production Preview Handler core is fresh/unowned;
- an exact complete Zen production core whose `InprocServer32` equals the current canonical installed DLL path is Zen-owned and may be converged/idempotently repaired;
- a present-empty `InprocServer32` is inconsistent and must fail closed;
- any non-empty `InprocServer32` path that differs from the current canonical installed path is **not proven Zen-owned for W4-04** and must fail closed before destructive mutation;
- the installer/uninstaller must preserve that unexpected path and must not probe it as trusted delete authority, delete the file, overwrite it, or infer ownership from its directory/name;
- other Zen-looking CLSID/AppID/friendly-name/ThreadingModel/PreviewHandlers markers do not by themselves upgrade an unexpected filesystem path into Zen-owned file authority.

Forbidden ownership heuristics include, but are not limited to:

- path contains `Zen`;
- path is under `Program Files`;
- filename resembles the current handler;
- surrounding registry markers are Zen-owned while the path itself is non-current.

This rule applies only to the handler DLL path provenance. Existing exact-value foreign-handler protections for association slots, default applications and other registry ownership remain unchanged.

## 3. Superseded original taskbook clauses

For W4-04 only, the following original expectations are superseded:

### 3.1 Safe install / repair / upgrade-state fixture

The first-production W4-04 registration layer is **not required to migrate an arbitrary simulated old handler DLL path** when there is no durable released production path authority proving that path belonged to Zen.

Instead, its deterministic registration tests must prove:

- current canonical Zen-owned state is idempotent;
- missing/unowned matrix slots converge normally;
- foreign association slots are preserved;
- current canonical `InprocServer32` is accepted;
- present-empty `InprocServer32` fails closed;
- unexpected non-current `InprocServer32` fails closed with zero filesystem delete authority and preserves the path/file;
- uninstall also fails closed rather than deleting or rewriting an unexpected non-current handler path.

### 3.2 Registration deterministic test #10

The original “old Zen DLL path/subset matrix converges correctly” test is replaced for W4-04 by a **first-production non-current-path preservation** fixture.

The fixture must prove that a complete Zen-looking core with an unexpected non-current `InprocServer32` does not grant delete/migration authority.

This replacement does not weaken the requirement to converge the 16-extension matrix when the production core itself is current/exact.

## 4. W4-05 owns the first real cross-version path migration

After W4-04 has shipped/closed with a concrete production installed path, W4-05 may use that exact released W4-04 path as a real historical ownership authority.

Any W4-05 cross-version migration must:

- name the exact previous released Zen path/identity it recognizes;
- prove the source installation is Zen-owned using durable product metadata rather than path heuristics;
- preserve foreign mutations;
- migrate only explicitly recognized prior Zen state;
- include real signed/cross-version installer evidence required by W4-05.

W4-05 must not retroactively broaden W4-04's first-release installer into accepting arbitrary historical paths.

## 5. Installer lifecycle requirements are otherwise unchanged

This amendment makes **no change** to W4-04 requirements for:

- production CLSID, Friendly Name, Prevhost AppID or `ThreadingModel=Apartment`;
- exact 16-extension production matrix;
- per-machine x64 registration;
- `SystemFileAssociations` conflict-safe strategy;
- no `UserChoice`, default-ProgID or OpenWith takeover;
- normal Low-IL `prevhost.exe` isolation;
- ADR-0006 capture-before-defer and 512 KiB ingress ceiling;
- bounded Preview DLL release without global Explorer/prevhost termination;
- safe same-version repair of the current W4-04 production state;
- rollback-safe exact registry mutation owned by the W4-04 registration layer;
- truthful incomplete-state reporting when broader generated installer/file operations cannot be safely represented as fully rolled back;
- real installed Explorer Preview acceptance;
- clean normal uninstall without reboot-required success claims;
- W4-05/W4-06/W4-07 boundaries.

This amendment does not authorize a custom installer architecture by itself and does not weaken any real installed acceptance gate.

## 6. Implementation/test consequence

Once this amendment is merged, the accepted W4-04 production planner and NSIS implementation should encode a single rule:

```text
current canonical handler path => exact Zen-owned path authority
unexpected non-current path    => fail closed / preserve / no delete authority
```

Tests that intentionally require `C:\Old Zen\...` or another invented non-current path to migrate must be removed or rewritten to reflect this amended first-production contract.

No production code may claim support for a previous released Zen Preview Handler path until such a release actually exists and W4-05 freezes it as an input.

## 7. Validation / delivery

This amendment is docs/governance-only.

Required validation before acceptance:

```text
npm run test:docs
npm run test:governance
git diff --check
git diff --check origin/master...HEAD
```

The PR must prove:

- exact base is `3f3d17c6f28cc2dd351b71528d31d4492858b68a` / `010c81e21a7bb03e944c87914d40af160038ffbb`;
- only this amendment file changes;
- W4-04 is still the first production Preview Handler release;
- no production code/config/package/installer/CI file changes;
- every W4-04 requirement outside first-production non-current path migration remains unchanged;
- W4-05+ remain gated.

Open as Draft. Do not merge until independent governance review has blockers = 0 and docs/governance CI is successful.

After merge, the W4-04 implementation/remediation lineage must incorporate this amendment into its final merge ancestry before W4-04 acceptance. The amendment does not authorize Ready/Merge of PR #159 by itself.