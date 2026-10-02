import type { AutomationTrigger } from "../../types/automation";
import type { Translator } from "../../types/ui";
import { inputSurface } from "../../utils/tw";

const daily = [1, 2, 3, 4, 5, 6, 7];
const weekdays = [1, 2, 3, 4, 5];
export function validAutomationTrigger(trigger: AutomationTrigger) {
  if (trigger.kind !== "schedule") return true;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trigger.localTime) || !trigger.weekdays.length) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: trigger.timeZone }).format(0); return true; } catch { return false; }
}

export function AutomationTriggerEditor({ trigger, onChange, disabled, t }: {
  trigger: AutomationTrigger; onChange: (trigger: AutomationTrigger) => void; disabled: boolean; t: Translator;
}) {
  const mode = trigger.kind === "schedule" ? trigger.weekdays.join(",") === daily.join(",") ? "daily" : trigger.weekdays.join(",") === weekdays.join(",") ? "weekdays" : "custom" : "daily";
  return <fieldset disabled={disabled} className="space-y-3">
    <legend className="font-medium">{t("automationIntentTrigger")}</legend>
    <label className="block space-y-1">{t("automationTriggerKind")}
      <select className={`${inputSurface} block w-full`} value={trigger.kind} onChange={(event) => {
        const kind = event.target.value as AutomationTrigger["kind"];
        onChange(kind === "schedule" ? { version: 2, kind, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", localTime: "09:00", weekdays: [...daily] } : { version: 2, kind });
      }}>
        <option value="manual">{t("automationManual")}</option>
        <option value="schedule">{t("automationScheduled")}</option>
        <option value="managed_scope_change">{t("automationFilesChanged")}</option>
      </select>
    </label>
    {trigger.kind === "schedule" && <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">{t("automationScheduleTime")}<input type="time" step={60} required value={trigger.localTime} className={`${inputSurface} block w-full`} onChange={(event) => onChange({ ...trigger, localTime: event.target.value })} /></label>
        <label className="block space-y-1">{t("automationScheduleZone")}<input required value={trigger.timeZone} className={`${inputSurface} block w-full`} onChange={(event) => onChange({ ...trigger, timeZone: event.target.value })} /></label>
      </div>
      <label className="block space-y-1">{t("automationScheduleDays")}<select value={mode} className={`${inputSurface} block w-full`} onChange={(event) => onChange({ ...trigger, weekdays: event.target.value === "daily" ? [...daily] : event.target.value === "weekdays" ? [...weekdays] : [1] })}>
        <option value="daily">{t("automationDaily")}</option><option value="weekdays">{t("automationWeekdays")}</option><option value="custom">{t("automationCustomDays")}</option>
      </select></label>
      {mode === "custom" && <div className="flex flex-wrap gap-3">{daily.map((day) => <label className="flex gap-1" key={day}><input type="checkbox" checked={trigger.weekdays.includes(day)} onChange={(event) => onChange({ ...trigger, weekdays: event.target.checked ? [...trigger.weekdays, day].sort((a, b) => a - b) : trigger.weekdays.filter((value) => value !== day) })} />{t((`automationDay${day}`) as Parameters<Translator>[0])}</label>)}</div>}
      {!validAutomationTrigger(trigger) && <p role="alert">{t("automationInvalidSchedule")}</p>}
      <p className="text-sm opacity-70">{t("automationScheduleHelp")}</p>
    </div>}
    {trigger.kind === "managed_scope_change" && <p className="text-sm opacity-70">{t("automationEventHelp")}</p>}
    {trigger.kind !== "manual" && <p className="text-sm opacity-70">{t("automationAiPermissionHelp")}</p>}
  </fieldset>;
}
