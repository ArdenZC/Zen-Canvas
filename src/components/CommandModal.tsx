import { useEffect, useMemo, useState, type RefObject } from "react";
import { ChevronRight, File, Search, X } from "lucide-react";
import { tauriApi } from "../api/tauriApi";
import type { FileRecord } from "../types/domain";
import type { Translator, View } from "../types/ui";

export function CommandModal({
  inputRef,
  setView,
  setSelectedFileId,
  onClose,
  platform,
  t,
  standalone = false
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  setView: (view: View) => void;
  setSelectedFileId: (id: string) => void;
  onClose: () => void;
  platform: NodeJS.Platform | "browser";
  t: Translator;
  standalone?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FileRecord[]>([]);
  const [queryState, setQueryState] = useState<"idle" | "pending" | "done" | "failed">("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const trimmedSearch = search.trim();
  const showResults = trimmedSearch.length > 0 && results.length > 0;
  const locateKey = platform === "darwin" ? "⌥↵" : "Alt↵";

  useEffect(() => {
    if (!trimmedSearch) {
      setResults([]);
      setQueryState("idle");
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    setQueryState("pending");
    const timer = window.setTimeout(() => {
      tauriApi.getPagedFiles(12, 0, trimmedSearch)
        .then((page) => {
          if (cancelled) return;
          setResults(page.files);
          setQueryState("done");
          setActiveIndex(0);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setQueryState("failed");
        });
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedSearch]);

  const visibleResults = useMemo(() => results.slice(0, 12), [results]);

  function chooseFile(file: FileRecord) {
    setSelectedFileId(file.id);
    setView("library");
    onClose();
  }

  function clearSearch() {
    setSearch("");
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function getResultTone(file: FileRecord) {
    if (file.risk_level === "Sensitive") return "red";
    if (file.lifecycle === "Archive") return "purple";
    return "blue";
  }

  return (
    <div className={`command-backdrop ${standalone ? "standalone" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className={`command-modal ${standalone ? "standalone-modal" : ""} ${showResults ? "rounded-24" : "rounded-36"}`}
        onKeyDown={(event) => {
          if ((event.metaKey && event.key === "Backspace") || (event.ctrlKey && event.key === "Backspace")) {
            event.preventDefault();
            clearSearch();
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, visibleResults.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          }
          if (event.key === "Enter" && visibleResults[activeIndex]) {
            event.preventDefault();
            chooseFile(visibleResults[activeIndex]);
          }
          if (event.key === "Escape") onClose();
        }}
      >
        <div className={`command-search-head ${showResults ? "has-results" : ""}`}>
          <Search className="command-search-icon" size={20} strokeWidth={2.2} />
          <input
            ref={inputRef}
            value={search}
            placeholder={t("commandPlaceholder")}
            onChange={(event) => setSearch(event.target.value)}
            onClick={() => inputRef.current?.focus()}
          />
          {search && (
            <button className="command-clear-button" onClick={clearSearch} aria-label={t("clearSearch")}>
              <X size={16} strokeWidth={2.5} />
            </button>
          )}
          <kbd className="command-esc-key">ESC</kbd>
        </div>
        {showResults && (
          <div className="command-results-panel">
            <div className="command-results">
              <div className="command-section-label">{t("smartMatches")}</div>
              <div className="command-result-stack">
                {visibleResults.map((file, index) => {
                  const tone = getResultTone(file);
                  const extension = file.extension ? file.extension.replace(".", "").toUpperCase() : file.file_type;
                  return (
                    <button
                      key={file.id}
                      className={`result-item-card ${index === activeIndex ? "active-row" : ""}`}
                      onClick={() => chooseFile(file)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className={`result-main-icon ${tone}`}>
                        <File size={20} strokeWidth={1.5} />
                      </span>
                      <span className="result-copy">
                        <strong><HighlightText text={file.name} highlight={trimmedSearch} /></strong>
                        <small>
                          <span>{file.directory || file.path}</span>
                          <i />
                          <em className={tone}>{file.purpose}</em>
                        </small>
                      </span>
                      <span className="result-trailing">
                        <em>{extension}</em>
                        {index === activeIndex && <ChevronRight className="command-row-chevron" size={16} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="command-action-bar">
              <span>{t("matchesFound").replace("{count}", String(visibleResults.length))}</span>
              <div>
                <span><kbd>↵</kbd>{t("openResult")}</span>
                <span><kbd>{locateKey}</kbd>{t("revealPhysical")}</span>
                <span><kbd>⇥</kbd>{t("sortingAdvice")}</span>
              </div>
            </div>
          </div>
        )}
        {trimmedSearch && queryState === "done" && !results.length && (
          <div className="command-results-panel">
            <div className="empty-state compact">{t("noOperations")}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  const value = highlight.trim();
  if (!value) return <>{text}</>;
  const escaped = value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const matcher = new RegExp(`(${escaped})`, "ig");
  return (
    <>
      {text.split(matcher).map((part, index) => (
        part.toLowerCase() === value.toLowerCase()
          ? <mark className="highlight-mark" key={`${part}-${index}`}>{part}</mark>
          : <span key={`${part}-${index}`}>{part}</span>
      ))}
    </>
  );
}
