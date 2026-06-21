import { memo, type KeyboardEvent } from "react";
import { motion } from "motion/react";
import { File, FolderOpen } from "lucide-react";
import type { FileRecord } from "../../types/domain";
import type { Translator } from "../../types/ui";
import { formatBytes } from "../../utils/format";
import { cn, toneClasses } from "../../utils/tw";
import { revealFileFromCard } from "../shared/cardActions";
import { itemMotion, panelSurface } from "../shared/ui";

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
        panelSurface,
        "group relative grid min-h-52 cursor-pointer gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/40 dark:hover:bg-white/10",
        isSelected && "ring-2 ring-blue-400/60"
      )}
      layout
      variants={itemMotion}
      role="button"
      tabIndex={0}
      onClick={selectFile}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-white/70 text-[var(--muted)] opacity-0 shadow-sm transition hover:border-blue-400/60 hover:bg-blue-500/10 hover:text-blue-600 focus:opacity-100 group-hover:opacity-100 dark:bg-slate-900/70 dark:hover:text-blue-300"
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
      <div className={cn("grid h-12 w-12 place-items-center rounded-2xl border", toneClasses(file.risk_level === "Sensitive" ? "red" : file.lifecycle === "Archive" ? "purple" : "blue"))}>
        <File size={24} />
      </div>
      <h3 className="line-clamp-2 text-base font-semibold">{file.name}</h3>
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--muted)]">
        <span>{file.lifecycle}</span>
        <strong>{formatBytes(file.size)}</strong>
      </div>
      <small className="truncate text-xs text-[var(--quiet)]">{file.directory || file.path}</small>
    </motion.div>
  );
});

