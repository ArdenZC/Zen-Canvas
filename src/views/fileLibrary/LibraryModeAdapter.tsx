import { lazy, Suspense } from "react";
import { useI18nContext } from "../../contexts/AppContexts";
import { softPanel } from "../shared/ui";

const VaultView = lazy(() => import("../vault/VaultView").then((module) => ({
  default: module.VaultView
})));

/**
 * W2-01 strangler seam. Query V2, LibrarySelectionV1 and existing Vault
 * behavior remain owned by VaultView while the new workspace shell becomes the
 * route owner. W2-03 may progressively extract Library responsibilities behind
 * this adapter without changing the shell contract.
 */
export function LibraryModeAdapter() {
  const { t } = useI18nContext();
  return (
    <Suspense fallback={<div className={softPanel}>{t("loading")}</div>}>
      <VaultView />
    </Suspense>
  );
}
