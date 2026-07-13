import { memo } from "react";
import { motion } from "motion/react";
import { File } from "lucide-react";
import type { OperationPreview } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { percent } from "../../utils/format";
import { cn, inputSurface } from "../../utils/tw";
import { compactPath, formatDisplayPath, formatPreviewDisplayPath } from "../../utils/viewHelpers";
import { ToneBadge, itemMotion } from "../shared/ui";
import { validateOrganizeFileName } from "../organize/organizeModel";
import { riskLabel } from "../vault/components/FileLibraryList";
import { resolvePreviewEligibility, type PreviewExecutionIntent } from "../../store/useOperationQueueStore";

export const PreviewFileRow = memo(function PreviewFileRow({
  preview,
  isSelected,
  executionIntent,
  toggle,
  onRenamePreview,
  t
}: {
  preview: OperationPreview;
  isSelected: boolean;
  executionIntent?: PreviewExecutionIntent;
  toggle: (id: string) => void;
  onRenamePreview: (id: string, name: string) => void;
  t: Translator;
}) {
  const trashOperation = preview.operation_type === "move_to_trash";
  const nameError = trashOperation ? null : validateOrganizeFileName(preview.new_name);
  const eligibility = resolvePreviewEligibility(preview, executionIntent ?? null);
  const blocked = eligibility.reason === "blocked" || eligibility.reason === "unavailable" || eligibility.reason === "outsideWhitelist";
  const executionStatus = eligibility.executable ? "executable" : eligibility.reason === "invalidName" ? "invalid-name" : eligibility.reason === "unavailable" ? "unavailable" : eligibility.reason === "outsideWhitelist" ? "outside-whitelist" : "blocked";
  const executionStatusLabel = eligibility.executable ? t("operationExecutable") : eligibility.reason === "invalidName" ? t("operationInvalidName") : eligibility.reason === "unavailable" ? t("unavailable") : eligibility.reason === "outsideWhitelist" ? t("organizeOutsideWhitelist") : t("operationBlocked");

  return (
    <motion.div
      className={cn(
        "grid items-start gap-3 border-b border-[var(--zc-divider)] px-2 py-3 transition-[background,color] sm:grid-cols-[auto_auto_minmax(0,1fr)]",
        isSelected && "bg-[var(--zc-surface-selected)]",
        blocked && "opacity-65"
      )}
      layout={false}
      variants={itemMotion}
    >
      <input
        type="checkbox"
        disabled={!isSelected && !eligibility.executable}
        checked={isSelected}
        onChange={() => toggle(preview.id)}
        aria-label={`${t("selectOperation")} · ${preview.old_name}`}
      />
      <File size={15} />
      <div className="min-w-0">
        <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0">
            <strong className="block truncate text-sm">{preview.old_name}</strong>
            <span className="block text-xs text-[var(--muted)]">
              {operationLabel(preview.operation_type, t)} / {percent(preview.confidence)}
            </span>
          </div>
          <span role="status" aria-label={executionStatusLabel} data-preview-execution-state={executionStatus}>
            <ToneBadge tone={blocked ? "danger" : nameError ? "warning" : "success"}>
              {executionStatusLabel}
            </ToneBadge>
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <ToneBadge tone={riskTone(preview.risk_level)}>{riskLabel(preview.risk_level, t)}</ToneBadge>
          {preview.requires_confirmation && (
            <ToneBadge tone="warning">{t("operationNeedsConfirmation")}</ToneBadge>
          )}
          {preview.blocking_reason ? <ToneBadge tone="danger">{t("operationBlocked")}</ToneBadge> : null}
          {!trashOperation && preview.will_create_parent && (
            <ToneBadge tone="info">{t("operationCreatesParent")}</ToneBadge>
          )}
        </div>
        {trashOperation && (
          <p className="mt-2 text-xs text-[var(--muted)]">{t("operationMoveToTrashRisk")}</p>
        )}
        {preview.reason ? <p className="mt-2 text-xs text-[var(--muted)]">{t("organizeReasonFromAnalysis")}</p> : null}

        <div className="mt-2 grid min-w-0 gap-2 xl:grid-cols-2">
          <PathBlock label={t("sourcePath")} path={preview.source_path} tone="source" t={t} />
          <PathBlock label={t("targetPath")} path={preview.target_path} tone="target" t={t} localizeLogicalPath />
        </div>

        {!trashOperation && (
          <input
            className={cn(inputSurface, "mt-2 w-full")}
            value={preview.new_name}
            disabled={!preview.editable_new_name || eligibility.reason === "unavailable" || eligibility.reason === "outsideWhitelist"}
            onChange={(event) => onRenamePreview(preview.id, event.target.value)}
            aria-label={t("newFileName")}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? `preview-name-error-${preview.id}` : undefined}
          />
        )}
        {nameError ? <p id={`preview-name-error-${preview.id}`} className="mt-1 text-xs text-[var(--zc-danger-text)]" role="alert">{t(nameError === "empty" ? "organizeNameErrorEmpty" : nameError === "reserved" ? "organizeNameErrorReserved" : "organizeNameErrorUnsafe")}</p> : null}
      </div>
    </motion.div>
  );
});

function PathBlock({ label, path, tone, t, localizeLogicalPath = false }: { label: string; path: string; tone: "source" | "target"; t: Translator; localizeLogicalPath?: boolean }) {
  const displayPath = localizeLogicalPath ? formatPreviewDisplayPath(path, t) : formatDisplayPath(path);
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-2 py-1.5",
        tone === "source"
          ? "border-[var(--zc-divider)] bg-[var(--zc-neutral-soft)]"
          : "border-[var(--zc-info-border)] bg-[var(--zc-info-soft)]"
      )}
      title={displayPath}
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--quiet)]">{label}</span>
      <code className="block min-w-0 truncate whitespace-nowrap text-[11px] leading-5 text-[var(--muted)]">
        {compactPath(displayPath, 78)}
      </code>
    </div>
  );
}

function operationLabel(operation: OperationPreview["operation_type"], t: Translator): string {
  if (operation === "move_to_trash") return t("operationMoveToTrash");
  if (operation === "rename") return t("operationRename");
  if (operation === "move_rename") return t("operationMoveRename");
  return t("operationMove");
}

function riskTone(risk: OperationPreview["risk_level"]): "info" | "success" | "warning" | "danger" | "slate" {
  if (risk === "Sensitive") return "danger";
  if (risk === "System") return "warning";
  if (risk === "Normal") return "success";
  return "slate";
}
