import { afterEach, describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { useAppStore } from "../src/store/useAppStore";
import {
  watcherPartialIndexWarningMessage,
  watcherPermissionMessage,
  watcherReconciliationMessage,
  watcherRetryExhaustedMessage
} from "../src/hooks/useFsWatcher";

describe("watcher warning copy", () => {
  afterEach(() => useAppStore.getState().setLanguage("zh"));

  it("keeps reconciliation, retry, permission, and partial states distinct", () => {
    useAppStore.getState().setLanguage("en");
    const retry = watcherRetryExhaustedMessage();
    const reconciliation = watcherReconciliationMessage();
    const permission = watcherPermissionMessage();
    const partial = watcherPartialIndexWarningMessage();

    expect(retry).toContain("failed repeatedly");
    expect(reconciliation).toContain("not fully reconciled");
    expect(permission).toContain("permission");
    expect(partial).not.toBe(retry);
    expect(reconciliation).not.toBe(retry);
    expect(makeTranslator("zh")("watcherReconciliationRequired")).toContain("重新扫描");
    expect(makeTranslator("zh")("watcherReconciliationRequired")).not.toBe(
      makeTranslator("zh")("watcherRetryExhausted")
    );
  });
});
