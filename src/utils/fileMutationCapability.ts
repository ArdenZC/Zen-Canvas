import { useRuntimeCapabilitiesContext } from "../contexts/AppContexts";
import type { RuntimeCapabilities } from "../types/domain";

export const MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED =
  "macos_file_mutation_source_binding_unsupported";

export function fileMutationUnavailableCode(capabilities: RuntimeCapabilities | null | undefined): string | null {
  if (!capabilities) return localFileMutationUnavailableCode();
  if (capabilities.fileMutationAvailable) return null;
  return capabilities.fileMutationUnavailableCode
    || (capabilities.platform === "macos" ? MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED : "file_mutation_unsupported");
}

export function localFileMutationUnavailableCode(): string | null {
  // The backend capability payload is the authority for the current runtime.
  // Do not infer a renderer-wide platform block from the browser host: the
  // frontend quality job runs on Linux while the supported desktop targets
  // are Windows and macOS, and the Tauri backend already rejects unsupported
  // mutations with its durable error contract.
  return null;
}

export function rejectUnavailableFileMutation<T>(): Promise<T> | null {
  const code = localFileMutationUnavailableCode();
  return code ? Promise.reject(new Error(code)) : null;
}

export function useFileMutationUnavailableCode(): string | null {
  const { capabilities } = useRuntimeCapabilitiesContext();
  return fileMutationUnavailableCode(capabilities);
}
