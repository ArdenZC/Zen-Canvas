import { useCallback, useEffect, useRef, useState } from "react";
import { SETTINGS_SECTION_EVENT } from "../../../components/spotlight/commandRegistry";
import {
  activeSettingsSectionId,
  scrollSettingsSectionIntoView
} from "../components/SettingsPrimitives";

export const SETTINGS_SECTION_IDS = [
  "settings-general",
  "settings-appearance",
  "settings-files-scan",
  "settings-search",
  "settings-global-index",
  "settings-managed-scopes",
  "settings-automation",
  "settings-ai",
  "settings-privacy",
  "settings-about"
] as const;

type SettingsFocusOptions = { focusContent?: boolean };

export function useSettingsNavigationController() {
  const [activeSettingsSection, setActiveSettingsSection] = useState("settings-general");
  const settingsScrollRef = useRef<HTMLDivElement | null>(null);
  const settingsScrollFrameRef = useRef<number | null>(null);
  const pendingInitialSectionRef = useRef(false);

  const focusSettingsSection = useCallback((sectionId: string, options: SettingsFocusOptions = {}) => {
    const targetId = sectionId === "settings-search-scope" ? "settings-search" : sectionId;
    setActiveSettingsSection(targetId);
    window.requestAnimationFrame(() => {
      scrollSettingsSectionIntoView(settingsScrollRef.current, targetId, options);
    });
  }, []);

  useEffect(() => {
    function handleSectionRequest(event: Event) {
      const sectionId = (event as CustomEvent<string>).detail;
      if (sectionId) focusSettingsSection(sectionId);
    }

    window.addEventListener(SETTINGS_SECTION_EVENT, handleSectionRequest);
    let hasPendingSection = false;
    try {
      const pendingSection = window.sessionStorage.getItem(SETTINGS_SECTION_EVENT);
      if (pendingSection) {
        hasPendingSection = true;
        pendingInitialSectionRef.current = true;
        window.sessionStorage.removeItem(SETTINGS_SECTION_EVENT);
        focusSettingsSection(pendingSection);
      }
    } catch {
      // In-memory events still work when storage is unavailable.
    }
    if (!hasPendingSection) {
      const container = settingsScrollRef.current;
      if (container) container.scrollTop = 0;
      setActiveSettingsSection("settings-general");
    }
    return () => window.removeEventListener(SETTINGS_SECTION_EVENT, handleSectionRequest);
  }, [focusSettingsSection]);

  useEffect(() => {
    const container = settingsScrollRef.current;
    if (!container) return undefined;

    const updateActiveSection = () => {
      settingsScrollFrameRef.current = null;
      if (pendingInitialSectionRef.current) {
        pendingInitialSectionRef.current = false;
        return;
      }
      const nextSectionId = activeSettingsSectionId(container, SETTINGS_SECTION_IDS);
      if (!nextSectionId) return;
      setActiveSettingsSection((current) => current === nextSectionId ? current : nextSectionId);
    };

    const scheduleUpdate = () => {
      if (settingsScrollFrameRef.current !== null) return;
      settingsScrollFrameRef.current = window.requestAnimationFrame(updateActiveSection);
    };

    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    scheduleUpdate();
    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      if (settingsScrollFrameRef.current !== null) window.cancelAnimationFrame(settingsScrollFrameRef.current);
      settingsScrollFrameRef.current = null;
    };
  }, []);

  return { activeSettingsSection, focusSettingsSection, settingsScrollRef };
}
