import type { LocationDescriptor, LocationKind } from "../../../types/fileWorkspace";

/** The existing Chrome/Command runtime platform input used by the shell. */
export type LocationPresentationPlatform = NodeJS.Platform | "browser";

export type LocationPresentationGroupId =
  | "this_pc"
  | "locations"
  | "providers"
  | "cloud"
  | "network"
  | "other";

export interface LocationPresentationGroup {
  id: LocationPresentationGroupId;
  locations: readonly LocationDescriptor[];
}

const WINDOWS_GROUP_ORDER: readonly LocationPresentationGroupId[] = ["this_pc", "cloud", "network", "other"];
const MACOS_GROUP_ORDER: readonly LocationPresentationGroupId[] = ["locations", "providers", "network", "other"];
const GENERIC_GROUP_ORDER: readonly LocationPresentationGroupId[] = ["other"];

/**
 * Projects backend-confirmed LocationDescriptor facts into platform vocabulary.
 * Platform changes labels and grouping only; it never changes LocationRef
 * identity, availability, or capabilities.
 */
export function projectLocationGroups(
  locations: readonly LocationDescriptor[],
  platform: LocationPresentationPlatform
): LocationPresentationGroup[] {
  const order = platform === "win32"
    ? WINDOWS_GROUP_ORDER
    : platform === "darwin"
      ? MACOS_GROUP_ORDER
      : GENERIC_GROUP_ORDER;
  const groups = new Map<LocationPresentationGroupId, LocationDescriptor[]>();
  for (const id of order) groups.set(id, []);
  for (const location of locations) {
    const id = locationPresentationGroupForKind(location.kind, platform);
    groups.get(id)?.push(location);
  }
  return order
    .map((id) => ({ id, locations: groups.get(id) ?? [] }))
    .filter((group) => group.locations.length > 0);
}

export function locationPresentationGroupForKind(
  kind: LocationKind,
  platform: LocationPresentationPlatform
): LocationPresentationGroupId {
  if (platform === "win32") {
    if (kind === "local" || kind === "external") return "this_pc";
    if (kind === "cloud_provider") return "cloud";
    if (kind === "network") return "network";
    return "other";
  }
  if (platform === "darwin") {
    if (kind === "local" || kind === "external") return "locations";
    if (kind === "cloud_provider") return "providers";
    if (kind === "network") return "network";
    return "other";
  }
  return "other";
}
