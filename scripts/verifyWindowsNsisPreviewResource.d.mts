export function assertGeneratedPreviewResourcePath(
  generatedInstallerSource: string,
  servicingSource: string,
): {
  canonicalInvocation: string;
  canonicalFileInstruction: string;
};

export function resolveGeneratedNsisInstallerPath(): string;

export function assertGeneratedPreviewResourcePathFile(
  generatedInstallerPath?: string,
): {
  canonicalInvocation: string;
  canonicalFileInstruction: string;
};

export function runWindowsPreviewResourceSmoke(options?: {
  sourcePath?: string;
}): {
  freshCanonical: string;
  mappedCanonical: string;
};
