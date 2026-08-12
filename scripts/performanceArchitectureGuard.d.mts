export interface VaultPaginationSources {
  viewSource: string;
  storeSource: string;
  componentSources?: Record<string, string>;
}

export function findVaultPaginationArchitectureViolations(
  sources: VaultPaginationSources
): string[];
