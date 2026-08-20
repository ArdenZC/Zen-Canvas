import { ChevronRight, Folder, LoaderCircle, MapPin, RefreshCw } from "lucide-react";
import { StateBlock, NoticeBanner } from "../../shared/ui";
import { useI18nContext } from "../../../contexts/AppContexts";
import type { LocationDescriptor } from "../../../types/fileWorkspace";
import { useFileLibraryExperience } from "../FileLibraryExperienceProvider";
import { BrowseEntryList } from "./BrowseEntryList";
import {
  isActivatableLocation,
  locationAvailabilityLabel,
  useBrowseSourceOwner
} from "./browseSourceOwner";
import "./browseMode.css";

export function BrowseMode() {
  const { controller, state } = useFileLibraryExperience();
  const { language, t } = useI18nContext();
  const source = useBrowseSourceOwner({ controller, state, t });

  if (source.showLocationPicker || source.target === null || source.browse === null) {
    return <BrowseLocationPicker detached={state.detachedBrowse} source={source} t={t} />;
  }

  const locationUnavailable = source.browse.location.availability !== "available"
    || !source.browse.location.capabilities.canBrowse;
  if (locationUnavailable) {
    return (
      <div className="browse-mode" data-browse-source-owner="browse" data-browse-state="unavailable">
        <StateBlock
          tone="warning"
          title={locationAvailabilityLabel(source.browse.location.availability, t)}
          description={t("browseLocationsDesc")}
          primaryAction={(
            <button className="browse-action" type="button" onClick={source.openLocationPicker}>
              <MapPin size={15} aria-hidden="true" />
              {t("browseLocationsButton")}
            </button>
          )}
        />
      </div>
    );
  }

  const completion = source.collection?.provenance.completion ?? "pending";
  const statusText = source.enumerationState === "loading"
    ? t("browseEnumerationLoading")
    : source.enumerationState === "loading_more"
      ? t("browseEnumerationLoadingMore")
      : source.enumerationState === "complete"
        ? t("browseEnumerationComplete").replace("{loaded}", String(source.loadedCount))
        : source.enumerationState === "partial"
          ? t("browseEnumerationPartial").replace("{loaded}", String(source.loadedCount))
          : "";
  const selectionText = source.selectedCount === 0
    ? t("browseSelectionNone")
    : t("browseSelectionLoaded").replace("{count}", String(source.selectedCount));

  return (
    <div
      className="browse-mode"
      data-browse-source-owner="browse"
      data-browse-state="current-folder"
      data-browse-provenance={source.collection === null ? "pending" : "browse-enumeration"}
      data-browse-enumeration-completion={completion}
      data-browse-known-count={source.knownCount === null ? undefined : source.knownCount}
      data-browse-selection-authority="browse-source-local"
    >
      <header className="browse-mode-header">
        <div className="min-w-0">
          <h2 className="browse-mode-title truncate text-base font-semibold">{t("fileLibraryBrowseTargetTitle")}</h2>
          <p className="browse-mode-description">{t("fileLibraryBrowseTargetDesc")}</p>
        </div>
        <div className="browse-mode-actions">
          <button className="browse-action" type="button" onClick={source.openLocationPicker}>
            <MapPin size={15} aria-hidden="true" />
            {t("browseLocationsButton")}
          </button>
          <button
            className="browse-action"
            type="button"
            disabled={source.enumerationState === "loading" || source.enumerationState === "loading_more"}
            aria-label={t("browseRefresh")}
            onClick={() => void source.refreshEnumeration()}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {t("browseRefresh")}
          </button>
        </div>
      </header>

      <div className="browse-mode-toolbar" data-browse-breadcrumbs="true">
        <nav className="browse-breadcrumbs" aria-label={t("browseBreadcrumbLabel")}>
          {source.breadcrumbs.length === 0
            ? <span className="browse-breadcrumb" aria-current="page">{t("browseCurrentFolder")}</span>
            : source.breadcrumbs.map((breadcrumb, index) => {
              const current = index === source.breadcrumbs.length - 1;
              return (
                <span className="inline-flex min-w-0 items-center gap-1" key={`${breadcrumb.sessionId}:${breadcrumb.pathRef.id}`}>
                  {index > 0 ? <ChevronRight className="browse-breadcrumb-separator" size={14} aria-hidden="true" /> : null}
                  <button
                    className="browse-breadcrumb"
                    type="button"
                    disabled={current}
                    aria-current={current ? "page" : undefined}
                    onClick={() => source.navigateToBreadcrumb(breadcrumb)}
                  >
                    {breadcrumb.label}
                  </button>
                </span>
              );
            })}
        </nav>
        <span className="browse-selection-summary" aria-live="polite">{selectionText}</span>
      </div>

      <div className="browse-mode-body">
        {source.enumerationError ? (
          <StateBlock
            tone="error"
            title={t("browseEnumerationFailedTitle")}
            description={t("browseEnumerationFailedDesc")}
            primaryAction={(
              <button className="browse-action" type="button" onClick={() => void source.refreshEnumeration()}>
                <RefreshCw size={15} aria-hidden="true" />
                {t("browseRefresh")}
              </button>
            )}
          />
        ) : source.enumerationState === "loading" && source.entries.length === 0 ? (
          <StateBlock
            tone="info"
            title={t("browseEnumerationLoading")}
            description={t("fileLibraryBrowseTargetDesc")}
            primaryAction={<LoaderCircle className="animate-spin" size={18} aria-label={t("browseEnumerationLoading")} />}
          />
        ) : source.enumerationState === "complete" && source.entries.length === 0 ? (
          <StateBlock
            title={t("browseEnumerationEmptyTitle")}
            description={t("browseEnumerationEmptyDesc")}
          />
        ) : (
          <section className="browse-results-panel" aria-label={t("browseCurrentFolder")}>
            {source.locationError ? (
              <NoticeBanner tone="warning" title={t("browseLocationUnavailable")}>
                {t("browseLocationsDesc")}
              </NoticeBanner>
            ) : null}
            <div className="browse-results-status" role="status" aria-live="polite" data-browse-enumeration-status="true">
              {statusText}
            </div>
            <BrowseEntryList source={source} language={language} t={t} />
            {source.hasMore ? (
              <button
                className="browse-action browse-load-more"
                type="button"
                disabled={source.enumerationState === "loading_more"}
                onClick={() => void source.loadNextPage()}
              >
                {source.enumerationState === "loading_more" ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : null}
                {source.enumerationState === "loading_more" ? t("browseEnumerationLoadingMore") : t("browseLoadMore")}
              </button>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}

function BrowseLocationPicker({
  detached,
  source,
  t
}: {
  detached: boolean;
  source: ReturnType<typeof useBrowseSourceOwner>;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const showLoading = source.locationState === "loading" && source.locations.length === 0;
  const showFailed = source.locationState === "failed" && source.locations.length === 0;
  const showEmpty = source.locationState === "ready" && source.locations.length === 0;

  return (
    <div className="browse-mode" data-browse-source-owner="browse" data-browse-state="locations">
      <header className="browse-mode-header">
        <div className="browse-location-intro min-w-0">
          <h2 className="browse-mode-title truncate text-base font-semibold">{detached ? t("fileLibraryBrowseDetachedTitle") : t("browseLocationsTitle")}</h2>
          <p className="browse-mode-description">
            {detached ? t("fileLibraryBrowseDetachedDesc") : t("browseLocationsDesc")}
          </p>
        </div>
        <button
          className="browse-action"
          type="button"
          disabled={source.locationState === "loading"}
          onClick={() => void source.loadLocations()}
        >
          <RefreshCw size={15} aria-hidden="true" />
          {t("browseLocationsRetry")}
        </button>
      </header>

      {source.locationError ? (
        <NoticeBanner tone="warning" title={t("browseLocationUnavailable")}>
          {t("browseLocationsDesc")}
        </NoticeBanner>
      ) : null}

      <div className="browse-location-panel">
        {showLoading ? (
          <StateBlock
            tone="info"
            title={t("browseLocationsLoading")}
            primaryAction={<LoaderCircle className="animate-spin" size={18} aria-label={t("browseLocationsLoading")} />}
          />
        ) : showFailed ? (
          <StateBlock
            tone="error"
            title={t("browseLocationsEmptyTitle")}
            description={t("browseLocationsEmptyDesc")}
            primaryAction={(
              <button className="browse-action" type="button" onClick={() => void source.loadLocations()}>
                <RefreshCw size={15} aria-hidden="true" />
                {t("browseLocationsRetry")}
              </button>
            )}
          />
        ) : showEmpty ? (
          <StateBlock
            title={t("browseLocationsEmptyTitle")}
            description={t("browseLocationsEmptyDesc")}
          />
        ) : (
          <div className="browse-location-grid" data-browse-locations="true">
            {source.locations.map((location) => (
              <BrowseLocationCard key={locationKey(location)} location={location} source={source} t={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BrowseLocationCard({
  location,
  source,
  t
}: {
  location: LocationDescriptor;
  source: ReturnType<typeof useBrowseSourceOwner>;
  t: ReturnType<typeof useI18nContext>["t"];
}) {
  const activatable = isActivatableLocation(location);
  const statusLabel = locationAvailabilityLabel(location.availability, t);
  const opening = source.admissionLoading && activatable;
  return (
    <article
      className={`browse-location-card${activatable ? "" : " is-unavailable"}`}
      data-browse-location="true"
      data-browse-location-availability={location.availability}
      data-browse-location-openable={activatable ? "true" : "false"}
    >
      <div className="browse-location-card-header">
        <span className="browse-location-card-icon" aria-hidden="true"><Folder size={17} /></span>
        <div className="min-w-0">
          <strong className="browse-location-title">{location.displayName}</strong>
          <span className={`browse-location-status${activatable ? " is-ready" : " is-unavailable"}`}>
            <span aria-hidden="true">•</span>
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="browse-location-actions">
        <button
          className="browse-location-open"
          type="button"
          disabled={!activatable || source.admissionLoading}
          data-browse-location-action="open"
          onClick={() => void source.activateLocation(location)}
        >
          {opening ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : null}
          {opening ? t("browseLocationOpening") : t("browseLocationOpen")}
        </button>
      </div>
    </article>
  );
}

function locationKey(location: LocationDescriptor): string {
  return location.ref.kind === "managed"
    ? `managed:${location.ref.scanRootId}`
    : `ephemeral:${location.ref.browseSessionId}:${location.ref.locationId}`;
}
