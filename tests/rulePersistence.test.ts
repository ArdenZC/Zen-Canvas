import { describe, expect, it, vi } from "vitest";
import type { Rule } from "../src/types/domain";
import {
  mergeSystemAndUserRules,
  migrateLocalUserRulesToSQLite,
  persistRuleEnabledToggle,
  persistUserRuleDelete,
  removeUserRule,
  setRuleEnabled
} from "../src/store/rulePersistence";

describe("rule persistence helpers", () => {
  it("keeps system rules when hydrating SQLite user rules", () => {
    const system = rule("system-rule", "System", "system");
    const sqliteUser = rule("sqlite-user", "SQLite User", "user");

    const merged = mergeSystemAndUserRules([system], [sqliteUser]);

    expect(merged.map((item) => item.id)).toEqual(["system-rule", "sqlite-user"]);
  });

  it("replaces local user rules when SQLite user rules are available", () => {
    const system = rule("system-rule", "System", "system");
    const localUser = rule("local-user", "Local User", "user");
    const sqliteUser = rule("sqlite-user", "SQLite User", "user");

    const merged = mergeSystemAndUserRules([system, localUser], [sqliteUser]);

    expect(merged.map((item) => item.id)).toEqual(["system-rule", "sqlite-user"]);
  });

  it("migrates local user rules when SQLite is empty", async () => {
    const localUser = rule("local-user", "Local User", "user");
    const savedUser = { ...localUser, name: "Saved User" };
    const saveUserRule = vi.fn(async () => savedUser);

    const savedRules = await migrateLocalUserRulesToSQLite([localUser], saveUserRule);

    expect(saveUserRule).toHaveBeenCalledWith(localUser);
    expect(savedRules).toEqual([savedUser]);
  });

  it("updates enabled state for user rules only", () => {
    const user = rule("user-rule", "User", "user");
    const system = rule("system-rule", "System", "system");

    const toggledUser = setRuleEnabled([user, system], "user-rule", false, "2026-06-21T01:00:00Z");
    const toggledSystem = setRuleEnabled(toggledUser, "system-rule", false, "2026-06-21T02:00:00Z");

    expect(toggledUser.find((item) => item.id === "user-rule")?.enabled).toBe(false);
    expect(toggledUser.find((item) => item.id === "user-rule")?.updated_at).toBe("2026-06-21T01:00:00Z");
    expect(toggledSystem.find((item) => item.id === "system-rule")?.enabled).toBe(true);
  });

  it("fails closed without activating an unsynced toggle when SQLite sync fails", async () => {
    const user = rule("user-rule", "User", "user");
    const saveUserRule = vi.fn(async () => {
      throw new Error("sqlite offline");
    });
    const upsertRule = vi.fn();
    const onSyncError = vi.fn();

    await expect(persistRuleEnabledToggle({
      rule: user,
      enabled: false,
      saveUserRule,
      upsertRule,
      onSyncError,
      nowIso: () => "2026-06-21T03:00:00Z"
    })).rejects.toThrow("sqlite offline");

    expect(saveUserRule).toHaveBeenCalledWith({
      ...user,
      enabled: false,
      updated_at: "2026-06-21T03:00:00Z"
    });
    expect(upsertRule).not.toHaveBeenCalled();
    expect(onSyncError).toHaveBeenCalledOnce();
  });

  it("removes user rules only", () => {
    const user = rule("user-rule", "User", "user");
    const system = rule("system-rule", "System", "system");

    const removedUser = removeUserRule([user, system], "user-rule");
    const removedSystem = removeUserRule([user, system], "system-rule");

    expect(removedUser.map((item) => item.id)).toEqual(["system-rule"]);
    expect(removedSystem.map((item) => item.id)).toEqual(["user-rule", "system-rule"]);
  });

  it("does not remove local rule when SQLite delete fails", async () => {
    const user = rule("user-rule", "User", "user");
    const deleteUserRule = vi.fn(async () => {
      throw new Error("sqlite offline");
    });
    const removeRule = vi.fn();
    const onSyncError = vi.fn();

    await persistUserRuleDelete({
      rule: user,
      deleteUserRule,
      removeRule,
      onSyncError
    });

    expect(deleteUserRule).toHaveBeenCalledWith("user-rule");
    expect(removeRule).not.toHaveBeenCalled();
    expect(onSyncError).toHaveBeenCalledOnce();
  });
});

function rule(id: string, name: string, source: Rule["source"]): Rule {
  return {
    id,
    name,
    source,
    enabled: true,
    priority: source === "system" ? 1000 : 100,
    weight: 50,
    root_operator: "AND",
    groups: [],
    action: {},
    created_at: "2026-06-21T00:00:00Z",
    updated_at: "2026-06-21T00:00:00Z"
  };
}
