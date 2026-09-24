export async function installMainReadinessListenerBeforeReady(
  installListener: () => Promise<() => void>,
  markReady: () => Promise<void>,
  isDisposed: () => boolean
): Promise<(() => void) | undefined> {
  const unlisten = await installListener();
  if (isDisposed()) {
    unlisten();
    return undefined;
  }

  try {
    await markReady();
  } catch (error) {
    unlisten();
    throw error;
  }

  if (isDisposed()) {
    unlisten();
    return undefined;
  }
  return unlisten;
}
