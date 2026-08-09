const MAX_FILE_LIBRARY_PAGE_SIZE = 50;

function lastSection(source, startMarker, endMarker) {
  const start = source.lastIndexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end < 0 ? undefined : end);
}

function hasUnboundedPageRequest(source) {
  for (const match of source.matchAll(/\b(?:pageSize|limit)\s*:\s*(\d+)/g)) {
    if (Number(match[1]) > MAX_FILE_LIBRARY_PAGE_SIZE) return true;
  }
  return /\b(?:pageSize|limit)\s*:\s*(?:Infinity|[A-Za-z_$][\w$]*\.(?:length|size))\b/.test(source);
}

export function findVaultPaginationArchitectureViolations({ viewSource, storeSource }) {
  const violations = [];
  const firstPage = lastSection(storeSource, "loadFirstPage: async", "loadNextPage: async");
  const nextPage = lastSection(storeSource, "loadNextPage: async", "refresh:");
  const pageSizeDeclaration = storeSource.match(/\bFILE_LIBRARY_V2_PAGE_SIZE\s*=\s*(\d+)/);

  if (!/\buseFileLibraryResultStore\s*\(/.test(viewSource)) {
    violations.push("Vault must use useFileLibraryResultStore for paginated rows.");
  }
  if (!/\bloadFirstPage\s*\(/.test(viewSource)) {
    violations.push("Vault must request its first page through the canonical store.");
  }
  if (!/onLoadMore\s*=\s*\{\s*\(\s*\)\s*=>\s*(?:void\s+)?loadNextPage\s*\(\s*\)/.test(viewSource)) {
    violations.push("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  }
  if (/\b(?:tauriApi\.)?queryFileLibraryV2\s*\(/.test(viewSource) || /\binvokeCommand\s*\([^)]*["']query_file_library_v2["']/.test(viewSource)) {
    violations.push("Vault must not call the File Library V2 backend directly.");
  }
  if (/\b(?:const|let)\s+\w*cursor\w*\s*=/.test(viewSource) || /\b(?:const|let)\s*\[\s*\w*cursor\w*\s*,/.test(viewSource)) {
    violations.push("Vault must not own a frontend pagination cursor.");
  }

  if (!pageSizeDeclaration || Number(pageSizeDeclaration[1]) > MAX_FILE_LIBRARY_PAGE_SIZE) {
    violations.push("File Library V2 store must define a bounded page size of 50.");
  }
  if (pageSizeDeclaration && Number(pageSizeDeclaration[1]) > MAX_FILE_LIBRARY_PAGE_SIZE) {
    violations.push("File Library pagination must not issue an unbounded page request.");
  }
  if (!/\bqueryFileLibraryV2\s*\(/.test(storeSource)) {
    violations.push("File Library V2 store must use queryFileLibraryV2.");
  }
  if (!/\bnextCursor\b/.test(storeSource) || !/const\s+cursor\s*=\s*get\(\)\.nextCursor/.test(nextPage)) {
    violations.push("File Library V2 store must own and read the backend nextCursor.");
  }
  if (!firstPage.includes("FILE_LIBRARY_V2_PAGE_SIZE")) {
    violations.push("File Library V2 store must use its bounded page size for the first page.");
  }
  if (!/\bexecuteLibraryQuery\s*\([\s\S]*?\bFILE_LIBRARY_V2_PAGE_SIZE\b[\s\S]*?\bnull\b/.test(firstPage)) {
    violations.push("The first File Library V2 request must use a bounded page size and no cursor.");
  }
  if (!/\bexecuteLibraryQuery\s*\([\s\S]*?\bFILE_LIBRARY_V2_PAGE_SIZE\b[\s\S]*?\bcursor\b/.test(nextPage)) {
    violations.push("The next File Library V2 request must use a bounded page size and backend cursor.");
  }
  if (hasUnboundedPageRequest(viewSource) || hasUnboundedPageRequest(storeSource)) {
    violations.push("File Library pagination must not issue an unbounded page request.");
  }

  return violations;
}
