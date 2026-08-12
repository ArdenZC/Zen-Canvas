export function isBrowserMockEnabled(): boolean {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
  return (Boolean(meta.env?.DEV) || isLocalBrowserPreview()) && !hasTauriRuntime();
}

function hasTauriRuntime(): boolean {
  const candidate = globalThis as typeof globalThis & {
    __TAURI_INTERNALS__?: { transformCallback?: unknown; invoke?: unknown };
    __TAURI__?: unknown;
  };
  return Boolean(
    candidate.__TAURI__
      || (candidate.__TAURI_INTERNALS__
        && typeof candidate.__TAURI_INTERNALS__.transformCallback === "function"
        && typeof candidate.__TAURI_INTERNALS__.invoke === "function")
  );
}

function isLocalBrowserPreview(): boolean {
  const location = globalThis.location;
  if (!location) return false;
  return location.hostname === "localhost"
    || location.hostname === "127.0.0.1"
    || location.hostname === "::1";
}
