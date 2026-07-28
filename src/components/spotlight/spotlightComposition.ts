/**
 * Returns the value that is safe to commit to the backend query stream.
 * Composition updates remain display-only until compositionend, even when a
 * browser reports an IME keyCode of 229 without a reliable isComposing flag.
 */
export function committedSpotlightInput(
  value: string,
  composingRef: boolean,
  nativeIsComposing = false,
  keyCode = 0
): string | null {
  if (composingRef || nativeIsComposing || keyCode === 229) return null;
  return value;
}

export function completedSpotlightComposition(value: string) {
  return value;
}
