# Task 02A Specification Closeout

- 基线：PR #23 合并提交 `1bc9ead144601892feb13feaf53a6a6137df3904`
- 分支：`remediation/02a-durable-dedupe-spec`
- 本 PR 只包含整改任务书、执行索引和风险登记，不修改生产代码、schema、依赖或测试。
- Task 02A 目标：schema 29、独立 watcher rule recovery fact、durable dedupe run/error ledger、single-worker queue、durable cancel/revision 和 startup recovery。
- Task 02A 明确不包含：prehash、hard-link、physical identity mapping、duplicate groups、reclaimable bytes 或删除动作。
- Task 02B、02C 和 Task 03 继续禁止执行。
- Task 02A 只有在本任务书 PR 合并到 `master` 后才获得生产实施授权。
