export const MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED =
  "macos_file_mutation_source_binding_unsupported";

export function localFileMutationUnavailableCode(): string | null {
  if (typeof navigator === "undefined") return null;
  const platform = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  if (platform.includes("mac")) return MACOS_FILE_MUTATION_SOURCE_BINDING_UNSUPPORTED;
  return null;
}

export function rejectUnavailableFileMutation<T>(): Promise<T> | null {
  const code = localFileMutationUnavailableCode();
  return code ? Promise.reject(new Error(code)) : null;
}
