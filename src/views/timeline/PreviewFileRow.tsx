import { memo } from "react";
import { motion } from "motion/react";
import { File } from "lucide-react";
import type { OperationPreview } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { percent } from "../../utils/format";
import { cn, inputSurface } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import { ToneBadge, compactInteractiveRow, itemMotion } from "../shared/ui";

export const PreviewFileRow = memo(function PreviewFileRow({
  preview,
  isSelected,
  toggle,
  onRenamePreview,
  t
}: {
  preview: OperationPreview;
  isSelected: boolean;
  toggle: (id: string) => void;
  onRenamePreview: (id: string, name: string) => void;
  t: Translator;
}) {
  const blocked = preview.is_executable === false;
  const trashOperation = preview.operation_type === "move_to_trash";

  return (
    <motion.div
      className={cn(
        compactInteractiveRow({ selected: isSelected, disabled: blocked }),
        "grid items-start gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)]"
      )}
      layout={false}
      variants={itemMotion}
    >
      <input
        type="checkbox"
        disabled={blocked}
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
          <ToneBadge tone={blocked ? "danger" : "success"}>
            {blocked ? t("operationBlocked") : t("operationExecutable")}
          </ToneBadge>
        </div>

        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <ToneBadge tone={riskTone(preview.risk_level)}>{preview.risk_level}</ToneBadge>
          {preview.requires_confirmation && (
            <ToneBadge tone="warning">{t("operationNeedsConfirmation")}</ToneBadge>
          )}
          {preview.blocking_reason && (
            <ToneBadge tone="danger">{preview.blocking_reason}</ToneBadge>
          )}
          {!trashOperation && preview.will_create_parent && (
            <ToneBadge tone="info">{t("operationCreatesParent")}</ToneBadge>
          )}
        </div>
        {trashOperation && (
          <p className="mt-2 text-xs text-[var(--muted)]">{t("operationMoveToTrashRisk")}</p>
        )}
        {preview.reason && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {t("reason")}：{preview.reason}
          </p>
        )}

        <div className="mt-2 grid min-w-0 gap-2 xl:grid-cols-2">
          <PathBlock label={t("sourcePath")} path={preview.source_path} tone="source" />
          <PathBlock label={t("targetPath")} path={preview.target_path} tone="target" />
        </div>

        {!trashOperation && (
          <input
            className={cn(inputSurface, "mt-2 w-full")}
            value={preview.new_name}
            disabled={!preview.editable_new_name || blocked}
            onChange={(event) => onRenamePreview(preview.id, event.target.value)}
            aria-label={t("newFileName")}
          />
        )}
      </div>
    </motion.div>
  );
});

function PathBlock({ label, path, tone }: { label: string; path: string; tone: "source" | "target" }) {
  const displayPath = formatDisplayPath(path);
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border px-2 py-1.5",
        tone === "source"
          ? "border-slate-400/20 bg-slate-500/8"
          : "border-blue-400/24 bg-blue-500/8"
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
