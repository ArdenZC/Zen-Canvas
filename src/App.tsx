import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  Files,
  FolderOpen,
  FolderSearch,
  Languages,
  ListChecks,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal
} from "lucide-react";
import type {
  AppSnapshot,
  FileQuery,
  FileRecord,
  FolderScanResult,
  OperationPreview,
  Rule
} from "./types/domain";
import { type Language, makeTranslator } from "./i18n";
import { formatBytes, formatDate, percent } from "./utils/format";

type View = "dashboard" | "files" | "rules" | "preview" | "operations" | "settings";
type Translator = ReturnType<typeof makeTranslator>;

const demoFiles = createDemoFiles();
const demoSnapshot: AppSnapshot = {
  stats: {
    totalFiles: demoFiles.length,
    totalSize: demoFiles.reduce((sum, file) => sum + file.size, 0),
    duplicateFiles: demoFiles.filter((file) => file.is_duplicate).length,
    largeFiles: 0,
    sensitiveFiles: demoFiles.filter((file) => file.risk_level === "Sensitive").length,
    needsConfirmation: demoFiles.filter((file) => file.requires_confirmation).length,
    byType: demoFiles.reduce<Record<string, number>>((acc, file) => {
      acc[file.file_type] = (acc[file.file_type] ?? 0) + 1;
      return acc;
    }, {}),
    byLifecycle: demoFiles.reduce<Record<string, number>>((acc, file) => {
      acc[file.lifecycle] = (acc[file.lifecycle] ?? 0) + 1;
      return acc;
    }, {}),
    lastScannedAt: null
  },
  files: demoFiles,
  rules: createDemoRules(),
  operations: [],
  scanRoots: []
};

