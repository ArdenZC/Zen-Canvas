import type { Translator } from "../../types/ui";
import { ConfirmDialog } from "../shared/ui";

export function ScanCancelDialog({
  open,
  isCanceling,
  t,
  onConfirm,
  onCancel
}: {
  open: boolean;
  isCanceling: boolean;
  t: Translator;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      tone="danger"
      title={t("overviewCancelScanTitle")}
      description={t("overviewCancelScanDesc")}
      confirmLabel={t("overviewConfirmCancelScan")}
      cancelLabel={t("cancel")}
      isProcessing={isCanceling}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
