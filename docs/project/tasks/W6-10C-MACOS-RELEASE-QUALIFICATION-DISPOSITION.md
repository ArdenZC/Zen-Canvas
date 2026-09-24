# W6-10C — macOS Release Qualification — Owner Disposition

Status: **DEFERRED / UNVERIFIED — OWNER SKIPPED**

## Decision

W6-10C macOS Release Qualification is not executed in this release-reentry
cycle because no real supported Apple Silicon macOS host is available.

This disposition means:

- macOS RC1 release qualification is **UNVERIFIED**;
- macOS is **not** accepted as PASS;
- no macOS product defect is demonstrated by this disposition;
- PR #256 is closed without merge;
- Issue #255 is closed as not planned for this cycle;
- RC1 remains unchanged;
- full supported-platform native/release PASS remains **NOT CLAIMED**.

## Release implication

The frozen W6-10 qualification matrix requires a real supported Mac GUI host for
a macOS GO. Skipping W6-10C therefore prevents a truthful
**full supported-platform release acceptance** under the current Windows +
macOS support policy.

A future macOS release claim requires a new explicit qualification task on a
real supported Apple Silicon Mac. Hosted CI/build success does not replace that
evidence.

If the Owner later wants to publish Windows-only, that requires a separate
explicit release-scope/support-policy decision. This disposition does not
silently remove macOS from the declared supported product targets.

## Windows state

W6-10B remains independently:

**BLOCKED — SECURITY PRESENTATION EVIDENCE HOST REQUIRED**

RC1 clean-profile/self-generated-state startup, relaunch and reinstall gates
passed. B02 SmartScreen and B03 Unknown Publisher/UAC remain UNVERIFIED because
the available Windows host/Sandbox do not provide a valid default
security-presentation environment.

This remains an evidence-host gap, not an RC1 product failure.

## Publication

Publication remains:

**DEFERRED — DO NOT PUBLISH**

No tag or GitHub Release is authorized by this disposition.