export function App() {
  const [language, setLanguageState] = useState<Language>(() => preferredLanguage());
  const t = useMemo(() => makeTranslator(language), [language]);
  const [view, setView] = useState<View>("dashboard");
  const [snapshot, setSnapshot] = useState<AppSnapshot>(demoSnapshot);
  const [query, setQuery] = useState<FileQuery>({
    fileType: "All",
    purpose: "All",
    riskLevel: "All",
    sortBy: "modified_at",
    sortDirection: "desc"
  });
  const [selectedFileId, setSelectedFileId] = useState<string>(demoFiles[0]?.id ?? "");
  const [selectedOperationIds, setSelectedOperationIds] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);

  const hasNativeApi = typeof window.fileManager !== "undefined";

  useEffect(() => {
    if (!hasNativeApi) return;
    window.fileManager.getSnapshot().then((next) => {
      if (next.files.length) {
        setSnapshot(next);
        setSelectedFileId(next.files[0]?.id ?? "");
      }
    });
  }, [hasNativeApi]);

  const filteredFiles = useMemo(() => filterFiles(snapshot.files, query), [snapshot.files, query]);
  const selectedFile =
    snapshot.files.find((file) => file.id === selectedFileId) ?? filteredFiles[0] ?? snapshot.files[0];
  const previews = useMemo(() => createOperationPreviews(snapshot.files), [snapshot.files]);
  const reviewFiles = useMemo(
    () => snapshot.files.filter((file) => file.requires_confirmation).slice(0, 5),
    [snapshot.files]
  );

  function setLanguage(next: Language) {
    setLanguageState(next);
    window.localStorage.setItem("fma-language", next);
  }

  async function refreshSnapshot() {
    if (!hasNativeApi) return;
    const next = await window.fileManager.getSnapshot();
    setSnapshot(next);
    setSelectedFileId(next.files[0]?.id ?? "");
  }

  async function handleScan() {
    setIsScanning(true);
    try {
      if (hasNativeApi) {
        await window.fileManager.scanDefaults();
        await refreshSnapshot();
        setStatus(t("success"));
      } else {
        setSnapshot(demoSnapshot);
        setStatus(t("demoMode"));
      }
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setIsScanning(false);
    }
  }

  async function handleChooseFolders() {
    setIsScanning(true);
    try {
      if (hasNativeApi) {
        const result: FolderScanResult = await window.fileManager.chooseAndScanFolders();
        if (result.canceled) {
          setStatus(t("noFolderSelected"));
          return;
        }
        setSelectedFolders(result.selectedPaths);
        const next = await window.fileManager.getSnapshot();
        setSnapshot(next);
        setSelectedFileId(next.files[0]?.id ?? "");
        setStatus(`${t("success")}: ${result.selectedPaths.length} / ${next.files.length}`);
      } else {
        const sampleFolders = ["C:/Users/example/Downloads", "C:/Users/example/Desktop"];
        setSelectedFolders(sampleFolders);
        setSnapshot(demoSnapshot);
        setStatus(t("folderChooserUnavailable"));
      }
    } catch (error) {
      setStatus(readableError(error));
    } finally {
      setIsScanning(false);
    }
  }

  async function saveRule(rule: Rule) {
    if (hasNativeApi) {
      await window.fileManager.saveRule(rule);
      const next = await window.fileManager.reapplyRules();
      setSnapshot(next);
    } else {
      setSnapshot((current) => ({ ...current, rules: [...current.rules, rule] }));
    }
  }

  async function executeSelected() {
    const operations = previews.filter((preview) => selectedOperationIds.has(preview.id));
    if (!operations.length) return;
    if (hasNativeApi) {
      await window.fileManager.executeOperations({ operations });
      await refreshSnapshot();
    }
    setSelectedOperationIds(new Set());
  }

  const nav = [
    { id: "dashboard" as const, label: t("dashboard"), icon: FolderSearch },
    { id: "files" as const, label: t("files"), icon: Files },
    { id: "rules" as const, label: t("rules"), icon: SlidersHorizontal },
    { id: "preview" as const, label: t("preview"), icon: ListChecks },
    { id: "operations" as const, label: t("operations"), icon: Archive },
    { id: "settings" as const, label: t("settings"), icon: Settings }
  ];

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Primary">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <FolderOpen size={21} />
          </div>
          <div>
            <strong>{t("appName")}</strong>
            <span>{t("productEdition")}</span>
          </div>
        </div>

        <nav className="nav-list">
          {nav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => setView(item.id)}
              aria-label={item.label}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <LockKeyhole size={17} />
          <div>
            <strong>{t("privateByDefault")}</strong>
            <span>{t("privacyLine")}</span>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{t("friendlyMode")}</span>
            <h1>{nav.find((item) => item.id === view)?.label}</h1>
            <p>
              {snapshot.stats.lastScannedAt
                ? `${t("lastScan")}: ${formatDate(snapshot.stats.lastScannedAt)}`
                : t("demoMode")}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="icon-button text-action" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
              <Languages size={18} />
              <span>{language === "zh" ? "EN" : "中文"}</span>
            </button>
            <button className="icon-button primary-action" onClick={handleChooseFolders} disabled={isScanning}>
              <FolderSearch size={18} />
              <span>{t("chooseFolders")}</span>
            </button>
          </div>
        </header>

        {status && <div className="status-line">{status}</div>}

        {view === "dashboard" && (
          <HomeView
            snapshot={snapshot}
            t={t}
            selectedFile={selectedFile}
            reviewFiles={reviewFiles}
            previews={previews}
            setView={setView}
            chooseFolders={handleChooseFolders}
            scanCommon={handleScan}
            isScanning={isScanning}
            selectedFolders={selectedFolders}
          />
        )}
        {view === "files" && (
          <FilesView
            files={filteredFiles}
            selectedFile={selectedFile}
            query={query}
            setQuery={setQuery}
            setSelectedFileId={setSelectedFileId}
            t={t}
          />
        )}
        {view === "rules" && <RulesView rules={snapshot.rules} onSave={saveRule} t={t} />}
        {view === "preview" && (
          <PreviewView
            previews={previews}
            selectedIds={selectedOperationIds}
            setSelectedIds={setSelectedOperationIds}
            executeSelected={executeSelected}
            t={t}
          />
        )}
        {view === "operations" && <OperationsView snapshot={snapshot} t={t} />}
        {view === "settings" && <SettingsView language={language} setLanguage={setLanguage} t={t} />}
      </main>
    </div>
  );
}

