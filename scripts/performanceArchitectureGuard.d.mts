export interface VaultPaginationSources {
  viewSource: string;
  storeSource: string;
}

export function findVaultPaginationArchitectureViolations(
  sources: VaultPaginationSources
): string[];
