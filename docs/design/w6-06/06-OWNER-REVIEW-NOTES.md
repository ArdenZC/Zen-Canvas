# Unified UI Grammar owner review notes

Decision: **Changes required; candidate not frozen.**

The candidate is directionally strong and materially better than the earlier theme-based exploration. It establishes a coherent metric, spatial, state and overlay language. The remaining concerns are refinement issues that materially affect perceived product quality if frozen prematurely.

## Binding owner follow-up

The owner explicitly rejected underline-based focus. The earlier proposal for row-name underlines, short bottom control bars and inset field accent lines is **superseded and prohibited**.

Current focus direction:

- object/navigation: quiet focus tonal surface + restrained identity foreground emphasis;
- selected+focus: distinct selected-focus tone;
- buttons/IconButtons/segments: focus surface/foreground, with primary action staying in its primary family;
- fields/search/select: the existing 1px boundary changes to the focus role;
- switches: the existing track boundary/tone strengthens;
- Forced Colors may use the operating system's native outline.

Do not use text underline focus, short bottom focus bars, inner field accent lines, rails, glow or decorative perimeter frames.

Other required refinements remain:

1. Selection shares tone/rhythm but not a universal check marker across navigation, segmented choices, file selection and switches.
2. Secondary toolbar chrome should not become uniformly bordered; visible boundaries are reserved for fields and cases where discoverability/grouping needs them.
3. Switches should not show an On/Off word by default when the setting label already provides semantic context.
4. Compact UI-copy remains separate from explanatory 14/24 prose.
5. Selection markers use a reserved structural slot, not a trailing overlay.
6. Coherence means shared metrics/tone/hierarchy, not identical anatomy for different interaction semantics.

Do not activate W6-07 or implementation. The no-underline grammar/specimen must return for owner review. After owner approval, the next design step is a File Library flagship target composition using the accepted system.
