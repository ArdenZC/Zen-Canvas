"""Serialize the human-authored role audit with reproducible source anchors."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
sources = {
 'shell': ('src/components/AppShell.tsx','const workspaceClass'),
 'titlebar': ('src/components/AppShell.tsx','const titlebar ='),
 'nav': ('src/components/AppShell.tsx','const navItemBase'),
 'surfaces': ('src/components/ui/surfaces.ts','export const pageHeader ='),
 'section': ('src/components/ui/surfaces.ts','export const sectionHeading'),
 'panel': ('src/utils/tw.ts','export const contentSurface'),
 'raised': ('src/utils/tw.ts','export const raisedSurface'),
 'button': ('src/utils/tw.ts','inline-flex min-h-10'),
 'buttonComponent': ('src/components/ui/Button.tsx','export function Button'),
 'icon': ('src/components/ui/Button.tsx','export function IconButton'),
 'input': ('src/utils/tw.ts','export const inputSurface'),
 'empty': ('src/utils/tw.ts','export const emptyState'),
 'notice': ('src/components/ui/Notice.tsx','export function NoticeBanner'),
 'state': ('src/components/ui/Notice.tsx','export function StateBlock'),
 'segment': ('src/views/shared/ui.ts','export function segmentButton'),
 'row': ('src/views/shared/ui.ts','export function interactiveRow'),
 'search': ('src/views/shared/ui.ts','export function SearchField'),
 'task': ('src/views/shared/ui.ts','export function DurableTaskStatus'),
 'inspector': ('src/views/shared/ui.ts','export function InspectorLayout'),
 'sheet': ('src/views/shared/ui.ts','export function SideSheet'),
 'dialog': ('src/views/shared/ui.ts','export function ConfirmDialog'),
 'switch': ('src/components/ui/Switch.tsx','export function toggleSwitch'),
 'settingsSwitch': ('src/views/settings/components/SettingsPrimitives.tsx','export function SettingsSwitchControl'),
 'settings': ('src/views/settings/components/SettingsPrimitives.tsx','export function SettingsSection'),
 'settingsRow': ('src/views/settings/components/SettingsPrimitives.tsx','export function SettingsRow'),
 'settingsField': ('src/views/settings/components/SettingsPrimitives.tsx','const settingsControl'),
 'settingsSegment': ('src/views/settings/components/SettingsPrimitives.tsx','export function SettingsSegmentedControl'),
 'settingsEmpty': ('src/views/settings/components/SettingsPrimitives.tsx','export function SettingsEmptyState'),
 'settingsNotice': ('src/views/settings/components/SettingsPrimitives.tsx','export function SettingsInlineMessage'),
 'toolbar': ('src/views/fileLibrary/fileLibraryWorkspace.css','.file-library-command-bar {'),
 'chromeToggle': ('src/views/fileLibrary/fileLibraryWorkspace.css','.file-library-command-group,'),
 'context': ('src/views/fileLibrary/fileLibraryWorkspace.css','.file-library-context-content-inner {'),
 'list': ('src/views/fileLibrary/list/sharedFileList.css','.shared-file-list-header,'),
 'listState': ('src/views/fileLibrary/list/sharedFileList.css','.shared-file-list-row.is-selected'),
 'listMetric': ('src/views/fileLibrary/list/SharedFileList.tsx','const ROW_HEIGHT'),
 'grid': ('src/views/fileLibrary/list/sharedFileGrid.css','.shared-file-grid'),
 'gridMetric': ('src/views/fileLibrary/list/SharedFileGrid.tsx','const GRID_ROW_HEIGHT'),
 'preview': ('src/views/fileLibrary/preview/zenFloatingQuickPreview.css','.zc-floating-preview-header {'),
 'previewAction': ('src/views/fileLibrary/preview/zenFloatingQuickPreview.css','.zc-floating-preview-action {'),
 'previewState': ('src/views/fileLibrary/preview/zenFloatingQuickPreview.css','.zc-preview-representation'),
 'historySearch': ('src/views/history/HistorySearchField.tsx','export function HistorySearchField'),
 'command': ('src/components/CommandModal.tsx','const commandResultsShell'),
 'toast': ('src/utils/tw.ts','export const statusToast'),
 'tokens': ('src/styles/tokens.css','--zc-radius-control:'),
 'css': ('src/styles.css','button:focus-visible,'),
 'closeDialog': ('src/components/ShellChrome.tsx','export function CloseChoiceDialog'),
 'filter': ('src/views/vault/components/FileLibraryFilterPopover.tsx','export'),
 'ruleDialog': ('src/views/automation/AutomationRuleDialog.tsx','export'),
 'cleanup': ('src/views/cleanup/StorageCleanupView.tsx','export'),
 'overview': ('src/views/overview/OverviewPriorityTask.tsx','export'),
 'badge': ('src/components/ui/Badge.tsx','export'),
}
screens = {
 'O':'Overview-medium-1299x884', 'L':'FileLibrary-all-indexed-21', 'P':'QuickPreview-Welcome-Markdown',
 'S':'Settings-overview', 'B':'Browse-navigation-open', 'H':'History-initial', 'C':'Cleanup-scan-fixture-result',
 'R':'Automation-rules-initial-english-dark', 'D':'Automation-rule-manual-builder-english-dark',
 'A':'Settings-appearance-english-dark', 'AI':'Settings-AI-english-dark', 'G':'FileLibrary-grid',
 'F':'FileLibrary-multi-selection-ctrl-a', 'I':'ContextPanel-Welcome', 'N':'FileLibrary-narrow-969x675',
 'E':'QuickPreview-image-unavailable', 'PDF':'QuickPreview-PDF-metadata-fallback',
 'GI':'Settings-global-index-unavailable', 'PD':'Settings-platform-and-managed-scopes-english-dark',
 'OP':'OrganizationPlan-missing-info', 'K':'R0-keyboard-focus', 'SL':'Settings-appearance-chinese-light-restored',
}
# role | severity | source keys | screen keys | dimensions | spacing | typography | shape/elevation | concrete issue | canonical / retain variants / retire
rows = '''App/window titlebar|C2|titlebar,preview,closeDialog|O,L,P|Shell 48 high; search launcher 32; OS controls 44x48|Shell x16; Preview header x1.1rem|Launcher text-xs; Preview .72rem/650 kicker|Pill launcher; Preview floating radius20|Shell is consistent across pages; Preview adds a second independently measured title/close system|ShellChrome plus OverlayHeader / retain OS adapters / retire local overlay header metrics
Sidebar item|C1|nav,settings,chromeToggle|O,S,A|App min40; Settings min36; location min34|App gap12; Settings x12 y8; location gap8|App 14/500; location12/600|App rail+tonal; Settings tonal; location inset border|Current destination gets three independent selection markers|NavigationItem with app/local roles / retain scope hierarchy / retire independent selected recipes
Page header|C0|shell,surfaces,toolbar|O,L,S|Page title declared24; Library target12; no Library h1 strip|Ordinary shell20; Library0; narrow12 vs0; header mb16|24/600 tracking-.01em vs target12/600|Ordinary bare title; Library command strip|20 CSS px content-edge split is explicit; workspace mode does not require a different inset authority|PageHeader workspace and document variants / retain compact location label / retire shell special-case inset
Section header|C1|section,settings,preview|O,S,P|Shared18; settings disclosure16; Preview16.8 at root16|Shared subtitle mt4; settings group pt20; preview title mt4|600 shared; 700 preview;650 kicker|No elevation needed|Heading hierarchy is local rather than a declared role map; 16 disclosure vs18 normal can be intentional|SectionHeader with pane/group variants / retain subordinate diagnostics / retire arbitrary weights
Workspace command bar|C0|toolbar,surfaces,shell|L,N,H|Library min42 but wraps; generic toolbar no height|Library gap8 bottom10 x2; generic gap12|Library command12/600 vs generic14/500|Library divider; generic raised panel via toolbarSurface|Navigation, search and management blocks compound into several chrome rows|Toolbar owns grouping and overflow order / retain navigation+query groups / retire feature metric sheet
Search field|C1|search,historySearch,toolbar,command|L,H,S|Shared min40; Library override34; History min40; launcher32|Search x12 gap8; History gap8|Search icon16; History15; shared text14 declaration|Field radius12; launcher pill|Same field anatomy forked and then resized by feature CSS; launcher is a valid distinct role|SearchField scope and density props / retain launcher and command dialog roles / retire HistorySearchField styling and local override
Primary button|C1|button,buttonComponent,segment|C,O,OP|Recipe min40; component36 or40; segment min32|Button x16 y8; compact x12 y6|14/500 default;12 compact|radius10 primary fill shadow-sm|Selected segment reuses the visual emphasis of an execute CTA; component appends competing sizing utilities|Button primary plus SegmentedControl selection / retain danger and compact variants / retire local size overrides
Secondary button|C1|button,buttonComponent,previewAction|L,P,H|Default min40; Preview36|x16/y8 vs .65rem horizontal|14/500 vs .78rem/650|radius10; shadow-sm vs no shadow|Repeated actions have independent dimensions and elevation|Button secondary / retain compact36 and default40 / retire preview action recipe
Ghost/icon button|C2|icon,previewAction,context|P,I,L|IconButton36; context close30; shared clear h32 override|Preview gap.45rem; context header x12|Close icon varies by caller|Common radius10; chrome borderless|Hit-target and visible-square bounds are coupled differently by host|IconButton size prop and optional quiet chrome / retain OS controls / retire context/preview close recipes
Segmented/chrome toggle|C0|segment,settingsSegment,chromeToggle|L,A,OP|Shared min32; settings min32 plus padding; library min30|Shared/settings group p4 gap4; Library p2 gap2|Shared/settings14; Library12/600|Shared primary fill; Settings underline; Library inset border|Same mutually exclusive choice reads as CTA, radio-tab and outlined toggle|SegmentedControl visual owner / retain tab versus radio semantics / retire segmentButton and settings/local CSS styling
Input|C1|input,settingsField|D,S|Both min40 source declarations|Both x12|Both14; global font inherit may override utility typography|Generic radius12 vs Settings10|Even visually close fields bypass a unique anatomy; cascade order matters|Input owns field tokens / retain numeric/secret input behavior / retire settingsControl visual recipe
Select|C1|input,settingsField,toolbar|L,D,AI|Generic40; local command group30/34 context|Field x12 vs toolbar5x9|14 generic;12 command role|Generic12 vs Settings10; native arrow|Mixed native select and icon disclosure align by feature rather than density|Select plus DisclosureButton / retain native select behavior / retire page radius and arrow spacing
Switch|C1|switch,settingsSwitch|S,AI|Both track48x28 thumb20; Settings target min40|Shared thumb top4; settings vertically centered|Label14 via row|Shared shadow-inner and checked glow; Settings no track glow|Same geometry has two independent DOM/style implementations and disabled treatments|Switch visual primitive with semantic input / retain SettingsRow composition / retire toggleSwitch versus Settings track duplication after behavior parity
Toolbar|C1|surfaces,toolbar,raised|L,H,OP|Shared toolbar auto; Library min42|Shared gap12; raised x12 y8; Library gap8|Caller-controlled14/12|Raised16/shadow vs bottom divider|Generic flex recipe defines no item density or overflow contract|Toolbar with command and contextual variants / retain operation decision bar / retire scattered wrappers
Notice/status strip|C1|notice,settingsNotice,toast|C,GI,OP|Content-driven; no common reserved height|Notice y8/12; settings y8; toast x16 y12|Notice14 leading24; title strong|Tonal box vs neutral toast red edge|One error appears globally and locally; same status has divergent title/action anatomy|Notice plus separate transient Toast / retain consequence-specific tone / retire SettingsInlineMessage visual fork
State block|C0|state,settingsEmpty,empty,overview,previewState|O,H,C,E|Shared min112; Preview unavailable min192; Overview hero content-driven|State x20 y24; legacy x16 y24; Preview24|State title16; settings14; Preview .86rem body|row8 dashed vs field12 dashed vs flat preview|Empty, unavailable and recovery use unrelated compositions across the product|StateBlock size and host slots / retain dense pane versus workspace context / retire independent empty-state layouts
Content panel|C1|panel,surfaces,context|O,L,I|No universal size; pane widths contextual|Form16; panelSurface20; context14|Body14 vs context12|radius16 vs context8|Token names exist but context/row/panel roles lack one nesting contract|Panel with content/inset variants / retain pane geometry / retire local content backgrounds and radius selection
Raised panel|C2|raised,surfaces|H,R|Content-driven|toolbar12x8; panel20|Caller-driven|radius16 raised; appPanel24 raised|Static history shell gains depth similar to actionable/floating surfaces|Panel elevated only by semantic layer / retain overlays / retire default raised shell for every nested group
Card|C2|panel,badge,overview|O,R|Metric/card content-driven|p16/p20; metric strips x12/16|Metric18/24/30 roles need separation|Border plus inset cards|Grouping and clickable object cards are visually conflated|Card uses Panel+Row / retain summary metric hierarchy / retire feature card recipes
List row|C1|row,list,listMetric|L,H|Shared52/42 minimum; file44 fixed virtual row|Shared p12; compact12x8; file x12 gap12 namegap9|File13 name/600+12 meta; shared caller14|Shared rounded border+shadow; file flat divider|Virtual rows and card rows need explicit variants; 44 cannot be replaced without virtualizer agreement|Row list/card variants / retain fixed virtual height contract / retire ad hoc row recipes
Grid item|C2|grid,gridMetric,list|G,L|Grid row204; placeholder icon folder32/file30 vs list17|Thumbnail/content gaps local|Grid metadata truncates a joined line|Thumbnail and tile nested surfaces|Metadata loses useful suffixes; file/folder optical stroke differs1.5/1.6|GridItem uses Row selection tokens / retain thumbnail density / retire unexplained fallback size/stroke differences
Table header|C2|list,surfaces|L,H|File header min34; rows44|Header7x12; shared row x12|Header11/700 vs row13/600|1px divider; sticky background|11px heavy label contrasts with larger general section roles without semantic mapping|TableHeader and ColumnSpec / retain sticky and shared column grid / retire local label metrics
Selection|C0|listState,row,segment,settingsSegment,nav|F,OP,A|Independent of component dimensions|Row inset outline versus external glow|Primary contrast on generic segment; normal text in Library|Tonal+focus separate in file list; selected shared row gets focus-soft halo|Good list model exists; shared row selection borrows focus ring token; segment CTA saturation conflicts|Interaction state tokens / retain list selection-focus separation / retire focus token from selected styling
Keyboard focus|C1|css,listState,search,historySearch|F,K,D|Global outline2 offset2; file outline2 inset2|Search wrapper halo3; History wrapper outline+halo|No typography change expected|Global focus fallback exists including preview buttons|Do not claim missing icon focus from local CSS absence; double border+halo and clipping remain risks|Focus primitive external/inset modes / retain global fallback and roving focus / retire multi-owner focus decoration
Inspector|C1|inspector,context,settingsRow|I,H,PD|Shared width320; sheet480; settings controls360/480|Inspector gap16; context padding14; settings y16|Context12 vs Settings14|Context radius8; generic raised parent24|Property rows and pane headers diverge, though authorities must remain separate|Inspector+PropertyRow / retain source adapters and permissions / retire local presentation only
Side Sheet|C2|sheet,context|I,B|Max480 shared; local inline widths contextual|Sheet20x16; inner context14 gives additive inset|Sheet heading18/600; inner local13/700|Floating shadow; edge border|Nested wrapper padding makes title and content left edges shift again|Sheet slots own outer inset / retain navigation vs inspector sides / retire duplicated inner chrome
Dialog|C1|dialog,closeDialog,ruleDialog|D,K|Confirm max-md; onboarding max-2xl; rule custom width|Confirm20 gap16; Close24 gap20; onboarding20/28|18 vs20 titles|Shared floating20; rule appPanel style|Widths can follow task; internal title/body/footer rhythm should not follow feature|Dialog slots+ModalPortal / retain alertdialog semantics and safe cancel focus / retire custom visual shells
Popover/menu|C1|filter,command,previewAction|OP,S|Filter anchored geometry source; plan menu screenshot only|Menu item gaps per caller; geometry not measured from JPEG|Menu14; command results separate roles|Floating20 versus small menu border|No open filter screenshot retained; do not infer anchoring PASS; standardize chrome without replacing repaired focus/placement logic|Popover visual slots over existing geometry / retain filter controller / retire feature menu surfaces
Tooltip|C3|command,previewAction|P|Native title attribute has UA geometry; no retained tooltip frame|UNVERIFIED native spacing|UA-dependent|UA-dependent|Cannot audit tooltip pixel quality from these captures; several title attributes are native tooltips, not absent components|Tooltip policy and accessible name / retain native title where sufficient / retire tooltip-only explanations for unavailable controls
Toast|C1|toast,shell|C,S,O|Auto height; occupies layout and pushes body|x16 y12 mb12|14; raw long error wraps|Neutral floating background raised shadow with severity edge|Cleanup error persists across unrelated contexts and duplicates local error|Toast for transient acknowledgment; Notice for durable error / retain error truth / retire duplicate display ownership only after lifecycle review
Preview chrome|C0|preview,previewAction,previewState|P,E,PDF|Width34rem; max42rem; actions36; title16.8 at root16|header16/17.6/14.4; footer12.8/17.6|.72/.78/1.05rem;650/700|radius20 but novel overlay72% mix|Fractional metric dialect plus repeated close affordances and prominent empty frame make a separate mini-app|OverlayHeader/Footer+Button+StateBlock / retain Preview Core and content typography / retire host-local chrome metrics
Settings section/row|C1|settings,settingsRow,settingsSegment|S,A,AI|Controls360 or480 column; breakpoint1180|Section pb28; group pt20; row y16|18 section;16 disclosure;14 group/body|Flat dividers; selected underline|Distinct quiet form dialect is useful; underlying controls and spacing ownership should be shared|SettingsRow composes canonical primitives / retain progressive disclosure / retire field/switch/segment forks
Empty state|C1|empty,state,settingsEmpty|H,R,GI|min112 common but title and radius differ|x16 versus20; y24|Settings14; StateBlock16|8 versus12 radius; dashed border|Similar no-content semantic repeated despite shared StateBlock export|StateBlock empty / retain panel-sized versus workspace-sized / retire emptyState and SettingsEmptyState visual copies
Loading state|C2|task,search,previewState|P,L|Search spinner15 replaces clear32; Preview transitions not captured|No reserved trailing clear/spinner slot in shared SearchField|Status14; spinner15|No automatic layout preservation contract|Source risk: trailing slot changes intrinsic width; native Preview loading remains UNVERIFIED|StateBlock loading+reserved control slot / retain progressive content / retire geometry-changing spinner insertion
Degraded/limited state|C1|notice,previewState,settingsNotice|PDF,OP,GI|Content-driven status blocks|Shared12x12 vs Preview rem gaps|Technical status values exposed|Blue informational index state vs warning/red plan|A limitation must preserve useful content and name consequence; hue alone is insufficient|Notice limitation with next action / retain provider truth / retire raw technical-first body copy later
Unavailable state|C1|previewState,settingsEmpty,state|E,GI,I|Preview min192; Settings min112|Preview centered vs context card|Generic unavailable vs raw capability values|Plain preview vs dashed settings|One host says unavailable, another says unsupported; format-specific authority must decide wording|StateBlock unavailable cause/action slots / retain fallback metadata / retire generic dead-end copy after capability mapping
Recoverable error state|C1|notice,toast,previewState|C,OP,E|Three different body compositions|Close/retry placements differ|Raw English path in Chinese UI|Neutral edge+red box+plain preview|Raw error is duplicated; Preview asks close/reselect instead of preserving a common recovery location|Notice error + StateBlock error / retain safe recovery gates / retire duplicate display and backend text as primary copy
Safety-blocked state|C2|dialog,cleanup,notice|C,OP,PD|Task-specific details legitimate|Safety notice repeated near action/state|Raw Dry Run and capability names compete with intent|Info/warning/disabled mix|Visual status must distinguish unavailable capability from prohibited mutation; current captures do not prove unsafe action|Notice blocked+ConfirmDialog / retain authoritative preview/revalidation / retire redundant safety prose only when consequence stays explicit
Scrollbar/overflow treatment|C1|shell,inspector,list,settings|N,AI,SL,P|Shared pr4; file thin scrollbar; nested scroll regions|Settings bottom horizontal track visible; context nested insets|Truncated labels need source context|Preview backdrop ends mid-window in retained frames|Observed Settings horizontal overflow; Preview backdrop coverage is a static geometry concern, not a proven event cause|ScrollArea/pane contract / retain virtualization / retire nested same-axis scrolling where no independent pane
Divider/separator treatment|C2|surfaces,list,settingsRow,context|L,S,H,I|1px typical|File x12; settings full row; context inset14|Not applicable|Border rows + card boundaries + section rules|Separator endpoints compound with nesting; identical hierarchy gets different visual enclosures|Divider inset/content/full variants / retain table separators / retire border+divider double boundaries
Icon size/alignment rules|C2|listMetric,gridMetric,search,historySearch,previewAction|L,G,H,P|List17; history15; search16; grid30/32; badges13/14|File namegap9; command6; shared8|Lucide default stroke versus grid1.5/1.6|Framed list icon vs unframed grid fallback|Same small search/action roles have no optical or size policy; actual 1px centering UNVERIFIED|Icon component role sizes / retain content-thumbnail size class / retire arbitrary same-role sizes
Typography roles|C0|section,preview,tokens,css|O,L,P,S|Shared24/18/14/12; Library13/11; Preview fractional rem|Line24 vs1.5/1.55/1.6|600/650/700 and uppercase tracking.12/.08em|Not applicable|Tokens do not own typography ladder; unlayered font:inherit may supersede Tailwind declarations|Typography role tokens and primitive consumption / retain content monospace / retire page-local chrome scales
Spacing/inset rhythm|C0|shell,toolbar,context,preview,settingsRow|O,L,S,P,N|Shell20/12 versus0; context14|Toolbar8/6/2; Preview7.2/6.4/17.6 at root16|Not applicable|Nested wrapper padding changes apparent edge|--zc-space values exist but layout recipes mostly use independent metrics|Layout semantic spacing tokens / retain optical2 and dense4 / retire unexplained fractional chrome spacing
Radius ladder|C2|tokens,input,settingsField,preview|D,S,P,L|Tokens8/10/12/16/20/24|Nested controls group padding2/4|Not applicable|Input12 vs settings10; groups and children both10|The ladder is ordered but semantic application and nesting are not unique|Shape role tokens / retain pill for switch/launcher / retire feature choice of field versus control radius
Elevation/shadow ladder|C2|tokens,raised,preview,toast,switch|H,P,C,S|Three shadow tokens plus shadow-sm/inner/insets|No shared layer clearance|Not applicable|Raised/floating/spotlight distinct dark shadows exist|Dark is not simply color inversion; uncontrolled small shadows and hover insets still layer noise|Elevation0/raised/floating policy / retain theme-specific shadows / retire decorative row/switch glows
Motion/transition grammar|C2|tokens,css,row,previewAction|F,P,A|120/180/280 tokens; default transitions also present|No capture sequence for timing|Not applicable|Transitions on selected/hover vary|Reduced Motion global rule exists; actual animation/pressed continuity not evidenced by static shots|Motion tokens by state change / retain reduced motion / retire unclassified default transition recipes
Badge|C2|badge,segment,list|L,PD,O|Content-driven small labels|Source badge x8 y4; metric labels separate|12 medium vs uppercase metric12 semibold|Pill border status versus plain technical value|Category labels and status badges need different semantics, not arbitrary per-feature tone|Badge neutral/category/status roles / retain backend state distinction / retire sourceBadge visual duplication'''

def source(key):
    path, needle = sources[key]
    lines = (ROOT/path).read_text(encoding='utf-8').splitlines()
    line = next(i for i,s in enumerate(lines,1) if needle in s)
    return {"file":path,"line":line,"anchor":needle,"excerpt":'\n'.join(lines[line-1:line+9])}

matrix=[]
for i,row in enumerate(rows.splitlines(),1):
    role,severity,src,shots,dim,spacing,typo,shape,issue,target=row.split('|')
    canonical,variants,retire=target.split(' / ')
    matrix.append({"id":f"UI-{i:02}","semantic_role":role,"severity":severity,
      "severity_system":"C0 system-breaking incoherence; C1 major divergence; C2 craft degradation; C3 polish. User taxonomy overrides brief P1/P2/P3 design-debt labels; unrelated to W6-05 product severity.",
      "current_implementations":src.split(','),"source_locations":[source(x) for x in src.split(',')],
      "representative_screens":[f"outputs/w6-05-native-audit/screenshots/{screens[x]}.jpg" for x in shots.split(',')],
      "current_dimensions":dim,"current_spacing":spacing,"current_typography":typo,
      "current_radius_border_elevation":shape,"states_supported":{"static_source":"See source excerpts and 03-INTERACTION-STATES.md; declarations are not runtime acceptance", "native_evidence":"Only visible states in listed captures; hover/pressed/time-based claims unverified unless explicitly noted"},
      "inconsistency_type": "source and cross-surface anatomy audit; see concrete issue",
      "craftsmanship_issue":issue,"canonical_target_anatomy":canonical,"allowed_variants":variants,
      "patterns_to_retire":retire,"w6_07_action":f"Proposal only, W6-07 inactive: {canonical}. {retire}; preserve source behavior until replacement parity is demonstrated."})
(OUT/'03-ui-coherence-matrix.json').write_text(json.dumps({"source_head":"3910dc9e6e5caca922a91482c8a3ae954cde4104","rows":matrix},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
text='# Visual authority map\n\nSource authority at master `3910dc9e`; source excerpts and all dimensions are in [machine-readable matrix](03-ui-coherence-matrix.json). C-severity is design debt, not W6-05 product severity. Export aliases are not counted as independent implementations. See [metric analysis](03-METRIC-INVENTORY.md) for declaration versus computed-style limits.\n\n| Semantic concept | Implementations | Files | Conflict | Canonical target |\n| --- | --- | --- | --- | --- |\n'
for r in matrix:
    loc='; '.join(f"`{x['file']}:{x['line']}`" for x in r['source_locations'])
    text += f"| {r['id']} {r['semantic_role']} | {' / '.join(r['current_implementations'])} | {loc} | {r['severity']}: {r['craftsmanship_issue']} | {r['canonical_target_anatomy']} |\n"
(OUT/'03-VISUAL-AUTHORITY-MAP.md').write_text(text,encoding='utf-8')
print(f'{len(matrix)} semantic roles serialized with resolved source anchors')
