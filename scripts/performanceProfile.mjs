const SUPPORTED_PROFILES = new Set(["full", "extended"]);

export function resolvePerformanceProfile(argv = []) {
  const profileArguments = argv.filter(
    (argument) => argument === "--profile" || argument.startsWith("--profile="),
  );

  if (profileArguments.length === 0) {
    return "full";
  }

  if (profileArguments.length > 1) {
    throw new Error("Specify the performance profile only once.");
  }

  const profileArgument = profileArguments[0];
  const profile = profileArgument.startsWith("--profile=")
    ? profileArgument.slice("--profile=".length)
    : "";

  if (!SUPPORTED_PROFILES.has(profile)) {
    throw new Error(`Unsupported performance profile: ${profile || "<missing>"}`);
  }

  return profile;
}
