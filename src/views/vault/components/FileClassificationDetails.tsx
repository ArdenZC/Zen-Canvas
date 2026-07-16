import { useEffect, useState } from "react";
import { tauriApi } from "../../../api/tauriApi";
import { useAppStore } from "../../../store/useAppStore";
import { useFileLibraryStore } from "../../../store/useFileLibraryStore";
import type { ClassificationCorrectionRequest, FileRecord, FileType, Lifecycle, Purpose, RiskLevel, SuggestedAction } from "../../../types/domain";
import type { Translator } from "../../../types/ui";
import { readableError } from "../../../utils/viewHelpers";
import { buttonSecondary, cn, inputSurface } from "../../../utils/tw";

export function FileClassificationDetails({ file, t }: { file: FileRecord; t: Translator }) {
  const isAI = file.matched_rules.some((rule) => rule.startsWith("ai:"));
  const isLowConfidence = file.confidence < 0.65;
  const refresh = useFileLibraryStore((state) => state.refresh);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const showSuccess = useAppStore((state) => state.showSuccess);
  const showError = useAppStore((state) => state.showError);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [correction, setCorrection] = useState<ClassificationCorrectionRequest>(() => correctionFromFile(file));

  useEffect(() => {
    setCorrection(correctionFromFile(file));
    setIsEditing(false);
  }, [file.id]);

  async function confirmClassification() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await tauriApi.confirmClassification(file.id);
      await refresh(searchQuery);
      showSuccess(t("libraryConfirmClassification"));
    } catch (error) {
      showError(readableError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitCorrection() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await tauriApi.correctClassification(file.id, correction);
      await refresh(searchQuery);
      setIsEditing(false);
      showSuccess(t("libraryApplyCorrection"));
    } catch (error) {
      showError(readableError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-3 border-t border-[var(--zc-divider)] pt-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {isAI ? <Badge tone="info">AI</Badge> : null}
        {file.requires_confirmation ? <Badge tone="warning">{t("needsReview")}</Badge> : null}
        {isLowConfidence ? <Badge tone="warning">{t("libraryConfidenceLow")}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={buttonSecondary} onClick={() => void confirmClassification()} disabled={isSubmitting}>{t("libraryConfirmClassification")}</button>
        <button className={buttonSecondary} onClick={() => setIsEditing((value) => !value)} disabled={isSubmitting}>{t("libraryEditClassification")}</button>
      </div>
      <p className="leading-5 text-[var(--zc-text-tertiary)]">{t("libraryLearningHint")}</p>
      {isEditing ? (
        <div className="grid gap-2 border-t border-[var(--zc-divider)] pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <CorrectionSelect label={t("fileType")} value={correction.fileType} options={FILE_TYPE_OPTIONS} optionLabel={(option) => typeOptionLabel(option, t)} onChange={(fileType) => setCorrection((current) => ({ ...current, fileType }))} />
            <CorrectionSelect label={t("purpose")} value={correction.purpose} options={PURPOSE_OPTIONS} optionLabel={(option) => purposeOptionLabel(option, t)} onChange={(purpose) => setCorrection((current) => ({ ...current, purpose }))} />
            <CorrectionSelect label={t("lifecycle")} value={correction.lifecycle} options={LIFECYCLE_OPTIONS} optionLabel={(option) => lifecycleOptionLabel(option, t)} onChange={(lifecycle) => setCorrection((current) => ({ ...current, lifecycle }))} />
            <CorrectionSelect label={t("risk")} value={correction.riskLevel} options={RISK_LEVEL_OPTIONS} optionLabel={(option) => riskOptionLabel(option, t)} onChange={(riskLevel) => setCorrection((current) => ({ ...current, riskLevel }))} />
            <CorrectionSelect label={t("action")} value={correction.suggestedAction} options={SUGGESTED_ACTION_OPTIONS} optionLabel={(option) => actionOptionLabel(option, t)} onChange={(suggestedAction) => setCorrection((current) => ({ ...current, suggestedAction }))} />
            <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{t("libraryFieldContext")}</span><input className={inputSurface} value={correction.context} onChange={(event) => setCorrection((current) => ({ ...current, context: event.target.value }))} /></label>
          </div>
          <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{t("libraryFieldTargetTemplate")}</span><input className={inputSurface} value={correction.targetTemplate} onChange={(event) => setCorrection((current) => ({ ...current, targetTemplate: event.target.value }))} /></label>
          <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{t("libraryFieldSuggestedName")}</span><input className={inputSurface} value={correction.suggestedName ?? ""} onChange={(event) => setCorrection((current) => ({ ...current, suggestedName: event.target.value }))} /></label>
          <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{t("libraryFieldReason")}</span><input className={inputSurface} value={correction.reason ?? ""} onChange={(event) => setCorrection((current) => ({ ...current, reason: event.target.value }))} /></label>
          <div className="flex flex-wrap gap-2"><button className={buttonSecondary} onClick={() => void submitCorrection()} disabled={isSubmitting}>{t("libraryApplyCorrection")}</button><button className={buttonSecondary} onClick={() => setIsEditing(false)} disabled={isSubmitting}>{t("libraryCancelEdit")}</button></div>
        </div>
      ) : null}
    </section>
  );
}

function CorrectionSelect<T extends string>({ label, value, options, optionLabel, onChange }: { label: string; value: T; options: readonly T[]; optionLabel: (option: T) => string; onChange: (value: T) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-[var(--zc-text-tertiary)]"><span>{label}</span><select className={cn(inputSurface, "appearance-auto")} value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}</select></label>;
}

function typeOptionLabel(value: FileType, t: Translator) { return t(`libraryType${value === "ArchivePackage" ? "Archive" : value}` as Parameters<Translator>[0]); }
function purposeOptionLabel(value: Purpose, t: Translator) { return t(`libraryPurpose${value}` as Parameters<Translator>[0]); }
function lifecycleOptionLabel(value: Lifecycle, t: Translator) { return t(`libraryLifecycle${value}` as Parameters<Translator>[0]); }
function riskOptionLabel(value: RiskLevel, t: Translator) { return t(`libraryRisk${value}` as Parameters<Translator>[0]); }
function actionOptionLabel(value: SuggestedAction, t: Translator) { return t(`libraryAction${value}` as Parameters<Translator>[0]); }

function Badge({ tone, children }: { tone: "info" | "warning"; children: string }) {
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", tone === "info" ? "border-[var(--zc-info-border)] bg-[var(--zc-info-soft)] text-[var(--zc-info-text)]" : "border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]")}>{children}</span>;
}

function correctionFromFile(file: FileRecord): ClassificationCorrectionRequest {
  return {
    fileType: file.file_type,
    purpose: file.purpose,
    lifecycle: file.lifecycle,
    context: file.context,
    riskLevel: file.risk_level,
    suggestedAction: file.suggested_action,
    targetTemplate: relativeTargetTemplate(file.suggested_target_path),
    suggestedName: file.suggested_name || undefined,
    reason: file.classification_reason || undefined
  };
}

function relativeTargetTemplate(path: string) {
  const value = path.trim().replace(/\\/g, "/");
  if (!value || value.startsWith("/") || value.startsWith("//") || /^[A-Za-z]:\//.test(value)) return "";
  return value;
}

const FILE_TYPE_OPTIONS: readonly FileType[] = ["Document", "Image", "Video", "Audio", "Code", "ArchivePackage", "Installer", "Spreadsheet", "Presentation", "Other"];
const PURPOSE_OPTIONS: readonly Purpose[] = ["Project", "Teaching", "Study", "Work", "Personal", "Career", "Finance", "Identity", "Media", "Installer", "Temporary", "Archive", "Unknown"];
const LIFECYCLE_OPTIONS: readonly Lifecycle[] = ["Inbox", "Active", "Reference", "Archive", "Disposable", "Duplicate", "Sensitive"];
const RISK_LEVEL_OPTIONS: readonly RiskLevel[] = ["Normal", "Sensitive", "System", "Unknown"];
const SUGGESTED_ACTION_OPTIONS: readonly SuggestedAction[] = ["Keep", "Rename", "Move", "MoveAndRename", "Archive", "Review", "DeleteCandidate"];
