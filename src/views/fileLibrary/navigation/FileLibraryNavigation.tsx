import {
  Bookmark,
  CircleAlert,
  Clock3,
  Cloud,
  Folder,
  HardDrive,
  Layers3,
  MapPin,
  Network,
  Shapes,
  Tags,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Translator } from "../../../types/ui";
import type {
  LocationDescriptor,
  LocationKind,
  NavigationTarget
} from "../../../types/fileWorkspace";
import type { FileLibraryExperienceController, FileLibraryExperienceState } from "../fileLibraryExperience";
import { isActivatableLocation, locationAvailabilityLabel } from "../browse/browseSourceOwner";
import { cn } from "../../../utils/tw";

export type FileLibraryNavigationLayout = "large" | "drawer";

type LibraryNavigationItem = {
  id: string;
  labelKey: Parameters<Translator>[0];
  icon: typeof Layers3;
  target: Extract<NavigationTarget, { kind: "library" }>;
};

const LIBRARY_NAVIGATION_ITEMS: readonly LibraryNavigationItem[] = [
  { id: "all", labelKey: "fileLibraryNavigationAll", icon: Layers3, target: { kind: "library", source: "smart_view", key: "all" } },
  { id: "recent", labelKey: "fileLibraryNavigationRecent", icon: Clock3, target: { kind: "library", source: "smart_view", key: "recent" } },
  { id: "types", labelKey: "fileLibraryNavigationTypes", icon: Shapes, target: { kind: "library", source: "smart_view", key: "types" } },
  { id: "saved", labelKey: "fileLibraryNavigationSaved", icon: Bookmark, target: { kind: "library", source: "saved_view", key: "all" } },
  { id: "tags", labelKey: "fileLibraryNavigationTags", icon: Tags, target: { kind: "library", source: "tag", key: "all" } }
];

const LOCATION_GROUP_ORDER: readonly LocationKind[] = ["local", "external", "network", "cloud_provider", "unknown"];

export function groupBrowseLocations(locations: readonly LocationDescriptor[]) {
  const groups = new Map<LocationKind, LocationDescriptor[]>();
  for (const kind of LOCATION_GROUP_ORDER) groups.set(kind, []);
  for (const location of locations) groups.get(location.kind)?.push(location);
  return LOCATION_GROUP_ORDER
    .map((kind) => ({ kind, locations: groups.get(kind) ?? [] }))
    .filter((group) => group.locations.length > 0);
}

export function locationIdentity(location: LocationDescriptor) {
  return location.ref.kind === "managed"
    ? `managed:${location.ref.scanRootId}`
    : `ephemeral:${location.ref.browseSessionId}:${location.ref.locationId}`;
}

