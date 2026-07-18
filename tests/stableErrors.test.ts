import { describe, expect, it } from "vitest";
import { makeTranslator } from "../src/i18n";
import { localizedStableError } from "../src/utils/viewHelpers";

describe("stable error codes", () => {
  it("maps filesystem and credential codes through the active locale", () => {
    const zh = makeTranslator("zh");
    const en = makeTranslator("en");

    expect(localizedStableError(new Error("source_changed"), zh)).toContain("文件");
    expect(localizedStableError("atomic_noreplace_unsupported", en)).toContain("filesystem");
    expect(localizedStableError("credential_transaction_lock_poisoned", en)).toContain("credential");
    expect(localizedStableError("watcher_retry_exhausted", zh)).toContain("文件监听");
    expect(localizedStableError("source_claim_recovery_required: claim", zh)).toContain("待恢复");
    expect(localizedStableError("unsupported_platform_linux", en)).toContain("unsupported");
    expect(localizedStableError("target_committed_source_delete_failed: denied", en)).toContain("manual review");
    expect(localizedStableError("copy_verification_failed", en)).toContain("identity verification");
    expect(localizedStableError("target_parent_durability_unknown", zh)).toContain("持久化");
  });

  it("preserves unknown technical details for diagnostics", () => {
    expect(localizedStableError("provider_timeout", makeTranslator("en"))).toBe("provider_timeout");
  });
});
