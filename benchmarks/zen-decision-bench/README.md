# ZenDecisionBench Evidence Store

This directory is reserved for committed benchmark manifests and small, reviewable evidence summaries.

Do not commit credentials, private user filenames/content, large raw provider dumps, or generated caches.

A benchmark result is evidence only when it records:

- dataset version/hash;
- runner commit;
- provider/model identifier;
- prompt/template version;
- decoding/settings;
- timestamp;
- split and case count;
- retry policy;
- cost source/method.

The 12-case smoke fixture under `research/zen-decision-bench/fixtures/` is CI/reproducibility scaffolding and is **not benchmark evidence**.