export function FileLibraryNavigation({
  controller,
  state,
  layout,
  t,
  onClose
}: {
  controller: FileLibraryExperienceController;
  state: FileLibraryExperienceState;
  layout: FileLibraryNavigationLayout;
  t: Translator;
  onClose: () => void;
}) {
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsFailed, setLocationsFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const locationLoadStartedRef = useRef(false);
  const locations = state.workspace.locations;
  const locationGroups = useMemo(() => groupBrowseLocations(locations), [locations]);

  useEffect(() => {
    if (locations.length > 0 || locationLoadStartedRef.current) return;
    let cancelled = false;
    locationLoadStartedRef.current = true;
    setLocationsLoading(true);
    setLocationsFailed(false);
    void controller.workspace.loadLocations()
      .then((loaded) => {
        if (cancelled) return;
        setLocationsFailed(loaded === null);
      })
      .catch(() => {
        if (!cancelled) setLocationsFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });
    return () => { cancelled = true; };
  }, [controller.workspace, locations.length]);

  useEffect(() => {
    if (layout === "large") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.removeEventListener("keydown", handleEscape);
  }, [layout, onClose]);

  const currentTarget = state.workspace.session.currentTarget;

  return (
    <nav
      className="file-library-navigation-panel"
      aria-label={t("fileLibraryNavigationLabel")}
      data-file-library-navigation-panel="true"
      data-file-library-navigation-mode={layout}
    >
      <header className="file-library-navigation-header">
        <div className="min-w-0">
          <h2 className="file-library-navigation-title">{t("fileLibraryNavigationTitle")}</h2>
          <p className="file-library-navigation-description">{t("fileLibraryNavigationDescription")}</p>
        </div>
        {layout === "drawer" ? (
          <button
            ref={closeButtonRef}
            className="file-library-navigation-close"
            type="button"
            aria-label={t("fileLibraryNavigationClose")}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      <section className="file-library-navigation-section" aria-labelledby="file-library-navigation-library-heading">
        <h3 id="file-library-navigation-library-heading" className="file-library-navigation-section-title">{t("fileLibraryNavigationLibrary")}</h3>
        <div className="file-library-navigation-list">
          {LIBRARY_NAVIGATION_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentTarget?.kind === "library"
              && currentTarget.source === item.target.source
              && currentTarget.key === item.target.key;
            return (
              <button
                key={item.id}
                className={cn("file-library-navigation-item", active && "is-active")}
                type="button"
                aria-current={active ? "page" : undefined}
                data-file-library-navigation-item={item.id}
                onClick={() => controller.navigate(item.target)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="file-library-navigation-section" aria-labelledby="file-library-navigation-locations-heading">
        <div className="file-library-navigation-section-heading">
          <h3 id="file-library-navigation-locations-heading" className="file-library-navigation-section-title">{t("fileLibraryNavigationLocations")}</h3>
          <MapPin size={15} aria-hidden="true" />
        </div>
        {locationsLoading && locations.length === 0 ? <p className="file-library-navigation-muted" role="status">{t("fileLibraryNavigationLocationsLoading")}</p> : null}
        {locationsFailed && locations.length === 0 ? <p className="file-library-navigation-muted" role="status"><CircleAlert size={14} aria-hidden="true" />{t("fileLibraryNavigationLocationsFailed")}</p> : null}
        {!locationsLoading && !locationsFailed && locations.length === 0 ? <p className="file-library-navigation-muted">{t("fileLibraryNavigationLocationsEmpty")}</p> : null}
        <div className="file-library-navigation-location-groups">
          {locationGroups.map((group) => (
            <div key={group.kind} className="file-library-navigation-location-group" data-file-library-location-group={group.kind}>
              <h4 className="file-library-navigation-location-group-title">{locationGroupLabel(group.kind, t)}</h4>
              <div className="file-library-navigation-list">
                {group.locations.map((location) => <LocationNavigationItem key={locationIdentity(location)} location={location} controller={controller} t={t} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="file-library-navigation-footnote">{t("fileLibraryNavigationAuthorityNote")}</p>
    </nav>
  );
}

function LocationNavigationItem({
  location,
  controller,
  t
}: {
  location: LocationDescriptor;
  controller: FileLibraryExperienceController;
  t: Translator;
}) {
  const activatable = isActivatableLocation(location);
  const status = locationAvailabilityLabel(location.availability, t);
  const managedLabel = location.ref.kind === "managed"
    ? t("fileLibraryNavigationManaged")
    : t("fileLibraryNavigationUnmanaged");
  const Icon = location.kind === "cloud_provider"
    ? Cloud
    : location.kind === "network"
      ? Network
      : location.ref.kind === "managed"
        ? HardDrive
        : Folder;

  return (
    <div className={cn("file-library-navigation-location", !activatable && "is-unavailable")} data-file-library-location={locationIdentity(location)} data-file-library-location-managed={location.ref.kind === "managed" ? "true" : "false"}>
      <button
        className="file-library-navigation-location-button"
        type="button"
        disabled={!activatable}
        aria-label={`${location.displayName}, ${managedLabel}, ${status}`}
        onClick={() => void controller.browseLocation(location.ref)}
      >
        <Icon size={15} aria-hidden="true" />
        <span className="file-library-navigation-location-copy">
          <strong>{location.displayName}</strong>
          <small>{managedLabel} · {status}</small>
        </span>
      </button>
    </div>
  );
}

function locationGroupLabel(kind: LocationKind, t: Translator) {
  switch (kind) {
    case "local": return t("fileLibraryNavigationGroupLocal");
    case "external": return t("fileLibraryNavigationGroupExternal");
    case "network": return t("fileLibraryNavigationGroupNetwork");
    case "cloud_provider": return t("fileLibraryNavigationGroupCloud");
    default: return t("fileLibraryNavigationGroupOther");
  }
}
