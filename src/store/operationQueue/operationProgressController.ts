import { tauriApi } from "../../api/tauriApi";
import { makeTranslator } from "../../i18n";
import { localizedStableError, readableError } from "../../utils/viewHelpers";
import { useAppStore } from "../useAppStore";
import type { OperationQueueControllerContext } from "./controllerTypes";

function currentT() {
  return makeTranslator(useAppStore.getState().language);
}

export function initializeOperationQueue({ get, set }: OperationQueueControllerContext): Promise<void> {
  if (get().listenersRegistered) return Promise.resolve();
  const registrationPromise = get().registrationPromise;
  if (registrationPromise) return registrationPromise;

  const promise = (async () => {
    try {
      await get().loadPersistedOperationLogs();
      const unlistener = await tauriApi.onOperationProgress((payload) => {
        if (get().activeOperationKind !== payload.kind) return;
        set({ operationProgress: payload });
      });
      set({ listenersRegistered: true, registrationPromise: null, unlistener });
    } catch (error) {
      set({ registrationPromise: null });
      useAppStore.getState().showError(readableError(error));
    }
  })();
  set({ registrationPromise: promise });
  return promise;
}

export async function cancelOperations({ get, set }: OperationQueueControllerContext): Promise<void> {
  if (!get().activeOperationKind) return;
  set({ isOperationCanceling: true });
  try {
    await tauriApi.cancelOperations();
  } catch (error) {
    set({ isOperationCanceling: false });
    useAppStore.getState().showError(localizedStableError(error, currentT()));
  }
}
