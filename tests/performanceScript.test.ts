import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("performance benchmark script", () => {
  it("runs the 100k SQLite benchmark with all required query scenarios", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");

    expect(source).toContain("fts_benchmark_100k");
    expect(source).toContain("english_search");
    expect(source).toContain("cjk_search");
    expect(source).toContain("extension_search");
    expect(source).toContain("scope_query");
    expect(source).toContain("filter_query");
    expect(source).toContain("query_filter_query");
  });

  it("runs the Task 02 repository and bounded hash IO gates with a reduced fixture", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "scripts/runPerformanceTest.mjs"), "utf8");

    expect(source).toContain("performance_100k_files_schema_28_to_29_and_wal_reader");
    expect(source).toContain("performance_task02_repository_100k_and_group_pages");
    expect(source).toContain("performance_task02_hash_io_1000x16mib_1_worker_and_default_workers");
    expect(source).toContain('ZC_TASK02_IO_FILES: "16"');
    expect(source).toContain('ZC_TASK02_IO_BYTES: "1048576"');
  });
});
