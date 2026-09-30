import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ACCEPTED_POST_CLOSEOUT_BLOBS, ROOT, START, git, verifyFrozenTree
} from "../preference/signal/screen-inputs.mjs";

const readme = "research/zen-decision-bench/preference/README.md";
const otherFrozenFile = "research/zen-decision-bench/preference/src/resolver.mjs";
let fixtureRoot;

beforeAll(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "zdb-b4-freeze-guard-"));
  const files = git("ls-tree", "-r", "--name-only", START, "research/zen-decision-bench").split("\n");
  for (const file of files) {
    const destination = path.join(fixtureRoot, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(ROOT, file), destination);
  }
});
afterAll(async () => {
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true });
});

async function expectMutationRejected(file) {
  const target = path.join(fixtureRoot, file);
  const original = await readFile(target);
  try {
    await writeFile(target, Buffer.concat([original, Buffer.from("\nunauthorized test drift\n")]));
    await expect(verifyFrozenTree(fixtureRoot)).rejects.toThrow(`STOP:b4:frozen_blob:${file}`);
  } finally {
    await writeFile(target, original);
  }
}

describe("B4 accepted post-closeout freeze guard", () => {
  it("accepts the repository with exactly one pinned post-closeout blob and the original START", async () => {
    expect(START).toBe("0fc3751de02a4acab07ff45dbd6523c8efa35a65");
    expect(ACCEPTED_POST_CLOSEOUT_BLOBS).toEqual({
      [readme]: "6545ea8d46b4214865c0674a2627485aabafb45c"
    });
    expect(git("hash-object", readme)).toBe(ACCEPTED_POST_CLOSEOUT_BLOBS[readme]);
    expect(await verifyFrozenTree()).toEqual({
      checked_files: git("ls-tree", "-r", START, "research/zen-decision-bench").split("\n").length,
      hash_drift: 0,
      starting_tree: git("rev-parse", `${START}^{tree}`)
    });
  });
  it("rejects README drift after the accepted #310 blob", async () => {
    await expectMutationRejected(readme);
  });
  it("still rejects drift in another frozen pre-B4 file", async () => {
    await expectMutationRejected(otherFrozenFile);
  });
});
