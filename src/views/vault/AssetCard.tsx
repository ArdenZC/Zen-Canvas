import { memo, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { File, FolderOpen } from "lucide-react";
import type { FileRecord } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes, formatDate } from "../../utils/format";
import { cn } from "../../utils/tw";
import { compactPath, formatDisplayPath } from "../../utils/viewHelpers";
import { revealFileFromCard } from "../shared/cardActions";
import { contentPanel, itemMotion, quietText } from "../shared/ui";

export const AssetCard = memo(function AssetCard({
  file,
  isSelected,
  onError,
  setSelectedFileId,
  t
}: {
  file: FileRecord;
  isSelected: boolean;
  onError: (message: string) => void;
  setSelectedFileId: (id: string) => void;
  t: Translator;
}) {
  function selectFile() {
    setSelectedFileId(file.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectFile();
  }

  const badges = compactBadges(file, t);
  const visibleBadges = badges.slice(0, 3);
  const hiddenBadgeCount = badges.length - visibleBadges.length;

  return (
    <motion.div
      className={cn(
        contentPanel,
        "group relative grid h-[156px] cursor-pointer grid-rows-[auto_auto_1fr] gap-2 overflow-hidden p-3 text-left transition-[background,border-color,box-shadow,color]",
        "hover:border-[var(--zc-control-border-hover)] hover:bg-[var(--zc-surface-hover)] hover:shadow-[inset_0_1px_0_var(--zc-brand-canvas-highlight)]",
        isSelected && "border-[var(--zc-primary)] bg-[var(--zc-surface-selected)] shadow-[inset_0_0_0_1px_var(--zc-focus-ring-soft)]"
      )}
      layout={false}
      variants={itemMotion}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onClick={selectFile}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg border border-[var(--zc-border)] bg-[var(--zc-surface-floating)] text-[var(--zc-text-secondary)] opacity-0 shadow-sm transition-[background,border-color,color,opacity] hover:border-[var(--zc-control-border-hover)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-primary-text)] focus:opacity-100 group-hover:opacity-100"
        aria-label={t("revealPhysical")}
        title={t("revealPhysical")}
        onClick={(event) => {
          void revealFileFromCard({
            path: file.path,
            onError,
            stopPropagation: () => event.stopPropagation()
          });
        }}
      >
        <FolderOpen size={15} />
      </button>

      <div className="flex min-w-0 items-start gap-2.5 pr-8">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--muted)]">
          <File size={19} />
        </span>
        <div className="min-w-0 max-w-full flex-1">
          <h3 className="line-clamp-2 break-all text-sm font-semibold leading-5 text-[var(--ink)]" title={file.name}>{file.name}</h3>
          <p className={cn(quietText, "mt-0.5 truncate")} title={formatDisplayPath(file.path)}>{compactPath(formatDisplayPath(file.path), 54)}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
        {visibleBadges.map((badge) => (
          <span className={miniBadgeClass(badge.tone)} key={`${badge.label}-${badge.tone}`} title={badge.label}>
            {badge.label}
          </span>
        ))}
        {hiddenBadgeCount > 0 && <span className={miniBadgeClass("slate")}>+{hiddenBadgeCount}</span>}
      </div>

      <div className="mt-auto flex min-w-0 items-center justify-between gap-2 text-xs leading-5 text-[var(--muted)]">
        <span className="truncate" title={file.purpose}>{file.purpose}</span>
        <span className="shrink-0 text-[var(--quiet)]">{formatDate(file.modified_at)}</span>
      </div>
    </motion.div>
  );
});

type MiniBadgeTone = "info" | "green" | "amber" | "red" | "slate" | "purple";

function compactBadges(file: FileRecord, t: Translator): Array<{ label: string; tone: MiniBadgeTone }> {
  const badges: Array<{ label: string; tone: MiniBadgeTone }> = [
    { label: file.file_type, tone: "info" },
    { label: formatBytes(file.size), tone: "slate" },
    { label: file.lifecycle, tone: lifecycleTone(file.lifecycle) }
  ];

  if (file.risk_level !== "Normal") {
    badges.push({
      label: file.risk_level === "Sensitive" ? t("sensitiveLabel") : file.risk_level,
      tone: riskTone(file.risk_level)
    });
  }
  if (file.matched_rules.some((rule) => rule.startsWith("ai:"))) badges.push({ label: "AI", tone: "info" });
  if (file.confidence < 0.65) badges.push({ label: t("libraryConfidenceLow"), tone: "amber" });
  if (file.is_duplicate) badges.push({ label: t("libraryDuplicateFiles"), tone: "amber" });
  if (file.requires_confirmation) badges.push({ label: t("needsReview"), tone: "amber" });

  return badges;
}

function miniBadgeClass(tone: MiniBadgeTone) {
  return cn(
    "inline-flex max-w-[8rem] items-center truncate rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-4",
    tone === "green" && "border-[var(--zc-success-border)] bg-[var(--zc-success-soft)] text-[var(--zc-success-text)]",
    tone === "amber" && "border-[var(--zc-warning-border)] bg-[var(--zc-warning-soft)] text-[var(--zc-warning-text)]",
    tone === "red" && "border-[var(--zc-danger-border)] bg-[var(--zc-danger-soft)] text-[var(--zc-danger-text)]",
    tone === "purple" && "border-[var(--zc-purple-border)] bg-[var(--zc-purple-soft)] text-[var(--zc-purple-text)]",
    tone === "info" && "border-[var(--zc-info-border)] bg-[var(--zc-info-soft)] text-[var(--zc-info-text)]",
    tone === "slate" && "border-[var(--zc-divider)] bg-[var(--zc-surface-subtle)] text-[var(--zc-text-secondary)]"
  );
}

function lifecycleTone(lifecycle: FileRecord["lifecycle"]): MiniBadgeTone {
  if (lifecycle === "Archive") return "purple";
  if (lifecycle === "Disposable" || lifecycle === "Duplicate") return "amber";
  if (lifecycle === "Sensitive") return "red";
  if (lifecycle === "Active") return "green";
  return "slate";
}

function riskTone(riskLevel: FileRecord["risk_level"]): MiniBadgeTone {
  if (riskLevel === "Sensitive") return "red";
  if (riskLevel === "System" || riskLevel === "Unknown") return "amber";
  return "green";
}
