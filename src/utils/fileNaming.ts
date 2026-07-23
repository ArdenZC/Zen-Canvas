export type FileExtensionNormalization = {
  name: string;
  error: "extension" | null;
};

export function normalizeProposedFileNameExtension(originalName: string, proposedName: string): FileExtensionNormalization {
  const trimmed = proposedName.trim();
  if (!trimmed) return { name: trimmed, error: null };

  const originalExtension = fileExtension(originalName);
  const proposedExtension = fileExtension(trimmed);
  if (!originalExtension) {
    return proposedExtension ? { name: trimmed, error: "extension" } : { name: trimmed, error: null };
  }
  if (!proposedExtension) {
    return { name: `${trimmed}.${originalExtension}`, error: null };
  }
  if (proposedExtension.toLocaleLowerCase() !== originalExtension.toLocaleLowerCase()) {
    return { name: trimmed, error: "extension" };
  }

  const stem = trimmed.slice(0, -(proposedExtension.length + 1));
  return { name: `${stem}.${originalExtension}`, error: null };
}

function fileExtension(name: string): string | null {
  const base = name.split(/[\\/]/).at(-1) ?? name;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1);
}
