# W4-07 — W4 Closeout Activation

Status: **AUTHORIZED / NEXT — DOCS / GOVERNANCE ONLY**

Last verified: 2026-09-02

## Entry condition

W4-07 activates only after the W4-06 evidence audit/current-truth PR merges.

The W4-06 branch was created from:

- `master@9ea11809fa60732c110d60cce183f2f52c235194`;
- tree `d91e018a25796155660e294e8886976f2bb2dd3b`.

W4-07 work must use the exact post-merge master produced by the W4-06 closeout PR, not the pre-merge baseline above.

## Objective

W4-07 is the final W4 documentation/governance closeout.

It must not create new native functionality or reopen closed platform tracks.

Required final record:

- W4-00 through W4-06 completion states;
- final runtime/architecture merge baselines;
- accepted macOS native Quick Look scope;
- accepted Windows Explorer Preview Handler scope and 16-extension association matrix;
- final Windows installed-product/genuine Explorer acceptance authority;
- packaging state;
- explicit unsigned distribution/signing-notarization disposition from W4-05;
- W4-06 accepted native QA evidence;
- residual manual/fixture `UNVERIFIED` boundaries;
- final W4 supported native host / format matrix;
- exact relevant CI/artifact identities where already frozen;
- W5 handoff eligibility decision.

## Non-goals

W4-07 must not:

- modify production source;
- modify CI/release workflows;
- modify installer/registration logic;
- add signing/notarization integration;
- rerun the W4-04 installer matrix;
- invent accessibility/display PASS evidence;
- create provider/cloud fixtures;
- bump version;
- create a tag or GitHub Release;
- activate W5 before the final W4 closeout record is reviewed and merged.

## Current residual evidence truth

The final W4 record must preserve, not erase, W4-06 residual boundaries.

Examples include:

- macOS Retina/display-scale manual QA — `UNVERIFIED`;
- macOS multi-display — `UNVERIFIED`;
- macOS VoiceOver — `UNVERIFIED`;
- genuine iCloud/File Provider/external/network fixtures — `UNVERIFIED`;
- Windows DPI transition — `UNVERIFIED`;
- Windows multi-display — `UNVERIFIED`;
- Windows Narrator — `UNVERIFIED`;
- genuine native keyboard/focus rows where only controlled contracts exist — `UNVERIFIED`.

These are evidence boundaries, not silently accepted PASS claims and not current product defects.

## Packaging/signing truth

Carry forward the W4-05 product decision exactly:

- Windows/macOS engineering artifacts may remain unsigned;
- Windows Authenticode is deferred / not planned in the current horizon;
- Apple Developer ID is deferred / not planned in the current horizon;
- Apple notarization/stapling is deferred / not planned in the current horizon;
- W4 did not publish a public GitHub Release;
- final public release policy remains a future W5 concern.

## W5 boundary

W4-07 may make W5 **eligible for a separate activation** only after:

1. the W4 closeout record is internally consistent with live master;
2. no W4 implementation track remains active;
3. residual `UNVERIFIED` facts are recorded without fabrication;
4. W4 signing/packaging truth is explicit;
5. the docs-only W4-07 closeout PR passes governance validation and merges.

W4-07 does not itself implement W5.

## Expected deliverable

A concise canonical W4 current-truth/closeout record rather than another implementation taskbook.

Prefer references to existing W4-01/W4-02/W4-03/W4-04/W4-05/W4-06 current-truth documents over copying their full histories.

The closeout should reduce ambiguity, not duplicate every historical remediation detail.
