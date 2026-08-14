export type ListenerCleanup = () => void | Promise<void>;
export type ListenerRegistration = () => Promise<ListenerCleanup>;

async function cleanupInReverse(cleanups: readonly ListenerCleanup[]) {
  let firstError: unknown;
  for (const cleanup of [...cleanups].reverse()) {
    try {
      await cleanup();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError !== undefined) throw firstError;
}

/**
 * Registers a listener group sequentially. A partial registration is never
 * published: every completed registration is rolled back in reverse order
 * when a later registration fails.
 */
export async function registerListenerGroup(
  registrations: readonly ListenerRegistration[]
): Promise<() => Promise<void>> {
  const cleanups: ListenerCleanup[] = [];
  try {
    for (const register of registrations) {
      const cleanup = await register();
      if (typeof cleanup !== "function") throw new Error("Listener registration did not return a cleanup function.");
      cleanups.push(cleanup);
    }
  } catch (error) {
    try {
      await cleanupInReverse(cleanups);
    } catch {
      // Preserve the registration error while still attempting every cleanup.
    }
    throw error;
  }

  let cleanupPromise: Promise<void> | null = null;
  return () => {
    cleanupPromise ??= cleanupInReverse(cleanups).catch(() => {
      // Listener cleanup is best effort at teardown; every cleanup was still attempted.
    });
    return cleanupPromise;
  };
}
