const HOOK_BLOCK = [
  "{{#if installer_hooks}}",
  '!include "{{installer_hooks}}"',
  "{{/if}}",
].join("\n");

function replaceExactly(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) {
    throw new Error(`Zen NSIS hook relocation drift: missing ${label} anchor`);
  }
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Zen NSIS hook relocation drift: duplicate ${label} anchor`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function relocateWindowsNsisInstallerHooks(source) {
  let output = replaceExactly(
    source,
    HOOK_BLOCK,
    "; Zen Canvas relocates installer hooks after product defines and runtime Vars.",
    "upstream installer hook block",
  );

  output = replaceExactly(
    output,
    [
      "Var PassiveMode",
      "Var UpdateMode",
      "Var NoShortcutMode",
      "Var WixMode",
      "Var OldMainBinaryName",
    ].join("\n"),
    [
      "Var PassiveMode",
      "Var UpdateMode",
      "Var NoShortcutMode",
      "Var WixMode",
      "Var OldMainBinaryName",
      "",
      "; W4-04 package lifecycle helpers intentionally compile only after",
      "; MAINBINARYNAME/PRODUCTNAME/VERSION and PassiveMode are declared.",
      HOOK_BLOCK,
    ].join("\n"),
    "runtime variable declaration block",
  );

  const includeIndex = output.indexOf('!include "{{installer_hooks}}"');
  const mainBinaryIndex = output.indexOf('!define MAINBINARYNAME "{{main_binary_name}}"');
  const passiveVarIndex = output.indexOf("Var PassiveMode");
  const welcomePageIndex = output.indexOf("!insertmacro MUI_PAGE_WELCOME");
  if (
    includeIndex <= mainBinaryIndex ||
    includeIndex <= passiveVarIndex ||
    welcomePageIndex < 0 ||
    includeIndex >= welcomePageIndex
  ) {
    throw new Error("Relocated Zen NSIS installer hooks are outside the required define/Var/page boundary");
  }

  return output;
}
