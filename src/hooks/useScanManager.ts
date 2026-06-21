import { useCallback, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { tauriApi } from "../api/tauriApi";
import type { Translator } from "../types/ui";
import { readableError } from "../utils/viewHelpers";
import { useScanProgress, type UseScanProgressOptions } from "./useScanProgress";

export interface ScanManagerOptions {
  t: Translator;
  onRefreshData: () => Promise<void>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function createScanProgressOptions(
  onRefreshData: () => Promise<void>
): UseScanProgressOptions {
  return {
    onComplete: () => {
      void onRefreshData();
    }
  };
}

export function useScanManager({
  t,
  onRefreshData,
  onError,
  onSuccess
}: ScanManagerOptions) {
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const scanProgressOptions = useMemo(
    () => createScanProgressOptions(onRefreshData),
    [onRefreshData]
  );
  const scanState = useScanProgress(scanProgressOptions);
  const { startScan, reset } = scanState;

  const askForScanPath = useCallback(
    async () => {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: t("folderPickerTitle"),
        defaultPath: selectedFolders[0]
      });

      if (Array.isArray(selectedPath)) return selectedPath[0]?.trim() ?? "";
      return selectedPath?.trim() ?? "";
    },
    [selectedFolders, t]
  );

  const scanPath = useCallback(
    async (path: string) => {
      if (!path) {
        onError(t("noFolderSelected"));
        return;
      }
      setSelectedFolders([path]);
      setIsScanning(true);
      reset();
      try {
        const summary = await startScan(path);
        onSuccess(`${t("success")}: ${summary.files.toLocaleString()} ${t("files")}`);
      } catch (error) {
        onError(readableError(error));
      } finally {
        setIsScanning(false);
      }
    },
    [onError, onSuccess, reset, startScan, t]
  );

  const handleScan = useCallback(async () => {
    try {
      const requestedPath = selectedFolders.length > 0 ? "" : await askForScanPath();
      const paths = selectedFolders.length > 0 ? selectedFolders : [requestedPath].filter(Boolean);
      for (const path of paths) {
        if (path) await scanPath(path);
      }
    } catch (error) {
      onError(readableError(error));
    }
  }, [askForScanPath, onError, scanPath, selectedFolders]);

  const handleChooseFolders = useCallback(async () => {
    try {
      const path = await askForScanPath();
      if (path) await scanPath(path);
    } catch (error) {
      onError(readableError(error));
    }
  }, [askForScanPath, onError, scanPath]);

  const cancelScan = useCallback(async () => {
    await tauriApi.cancelScan();
    setIsScanning(false);
  }, []);

  return {
    selectedFolders,
    isScanning,
    scanState,
    handleScan,
    handleChooseFolders,
    cancelScan
  };
}
