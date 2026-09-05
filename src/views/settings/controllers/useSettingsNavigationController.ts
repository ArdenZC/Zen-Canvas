import { useCallback, useEffect, useRef, useState } from "react";
import { SETTINGS_SECTION_EVENT } from "../../../components/spotlight/commandRegistry";
import {
  activeSettingsSectionId,
  scrollSettingsSectionIntoView
} from "../components/SettingsPrimitives";
import {
  SETTINGS_NAV_SECTION_IDS,
  SETTINGS_SECTION_IDS,
  isProgressiveSettingsSectionId,
  settingsNavigationSectionId,
  settingsSectionRequestTarget
} from "../settingsSectionModel";

export { SETTINGS_SECTION_IDS } from "../settingsSectionModel";

type SettingsFocusOptions = { focusContent?: boolean };

export function useSettingsNavigationController() {
  const [activeSettingsSection, setActiveSettingsSection] = useState("settings-general");
  const settingsScrollRef = useRef<HTMLDivElement | null>(null);
  const settingsScrollFrameRef = useRef<number | null>(null);
  const pendingInitialSectionRef = useRef(false);

  const focusSettingsSection = useCallback((sectionId: string, options: SettingsFocusOptions = {}) => {
    const targetId = settingsSectionRequestTarget(sectionId);
    const navigationId = settingsNavigationSectionId(targetId);
    setActiveSettingsSection(navigationId);
    window.requestAnimationFrame(() => {
      scrollSettingsSectionIntoView(settingsScrollRef.current, targetId, {
        ...options,
        revealContent: isProgressiveSettingsSectionId(targetId)
      });
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
      const nextSectionId = activeSettingsSectionId(container, SETTINGS_NAV_SECTION_IDS);
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
