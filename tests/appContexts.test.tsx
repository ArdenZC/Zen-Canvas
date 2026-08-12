// @vitest-environment happy-dom

import { act, createElement, memo, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  ChromeProvider,
  useCommandContext,
  useI18nContext,
  type ChromeContextValue
} from "../src/contexts/AppContexts";
import type { Translator } from "../src/types/ui";

const t = ((key: string) => key) as Translator;

const I18nRenderProbe = memo(function I18nRenderProbe({ onRender }: { onRender: () => void }) {
  const { t: translate } = useI18nContext();
  onRender();
  return createElement("output", { "data-testid": "i18n-probe" }, translate("appName"));
});

function CommandProbe() {
  const { setIsCommandOpen } = useCommandContext();
  return createElement("button", { onClick: () => setIsCommandOpen(true) }, "open");
}

describe("split app chrome contexts", () => {
  it("does not notify an i18n-only consumer when command state changes", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let i18nRenderCount = 0;
    const onI18nRender = () => { i18nRenderCount += 1; };
    const base = {
      language: "en",
      setLanguage: () => undefined,
      theme: "system",
      setTheme: () => undefined,
      effectiveTheme: "light",
      view: "library",
      setView: () => undefined,
      onError: () => undefined,
      t,
      commandInputRef: { current: null },
      isCommandOpen: false,
      platform: "win32",
      isWindows: true,
      hotkeyLabel: "Ctrl+K",
      isSearchMode: false,
      closeBehavior: "ask",
      setCloseBehavior: async () => true,
      isCloseChoiceOpen: false,
      onCancelCloseChoice: () => undefined,
      handleWindowAction: async () => undefined,
      requestClose: () => undefined,
      resolveCloseChoice: async () => undefined
    } as unknown as ChromeContextValue;

    function Harness() {
      const [isCommandOpen, setIsCommandOpen] = useState(false);
      return createElement(
        ChromeProvider,
        {
          value: { ...base, isCommandOpen, setIsCommandOpen },
          children: createElement(
            "div",
            null,
            createElement(I18nRenderProbe, { onRender: onI18nRender }),
            createElement(CommandProbe)
          )
        }
      );
    }

    const root = createRoot(container);
    act(() => root.render(createElement(Harness)));
    expect(i18nRenderCount).toBe(1);

    act(() => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(i18nRenderCount).toBe(1);

    act(() => root.unmount());
    container.remove();
  });
});
