import { memo, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { File, FolderOpen } from "lucide-react";
import type { FileRecord } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes, formatDate } from "../../utils/format";
import { cn } from "../../utils/tw";
import { compactPath } from "../../utils/viewHelpers";
import { revealFileFromCard } from "../shared/cardActions";
import { ToneBadge, contentPanel, itemMotion, metadataText, quietText } from "../shared/ui";

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

  return (
    <motion.div
      className={cn(
        contentPanel,
        "group relative grid min-h-56 cursor-pointer content-start gap-3 p-4 text-left transition-[background,border-color,box-shadow,color]",
        "hover:border-blue-400/28 hover:bg-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] dark:hover:bg-white/10",
        isSelected && "border-blue-400/60 bg-blue-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.46),0_0_0_3px_rgba(59,130,246,0.09)]"
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
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white/58 text-[var(--muted)] opacity-0 shadow-sm transition-[background,border-color,color,opacity] hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-blue-600 focus:opacity-100 group-hover:opacity-100 dark:bg-slate-900/66 dark:hover:text-blue-300"
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

      <div className="flex items-start gap-3 pr-9">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[var(--line)] bg-white/24 text-[var(--muted)] dark:bg-white/5">
          <File size={23} />
        </span>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold leading-5 text-[var(--ink)]" title={file.name}>{file.name}</h3>
          <p className={cn(quietText, "mt-1 truncate")} title={file.path}>{compactPath(file.path, 62)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <ToneBadge tone="info">{file.file_type}</ToneBadge>
        <ToneBadge tone="slate">{formatBytes(file.size)}</ToneBadge>
        <ToneBadge tone={lifecycleTone(file.lifecycle)}>{file.lifecycle}</ToneBadge>
        <ToneBadge tone={riskTone(file.risk_level)}>{file.risk_level === "Sensitive" ? t("sensitiveLabel") : file.risk_level}</ToneBadge>
        {file.is_duplicate && <ToneBadge tone="warning">{t("libraryDuplicateFiles")}</ToneBadge>}
        {file.requires_confirmation && <ToneBadge tone="warning">{t("needsReview")}</ToneBadge>}
      </div>

      <div className={metadataText}>
        <span>{formatDate(file.modified_at)}</span>
        <span className="mx-2 text-[var(--quiet)]">/</span>
        <span>{file.purpose}</span>
      </div>
    </motion.div>
  );
});

function lifecycleTone(lifecycle: FileRecord["lifecycle"]) {
  if (lifecycle === "Archive") return "purple";
  if (lifecycle === "Disposable" || lifecycle === "Duplicate") return "amber";
  if (lifecycle === "Sensitive") return "warning";
  if (lifecycle === "Active") return "green";
  return "slate";
}

function riskTone(riskLevel: FileRecord["risk_level"]) {
  if (riskLevel === "Sensitive") return "warning";
  if (riskLevel === "System" || riskLevel === "Unknown") return "amber";
  return "success";
}
