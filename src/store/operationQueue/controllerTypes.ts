import type { OperationQueueStore } from "../useOperationQueueStore";

export type OperationQueueGet = () => OperationQueueStore;
export type OperationQueueSet = (
  update:
    | Partial<OperationQueueStore>
    | ((state: OperationQueueStore) => Partial<OperationQueueStore>)
) => void;

export interface OperationQueueControllerContext {
  get: OperationQueueGet;
  set: OperationQueueSet;
}
