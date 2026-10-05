import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const read=(path:string)=>readFileSync(path,"utf8");
it("PM-02B retains one wake/deadline coordinator and existing Background admission",()=>{
 const runtime=read("src-tauri/src/db/automation/runtime.rs");
 expect(runtime.match(/\.spawn\(/g)).toHaveLength(1);
 expect(runtime).toContain("Condvar"); expect(runtime).toContain("wait_while");
 expect(runtime).toContain("WorkClass::Background"); expect(runtime).toContain("acquire_with_backpressure");
 expect(runtime).not.toMatch(/thread::sleep|interval|tokio::time|NotifyWatcher|ReadDirectoryChanges/);
 for(const path of ["runtime.rs","calendar.rs","trigger_state.rs"]){
  expect(read(`src-tauri/src/db/automation/${path}`)).not.toMatch(/execute_organization_plan|dry_run_organization|update_organization_plan_decisions|Command::new|reqwest|create_dir|remove_file|fs::write/);
 }
 expect(read("src/views/automation/useAutomationIntents.ts")).toContain("onAutomationUpdated");
 expect(read("src/views/automation/useAutomationIntents.ts")).not.toMatch(/setInterval|setTimeout/);
});
it("PM-02B has exactly schema37 and native resume hints without polling",()=>{
 expect(read("src-tauri/src/db/schema.rs")).toContain("CURRENT_SCHEMA_VERSION: i32 = 37");
 const adapter=read("src-tauri/src/platform/windows/automation_resume.rs");
 expect(adapter).toContain("PowerRegisterSuspendResumeNotification");
 expect(adapter).toContain("PowerUnregisterSuspendResumeNotification");
 expect(adapter).not.toMatch(/thread::spawn|sleep\(|SetWaitableTimer|SELECT|UPDATE|INSERT/);
});