function HomeView({
  snapshot,
  selectedFile,
  reviewFiles,
  previews,
  setView,
  t,
  chooseFolders,
  scanCommon,
  isScanning,
  selectedFolders
}: {
  snapshot: AppSnapshot;
  selectedFile?: FileRecord;
  reviewFiles: FileRecord[];
  previews: OperationPreview[];
  setView: (view: View) => void;
  chooseFolders: () => Promise<void>;
  scanCommon: () => Promise<void>;
  isScanning: boolean;
  selectedFolders: string[];
  t: Translator;
}) {
  const metrics = [
    { label: t("totalFiles"), value: snapshot.stats.totalFiles.toLocaleString(), icon: Files },
    { label: t("totalSize"), value: formatBytes(snapshot.stats.totalSize), icon: Archive },
    { label: t("needsReview"), value: snapshot.stats.needsConfirmation.toString(), icon: AlertTriangle },
    { label: t("sensitive"), value: snapshot.stats.sensitiveFiles.toString(), icon: ShieldCheck }
  ];

  return (
    <div className="home-layout">
      <section className="scan-studio">
        <div className="scan-copy">
          <span className="promise"><ShieldCheck size={16} /> {t("primaryPromise")}</span>
          <h2>{t("folderPickerTitle")}</h2>
          <p>{t("folderPickerSubtitle")}</p>
          <div className="scan-actions">
            <button className="primary-command" onClick={chooseFolders} disabled={isScanning}>
              <FolderSearch size={20} />
              <span>{isScanning ? t("scanning") : t("chooseFoldersLong")}</span>
            </button>
            <button className="secondary-command" onClick={scanCommon} disabled={isScanning}>
              <RefreshCw size={18} className={isScanning ? "spin" : ""} />
              <span>{t("scanCommon")}</span>
            </button>
          </div>
        </div>

        <div className="flow-card" aria-label={t("guidedStart")}>
          <FlowStep icon={FolderOpen} title={t("stepChoose")} body={t("stepChooseDesc")} />
          <FlowStep icon={FileSearch} title={t("stepScan")} body={t("stepScanDesc")} />
          <FlowStep icon={CheckCircle2} title={t("stepReview")} body={t("stepReviewDesc")} />
        </div>
      </section>

      <section className="summary-strip" aria-label={t("quickSummary")}>
        {metrics.map((metric) => (
          <div className="summary-item" key={metric.label}>
            <metric.icon size={17} />
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </section>

      <section className="panel review-panel">
        <div className="section-heading">
          <div>
            <h2>{t("reviewQueue")}</h2>
            <p>{t("confidenceHint")}</p>
          </div>
          <button
            className="text-link"
            aria-label={`${t("reviewQueue")} ${t("openPreview")}`}
            onClick={() => setView("preview")}
          >
            {t("openPreview")} <ChevronRight size={16} />
          </button>
        </div>
        {reviewFiles.length ? (
          <div className="review-list">
            {reviewFiles.map((file) => (
              <button className="file-row-button" key={file.id} onClick={() => setView("files")}>
                <div>
                  <strong>{file.name}</strong>
                  <span>{file.purpose} / {file.lifecycle}</span>
                </div>
                <RiskBadge risk={file.risk_level} t={t} />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">{t("reviewQueueEmpty")}</div>
        )}
      </section>

      <section className="panel safety-panel">
        <h2>{t("compactSafety")}</h2>
        <SafetyItem icon={LockKeyhole} title={t("localOnly")} body={t("privacyLine")} />
        <SafetyItem icon={ListChecks} title={t("previewRequired")} body={t("previewRequiredDesc")} />
        <SafetyItem icon={AlertTriangle} title={t("noDelete")} body={t("noDeleteDesc")} />
      </section>

      <section className="panel plan-panel">
        <div className="section-heading">
          <div>
            <h2>{t("suggestedPlan")}</h2>
            <p>{t("previewBeforeExecute")}</p>
          </div>
          <span className="count-pill">{previews.length}</span>
        </div>
        <div className="plan-actions">
          <button className="primary-action full" onClick={() => setView("preview")}>
            <ListChecks size={18} />
            <span>{t("openPreview")}</span>
          </button>
          <button className="text-action full" onClick={() => setView("rules")}>
            <SlidersHorizontal size={18} />
            <span>{t("openRuleBuilder")}</span>
          </button>
        </div>
      </section>

      <section className="panel strategy-panel">
        <div className="section-heading">
          <div>
            <h2>{t("strategy")}</h2>
            <p>{t("safeModeDesc")}</p>
          </div>
        </div>
        <div className="segmented">
          <button className="active">{t("builtInRules")}</button>
          <button onClick={() => setView("rules")}>{t("customRules")}</button>
        </div>
        <div className="strategy-copy">
          <p>{t("builtInDesc")}</p>
          <p>{t("customDesc")}</p>
        </div>
      </section>

      <Inspector file={selectedFile} t={t} />
    </div>
  );
}

function FlowStep({
  icon: Icon,
  title,
  body
}: {
  icon: typeof FolderOpen;
  title: string;
  body: string;
}) {
  return (
    <div className="flow-step">
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  );
}

function SafetyItem({
  icon: Icon,
  title,
  body
}: {
  icon: typeof LockKeyhole;
  title: string;
  body: string;
}) {
  return (
    <div className="safety-item">
      <Icon size={17} />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </div>
  );
}

function FilesView({
  files,
  selectedFile,
  query,
  setQuery,
  setSelectedFileId,
  t
}: {
  files: FileRecord[];
  selectedFile?: FileRecord;
  query: FileQuery;
  setQuery: (query: FileQuery) => void;
  setSelectedFileId: (id: string) => void;
  t: Translator;
}) {
  return (
    <div className="content-layout">
      <section className="panel table-panel">
        <div className="toolbar">
          <label className="search-control">
            <Search size={16} />
            <input
              placeholder={t("search")}
              value={query.search ?? ""}
              onChange={(event) => setQuery({ ...query, search: event.target.value })}
            />
          </label>
          <select
            value={query.fileType ?? "All"}
            onChange={(event) => setQuery({ ...query, fileType: event.target.value as FileQuery["fileType"] })}
          >
            {["All", "Document", "Image", "Video", "Code", "Installer", "ArchivePackage", "Other"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={query.sortBy ?? "modified_at"}
            onChange={(event) => setQuery({ ...query, sortBy: event.target.value as FileQuery["sortBy"] })}
          >
            <option value="modified_at">{t("newest")}</option>
            <option value="size">{t("biggest")}</option>
            <option value="confidence">{t("strongest")}</option>
          </select>
          <label className="check-control">
            <input
              type="checkbox"
              checked={Boolean(query.onlyNeedsConfirmation)}
              onChange={(event) => setQuery({ ...query, onlyNeedsConfirmation: event.target.checked })}
            />
            {t("filterNeedsReview")}
          </label>
        </div>
        <FileTable files={files} onSelect={setSelectedFileId} selectedId={selectedFile?.id} t={t} />
      </section>
      <Inspector file={selectedFile} t={t} />
    </div>
  );
}

function FileTable({
  files,
  selectedId,
  onSelect,
  t
}: {
  files: FileRecord[];
  selectedId?: string;
  onSelect: (id: string) => void;
  t: Translator;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("files")}</th>
            <th>{t("purpose")}</th>
            <th>{t("lifecycle")}</th>
            <th>{t("risk")}</th>
            <th>{t("action")}</th>
            <th>{t("confidence")}</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className={selectedId === file.id ? "selected-row" : ""} onClick={() => onSelect(file.id)}>
              <td>
                <strong>{file.name}</strong>
                <span>{formatBytes(file.size)} / {file.file_type}</span>
              </td>
              <td>{file.purpose}</td>
              <td><span className="token">{file.lifecycle}</span></td>
              <td><RiskBadge risk={file.risk_level} t={t} /></td>
              <td>{file.suggested_action}</td>
              <td>{percent(file.confidence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RulesView({
  rules,
  onSave,
  t
}: {
  rules: Rule[];
  onSave: (rule: Rule) => Promise<void>;
  t: Translator;
}) {
  const [name, setName] = useState("Screenshots to Inbox");
  const [field, setField] = useState("name");
  const [operator, setOperator] = useState("contains");
  const [value, setValue] = useState("screenshot");
  const [purpose, setPurpose] = useState("Temporary");
  const [lifecycle, setLifecycle] = useState("Inbox");
  const [weight, setWeight] = useState(76);

  async function submit() {
    const now = nowIso();
    await onSave({
      id: localId("rule"),
      name,
      source: "user",
      enabled: true,
      priority: 75,
      weight,
      root_operator: "AND",
      groups: [
        {
          id: localId("group"),
          operator: "AND",
          conditions: [
            {
              id: localId("cond"),
              field: field as Rule["groups"][number]["conditions"][number]["field"],
              operator: operator as Rule["groups"][number]["conditions"][number]["operator"],
              value
            }
          ]
        }
      ],
      action: {
        purpose: purpose as Rule["action"]["purpose"],
        lifecycle: lifecycle as Rule["action"]["lifecycle"],
        suggested_action: "Move",
        target_template: "00_Inbox/Screenshots",
        context: "Screenshots"
      },
      created_at: now,
      updated_at: now
    });
  }

  return (
    <div className="content-layout">
      <section className="panel rule-builder">
        <div className="section-heading">
          <div>
            <h2>{t("ruleBuilder")}</h2>
            <p>{t("customDesc")}</p>
          </div>
        </div>
        <div className="form-grid">
          <label>{t("ruleName")}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>{t("field")}<select value={field} onChange={(event) => setField(event.target.value)}>
            {["name", "extension", "file_type", "path", "directory", "size", "modified_at", "risk_level"].map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <label>{t("operator")}<select value={operator} onChange={(event) => setOperator(event.target.value)}>
            {["contains", "equals", "startsWith", "endsWith", "greaterThan", "lessThan", "olderThanDays", "newerThanDays"].map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <label>{t("value")}<input value={value} onChange={(event) => setValue(event.target.value)} /></label>
          <label>{t("purpose")}<select value={purpose} onChange={(event) => setPurpose(event.target.value)}>
            {["Temporary", "Career", "Finance", "Study", "Project", "Personal", "Media", "Unknown"].map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <label>{t("lifecycle")}<select value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
            {["Inbox", "Active", "Reference", "Archive", "Disposable", "Sensitive"].map((item) => <option key={item}>{item}</option>)}
          </select></label>
          <label>{t("weight")}<input type="number" value={weight} onChange={(event) => setWeight(Number(event.target.value))} /></label>
        </div>
        <button className="primary-action" onClick={submit}><Plus size={17} />{t("saveRule")}</button>
      </section>

      <section className="panel rules-list">
        <h2>{t("strategy")}</h2>
        {rules.map((rule) => (
          <div className="rule-row" key={rule.id}>
            <div>
              <strong>{rule.name}</strong>
              <span>{rule.source} / weight {rule.weight} / priority {rule.priority}</span>
            </div>
            <span className={`source ${rule.source}`}>{rule.source}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function PreviewView({
  previews,
  selectedIds,
  setSelectedIds,
  executeSelected,
  t
}: {
  previews: OperationPreview[];
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  executeSelected: () => Promise<void>;
  t: Translator;
}) {
  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  return (
    <section className="panel table-panel">
      <div className="section-heading">
        <div>
          <h2>{t("suggestedPlan")}</h2>
          <p>{t("previewBeforeExecute")}</p>
        </div>
        <button className="primary-action" onClick={executeSelected} disabled={!selectedIds.size}>
          <Play size={17} /> {t("executeSelected")} / {selectedIds.size} {t("selected")}
        </button>
      </div>
      {!previews.length ? <div className="empty-state">{t("noOperations")}</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>{t("action")}</th>
                <th>{t("sourcePath")}</th>
                <th>{t("targetPath")}</th>
                <th>{t("newName")}</th>
                <th>{t("confidence")}</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((preview) => (
                <tr key={preview.id}>
                  <td><input type="checkbox" checked={selectedIds.has(preview.id)} onChange={() => toggle(preview.id)} /></td>
                  <td>{preview.operation_type}</td>
                  <td className="path-cell">{preview.source_path}</td>
                  <td className="path-cell">{preview.target_path}</td>
                  <td>{preview.new_name}</td>
                  <td>{percent(preview.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OperationsView({ snapshot, t }: { snapshot: AppSnapshot; t: Translator }) {
  if (!snapshot.operations.length) {
    return <section className="panel"><div className="empty-state">{t("noOperationHistory")}</div></section>;
  }

  return (
    <section className="panel rules-list">
      <div className="section-heading">
        <div>
          <h2>{t("operationHistory")}</h2>
          <p>{t("previewBeforeExecute")}</p>
        </div>
      </div>
      {snapshot.operations.map((operation) => (
        <div className="rule-row" key={operation.id}>
          <div>
            <strong>{operation.operation_type} / {t(operation.status)}</strong>
            <span>{operation.source_path} / {operation.target_path}</span>
            {operation.error_message && <span>{operation.error_message}</span>}
          </div>
          <span className={`source ${operation.status}`}>{t(operation.status)}</span>
        </div>
      ))}
    </section>
  );
}

function SettingsView({
  language,
  setLanguage,
  t
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translator;
}) {
  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <div>
          <h2>{t("settings")}</h2>
          <p>{t("languageDesc")}</p>
        </div>
      </div>
      <div className="setting-row">
        <span>{t("language")}</span>
        <div className="segmented compact">
          <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>中文</button>
          <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
        </div>
      </div>
      <div className="setting-row">
        <span>{t("releaseReady")}</span>
        <strong>{t("releaseReadyDesc")}</strong>
      </div>
      <div className="setting-row">
        <span>{t("localOnly")}</span>
        <strong>{t("privacyLine")}</strong>
      </div>
    </section>
  );
}

function Inspector({ file, t }: { file?: FileRecord; t: Translator }) {
  if (!file) return null;
  return (
    <aside className="panel inspector">
      <div className="section-heading">
        <div>
          <h2>{t("recentSignals")}</h2>
          <p>{t("reason")}</p>
        </div>
        <RiskBadge risk={file.risk_level} t={t} />
      </div>
      <h3>{file.name}</h3>
      <div className="inspector-grid">
        <span>{t("purpose")}</span><strong>{file.purpose}</strong>
        <span>{t("lifecycle")}</span><strong>{file.lifecycle}</strong>
        <span>{t("confidence")}</span><strong>{percent(file.confidence)}</strong>
        <span>{t("action")}</span><strong>{file.suggested_action}</strong>
      </div>
      <div className="explain-box">
        <strong>{t("matchedRules")}</strong>
        <p>{file.matched_rules.join(", ") || "-"}</p>
        <strong>{t("reason")}</strong>
        <p>{file.classification_reason || "-"}</p>
      </div>
      <div className="path-list">
        <span>{t("sourcePath")}</span>
        <code>{file.path}</code>
        <span>{t("targetPath")}</span>
        <code>{file.suggested_target_path || "-"}</code>
      </div>
    </aside>
  );
}

function RiskBadge({ risk, t }: { risk: string; t: Translator }) {
  const label =
    risk === "Normal" ? t("normal") :
    risk === "Sensitive" ? t("sensitiveLabel") :
    risk === "System" ? t("system") :
    t("unknown");
  return <span className={`risk ${risk.toLowerCase()}`}>{label}</span>;
}

function filterFiles(files: FileRecord[], query: FileQuery): FileRecord[] {
  const search = query.search?.toLowerCase().trim();
  const filtered = files.filter((file) => {
    if (search && !`${file.name} ${file.path} ${file.context}`.toLowerCase().includes(search)) return false;
    if (query.fileType && query.fileType !== "All" && file.file_type !== query.fileType) return false;
    if (query.purpose && query.purpose !== "All" && file.purpose !== query.purpose) return false;
    if (query.riskLevel && query.riskLevel !== "All" && file.risk_level !== query.riskLevel) return false;
    if (query.onlyNeedsConfirmation && !file.requires_confirmation) return false;
    return true;
  });

  const sortBy = query.sortBy ?? "modified_at";
  const direction = query.sortDirection === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
    return String(left).localeCompare(String(right)) * direction;
  });
}

function createOperationPreviews(files: FileRecord[]): OperationPreview[] {
  return files
    .filter((file) => ["Move", "Rename", "MoveAndRename", "Archive"].includes(file.suggested_action))
    .filter((file) => file.risk_level !== "Sensitive")
    .map((file) => {
      const newName = file.suggested_name || file.name;
      const targetDirectory =
        file.suggested_target_path || (file.suggested_action === "Rename" ? file.directory : "");
      const targetPath = targetDirectory ? joinPathLike(targetDirectory, newName) : file.path;
      const isMove = Boolean(targetDirectory) && normalizePathLike(targetDirectory) !== normalizePathLike(file.directory);
      const isRename = newName !== file.name;
      const operationType: OperationPreview["operation_type"] =
        isMove && isRename ? "move_rename" : isMove ? "move" : "rename";
      return {
        id: localId("op"),
        fileId: file.id,
        operation_type: operationType,
        source_path: file.path,
        target_path: targetPath,
        old_name: file.name,
        new_name: newName,
        status: "pending" as const,
        risk_level: file.risk_level,
        confidence: file.confidence,
        requires_confirmation: file.requires_confirmation,
        reason: file.classification_reason
      };
    })
    .filter((preview) => normalizePathLike(preview.source_path) !== normalizePathLike(preview.target_path));
}

function createDemoFiles(): FileRecord[] {
  const now = new Date().toISOString();
  const files: Array<Partial<FileRecord> & Pick<FileRecord, "name" | "file_type" | "purpose" | "lifecycle" | "risk_level" | "suggested_action" | "confidence" | "classification_reason">> = [
    {
      name: "resume_2026.pdf",
      file_type: "Document",
      purpose: "Career",
      lifecycle: "Reference",
      risk_level: "Normal",
      suggested_action: "Move",
      confidence: 0.84,
      classification_reason: "Matched Career and resume files"
    },
    {
      name: "invoice_apple.pdf",
      file_type: "Document",
      purpose: "Finance",
      lifecycle: "Reference",
      risk_level: "Sensitive",
      suggested_action: "Review",
      confidence: 0.78,
      classification_reason: "Matched Finance and receipt files; sensitive files require manual confirmation"
    },
    {
      name: "passport_scan.jpg",
      file_type: "Image",
      purpose: "Identity",
      lifecycle: "Sensitive",
      risk_level: "Sensitive",
      suggested_action: "Review",
      confidence: 0.92,
      classification_reason: "Matched Sensitive identity documents; sensitive files require manual confirmation"
    },
    {
      name: "setup.exe",
      file_type: "Installer",
      purpose: "Installer",
      lifecycle: "Disposable",
      risk_level: "Normal",
      suggested_action: "Review",
      confidence: 0.68,
      classification_reason: "Matched Installers and setup packages"
    },
    {
      name: "UNSW_COMP9900_Final_Report.pdf",
      file_type: "Document",
      purpose: "Study",
      lifecycle: "Archive",
      risk_level: "Normal",
      suggested_action: "Move",
      confidence: 0.72,
      classification_reason: "Matched Study material and coursework"
    },
    {
      name: "Screenshot 2026-06-15 at 10.22.01.png",
      file_type: "Image",
      purpose: "Media",
      lifecycle: "Inbox",
      risk_level: "Normal",
      suggested_action: "Rename",
      confidence: 0.62,
      classification_reason: "Matched Downloads and desktop inbox"
    }
  ];

  return files.map((file, index) => {
    const directory = "C:/Users/example/Downloads";
    const path = `${directory}/${file.name}`;
    const extension = file.name.split(".").pop() ?? "";
    return {
      id: `demo_${index}`,
      name: file.name,
      path,
      directory,
      extension,
      size: (index + 1) * 2_400_000,
      file_type: file.file_type,
      purpose: file.purpose,
      lifecycle: file.lifecycle,
      context: file.context ?? file.purpose,
      risk_level: file.risk_level,
      hash: null,
      created_at: now,
      modified_at: new Date(Date.now() - index * 8 * 86_400_000).toISOString(),
      scanned_at: now,
      last_seen_at: now,
      is_hidden: false,
      is_deleted: false,
      is_duplicate: false,
      suggested_action: file.suggested_action,
      suggested_target_path:
        file.suggested_action === "Move" ? `C:/Users/example/FileAssistant/${file.purpose}` : "",
      suggested_name:
        file.suggested_action === "Rename" ? "screenshot_20260615_001.png" : file.name,
      confidence: file.confidence,
      classification_reason: file.classification_reason,
      matched_rules: [file.classification_reason.replace("; sensitive files require manual confirmation", "")],
      requires_confirmation: file.risk_level === "Sensitive" || file.suggested_action === "Review"
    };
  });
}

function createDemoRules(): Rule[] {
  const now = new Date().toISOString();
  return [
    demoRule("system_career", "Career and resume files", "system", 90, 84),
    demoRule("system_finance", "Finance and receipt files", "system", 80, 80),
    demoRule("system_identity", "Sensitive identity documents", "system", 100, 95),
    {
      ...demoRule("user_screenshots", "Screenshots to Inbox", "user", 75, 76),
      action: {
        purpose: "Temporary" as const,
        lifecycle: "Inbox" as const,
        suggested_action: "Move" as const,
        target_template: "00_Inbox/Screenshots",
        context: "Screenshots"
      }
    }
  ].map((rule) => ({ ...rule, created_at: now, updated_at: now }));
}

function demoRule(
  id: string,
  name: string,
  source: Rule["source"],
  priority: number,
  weight: number
): Rule {
  const now = new Date().toISOString();
  return {
    id,
    name,
    source,
    enabled: true,
    priority,
    weight,
    root_operator: "AND",
    groups: [
      {
        id: `${id}_group`,
        operator: "AND",
        conditions: [{ id: `${id}_cond`, field: "name", operator: "contains", value: name.split(" ")[0] }]
      }
    ],
    action: { suggested_action: "Move", target_template: "00_Inbox" },
    created_at: now,
    updated_at: now
  };
}

function joinPathLike(directory: string, name: string): string {
  const separator = directory.includes("\\") ? "\\" : "/";
  return `${directory.replace(/[\\/]+$/, "")}${separator}${name}`;
}

function normalizePathLike(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function preferredLanguage(): Language {
  if (typeof window === "undefined") return "zh";
  return window.localStorage.getItem("fma-language") === "en" ? "en" : "zh";
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function localId(prefix: string): string {
  return `${prefix}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}
