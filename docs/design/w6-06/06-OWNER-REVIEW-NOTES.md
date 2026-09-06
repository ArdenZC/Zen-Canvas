# Unified UI Grammar owner review notes

Decision: **Changes required; candidate not frozen.**

The candidate is directionally strong and materially better than the earlier theme-based exploration. It establishes a coherent metric, spatial, state and overlay language. The remaining concerns are no longer broad inconsistency; they are refinement issues that would materially affect perceived product quality if frozen prematurely.

Required refinements:

1. Selection should share tone/rhythm but not a universal check marker across navigation, segmented choices, file selection and switches.
2. Focus should remain subtle without full frames, but control-type geometry should differ: row-name underline; short bottom control bar for buttons/toggles; inset field focus accent for fields/search/select.
3. Secondary toolbar chrome should not become uniformly bordered; visible boundaries should be reserved for fields and cases where discoverability/grouping needs them.
4. Switches should not show an On/Off word by default when the setting label already provides the semantic context.
5. Add a compact UI-copy type role separate from explanatory 14/24 prose to avoid vertical looseness in dense Settings/Inspector contexts.
6. Selection markers need a reserved structural slot when used; do not position them as a trailing overlay that can collide with columns.
7. State explicitly that coherence means shared metrics/tone/hierarchy, not identical anatomy for different interaction semantics.

Do not activate W6-07 or implementation. Revise the grammar/specimen, re-run the same browser/interaction validation, and return for owner review. After owner approval, the next design step is a File Library flagship target composition using the frozen system.
