# ZDB-03B2B — Owner Blind Adjudication Freeze

Status: **OWNER BLIND ADJUDICATION FROZEN — HISTORY UNSEEN AT FREEZE**

Issue: #283.

This artifact was authored after ZDB-03B2A produced a deterministic target-to-profile assignment, but before the Owner inspected History content or History generator semantics.

## Frozen inputs

- B1 Profile canonical SHA-256: `371519fe7c9f28d3c686e0299c223d64a57b00571777cab498668667498137b1`
- B1 Target canonical SHA-256: `96f975ef10148a49f47068c578dd76ccd69ab3cf3f81167de2e227de32b735c4`
- B2A Assignment canonical SHA-256: `4833443e85bf2a69c74b175b8e618a98eebab6444f1da05418fbf926582d6a0b`
- Assignment seed: `27418e52bb5e483ef523d2cdc1045dfb17a1ec45238b8f0cf67d431f0163bfaf`

## Frozen adjudication

- Records: **120**
- Canonical SHA-256: `498a511c4cfba87daaed7db5197c35aed96de34862feede43c500d9eb5d3ad50`
- File SHA-256: `7f87770e30dae42a735b26b620209fabcd59eac1e449aad528de68523d56abbf`
- Git blob at freeze: `1946fc65c4b2efa2086cfd5d0916eaaea7f5e949`
- Explicit User Truth authority cases: **6**
- deterministic Safety authority cases: **6**
- Owner material-ambiguity abstentions: **4**
- Owner profile-informed judgments: **28**
- Owner semantic judgments without matching profile tendency: **76**

The frozen adjudication has exactly four gold-abstain cases: `zdb03b-target-049`, `-051`, `-054`, and `-114`.

Thirty-three cases had one matching Profile tendency available for Owner inspection; only 28 final judgments are categorized as profile-informed because current explicit/safety authority or stronger target semantics may supersede a soft tendency. No script derives gold mechanically from `preferred_value`.

## Blindness boundary

The Owner used only:

1. frozen Profile Pack;
2. frozen Target Pack;
3. deterministic Assignment;
4. current Explicit User Truth and deterministic Safety fixtures embedded in the Target Pack.

At adjudication freeze, the Owner had **not inspected**:

- `history.v1.jsonl`;
- instantiated History decisions/support;
- History-to-target applicability;
- resolver output using History;
- Generative provider predictions.

The adjudication record itself carries `adjudication_blindness = history_unseen`.

## Next gate

With this adjudication hash frozen, the Owner may now inspect the already-frozen B2A History artifact against the pre-registered History template.

The adjudication must not change in response to History.

Provider execution remains unauthorized until History review and B2 assembled-corpus freeze complete.
