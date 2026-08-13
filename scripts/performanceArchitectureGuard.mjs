import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const MAX_FILE_LIBRARY_PAGE_SIZE = 50;
const MAX_CALLBACK_ANALYSIS_DEPTH = 8;
const FILE_LIBRARY_RESULT_ACTIONS = new Set(["loadFirstPage", "loadNextPage", "refresh", "clear"]);
const importBindingsCache = new WeakMap();
const importedComponentSourceCache = new Map();
const bindingStatesCache = new WeakMap();
const CANONICAL_RESULT_STORE_MODULE = "../../store/useFileLibraryV2Store";
const ZUSTAND_MODULE = "zustand";
const REACT_MODULE = "react";
const TAURI_CORE_MODULES = new Set(["@tauri-apps/api/core", "@tauri-apps/api/tauri"]);
const REACT_CLASS_ENTRYPOINTS = new Set([
  "render",
  "constructor",
  "componentDidMount",
  "componentDidUpdate",
  "componentWillUnmount",
  "componentDidCatch",
  "getSnapshotBeforeUpdate",
  "shouldComponentUpdate",
  "componentWillMount",
  "componentWillReceiveProps",
  "componentWillUpdate",
  "UNSAFE_componentWillMount",
  "UNSAFE_componentWillReceiveProps",
  "UNSAFE_componentWillUpdate"
]);
const ASSIGNMENT_OPERATORS = new Set([
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**=",
  "<<=",
  ">>=",
  ">>>=",
  "&=",
  "|=",
  "^=",
  "&&=",
  "||=",
  "??="
]);
const UNKNOWN_CALLBACK_CANDIDATE = {};
const NON_CALLABLE_RESULT_STORE_PROPERTIES = new Set([
  "files",
  "totalCount",
  "countState",
  "countToken",
  "isCountLoading",
  "nextCursor",
  "hasMore",
  "resultState",
  "isLoading",
  "error",
  "requestEpoch",
  "activeQueryKey"
]);

function createSourceFile(source, fileName, scriptKind) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind);
}

function unwrapExpression(expression) {
  let current = expression;
  while (current && (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current)
  )) {
    current = current.expression;
  }
  return current;
}

function findNamedDeclarations(sourceFile, name) {
  const declarations = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && bindingPatternContainsName(node.name, name)) {
      declarations.push({ kind: "variable", node });
    } else if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "function", node });
    } else if (ts.isClassDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "class", node });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return declarations;
}

function isFunctionLikeNode(node) {
  return ts.isArrowFunction(node)
    || ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessor(node)
    || ts.isSetAccessor(node);
}

function isImmediatelyInvokedFunctionLike(node) {
  let current = node;
  while (current.parent && (
    ts.isParenthesizedExpression(current.parent)
    || ts.isAsExpression(current.parent)
    || ts.isTypeAssertionExpression(current.parent)
    || ts.isNonNullExpression(current.parent)
  )) {
    current = current.parent;
  }
  return ts.isCallExpression(current.parent)
    && unwrapExpression(current.parent.expression) === node;
}

function findNamedDeclarationsInScope(scopeNode, name) {
  const declarations = [];
  const root = isFunctionLikeNode(scopeNode) ? scopeNode.body : scopeNode;
  if (!root) return declarations;
  if (isFunctionLikeNode(scopeNode)
    && scopeNode.parameters?.some((parameter) => bindingPatternContainsName(parameter.name, name))) {
    declarations.push({ kind: "parameter", node: scopeNode });
  }
  function visit(node) {
    if (ts.isVariableDeclaration(node) && bindingPatternContainsName(node.name, name)) {
      declarations.push({ kind: "variable", node });
    } else if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "function", node });
    } else if (ts.isClassDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "class", node });
    }
    if (node !== root && isFunctionLikeNode(node)) return;
    ts.forEachChild(node, visit);
  }
  visit(root);
  return declarations;
}

function findLexicalNamedDeclarations(node, name) {
  let current = node;
  while (current) {
    if (isFunctionLikeNode(current)) {
      const declarations = findNamedDeclarationsInScope(current, name);
      if (declarations.length > 0) return declarations;
    }
    current = current.parent;
  }
  const sourceFile = node?.getSourceFile?.();
  return sourceFile ? findNamedDeclarationsInScope(sourceFile, name) : [];
}

function findEnclosingFunctionLike(node) {
  let current = node?.parent;
  while (current) {
    if (isFunctionLikeNode(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function bindingPatternContainsName(pattern, name) {
  if (!pattern) return false;
  if (ts.isIdentifier(pattern)) return pattern.text === name;
  if (ts.isBindingElement(pattern)) return bindingPatternContainsName(pattern.name, name);
  if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
    return pattern.elements.some((element) => bindingPatternContainsName(element, name));
  }
  return false;
}

function getImportBindings(sourceFile) {
  const cached = importBindingsCache.get(sourceFile);
  if (cached) return cached;
  const bindings = [];
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)
      || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const clause = statement.importClause;
    if (!clause || clause.isTypeOnly) continue;
    const moduleSpecifier = statement.moduleSpecifier.text;
    if (clause.name) {
      bindings.push({
        kind: "import",
        importKind: "default",
        localName: clause.name.text,
        importedName: "default",
        moduleSpecifier,
        node: statement
      });
    }
    const namedBindings = clause.namedBindings;
    if (ts.isNamespaceImport(namedBindings)) {
      bindings.push({
        kind: "import",
        importKind: "namespace",
        localName: namedBindings.name.text,
        importedName: undefined,
        moduleSpecifier,
        node: statement
      });
    } else if (ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (element.isTypeOnly) continue;
        bindings.push({
          kind: "import",
          importKind: "named",
          localName: element.name.text,
          importedName: element.propertyName
            ? propertyNameText(element.propertyName)
            : element.name.text,
          moduleSpecifier,
          node: statement
        });
      }
    }
  }
  importBindingsCache.set(sourceFile, bindings);
  return bindings;
}

function collectDirectLexicalDeclarations(scopeNode, name) {
  const declarations = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && bindingPatternContainsName(node.name, name)) {
      declarations.push({ kind: "variable", node });
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "function", node });
      return;
    }
    if (ts.isClassDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "class", node });
      return;
    }
    if (node !== scopeNode && (isFunctionLikeNode(node) || ts.isBlock(node))) return;
    ts.forEachChild(node, visit);
  }
  visit(scopeNode);
  return declarations;
}

function findLexicalBindingDeclarations(referenceNode, name) {
  let current = referenceNode;
  while (current) {
    if (ts.isBlock(current) || ts.isSourceFile(current)) {
      const declarations = collectDirectLexicalDeclarations(current, name);
      if (declarations.length > 0) return declarations;
    }
    if (isFunctionLikeNode(current)) {
      const declarations = [];
      if (current.name && ts.isIdentifier(current.name) && current.name.text === name) {
        declarations.push({ kind: "function", node: current });
      }
      if (current.parameters?.some((parameter) => bindingPatternContainsName(parameter.name, name))) {
        declarations.push({ kind: "parameter", node: current });
      }
      if (ts.isBlock(current.body)) {
        declarations.push(...collectDirectLexicalDeclarations(current.body, name));
      }
      if (declarations.length > 0) return declarations;
    }
    current = current.parent;
  }
  return [];
}

function resolveLexicalBinding(referenceNode, name) {
  const declarations = findLexicalBindingDeclarations(referenceNode, name);
  if (declarations.length > 1) return { kind: "ambiguous" };
  if (declarations.length === 1) {
    return {
      kind: "local",
      declarationKind: declarations[0].kind,
      declaration: declarations[0].node
    };
  }
  const sourceFile = referenceNode?.getSourceFile?.();
  const imports = sourceFile
    ? getImportBindings(sourceFile).filter((binding) => binding.localName === name)
    : [];
  if (imports.length > 1) return { kind: "ambiguous" };
  return imports[0];
}

function importBindingMatches(binding, moduleSpecifier, importKind, importedName) {
  return Boolean(binding)
    && binding.kind === "import"
    && binding.moduleSpecifier === moduleSpecifier
    && binding.importKind === importKind
    && (importedName === undefined || binding.importedName === importedName);
}

function importProvenanceKey(binding) {
  return binding
    ? `${binding.moduleSpecifier}:${binding.importKind}:${binding.importedName ?? ""}`
    : undefined;
}

function resolveImportProvenance(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node || !ts.isIdentifier(node)) return undefined;
  const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
  if (!binding || binding.kind === "ambiguous") return undefined;
  if (binding.kind === "import") return binding;
  if (binding.declarationKind !== "variable") return undefined;
  const declaration = binding.declaration;
  if (!ts.isIdentifier(declaration.name)) return undefined;
  const key = `import-provenance:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return undefined;
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  const values = findBindingValueExpressions(referenceNode ?? declaration, declaration, node.text);
  if (values.length === 0) return undefined;
  const provenances = values.map((value) => (
    resolveImportProvenance(value, declaration, nextVisited)
  ));
  if (provenances.some((provenance) => !provenance)) return undefined;
  const keys = new Set(provenances.map(importProvenanceKey));
  return keys.size === 1 ? provenances[0] : undefined;
}

function isTauriCoreNamedImport(binding, importedName) {
  return Boolean(binding)
    && binding.kind === "import"
    && TAURI_CORE_MODULES.has(binding.moduleSpecifier)
    && binding.importKind === "named"
    && binding.importedName === importedName;
}

function isTauriCoreNamespaceImport(binding) {
  return Boolean(binding)
    && binding.kind === "import"
    && TAURI_CORE_MODULES.has(binding.moduleSpecifier)
    && binding.importKind === "namespace";
}

function isCanonicalResultStoreHook(expression, referenceNode) {
  return importBindingMatches(
    resolveImportProvenance(expression, referenceNode),
    CANONICAL_RESULT_STORE_MODULE,
    "named",
    "useFileLibraryResultStore"
  );
}

function isReactEffectHook(expression, referenceNode) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isIdentifier(node)) {
    const binding = resolveImportProvenance(node, referenceNode);
    return importBindingMatches(binding, REACT_MODULE, "named", "useEffect")
      || importBindingMatches(binding, REACT_MODULE, "named", "useLayoutEffect");
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const property = callablePropertyName(node);
    const binding = resolveImportProvenance(node.expression, referenceNode);
    return (property === "useEffect" || property === "useLayoutEffect")
      && importBindingMatches(binding, REACT_MODULE, "namespace");
  }
  return false;
}

function hasFunctionLocalBinding(functionLike, name) {
  if (functionLike.name && ts.isIdentifier(functionLike.name) && functionLike.name.text === name) {
    return true;
  }
  if (functionLike.parameters?.some((parameter) => bindingPatternContainsName(parameter.name, name))) {
    return true;
  }
  if (!ts.isBlock(functionLike.body)) return false;
  let found = false;
  function visit(node) {
    if (found) return;
    if (node !== functionLike.body && isFunctionLikeNode(node)) return;
    if (ts.isVariableDeclaration(node) && bindingPatternContainsName(node.name, name)) {
      found = true;
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  return found;
}

function findReturnedExpressions(functionLike) {
  if (!ts.isBlock(functionLike.body)) return [functionLike.body];
  const returned = [];
  function visit(node) {
    if (node !== functionLike.body && isFunctionLikeNode(node)) return;
    if (ts.isReturnStatement(node)) {
      returned.push(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  return returned;
}

function selectorReturnsProperty(selector, propertyName) {
  if (!ts.isArrowFunction(selector) && !ts.isFunctionExpression(selector)) return false;
  const parameter = selector.parameters[0]?.name;
  const returnedExpressions = findReturnedExpressions(selector).map(unwrapExpression);
  if (returnedExpressions.length === 0
    || returnedExpressions.some((expression) => !expression)
    || (ts.isBlock(selector.body) && canFallThroughSequence(selector.body.statements))) {
    return false;
  }
  if (ts.isIdentifier(parameter)) {
    return returnedExpressions.every((returned) => (
      ts.isPropertyAccessExpression(returned)
      && ts.isIdentifier(returned.expression)
      && returned.expression.text === parameter.text
      && returned.name.text === propertyName
    ));
  }
  if (!ts.isObjectBindingPattern(parameter)) return false;
  const binding = parameter.elements.find((element) => {
    if (!ts.isBindingElement(element)
      || element.dotDotDotToken
      || element.initializer
      || !ts.isIdentifier(element.name)) return false;
    const boundProperty = element.propertyName
      ? propertyNameText(element.propertyName)
      : element.name.text;
    return boundProperty === propertyName;
  });
  return Boolean(binding)
    && ts.isIdentifier(binding.name)
    && returnedExpressions.every((returned) => (
      ts.isIdentifier(returned)
      && returned.text === binding.name.text
    ));
}

function hasBindingWrite(sourceOrNode, name, bindingDeclaration, beforePosition) {
  const sourceFile = sourceOrNode.getSourceFile?.() ?? sourceOrNode;
  let written = false;
  function visit(node) {
    if (written) return;
    if (beforePosition !== undefined && node.getStart(sourceFile) >= beforePosition) return;
    if (bindingDeclaration && node !== sourceOrNode && isFunctionLikeNode(node)
      && hasFunctionLocalBinding(node, name)) {
      return;
    }
    if (ts.isBinaryExpression(node)
      && ts.isIdentifier(node.left)
      && node.left.text === name
      && ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(sourceFile))) {
      written = true;
      return;
    }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
      && ts.isIdentifier(node.operand)
      && node.operand.text === name) {
      written = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceOrNode);
  return written;
}

function isCanonicalStoreBinding(sourceFile, name, propertyName, referenceNode) {
  const declarations = referenceNode
    ? findLexicalNamedDeclarations(referenceNode, name)
    : findNamedDeclarations(sourceFile, name);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
  const declaration = declarations[0].node;
  const bindingScope = findEnclosingFunctionLike(declaration) ?? sourceFile;
  if (!ts.isVariableDeclarationList(declaration.parent)
    || (declaration.parent.flags & ts.NodeFlags.Const) === 0
    || hasBindingWrite(bindingScope, name, declaration)) {
    return false;
  }
  const initializer = unwrapExpression(declaration.initializer);
  if (!ts.isCallExpression(initializer)) return false;
  return isCanonicalResultStoreHook(initializer.expression, initializer)
    && initializer.arguments.length === 1
    && selectorReturnsProperty(initializer.arguments[0], propertyName);
}

function resolveFunctionBinding(sourceFile, name, referenceNode) {
  const declarations = referenceNode
    ? findLexicalNamedDeclarations(referenceNode, name)
    : findNamedDeclarations(sourceFile, name);
  if (declarations.length !== 1) return undefined;
  const declaration = declarations[0];
  if (declaration.kind === "function") return declaration.node;
  if (declaration.kind !== "variable" || !declaration.node.initializer) return undefined;
  const initializer = unwrapExpression(declaration.node.initializer);
  return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) ? initializer : undefined;
}

function findEnclosingClassDeclaration(node) {
  let current = node;
  while (current) {
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) return current;
    current = current.parent;
  }
  return undefined;
}

function classMemberName(member) {
  if (ts.isConstructorDeclaration(member)) return "constructor";
  if (ts.isMethodDeclaration(member)
    || ts.isGetAccessor(member)
    || ts.isSetAccessor(member)
    || ts.isPropertyDeclaration(member)) {
    return propertyNameText(member.name);
  }
  return undefined;
}

function resolveClassMemberBindings(
  sourceFile,
  classDeclaration,
  name,
  visitedBindings = new Set(),
  componentSources = {}
) {
  const resolved = [];
  for (const member of classDeclaration.members) {
    if (classMemberName(member) !== name) continue;
    if (isFunctionLikeNode(member)) {
      resolved.push(member);
    } else if (ts.isPropertyDeclaration(member) && member.initializer) {
      resolved.push(...resolveCallableBindings(
        sourceFile,
        member.initializer,
        member,
        visitedBindings,
        componentSources
      ));
    }
  }
  return [...new Set(resolved)];
}

function resolveClassComponentEntryPoints(
  sourceFile,
  classDeclaration,
  componentSources = {}
) {
  const resolved = [];
  for (const member of classDeclaration.members) {
    const name = classMemberName(member);
    if (!REACT_CLASS_ENTRYPOINTS.has(name)) continue;
    resolved.push(...resolveClassMemberBindings(
      sourceFile,
      classDeclaration,
      name,
      new Set(),
      componentSources
    ));
  }
  return [...new Set(resolved)];
}

function resolveLocalClassComponentBindings(sourceFile, expression, referenceNode, componentSources = {}) {
  const node = unwrapExpression(expression);
  if (!ts.isIdentifier(node)) return [];
  const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
  if (declarations.length !== 1 || declarations[0].kind !== "class") return [];
  return resolveClassComponentEntryPoints(sourceFile, declarations[0].node, componentSources);
}

function isRepositoryLocalImport(moduleSpecifier) {
  return moduleSpecifier.startsWith(".");
}

function sourceFileScriptKind(fileName) {
  return /\.(?:js|jsx|ts|tsx)$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function resolveRepositoryComponentSource(sourceFile, moduleSpecifier, componentSources = {}) {
  if (!isRepositoryLocalImport(moduleSpecifier)) return undefined;
  const suppliedSource = componentSources[moduleSpecifier];
  const repositoryRoot = path.resolve(process.cwd());
  const baseDirectory = path.isAbsolute(sourceFile.fileName)
    ? path.dirname(sourceFile.fileName)
    : path.join(repositoryRoot, "src", "views", "vault");
  const requestedPath = path.resolve(baseDirectory, moduleSpecifier);
  const cacheKey = suppliedSource === undefined
    ? undefined
    : `${sourceFile.fileName}:${moduleSpecifier}:supplied:${suppliedSource}`;
  if (cacheKey) {
    const cached = importedComponentSourceCache.get(cacheKey);
    if (cached) return cached;
  }

  let fileName;
  let source;
  if (suppliedSource !== undefined) {
    fileName = `${requestedPath}.tsx`;
    source = suppliedSource;
  } else {
    const relativeToRoot = path.relative(repositoryRoot, requestedPath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) return undefined;
    const candidates = [
      requestedPath,
      `${requestedPath}.tsx`,
      `${requestedPath}.ts`,
      `${requestedPath}.jsx`,
      `${requestedPath}.js`,
      path.join(requestedPath, "index.tsx"),
      path.join(requestedPath, "index.ts"),
      path.join(requestedPath, "index.jsx"),
      path.join(requestedPath, "index.js")
    ];
    fileName = candidates.find((candidate) => fs.existsSync(candidate));
    if (!fileName) return undefined;
    try {
      source = fs.readFileSync(fileName, "utf8");
    } catch {
      return undefined;
    }
  }

  const importedSourceFile = createSourceFile(source, fileName, sourceFileScriptKind(fileName));
  if (cacheKey) importedComponentSourceCache.set(cacheKey, importedSourceFile);
  return importedSourceFile;
}

function resolveDefaultComponentBinding(sourceFile) {
  const defaultFunction = sourceFile.statements.find((statement) => (
    ts.isFunctionDeclaration(statement)
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  ));
  if (defaultFunction) return defaultFunction;
  const defaultClass = sourceFile.statements.find((statement) => (
    ts.isClassDeclaration(statement)
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
  ));
  if (defaultClass) return defaultClass;
  const defaultAssignment = sourceFile.statements.find((statement) => ts.isExportAssignment(statement));
  if (!defaultAssignment || defaultAssignment.isExportEquals) return undefined;
  const expression = unwrapExpression(defaultAssignment.expression);
  return ts.isIdentifier(expression)
    ? resolveFunctionBinding(sourceFile, expression.text, expression)
    : isFunctionLikeNode(expression)
      ? expression
      : undefined;
}

function resolveExportedCallableBindings(
  sourceFile,
  exportedName,
  visitedBindings = new Set(),
  componentSources = {}
) {
  const resolved = resolveFunctionBinding(sourceFile, exportedName, undefined);
  if (resolved) return [resolved];
  const classDeclaration = findNamedDeclarations(sourceFile, exportedName)
    .find((declaration) => declaration.kind === "class")?.node;
  if (classDeclaration) {
    return resolveClassComponentEntryPoints(sourceFile, classDeclaration, componentSources);
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)
      || !statement.moduleSpecifier
      || !statement.exportClause
      || !ts.isNamedExports(statement.exportClause)) {
      continue;
    }
    for (const specifier of statement.exportClause.elements) {
      const name = specifier.name.text;
      if (name !== exportedName) continue;
      const originalName = specifier.propertyName?.text ?? name;
      const key = `re-export:${sourceFile.fileName}:${statement.moduleSpecifier.text}:${originalName}`;
      if (visitedBindings.has(key)) continue;
      const nextVisited = new Set(visitedBindings);
      nextVisited.add(key);
      const reExportedSource = resolveRepositoryComponentSource(
        sourceFile,
        statement.moduleSpecifier.text,
        componentSources
      );
      if (!reExportedSource || reExportedSource.parseDiagnostics.length > 0) continue;
      const reExported = resolveExportedCallableBindings(
        reExportedSource,
        originalName,
        nextVisited,
        componentSources
      );
      if (reExported.length > 0) return reExported;
    }
  }
  return [];
}

function resolveImportedCallableBindings(
  sourceFile,
  expression,
  referenceNode,
  visitedBindings = new Set(),
  componentSources = {}
) {
  const node = unwrapExpression(expression);
  if (!node) return [];
  let binding;
  let importedName;
  if (ts.isIdentifier(node)) {
    binding = resolveImportProvenance(node, referenceNode);
    importedName = binding?.importedName ?? "default";
  } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    if (!ts.isIdentifier(receiver)) return [];
    binding = resolveImportProvenance(receiver, referenceNode);
    importedName = callablePropertyName(node);
    if (binding?.importKind !== "namespace" || !importedName) return [];
  } else {
    return [];
  }
  if (!binding || binding.kind !== "import" || !isRepositoryLocalImport(binding.moduleSpecifier)) return [];
  const key = `imported-component:${binding.moduleSpecifier}:${importedName}`;
  if (visitedBindings.has(key)) return [];
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  const importedSourceFile = resolveRepositoryComponentSource(
    sourceFile,
    binding.moduleSpecifier,
    componentSources
  );
  if (!importedSourceFile || importedSourceFile.parseDiagnostics.length > 0) return [];
  if (importedName === "default") {
    const resolved = resolveDefaultComponentBinding(importedSourceFile);
    if (resolved && (ts.isClassDeclaration(resolved) || ts.isClassExpression(resolved))) {
      return resolveClassComponentEntryPoints(importedSourceFile, resolved, componentSources);
    }
    return resolved?.body ? [resolved] : [];
  }
  return resolveExportedCallableBindings(
    importedSourceFile,
    importedName,
    nextVisited,
    componentSources
  );
}

function isReactComponentWrapper(expression, referenceNode) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isIdentifier(node)) {
    const binding = resolveImportProvenance(node, referenceNode);
    return importBindingMatches(binding, REACT_MODULE, "named", "memo")
      || importBindingMatches(binding, REACT_MODULE, "named", "forwardRef");
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const property = callablePropertyName(node);
    return (property === "memo" || property === "forwardRef")
      && importBindingMatches(
        resolveImportProvenance(node.expression, referenceNode),
        REACT_MODULE,
        "namespace"
      );
  }
  return false;
}

function callablePropertyName(expression) {
  const node = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (!ts.isElementAccessExpression(node)) return undefined;
  return propertyNameText(unwrapExpression(node.argumentExpression));
}

function resolveObjectLiteralValues(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return [];
  if (ts.isObjectLiteralExpression(node)) return [node];
  if (!ts.isIdentifier(node)) return [];
  const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return [];
  const declaration = declarations[0].node;
  if (!ts.isIdentifier(declaration.name)) return [];
  const key = `object:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return [];
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  return findBindingValueExpressions(referenceNode, declaration, node.text).flatMap((value) => (
    resolveObjectLiteralValues(value, declaration, nextVisited)
  ));
}

function resolveCallableBindings(
  sourceFile,
  expression,
  referenceNode = expression,
  visitedBindings = new Set(),
  componentSources = {}
) {
  const node = unwrapExpression(expression);
  if (!node) return [];
  if (isFunctionLikeNode(node)) return [node];
  if (ts.isIdentifier(node)) {
    const resolved = resolveFunctionBinding(sourceFile, node.text, referenceNode);
    if (resolved) return [resolved];
    const localClass = resolveLocalClassComponentBindings(
      sourceFile,
      node,
      referenceNode,
      componentSources
    );
    if (localClass.length > 0) return localClass;
    const imported = resolveImportedCallableBindings(
      sourceFile,
      node,
      referenceNode,
      visitedBindings,
      componentSources
    );
    if (imported.length > 0) return imported;

    const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
    if (declarations.length !== 1 || declarations[0].kind !== "variable") return [];
    const declaration = declarations[0].node;
    const bindingScope = findEnclosingFunctionLike(declaration) ?? sourceFile;
    if (!ts.isVariableDeclarationList(declaration.parent)
      || (declaration.parent.flags & ts.NodeFlags.Const) === 0
      || !declaration.initializer
      || hasBindingWrite(bindingScope, node.text, declaration)) {
      return [];
    }

    const initializer = unwrapExpression(declaration.initializer);
    if (!ts.isCallExpression(initializer)
      || !isReactComponentWrapper(initializer.expression, initializer)
      || initializer.arguments.length === 0) {
      return [];
    }

    const key = `react-wrapper:${declaration.getStart(sourceFile)}`;
    if (visitedBindings.has(key)) return [];
    const nextVisited = new Set(visitedBindings);
    nextVisited.add(key);
    return resolveCallableBindings(
      sourceFile,
      initializer.arguments[0],
      initializer,
      nextVisited,
      componentSources
    );
  }
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return [];
  if (ts.isThis(node.expression)) {
    const classDeclaration = findEnclosingClassDeclaration(referenceNode);
    if (classDeclaration) {
      const classMember = resolveClassMemberBindings(
        sourceFile,
        classDeclaration,
        callablePropertyName(node),
        visitedBindings,
        componentSources
      );
      if (classMember.length > 0) return classMember;
    }
  }
  const imported = resolveImportedCallableBindings(
    sourceFile,
    node,
    referenceNode,
    visitedBindings,
    componentSources
  );
  if (imported.length > 0) return imported;
  const propertyName = callablePropertyName(node);
  if (!propertyName) return [];
  const key = `method:${node.getStart(sourceFile)}`;
  if (visitedBindings.has(key)) return [];
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  const resolved = [];
  for (const objectLiteral of resolveObjectLiteralValues(node.expression, referenceNode, nextVisited)) {
    for (const property of objectLiteral.properties) {
      if (ts.isMethodDeclaration(property) && propertyNameText(property.name) === propertyName) {
        resolved.push(property);
      } else if (ts.isPropertyAssignment(property) && propertyNameText(property.name) === propertyName) {
        resolved.push(...resolveCallableBindings(
          sourceFile,
          property.initializer,
          property,
          nextVisited,
          componentSources
        ));
      } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
        resolved.push(...resolveCallableBindings(
          sourceFile,
          property.name,
          property,
          nextVisited,
          componentSources
        ));
      }
    }
  }
  return [...new Set(resolved)];
}

function resolvesToFunctionBinding(referenceNode, name, expectedFunction) {
  const declarations = findLexicalNamedDeclarations(referenceNode, name);
  return declarations.length === 1
    && declarations[0].kind === "function"
    && declarations[0].node === expectedFunction;
}

function resolvesToVariableBinding(referenceNode, name, expectedDeclaration) {
  const declarations = findLexicalNamedDeclarations(referenceNode, name);
  return declarations.length === 1
    && declarations[0].kind === "variable"
    && declarations[0].node === expectedDeclaration;
}

function resolvesToFunctionParameter(referenceNode, name, expectedFunction) {
  const declarations = findLexicalNamedDeclarations(referenceNode, name);
  return declarations.length === 1
    && declarations[0].kind === "parameter"
    && declarations[0].node === expectedFunction;
}

function analyzeInvocationExpression(expression, sourceFile, depth, visitedBindings) {
  if (!expression || depth > MAX_CALLBACK_ANALYSIS_DEPTH) return false;
  const node = unwrapExpression(expression);

  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    if (ts.isIdentifier(callee)) {
      if (callee.text === "loadNextPage") {
        return isCanonicalStoreBinding(
          sourceFile,
          "loadNextPage",
          "loadNextPage",
          findEnclosingFunctionLike(callee)
        );
      }
      return analyzeCallbackBinding(callee, sourceFile, depth + 1, visitedBindings);
    }
    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.text;
      if (method === "bind") return false;
      if (method === "call" || method === "apply") {
        const receiver = unwrapExpression(callee.expression);
        if (ts.isIdentifier(receiver) && receiver.text === "loadNextPage") {
          return isCanonicalStoreBinding(
            sourceFile,
            "loadNextPage",
            "loadNextPage",
            findEnclosingFunctionLike(receiver)
          );
        }
        return analyzeCallbackBinding(receiver, sourceFile, depth + 1, visitedBindings);
      }
      return analyzeInvocationExpression(callee.expression, sourceFile, depth + 1, visitedBindings);
    }
    return false;
  }
  if (ts.isPropertyAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    return ts.isCallExpression(receiver)
      && analyzeInvocationExpression(receiver, sourceFile, depth + 1, visitedBindings);
  }
  if (ts.isVoidExpression(node) || ts.isPrefixUnaryExpression(node) || ts.isAwaitExpression(node)) {
    return analyzeInvocationExpression(node.operand ?? node.expression, sourceFile, depth + 1, visitedBindings);
  }
  return false;
}

const STATIC_VALUE_UNKNOWN = Symbol("static-value-unknown");

function evaluateStaticValue(expression, referenceNode = expression, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return STATIC_VALUE_UNKNOWN;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isStringLiteral(node) || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral) return node.text;

  if (ts.isIdentifier(node)) {
    const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
    if (declarations.length === 0 && node.text === "undefined") return undefined;
    if (declarations.length === 0 && node.text === "NaN") return Number.NaN;
    if (declarations.length !== 1 || declarations[0].kind !== "variable") return STATIC_VALUE_UNKNOWN;
    const declaration = declarations[0].node;
    if (!ts.isIdentifier(declaration.name)
      || !ts.isVariableDeclarationList(declaration.parent)
      || (declaration.parent.flags & ts.NodeFlags.Const) === 0
      || !declaration.initializer) return STATIC_VALUE_UNKNOWN;
    const owner = findEnclosingFunctionLike(declaration);
    const scope = owner ?? declaration.getSourceFile();
    if (hasBindingWrite(scope, declaration.name.text, declaration)) return STATIC_VALUE_UNKNOWN;
    const key = `static-value:${declaration.getStart(declaration.getSourceFile())}`;
    if (visitedBindings.has(key)) return STATIC_VALUE_UNKNOWN;
    const nextVisitedBindings = new Set(visitedBindings);
    nextVisitedBindings.add(key);
    return evaluateStaticValue(declaration.initializer, declaration, nextVisitedBindings);
  }

  if (ts.isPrefixUnaryExpression(node)) {
    const value = evaluateStaticValue(node.operand, referenceNode, visitedBindings);
    if (value === STATIC_VALUE_UNKNOWN) return STATIC_VALUE_UNKNOWN;
    switch (node.operator) {
      case ts.SyntaxKind.ExclamationToken:
        return !value;
      case ts.SyntaxKind.PlusToken:
        return +value;
      case ts.SyntaxKind.MinusToken:
        return -value;
      case ts.SyntaxKind.TildeToken:
        return ~value;
      case ts.SyntaxKind.VoidKeyword:
        return undefined;
      default:
        return STATIC_VALUE_UNKNOWN;
    }
  }

  if (ts.isConditionalExpression(node)) {
    const condition = evaluateStaticValue(node.condition, referenceNode, visitedBindings);
    if (condition === STATIC_VALUE_UNKNOWN) return STATIC_VALUE_UNKNOWN;
    return evaluateStaticValue(
      Boolean(condition) ? node.whenTrue : node.whenFalse,
      referenceNode,
      visitedBindings
    );
  }

  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.getText(node.getSourceFile());
    const left = evaluateStaticValue(node.left, referenceNode, visitedBindings);
    if (operator === "&&") {
      if (left === STATIC_VALUE_UNKNOWN) return STATIC_VALUE_UNKNOWN;
      return Boolean(left)
        ? evaluateStaticValue(node.right, referenceNode, visitedBindings)
        : left;
    }
    if (operator === "||") {
      if (left === STATIC_VALUE_UNKNOWN) return STATIC_VALUE_UNKNOWN;
      return Boolean(left)
        ? left
        : evaluateStaticValue(node.right, referenceNode, visitedBindings);
    }
    if (operator === "??") {
      if (left === STATIC_VALUE_UNKNOWN) return STATIC_VALUE_UNKNOWN;
      return left === null || left === undefined
        ? evaluateStaticValue(node.right, referenceNode, visitedBindings)
        : left;
    }
    const right = evaluateStaticValue(node.right, referenceNode, visitedBindings);
    if (left === STATIC_VALUE_UNKNOWN || right === STATIC_VALUE_UNKNOWN) return STATIC_VALUE_UNKNOWN;
    switch (operator) {
      case "+": return left + right;
      case "-": return left - right;
      case "*": return left * right;
      case "/": return left / right;
      case "%": return left % right;
      case "**": return left ** right;
      case "<": return left < right;
      case "<=": return left <= right;
      case ">": return left > right;
      case ">=": return left >= right;
      case "===": return left === right;
      case "!==": return left !== right;
      case "==": return left == right;
      case "!=": return left != right;
      default: return STATIC_VALUE_UNKNOWN;
    }
  }

  return STATIC_VALUE_UNKNOWN;
}

function staticBranchValue(expression) {
  const value = evaluateStaticValue(expression);
  return value === STATIC_VALUE_UNKNOWN ? undefined : Boolean(value);
}

function canFallThroughStatement(statement) {
  if (ts.isReturnStatement(statement)
    || ts.isThrowStatement(statement)
    || ts.isBreakStatement(statement)
    || ts.isContinueStatement(statement)) {
    return false;
  }
  if (ts.isBlock(statement)) return canFallThroughSequence(statement.statements);
  if (ts.isIfStatement(statement)) {
    const branch = staticBranchValue(statement.expression);
    if (branch === true) return canFallThroughStatement(statement.thenStatement);
    if (branch === false) return statement.elseStatement
      ? canFallThroughStatement(statement.elseStatement)
      : true;
    return !statement.elseStatement
      || canFallThroughStatement(statement.thenStatement)
      || canFallThroughStatement(statement.elseStatement);
  }
  if (ts.isTryStatement(statement)) {
    if (statement.finallyBlock && !canFallThroughStatement(statement.finallyBlock)) return false;
    return canFallThroughStatement(statement.tryBlock)
      || Boolean(statement.catchClause && canFallThroughStatement(statement.catchClause.block));
  }
  return true;
}

function canFallThroughSequence(statements) {
  for (const statement of statements) {
    if (!canFallThroughStatement(statement)) return false;
  }
  return true;
}

function analyzeStatementSequence(statements, sourceFile, depth, visitedBindings) {
  for (const statement of statements) {
    if (analyzeStatement(statement, sourceFile, depth, visitedBindings)) return true;
    if (!canFallThroughStatement(statement)) return false;
  }
  return false;
}

function analyzeStatement(statement, sourceFile, depth, visitedBindings) {
  if (ts.isExpressionStatement(statement)) {
    return analyzeInvocationExpression(statement.expression, sourceFile, depth, visitedBindings);
  }
  if (ts.isReturnStatement(statement)) {
    return statement.expression
      ? analyzeInvocationExpression(statement.expression, sourceFile, depth, visitedBindings)
      : false;
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((declaration) => (
      declaration.initializer
      && analyzeInvocationExpression(declaration.initializer, sourceFile, depth, visitedBindings)
    ));
  }
  if (ts.isBlock(statement)) {
    return analyzeStatementSequence(statement.statements, sourceFile, depth, visitedBindings);
  }
  if (ts.isIfStatement(statement)) {
    const branch = staticBranchValue(statement.expression);
    if (branch === true) return analyzeStatement(statement.thenStatement, sourceFile, depth, visitedBindings);
    if (branch === false) {
      return statement.elseStatement
        ? analyzeStatement(statement.elseStatement, sourceFile, depth, visitedBindings)
        : false;
    }
    return analyzeStatement(statement.thenStatement, sourceFile, depth, visitedBindings)
      || (statement.elseStatement ? analyzeStatement(statement.elseStatement, sourceFile, depth, visitedBindings) : false);
  }
  if (ts.isTryStatement(statement)) {
    return analyzeStatement(statement.tryBlock, sourceFile, depth, visitedBindings)
      || (statement.catchClause ? analyzeStatement(statement.catchClause.block, sourceFile, depth, visitedBindings) : false)
      || (statement.finallyBlock ? analyzeStatement(statement.finallyBlock, sourceFile, depth, visitedBindings) : false);
  }
  return false;
}

function analyzeFunctionBinding(functionLike, sourceFile, depth, visitedBindings) {
  if (!functionLike || depth > MAX_CALLBACK_ANALYSIS_DEPTH || visitedBindings.has(functionLike)) return false;
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(functionLike);
  if (ts.isBlock(functionLike.body)) {
    return analyzeStatementSequence(functionLike.body.statements, sourceFile, depth + 1, nextVisitedBindings);
  }
  return analyzeInvocationExpression(functionLike.body, sourceFile, depth + 1, nextVisitedBindings);
}

function analyzeCallbackBinding(expression, sourceFile, depth, visitedBindings) {
  if (!expression || depth > MAX_CALLBACK_ANALYSIS_DEPTH) return false;
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    if (node.text === "loadNextPage") {
      return isCanonicalStoreBinding(
        sourceFile,
        "loadNextPage",
        "loadNextPage",
        findEnclosingFunctionLike(node)
      );
    }
    const functionLike = resolveFunctionBinding(sourceFile, node.text, node);
    return analyzeFunctionBinding(functionLike, sourceFile, depth + 1, visitedBindings);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return analyzeFunctionBinding(node, sourceFile, depth + 1, visitedBindings);
  }
  return analyzeInvocationExpression(node, sourceFile, depth + 1, visitedBindings);
}

function findFileLibraryLoadMoreExpressions(rootNode) {
  const expressions = [];
  function visit(node) {
    if (node !== rootNode && isFunctionLikeNode(node)) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      if (ts.isIdentifier(tagName) && tagName.text === "FileLibraryList") {
        const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
        let loadMoreExpression;
        let hasLoadMoreAttribute = false;
        let hasUnresolvedSpreadOverride = false;
        for (const property of attributes.properties) {
          if (ts.isJsxSpreadAttribute(property)) {
            if (hasLoadMoreAttribute) {
              hasUnresolvedSpreadOverride = true;
              continue;
            }
            const spread = resolveStableJsxObjectProperties(property.expression, property);
            if (!spread.known) {
              continue;
            }
            const spreadLoadMore = spread.properties.find(({ name }) => name === "onLoadMore");
            if (spreadLoadMore) {
              hasLoadMoreAttribute = true;
              hasUnresolvedSpreadOverride = false;
              loadMoreExpression = spreadLoadMore.expression;
            }
            continue;
          }
          if (property.name.text !== "onLoadMore") continue;
          hasLoadMoreAttribute = true;
          hasUnresolvedSpreadOverride = false;
          loadMoreExpression = undefined;
          if (property.initializer && ts.isJsxExpression(property.initializer) && property.initializer.expression) {
            loadMoreExpression = property.initializer.expression;
          }
        }
        expressions.push({ expression: loadMoreExpression, hasUnresolvedSpreadOverride });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(rootNode);
  return expressions;
}

function isFileLibraryBackendCommand(expression, referenceNode = expression, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if ((node.kind === ts.SyntaxKind.StringLiteral
    || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral)
    && node.text === "query_file_library_v2") {
    return true;
  }
  if (!ts.isIdentifier(node)) return false;
  const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
  const declaration = declarations[0].node;
  if (!ts.isIdentifier(declaration.name)) return false;
  const key = `command:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return false;
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  return findBindingValueExpressions(referenceNode, declaration, node.text).some((value) => (
    isFileLibraryBackendCommand(value, declaration, nextVisited)
  ));
}

function findBindingValueExpressions(referenceNode, declaration, name) {
  const values = [];
  if (declaration.initializer) values.push(unwrapExpression(declaration.initializer));
  if (!ts.isIdentifier(declaration.name)) return values;
  const scope = findEnclosingFunctionLike(declaration) ?? declaration.getSourceFile();
  const root = isFunctionLikeNode(scope) ? scope.body : scope;
  if (!root) return values;
  const referenceStart = referenceNode.getStart(referenceNode.getSourceFile());
  function visit(node) {
    if (node !== root && isFunctionLikeNode(node)) return;
    if (ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left)
      && node.left.text === name
      && node.getStart(node.getSourceFile()) < referenceStart) {
      values.push(unwrapExpression(node.right));
    }
    ts.forEachChild(node, visit);
  }
  visit(root);
  return values;
}

function bindingValueKey(value) {
  if (value.unknown) return "unknown";
  if (!value.expression) return `empty:${value.propertyName ?? ""}`;
  const sourceFile = value.expression.getSourceFile?.();
  return `${sourceFile ? value.expression.getStart(sourceFile) : -1}:${value.propertyName ?? ""}`;
}

function bindingStateKey(state) {
  return state.map(bindingValueKey).sort().join("|");
}

function mergeBindingStates(...stateGroups) {
  const states = [];
  const seen = new Set();
  for (const stateGroup of stateGroups) {
    for (const state of stateGroup) {
      const key = bindingStateKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      states.push(state);
    }
  }
  return states;
}

function bindingElementMatchesDeclaration(element, referenceNode, declaration, name) {
  const bindingName = ts.isIdentifier(element)
    ? element
    : ts.isBindingElement(element)
      ? element.name
      : undefined;
  if (!bindingName || !bindingPatternContainsName(bindingName, name)) {
    return false;
  }
  const binding = resolveLexicalBinding(bindingName, name);
  return binding?.kind === "local"
    && binding.declarationKind === "variable"
    && binding.declaration === declaration;
}

function assignmentPropertyName(name) {
  if (ts.isComputedPropertyName(name)) {
    return propertyNameText(unwrapExpression(name.expression));
  }
  return propertyNameText(name);
}

function assignmentPropertyAccessName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (!ts.isElementAccessExpression(node)) return undefined;
  const argument = unwrapExpression(node.argumentExpression);
  return ts.isStringLiteral(argument) || ts.isNumericLiteral(argument)
    ? argument.text
    : undefined;
}

function findAssignmentBindingTargets(pattern, referenceNode, declaration, name, propertyName, unknown = false) {
  const targets = [];
  const node = unwrapExpression(pattern);
  if (!node) return targets;
  if (ts.isIdentifier(node)) {
    if (bindingElementMatchesDeclaration(node, referenceNode, declaration, name)) {
      targets.push({ propertyName, unknown });
    }
    return targets;
  }
  if (ts.isBindingElement(node)) {
    const nextPropertyName = node.propertyName
      ? assignmentPropertyName(node.propertyName)
      : propertyName;
    return findAssignmentBindingTargets(
      node.name,
      referenceNode,
      declaration,
      name,
      nextPropertyName,
      unknown || Boolean(node.dotDotDotToken) || (node.propertyName && !nextPropertyName)
    );
  }
  if (ts.isObjectBindingPattern(node) || ts.isObjectLiteralExpression(node)) {
    for (const element of node.elements ?? node.properties) {
      if (ts.isBindingElement(element)) {
        targets.push(...findAssignmentBindingTargets(
          element,
          referenceNode,
          declaration,
          name,
          propertyName,
          unknown
        ));
      } else if (ts.isPropertyAssignment(element)) {
        const nextPropertyName = assignmentPropertyName(element.name);
        targets.push(...findAssignmentBindingTargets(
          element.initializer,
          referenceNode,
          declaration,
          name,
          nextPropertyName,
          unknown || !nextPropertyName
        ));
      } else if (ts.isShorthandPropertyAssignment(element)) {
        targets.push(...findAssignmentBindingTargets(
          element.name,
          referenceNode,
          declaration,
          name,
          assignmentPropertyName(element.name),
          unknown
        ));
      } else if (ts.isSpreadAssignment(element)) {
        targets.push(...findAssignmentBindingTargets(
          element.expression,
          referenceNode,
          declaration,
          name,
          propertyName,
          true
        ));
      }
    }
    return targets;
  }
  if (ts.isArrayBindingPattern(node) || ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      if (!element || ts.isOmittedExpression(element)) continue;
      targets.push(...findAssignmentBindingTargets(
        element,
        referenceNode,
        declaration,
        name,
        propertyName,
        true
      ));
    }
  }
  return targets;
}

function bindingAssignmentValues(left, right, assignmentNode, referenceNode, declaration, name, trackPropertyContainer) {
  const node = unwrapExpression(left);
  if (ts.isIdentifier(node)) {
    return bindingElementMatchesDeclaration(node, referenceNode ?? node, declaration, name)
      ? [{ expression: right, referenceNode: assignmentNode }]
      : [];
  }
  if (trackPropertyContainer && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
    const receiver = unwrapExpression(node.expression);
    const propertyName = assignmentPropertyAccessName(node);
    if (ts.isIdentifier(receiver)
      && resolveLexicalBinding(receiver, receiver.text)?.declaration === declaration) {
      return [{
        expression: right,
        referenceNode: assignmentNode,
        propertyName,
        unknown: !propertyName,
        propertyAssignment: true
      }];
    }
    return [];
  }
  return findAssignmentBindingTargets(
    node,
    referenceNode ?? node,
    declaration,
    name
  ).map((target) => ({
    expression: right,
    referenceNode: assignmentNode,
    propertyName: target.propertyName,
    unknown: target.unknown
  }));
}

function applyBindingAssignment(states, values, operator) {
  if (values.length === 0) return states;
  if (operator === ts.SyntaxKind.EqualsToken) {
    const propertyAssignments = values.filter((value) => value.propertyAssignment);
    if (propertyAssignments.length > 0) {
      return states.map((state) => {
        const next = state.filter((value) => !propertyAssignments.some((assignment) => (
          assignment.propertyName && value.propertyName === assignment.propertyName
        )));
        return [...next, ...values];
      });
    }
    return values.map((value) => [value]);
  }
  if (operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken
    || operator === ts.SyntaxKind.BarBarEqualsToken
    || operator === ts.SyntaxKind.QuestionQuestionEqualsToken) {
    return mergeBindingStates(states, ...values.map((value) => [[value]]));
  }
  return [[{ unknown: true, referenceNode: values[0].referenceNode }]];
}

const VALUE_TRUTHY = "truthy";
const VALUE_FALSY = "falsy";
const VALUE_TRUTHINESS_UNKNOWN = "truthiness-unknown";
const VALUE_NULLISH = "nullish";
const VALUE_NON_NULLISH = "non-nullish";
const VALUE_NULLISHNESS_UNKNOWN = "nullishness-unknown";

function unknownValueClassification() {
  return {
    truthiness: VALUE_TRUTHINESS_UNKNOWN,
    nullishness: VALUE_NULLISHNESS_UNKNOWN
  };
}

function classifyStaticValue(value) {
  if (value === STATIC_VALUE_UNKNOWN) return unknownValueClassification();
  if (value === null || value === undefined) {
    return { truthiness: VALUE_FALSY, nullishness: VALUE_NULLISH };
  }
  return {
    truthiness: Boolean(value) ? VALUE_TRUTHY : VALUE_FALSY,
    nullishness: VALUE_NON_NULLISH
  };
}

function mergeValueClassification(classifications, field, unknownValue) {
  const values = new Set(classifications.map((classification) => classification[field]));
  if (values.size === 1) return classifications[0]?.[field] ?? unknownValue;
  return unknownValue;
}

function classifyBindingState(
  state,
  sourceFile,
  functionName,
  referenceNode,
  visitedBindings = new Set()
) {
  if (state.length === 0) {
    return { truthiness: VALUE_FALSY, nullishness: VALUE_NULLISH };
  }
  const classifications = state.map((value) => classifyBindingValue(
    value,
    sourceFile,
    functionName,
    referenceNode,
    visitedBindings
  ));
  return {
    truthiness: mergeValueClassification(
      classifications,
      "truthiness",
      VALUE_TRUTHINESS_UNKNOWN
    ),
    nullishness: mergeValueClassification(
      classifications,
      "nullishness",
      VALUE_NULLISHNESS_UNKNOWN
    )
  };
}

function classifyBindingValue(
  value,
  sourceFile,
  functionName,
  referenceNode,
  visitedBindings = new Set()
) {
  if (value.unknown || !value.expression) return unknownValueClassification();
  const expression = unwrapExpression(value.expression);
  if (!expression) return unknownValueClassification();

  if (value.propertyName) {
    if (ts.isObjectLiteralExpression(expression)) {
      const propertyValue = objectPropertyValue(expression, value.propertyName);
      return propertyValue
        ? classifyBindingValue(
          { expression: propertyValue, referenceNode: value.referenceNode },
          sourceFile,
          functionName,
          referenceNode,
          visitedBindings
        )
        : { truthiness: VALUE_FALSY, nullishness: VALUE_NULLISH };
    }
    return unknownValueClassification();
  }

  const staticValue = evaluateStaticValue(expression, value.referenceNode ?? referenceNode);
  if (staticValue !== STATIC_VALUE_UNKNOWN) return classifyStaticValue(staticValue);
  if (isFunctionLikeNode(expression)
    || ts.isObjectLiteralExpression(expression)
    || ts.isArrayLiteralExpression(expression)
    || ts.isClassExpression(expression)
    || ts.isNewExpression(expression)) {
    return { truthiness: VALUE_TRUTHY, nullishness: VALUE_NON_NULLISH };
  }
  if ((ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
    && FILE_LIBRARY_RESULT_ACTIONS.has(callablePropertyName(expression))
    && isCanonicalStoreStateExpression(
      expression.expression,
      sourceFile,
      value.referenceNode ?? referenceNode,
      visitedBindings
    )) {
    return { truthiness: VALUE_TRUTHY, nullishness: VALUE_NON_NULLISH };
  }
  if (ts.isIdentifier(expression)) {
    const binding = resolveLexicalBinding(value.referenceNode ?? referenceNode, expression.text);
    if (binding?.kind === "local" && binding.declarationKind === "variable") {
      const key = `value-classification:${binding.declaration.getStart(binding.declaration.getSourceFile())}`;
      if (visitedBindings.has(key)) return unknownValueClassification();
      const nextVisited = new Set(visitedBindings);
      nextVisited.add(key);
      const states = findReachableBindingStatesAt(
        value.referenceNode ?? referenceNode,
        binding.declaration,
        expression.text
      );
      if (states.length === 0) return unknownValueClassification();
      const classifications = states.map((candidate) => classifyBindingState(
        candidate,
        sourceFile,
        functionName,
        value.referenceNode ?? referenceNode,
        nextVisited
      ));
      return {
        truthiness: mergeValueClassification(
          classifications,
          "truthiness",
          VALUE_TRUTHINESS_UNKNOWN
        ),
        nullishness: mergeValueClassification(
          classifications,
          "nullishness",
          VALUE_NULLISHNESS_UNKNOWN
        )
      };
    }
  }
  return unknownValueClassification();
}

function classifyBindingTargetState(state, left, context) {
  const node = unwrapExpression(left);
  if (ts.isIdentifier(node)
    && bindingElementMatchesDeclaration(
      node,
      context.referenceNode ?? node,
      context.declaration,
      context.name
    )) {
    return state;
  }
  if (context.trackPropertyContainer
    && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
    const receiver = unwrapExpression(node.expression);
    const propertyName = assignmentPropertyAccessName(node);
    if (ts.isIdentifier(receiver)
      && resolveLexicalBinding(receiver, receiver.text)?.declaration === context.declaration) {
      return state.filter((value) => (
        value.propertyAssignment
        && value.propertyName === propertyName
      ));
    }
  }
  return undefined;
}

function logicalAssignmentDecision(state, left, operator, context) {
  const targetState = classifyBindingTargetState(state, left, context);
  if (!targetState) return "unknown";
  const classification = classifyBindingState(
    targetState,
    left.getSourceFile(),
    context.name,
    context.referenceNode ?? left
  );
  if (operator === ts.SyntaxKind.BarBarEqualsToken) {
    if (classification.truthiness === VALUE_TRUTHY) return "skip";
    if (classification.truthiness === VALUE_FALSY) return "execute";
  }
  if (operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken) {
    if (classification.truthiness === VALUE_FALSY) return "skip";
    if (classification.truthiness === VALUE_TRUTHY) return "execute";
  }
  if (operator === ts.SyntaxKind.QuestionQuestionEqualsToken) {
    if (classification.nullishness === VALUE_NON_NULLISH) return "skip";
    if (classification.nullishness === VALUE_NULLISH) return "execute";
  }
  return "unknown";
}

function processBindingLogicalAssignment(node, states, context) {
  const afterLeft = processBindingExpression(node.left, states, context);
  const outputStates = [];
  for (const state of afterLeft) {
    const decision = logicalAssignmentDecision(
      state,
      node.left,
      node.operatorToken.kind,
      context
    );
    if (decision !== "execute") outputStates.push(state);
    if (decision !== "skip") {
      const afterRight = processBindingExpression(node.right, [state], context);
      outputStates.push(...bindingAssignmentTarget(
        node.left,
        node.right,
        node,
        afterRight,
        context,
        ts.SyntaxKind.EqualsToken
      ));
    }
  }
  return mergeBindingStates(outputStates);
}

function logicalExpressionDecision(left, operator, referenceNode) {
  const classification = classifyBindingValue(
    { expression: left, referenceNode },
    referenceNode.getSourceFile(),
    undefined,
    referenceNode
  );
  if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
    if (classification.truthiness === VALUE_FALSY) return "skip";
    if (classification.truthiness === VALUE_TRUTHY) return "execute";
  }
  if (operator === ts.SyntaxKind.BarBarToken) {
    if (classification.truthiness === VALUE_TRUTHY) return "skip";
    if (classification.truthiness === VALUE_FALSY) return "execute";
  }
  if (operator === ts.SyntaxKind.QuestionQuestionToken) {
    if (classification.nullishness === VALUE_NON_NULLISH) return "skip";
    if (classification.nullishness === VALUE_NULLISH) return "execute";
  }
  return "unknown";
}

function bindingAssignmentTarget(left, right, node, states, context, operator = node.operatorToken.kind) {
  const values = bindingAssignmentValues(
    left,
    right,
    node,
    context.referenceNode,
    context.declaration,
    context.name,
    context.trackPropertyContainer
  );
  return applyBindingAssignment(states, values, operator);
}

function processBindingExpression(expression, states, context) {
  const node = unwrapExpression(expression);
  if (!node || node.getStart(node.getSourceFile()) >= context.referenceStart) return states;
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(node.getSourceFile()))) {
      if (operator === ts.SyntaxKind.AmpersandAmpersandEqualsToken
        || operator === ts.SyntaxKind.BarBarEqualsToken
        || operator === ts.SyntaxKind.QuestionQuestionEqualsToken) {
        return processBindingLogicalAssignment(node, states, context);
      }
      let next = processBindingExpression(node.right, states, context);
      next = processBindingExpression(node.left, next, context);
      return bindingAssignmentTarget(node.left, node.right, node, next, context);
    }
    const afterLeft = processBindingExpression(node.left, states, context);
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken
      || operator === ts.SyntaxKind.BarBarToken
      || operator === ts.SyntaxKind.QuestionQuestionToken) {
      const decision = logicalExpressionDecision(node.left, operator, node);
      if (decision === "skip") return afterLeft;
      const afterRight = processBindingExpression(node.right, afterLeft, context);
      return decision === "execute"
        ? afterRight
        : mergeBindingStates(afterLeft, afterRight);
    }
  }
  if (ts.isConditionalExpression(node)) {
    const afterCondition = processBindingExpression(node.condition, states, context);
    const branch = staticBranchValue(node.condition);
    if (branch === true) return processBindingExpression(node.whenTrue, afterCondition, context);
    if (branch === false) return processBindingExpression(node.whenFalse, afterCondition, context);
    return mergeBindingStates(
      processBindingExpression(node.whenTrue, afterCondition, context),
      processBindingExpression(node.whenFalse, afterCondition, context)
    );
  }
  if (ts.isCallExpression(node)) {
    let next = processBindingExpression(node.expression, states, context);
    for (const argument of node.arguments) {
      if (!isFunctionLikeNode(unwrapExpression(argument))) {
        next = processBindingExpression(argument, next, context);
      }
    }
    return next;
  }
  let next = states;
  ts.forEachChild(node, (child) => {
    if (!isFunctionLikeNode(child)) {
      next = processBindingExpression(child, next, context);
    }
  });
  return next;
}

function resolveIterationValues(expression, kind, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return [{ unknown: true, referenceNode }];

  if (kind === "of" && ts.isArrayLiteralExpression(node)) {
    const values = [];
    for (const element of node.elements) {
      if (ts.isOmittedExpression(element)) continue;
      if (ts.isSpreadElement(element)) {
        values.push({ unknown: true, referenceNode: element });
      } else {
        values.push({ expression: unwrapExpression(element), referenceNode: element });
      }
    }
    return values;
  }

  if (kind === "in" && ts.isObjectLiteralExpression(node)) {
    const values = [];
    let unknown = false;
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        unknown = true;
        continue;
      }
      const propertyName = (ts.isPropertyAssignment(property)
        || ts.isShorthandPropertyAssignment(property)
        || ts.isMethodDeclaration(property))
        ? propertyNameText(property.name)
        : undefined;
      if (!propertyName) {
        unknown = true;
        continue;
      }
      values.push({
        expression: ts.factory.createStringLiteral(propertyName),
        referenceNode: property
      });
    }
    if (unknown) values.push({ unknown: true, referenceNode: node });
    return values;
  }

  if (ts.isIdentifier(node)) {
    const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
    if (binding?.kind === "local"
      && binding.declarationKind === "variable"
      && ts.isIdentifier(binding.declaration.name)
      && isStableConstVariableDeclaration(binding.declaration, referenceNode, node.text)) {
      const key = `iteration-values:${binding.declaration.getStart(binding.declaration.getSourceFile())}:${kind}`;
      if (visitedBindings.has(key)) return [{ unknown: true, referenceNode: node }];
      const nextVisited = new Set(visitedBindings);
      nextVisited.add(key);
      return resolveIterationValues(
        binding.declaration.initializer,
        kind,
        binding.declaration,
        nextVisited
      );
    }
  }

  return [{ unknown: true, referenceNode: node }];
}

function selectIterationObjectProperty(valueExpression, propertyName) {
  const node = unwrapExpression(valueExpression);
  if (!propertyName) return { unknown: true };
  if (!ts.isObjectLiteralExpression(node)) return { unknown: true };
  let unknown = false;
  for (let index = node.properties.length - 1; index >= 0; index -= 1) {
    const property = node.properties[index];
    if (ts.isSpreadAssignment(property)) {
      unknown = true;
      continue;
    }
    const candidateName = (ts.isPropertyAssignment(property)
      || ts.isShorthandPropertyAssignment(property)
      || ts.isMethodDeclaration(property))
      ? propertyNameText(property.name)
      : undefined;
    if (candidateName !== propertyName) continue;
    if (unknown) return { unknown: true };
    if (ts.isPropertyAssignment(property)) return { known: true, expression: property.initializer };
    if (ts.isShorthandPropertyAssignment(property)) return { known: true, expression: property.name };
    if (ts.isMethodDeclaration(property)) return { known: true, expression: property };
  }
  return { unknown };
}

function selectIterationArrayElement(valueExpression, index) {
  const node = unwrapExpression(valueExpression);
  if (!ts.isArrayLiteralExpression(node)) return { unknown: true };
  const element = node.elements[index];
  if (!element) return { known: false };
  if (ts.isSpreadElement(element) || ts.isOmittedExpression(element)) return { unknown: true };
  return { known: true, expression: element };
}

function iterationBindingValues(
  pattern,
  valueExpression,
  assignmentNode,
  context,
  propertyName,
  unknown = false
) {
  const node = unwrapExpression(pattern);
  if (!node) return [];
  if (ts.isIdentifier(node)) {
    return bindingElementMatchesDeclaration(
      node,
      context.referenceNode ?? node,
      context.declaration,
      context.name
    )
      ? [{
        expression: valueExpression,
        referenceNode: assignmentNode,
        propertyName,
        unknown
      }]
      : [];
  }
  if (ts.isBindingElement(node)) {
    const nextPropertyName = node.propertyName
      ? assignmentPropertyName(node.propertyName)
      : propertyName;
    return iterationBindingValues(
      node.name,
      valueExpression,
      assignmentNode,
      context,
      nextPropertyName,
      unknown || Boolean(node.dotDotDotToken) || Boolean(node.propertyName && !nextPropertyName)
    );
  }
  if (ts.isObjectBindingPattern(node) || ts.isObjectLiteralExpression(node)) {
    const values = [];
    for (const element of node.elements ?? node.properties) {
      if (ts.isBindingElement(element)) {
        const sourceProperty = element.propertyName
          ? assignmentPropertyName(element.propertyName)
          : assignmentPropertyName(element.name);
        const selected = selectIterationObjectProperty(valueExpression, sourceProperty);
        values.push(...iterationBindingValues(
          element.name,
          selected.known ? selected.expression : valueExpression,
          assignmentNode,
          context,
          selected.known ? undefined : sourceProperty,
          unknown || selected.unknown || Boolean(element.dotDotDotToken)
        ));
      } else if (ts.isPropertyAssignment(element)) {
        const sourceProperty = assignmentPropertyName(element.name);
        const selected = selectIterationObjectProperty(valueExpression, sourceProperty);
        values.push(...iterationBindingValues(
          element.initializer,
          selected.known ? selected.expression : valueExpression,
          assignmentNode,
          context,
          selected.known ? undefined : sourceProperty,
          unknown || selected.unknown
        ));
      } else if (ts.isShorthandPropertyAssignment(element)) {
        const sourceProperty = assignmentPropertyName(element.name);
        const selected = selectIterationObjectProperty(valueExpression, sourceProperty);
        values.push(...iterationBindingValues(
          element.name,
          selected.known ? selected.expression : valueExpression,
          assignmentNode,
          context,
          selected.known ? undefined : sourceProperty,
          unknown || selected.unknown
        ));
      } else if (ts.isSpreadAssignment(element)) {
        values.push(...iterationBindingValues(
          element.expression,
          valueExpression,
          assignmentNode,
          context,
          propertyName,
          true
        ));
      }
    }
    return values;
  }
  if (ts.isArrayBindingPattern(node) || ts.isArrayLiteralExpression(node)) {
    const values = [];
    node.elements.forEach((element, index) => {
      if (!element || ts.isOmittedExpression(element)) return;
      const target = ts.isBindingElement(element) ? element.name : element;
      const selected = selectIterationArrayElement(valueExpression, index);
      values.push(...iterationBindingValues(
        target,
        selected.known ? selected.expression : valueExpression,
        assignmentNode,
        context,
        undefined,
        unknown || selected.unknown || !selected.known
      ));
    });
    return values;
  }
  return [];
}

function processForEachBinding(statement, states, context, kind) {
  const initializer = statement.initializer;
  const pattern = ts.isVariableDeclarationList(initializer)
    ? initializer.declarations[0]?.name
    : initializer;
  if (!pattern) return states;
  const iterationValues = resolveIterationValues(statement.expression, kind, statement);
  const bodyStates = [];
  for (const iterationValue of iterationValues) {
    const valueExpression = iterationValue.expression ?? statement.expression;
    const values = iterationBindingValues(
      pattern,
      valueExpression,
      statement,
      context,
      undefined,
      Boolean(iterationValue.unknown)
    );
    const iterationStates = applyBindingAssignment(states, values, ts.SyntaxKind.EqualsToken);
    bodyStates.push(processBindingStatement(statement.statement, iterationStates, context));
  }
  return mergeBindingStates(states, ...bodyStates);
}

function processBindingStatement(statement, states, context) {
  if (!statement || statement.getStart(statement.getSourceFile()) >= context.referenceStart) return states;
  if (ts.isVariableStatement(statement)) {
    return processBindingVariableDeclarationList(statement.declarationList, states, context);
  }
  if (ts.isExpressionStatement(statement)) {
    return processBindingExpression(statement.expression, states, context);
  }
  if (ts.isReturnStatement(statement)) {
    return statement.expression
      ? processBindingExpression(statement.expression, states, context)
      : states;
  }
  if (ts.isBlock(statement)) {
    return processBindingSequence(statement.statements, states, context);
  }
  if (ts.isIfStatement(statement)) {
    const afterCondition = processBindingExpression(statement.expression, states, context);
    const branch = staticBranchValue(statement.expression);
    if (branch === true) return processBindingStatement(statement.thenStatement, afterCondition, context);
    if (branch === false) {
      return statement.elseStatement
        ? processBindingStatement(statement.elseStatement, afterCondition, context)
        : afterCondition;
    }
    const afterThen = processBindingStatement(statement.thenStatement, afterCondition, context);
    const afterElse = statement.elseStatement
      ? processBindingStatement(statement.elseStatement, afterCondition, context)
      : afterCondition;
    return mergeBindingStates(afterThen, afterElse);
  }
  if (ts.isTryStatement(statement)) {
    const afterTry = processBindingStatement(statement.tryBlock, states, context);
    const afterCatch = statement.catchClause
      ? processBindingStatement(statement.catchClause.block, states, context)
      : states;
    const merged = mergeBindingStates(afterTry, afterCatch);
    return statement.finallyBlock
      ? processBindingStatement(statement.finallyBlock, merged, context)
      : merged;
  }
  if (ts.isForStatement(statement)) {
    let afterInitializer = states;
    if (statement.initializer) {
      afterInitializer = ts.isVariableDeclarationList(statement.initializer)
        ? processBindingVariableDeclarationList(statement.initializer, states, context)
        : processBindingExpression(statement.initializer, states, context);
    }
    if (statement.condition) {
      afterInitializer = processBindingExpression(statement.condition, afterInitializer, context);
      if (staticBranchValue(statement.condition) === false) return afterInitializer;
    }
    const afterBody = processBindingStatement(statement.statement, afterInitializer, context);
    const afterIncrement = statement.incrementor
      ? processBindingExpression(statement.incrementor, afterBody, context)
      : afterBody;
    return mergeBindingStates(afterInitializer, afterIncrement);
  }
  if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
    const afterExpression = processBindingExpression(statement.expression, states, context);
    return processForEachBinding(
      statement,
      afterExpression,
      context,
      ts.isForOfStatement(statement) ? "of" : "in"
    );
  }
  if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
    const afterCondition = ts.isWhileStatement(statement)
      ? processBindingExpression(statement.expression, states, context)
      : states;
    if (ts.isWhileStatement(statement) && staticBranchValue(statement.expression) === false) return afterCondition;
    return mergeBindingStates(
      afterCondition,
      processBindingStatement(statement.statement, afterCondition, context)
    );
  }
  if (ts.isSwitchStatement(statement)) {
    const afterExpression = processBindingExpression(statement.expression, states, context);
    const branches = statement.caseBlock.clauses.map((clause) => (
      processBindingSequence(clause.statements, afterExpression, context)
    ));
    return mergeBindingStates(afterExpression, ...branches);
  }
  if (isFunctionLikeNode(statement)) return states;
  return processBindingExpression(statement, states, context);
}

function processBindingSequence(statements, states, context) {
  let next = states;
  for (const statement of statements) {
    next = processBindingStatement(statement, next, context);
    if (!canFallThroughStatement(statement)) return next;
    if (statement.getStart(statement.getSourceFile()) >= context.referenceStart) break;
  }
  return next;
}

function bindingDeclarationValues(declaration, referenceNode, name) {
  if (!declaration.initializer) return [];
  if (ts.isObjectBindingPattern(declaration.name)) {
    const element = findBindingElementByName(declaration.name, name);
    return [{
      expression: declaration.initializer,
      referenceNode: declaration,
      propertyName: element
        ? assignmentPropertyName(element.propertyName ?? element.name)
        : undefined,
      unknown: !element
    }];
  }
  if (ts.isArrayBindingPattern(declaration.name)) {
    return [{ expression: declaration.initializer, referenceNode: declaration, unknown: true }];
  }
  return [{ expression: declaration.initializer, referenceNode: declaration }];
}

function processBindingVariableDeclarationList(declarationList, states, context) {
  let next = states;
  for (const declaration of declarationList.declarations) {
    if (declaration === context.declaration) {
      const values = bindingDeclarationValues(declaration, context.referenceNode, context.name);
      next = values.length > 0
        ? next.map(() => values)
        : next.map(() => []);
    } else if (declaration.initializer) {
      next = processBindingExpression(declaration.initializer, next, context);
    }
  }
  return next;
}

function findReachableBindingStatesAt(referenceNode, declaration, name, options = {}) {
  const referenceStart = referenceNode.getStart(referenceNode.getSourceFile());
  const cacheKey = `${referenceStart}:${referenceNode.kind}:${name ?? ""}:${options.trackPropertyContainer ? "property" : "binding"}`;
  let declarationCache = bindingStatesCache.get(declaration);
  if (!declarationCache) {
    declarationCache = new Map();
    bindingStatesCache.set(declaration, declarationCache);
  }
  const cached = declarationCache.get(cacheKey);
  if (cached) return cached;
  const sourceFile = declaration.getSourceFile();
  if (!options.trackPropertyContainer
    && ts.isIdentifier(declaration.name)
    && ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    && declaration.initializer
    && declaration.getStart(sourceFile) < referenceStart
    && isStableConstVariableDeclaration(declaration, referenceNode, name ?? declaration.name.text)) {
    const states = [[{ expression: declaration.initializer, referenceNode: declaration }]];
    declarationCache.set(cacheKey, states);
    return states;
  }
  const scope = findEnclosingFunctionLike(declaration) ?? sourceFile;
  const root = isFunctionLikeNode(scope) ? scope.body : scope;
  if (!root) return [];
  const context = {
    declaration,
    name: name ?? (ts.isIdentifier(declaration.name) ? declaration.name.text : undefined),
    referenceNode,
    referenceStart,
    trackPropertyContainer: Boolean(options.trackPropertyContainer)
  };
  if (!context.name) return [];
  const states = processBindingSequence(root.statements, [[]], context);
  declarationCache.set(cacheKey, states);
  return states;
}

function findReachableBindingValuesAt(referenceNode, declaration, name, options = {}) {
  const states = findReachableBindingStatesAt(referenceNode, declaration, name, options);
  const values = states.flat();
  const seen = new Set();
  return values.filter((value) => {
    const key = bindingValueKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isImportedTauriHelper(identifier) {
  const binding = resolveImportProvenance(identifier, identifier);
  return Boolean(binding)
    && binding.kind === "import"
    && isCanonicalTauriApiModule(binding.moduleSpecifier, identifier.getSourceFile());
}

function isCanonicalTauriApiModule(moduleSpecifier, sourceFile) {
  if (!isRepositoryLocalImport(moduleSpecifier) || !sourceFile?.fileName) return false;
  const sourceDirectory = path.isAbsolute(sourceFile.fileName)
    ? path.dirname(sourceFile.fileName)
    : sourceFile.fileName === "useFileLibraryV2Store.ts"
      ? path.join(process.cwd(), "src", "store")
      : path.join(process.cwd(), "src", "views", "vault");
  const requestedPath = path.resolve(sourceDirectory, moduleSpecifier);
  const canonicalPath = path.resolve(process.cwd(), "src", "api", "tauriApi");
  return requestedPath.toLowerCase() === canonicalPath.toLowerCase();
}

function isUnresolvedQueryHelper(identifier, sourceFile) {
  if (!/^(?:(?:run|execute|fetch|request|invoke).*query|query.*(?:run|execute|fetch|request|invoke))/i.test(identifier.text)) {
    return false;
  }
  return !resolveFunctionBinding(sourceFile, identifier.text, identifier);
}

function isTauriApiReceiver(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!ts.isIdentifier(node)) return false;
  const provenance = resolveImportProvenance(node, referenceNode);
  if (provenance?.kind === "import"
    && isCanonicalTauriApiModule(provenance.moduleSpecifier, referenceNode?.getSourceFile?.())) {
    return true;
  }
  const binding = resolveLexicalBinding(referenceNode, node.text);
  if (!binding && node.text === "tauriApi") return true;
  if (!binding || binding.kind !== "local" || binding.declarationKind !== "variable") return false;
  const declaration = binding.declaration;
  if (!ts.isIdentifier(declaration.name)) return false;
  const key = `receiver:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return false;
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  return findBindingValueExpressions(referenceNode, declaration, node.text).some((value) => (
    isTauriApiReceiver(value, declaration, nextVisited)
  ));
}

function isImportedTauriApiReceiver(expression, referenceNode) {
  const node = unwrapExpression(expression);
  if (!ts.isIdentifier(node)) return false;
  const provenance = resolveImportProvenance(node, referenceNode);
  return provenance?.kind === "import"
    && isCanonicalTauriApiModule(provenance.moduleSpecifier, referenceNode?.getSourceFile?.());
}

function isFileLibraryQueryCallable(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    const property = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : propertyNameText(unwrapExpression(node.argumentExpression));
    if (property === "bind" || property === "call" || property === "apply") {
      return isFileLibraryQueryCallable(receiver, referenceNode, visitedBindings);
    }
    if (property === "queryFileLibraryV2"
      && isTauriApiReceiver(receiver, referenceNode, visitedBindings)) {
      return true;
    }
    const key = `object-callable:${node.getStart(node.getSourceFile())}:${property ?? ""}`;
    if (visitedBindings.has(key)) return false;
    const nextVisited = new Set(visitedBindings);
    nextVisited.add(key);
    return resolveObjectLiteralValues(receiver, referenceNode, nextVisited).some((objectLiteral) => {
      const value = objectPropertyValue(objectLiteral, property);
      return Boolean(value)
        && isFileLibraryQueryCallable(value, objectLiteral, nextVisited);
    });
  }
  if (!ts.isIdentifier(node)) return false;
  if (isImportedTauriHelper(node)) return true;
  const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
  const declaration = declarations[0].node;
  const key = `callable:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return false;
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  if (ts.isObjectBindingPattern(declaration.name)) {
    const element = declaration.name.elements.find((candidate) => (
      ts.isBindingElement(candidate)
      && ts.isIdentifier(candidate.name)
      && candidate.name.text === node.text
    ));
    const property = element?.propertyName
      ? propertyNameText(element.propertyName)
      : element?.name && ts.isIdentifier(element.name)
        ? element.name.text
        : undefined;
    return property === "queryFileLibraryV2"
      && isTauriApiReceiver(declaration.initializer, declaration, nextVisited);
  }
  return findBindingValueExpressions(referenceNode, declaration, node.text).some((value) => (
    isFileLibraryQueryCallable(value, declaration, nextVisited)
  ));
}

function isImportedTauriInvoke(identifier) {
  return isTauriCoreNamedImport(
    resolveImportProvenance(identifier, identifier),
    "invoke"
  );
}

function isTauriInvocationCallable(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return callablePropertyName(node) === "invoke"
      && isTauriCoreNamespaceImport(resolveImportProvenance(node.expression, referenceNode));
  }
  if (!ts.isIdentifier(node)) return false;
  if (isImportedTauriInvoke(node)) return true;
  const binding = resolveLexicalBinding(referenceNode, node.text);
  if (!binding && (node.text === "invoke" || node.text === "invokeCommand")) return true;
  if (!binding || binding.kind !== "local" || binding.declarationKind !== "variable") return false;
  const declaration = binding.declaration;
  if (!ts.isIdentifier(declaration.name)) return false;
  const key = `invoke:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return false;
  const nextVisited = new Set(visitedBindings);
  nextVisited.add(key);
  return findBindingValueExpressions(referenceNode, declaration, node.text).some((value) => (
    isTauriInvocationCallable(value, declaration, nextVisited)
  ));
}

function collectReachableJsxInExpression(expression, jsxNodes) {
  const node = unwrapExpression(expression);
  if (!node || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
  if (ts.isConditionalExpression(node)) {
    collectReachableJsxInExpression(node.condition, jsxNodes);
    const branch = staticBranchValue(node.condition);
    if (branch === true) {
      collectReachableJsxInExpression(node.whenTrue, jsxNodes);
    } else if (branch === false) {
      collectReachableJsxInExpression(node.whenFalse, jsxNodes);
    } else {
      collectReachableJsxInExpression(node.whenTrue, jsxNodes);
      collectReachableJsxInExpression(node.whenFalse, jsxNodes);
    }
    return;
  }
  if (ts.isBinaryExpression(node)) {
    collectReachableJsxInExpression(node.left, jsxNodes);
    const operator = node.operatorToken.getText(node.getSourceFile());
    const leftValue = staticBranchValue(node.left);
    if (operator === "&&" && leftValue === false) return;
    if (operator === "||" && leftValue === true) return;
    collectReachableJsxInExpression(node.right, jsxNodes);
    return;
  }
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) jsxNodes.push(node);
  ts.forEachChild(node, (child) => {
    if (isFunctionLikeNode(child)) return;
    collectReachableJsxInExpression(child, jsxNodes);
  });
}

function collectReachableJsxInStatement(statement, jsxNodes) {
  if (ts.isExpressionStatement(statement)) {
    collectReachableJsxInExpression(statement.expression, jsxNodes);
    return;
  }
  if (ts.isReturnStatement(statement)) {
    if (statement.expression) collectReachableJsxInExpression(statement.expression, jsxNodes);
    return;
  }
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer) collectReachableJsxInExpression(declaration.initializer, jsxNodes);
    }
    return;
  }
  if (ts.isBlock(statement)) {
    collectReachableJsxInSequence(statement.statements, jsxNodes);
    return;
  }
  if (ts.isIfStatement(statement)) {
    const branch = staticBranchValue(statement.expression);
    if (branch === true) {
      collectReachableJsxInStatement(statement.thenStatement, jsxNodes);
    } else if (branch === false) {
      if (statement.elseStatement) collectReachableJsxInStatement(statement.elseStatement, jsxNodes);
    } else {
      collectReachableJsxInStatement(statement.thenStatement, jsxNodes);
      if (statement.elseStatement) collectReachableJsxInStatement(statement.elseStatement, jsxNodes);
    }
    return;
  }
  if (ts.isTryStatement(statement)) {
    collectReachableJsxInStatement(statement.tryBlock, jsxNodes);
    if (statement.catchClause) collectReachableJsxInStatement(statement.catchClause.block, jsxNodes);
    if (statement.finallyBlock) collectReachableJsxInStatement(statement.finallyBlock, jsxNodes);
    return;
  }
  if (ts.isForStatement(statement)) {
    if (statement.initializer) {
      if (ts.isVariableDeclarationList(statement.initializer)) {
        for (const declaration of statement.initializer.declarations) {
          if (declaration.initializer) collectReachableJsxInExpression(declaration.initializer, jsxNodes);
        }
      } else {
        collectReachableJsxInExpression(statement.initializer, jsxNodes);
      }
    }
    if (statement.condition) {
      collectReachableJsxInExpression(statement.condition, jsxNodes);
      if (staticBranchValue(statement.condition) === false) return;
    }
    collectReachableJsxInStatement(statement.statement, jsxNodes);
    if (statement.incrementor) collectReachableJsxInExpression(statement.incrementor, jsxNodes);
    return;
  }
  if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
    if (!ts.isVariableDeclarationList(statement.initializer)) {
      collectReachableJsxInExpression(statement.initializer, jsxNodes);
    }
    collectReachableJsxInExpression(statement.expression, jsxNodes);
    collectReachableJsxInStatement(statement.statement, jsxNodes);
    return;
  }
  if (ts.isWhileStatement(statement)) {
    collectReachableJsxInExpression(statement.expression, jsxNodes);
    if (staticBranchValue(statement.expression) !== false) {
      collectReachableJsxInStatement(statement.statement, jsxNodes);
    }
    return;
  }
  if (ts.isDoStatement(statement)) {
    collectReachableJsxInStatement(statement.statement, jsxNodes);
    collectReachableJsxInExpression(statement.expression, jsxNodes);
    return;
  }
  if (ts.isSwitchStatement(statement)) {
    collectReachableJsxInExpression(statement.expression, jsxNodes);
    for (const clause of statement.caseBlock.clauses) {
      if (ts.isCaseClause(clause)) collectReachableJsxInExpression(clause.expression, jsxNodes);
      collectReachableJsxInSequence(clause.statements, jsxNodes);
    }
    return;
  }
  if (ts.isLabeledStatement(statement) || ts.isWithStatement(statement)) {
    if (ts.isWithStatement(statement)) collectReachableJsxInExpression(statement.expression, jsxNodes);
    collectReachableJsxInStatement(statement.statement, jsxNodes);
  }
}

function collectReachableJsxInSequence(statements, jsxNodes) {
  for (const statement of statements) {
    collectReachableJsxInStatement(statement, jsxNodes);
    if (!canFallThroughStatement(statement)) return;
  }
}

function findReachableJsxElementsInFunction(functionLike) {
  const jsxNodes = [];
  if (!functionLike.body) return jsxNodes;
  if (ts.isBlock(functionLike.body)) {
    collectReachableJsxInSequence(functionLike.body.statements, jsxNodes);
  } else {
    collectReachableJsxInExpression(functionLike.body, jsxNodes);
  }
  return jsxNodes;
}

function resolveStableJsxObjectProperties(expression, referenceNode = expression, visitedBindings = new Set(), visitedObjects = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return { known: false, properties: [] };
  if (ts.isIdentifier(node)) {
    const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
    if (declarations.length !== 1 || declarations[0].kind !== "variable") {
      return { known: false, properties: [] };
    }
    const declaration = declarations[0].node;
    const owner = findEnclosingFunctionLike(declaration);
    const scope = owner ?? declaration.getSourceFile();
    if (!ts.isVariableDeclarationList(declaration.parent)
      || (declaration.parent.flags & ts.NodeFlags.Const) === 0
      || !declaration.initializer
      || hasBindingWrite(scope, node.text, declaration)
      || (owner && hasObjectPropertyWrite(owner, node.text))) {
      return { known: false, properties: [] };
    }
    const key = `jsx-object:${declaration.getStart(declaration.getSourceFile())}`;
    if (visitedBindings.has(key)) return { known: false, properties: [] };
    const nextVisitedBindings = new Set(visitedBindings);
    nextVisitedBindings.add(key);
    return resolveStableJsxObjectProperties(
      declaration.initializer,
      declaration,
      nextVisitedBindings,
      visitedObjects
    );
  }
  if (!ts.isObjectLiteralExpression(node)) return { known: false, properties: [] };
  if (visitedObjects.has(node)) return { known: false, properties: [] };
  const nextVisitedObjects = new Set(visitedObjects);
  nextVisitedObjects.add(node);
  const properties = new Map();
  let known = true;
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveStableJsxObjectProperties(
        property.expression,
        property,
        visitedBindings,
        nextVisitedObjects
      );
      if (!spread.known) {
        known = false;
        continue;
      }
      for (const spreadProperty of spread.properties) {
        properties.set(spreadProperty.name, spreadProperty);
      }
      continue;
    }
    const computed = (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
      && ts.isComputedPropertyName(property.name);
    if (computed) {
      known = false;
      continue;
    }
    const name = ts.isShorthandPropertyAssignment(property)
      ? property.name.text
      : (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
        ? propertyNameText(property.name)
        : undefined;
    if (!name) {
      known = false;
      continue;
    }
    const value = ts.isMethodDeclaration(property)
      ? property
      : ts.isShorthandPropertyAssignment(property)
        ? property.name
        : unwrapExpression(property.initializer);
    properties.set(name, { name, expression: value, referenceNode: property });
  }
  return { known, properties: [...properties.values()] };
}

function collectReachableJsxCallbackExpressions(
  expression,
  expressions,
  referenceNode = expression,
  visitedNodes = new Set()
) {
  const node = unwrapExpression(expression);
  if (!node || visitedNodes.has(node)) return;
  visitedNodes.add(node);

  if (ts.isConditionalExpression(node)) {
    const condition = evaluateStaticValue(node.condition, referenceNode);
    const candidates = condition === STATIC_VALUE_UNKNOWN
      ? [node.whenTrue, node.whenFalse]
      : [Boolean(condition) ? node.whenTrue : node.whenFalse];
    for (const candidate of candidates) {
      collectReachableJsxCallbackExpressions(candidate, expressions, referenceNode, visitedNodes);
    }
    return;
  }

  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.getText(node.getSourceFile());
    if (operator === "&&" || operator === "||" || operator === "??") {
      const leftValue = evaluateStaticValue(node.left, referenceNode);
      const candidates = leftValue === STATIC_VALUE_UNKNOWN
        ? [node.left, node.right]
        : operator === "&&"
          ? [Boolean(leftValue) ? node.right : node.left]
          : operator === "||"
            ? [Boolean(leftValue) ? node.left : node.right]
            : [leftValue === null || leftValue === undefined ? node.right : node.left];
      for (const candidate of candidates) {
        collectReachableJsxCallbackExpressions(candidate, expressions, referenceNode, visitedNodes);
      }
      return;
    }
  }

  expressions.push(node);
}

function isJsxCallbackAttribute(name) {
  return typeof name === "string" && /^on[A-Z]/.test(name);
}

function findJsxCallbackBindings(functionLike) {
  return findReachableJsxElementsInFunction(functionLike).flatMap((node) => {
    const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    return attributes.properties.flatMap((property) => {
      if (ts.isJsxAttribute(property)) {
        return property.initializer
          && ts.isJsxExpression(property.initializer)
          && property.initializer.expression
          ? [property.initializer.expression]
          : [];
      }
      if (!ts.isJsxSpreadAttribute(property)) return [];
      const spread = resolveStableJsxObjectProperties(property.expression, property);
      return spread.known ? spread.properties.map(({ expression }) => expression) : [];
    });
  });
}

function findJsxCallbackBranchExpressions(functionLike) {
  return findReachableJsxElementsInFunction(functionLike).flatMap((node) => {
    const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    return attributes.properties.flatMap((property) => {
      const expressions = [];
      const collectIfBranchExpression = (name, expression, referenceNode) => {
        const node = unwrapExpression(expression);
        if (!isJsxCallbackAttribute(name)
          || (!ts.isConditionalExpression(node)
            && !(ts.isBinaryExpression(node)
              && ["&&", "||", "??"].includes(node.operatorToken.getText(node.getSourceFile()))))) {
          return;
        }
        collectReachableJsxCallbackExpressions(expression, expressions, referenceNode);
      };

      if (ts.isJsxAttribute(property)) {
        if (property.initializer
          && ts.isJsxExpression(property.initializer)
          && property.initializer.expression) {
          collectIfBranchExpression(property.name.text, property.initializer.expression, property);
        }
        return expressions;
      }
      if (!ts.isJsxSpreadAttribute(property)) return expressions;
      const spread = resolveStableJsxObjectProperties(property.expression, property);
      if (spread.known) {
        for (const { name, expression, referenceNode } of spread.properties) {
          collectIfBranchExpression(name, expression, referenceNode ?? property);
        }
      }
      return expressions;
    });
  });
}

function hasReachableUnresolvedFileLibrarySpread(functionLike) {
  return findReachableJsxElementsInFunction(functionLike).some((node) => {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    if (!ts.isIdentifier(tagName) || tagName.text !== "FileLibraryList") return false;
    const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    return attributes.properties.some((property) => (
      ts.isJsxSpreadAttribute(property)
      && !resolveStableJsxObjectProperties(property.expression, property).known
    ));
  });
}

function hasReachableUnresolvedImportedComponent(functionLike, componentSources = {}) {
  const sourceFile = functionLike.getSourceFile();
  return findReachableJsxElementsInFunction(functionLike).some((node) => {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    const importReference = ts.isIdentifier(tagName)
      ? tagName
      : ts.isPropertyAccessExpression(tagName) || ts.isElementAccessExpression(tagName)
        ? unwrapExpression(tagName.expression)
        : undefined;
    if (!importReference || !ts.isIdentifier(importReference)) return false;
    const binding = resolveImportProvenance(importReference, tagName);
    return binding?.kind === "import"
      && isRepositoryLocalImport(binding.moduleSpecifier)
      && resolveImportedCallableBindings(
        sourceFile,
        tagName,
        tagName,
        new Set(),
        componentSources
      ).length === 0;
  });
}

function hasReachableUnresolvedLocalClassComponent(functionLike, componentSources = {}) {
  const sourceFile = functionLike.getSourceFile();
  return findReachableJsxElementsInFunction(functionLike).some((node) => {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    if (!ts.isIdentifier(tagName)) return false;
    const declarations = findLexicalNamedDeclarations(tagName, tagName.text);
    if (declarations.length !== 1 || declarations[0].kind !== "class") return false;
    return resolveClassComponentEntryPoints(
      sourceFile,
      declarations[0].node,
      componentSources
    ).length === 0;
  });
}

function findRenderedJsxComponentBindings(functionLike) {
  return findReachableJsxElementsInFunction(functionLike).flatMap((node) => {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    return ts.isIdentifier(tagName)
      || ts.isPropertyAccessExpression(tagName)
      || ts.isElementAccessExpression(tagName)
      ? [tagName]
      : [];
  });
}

function findReachableVaultFunctions(
  sourceFile,
  component,
  includeInvokedFunctions = true,
  componentSources = {}
) {
  const functions = [];
  const visited = new Set();
  function enqueue(functionLike) {
    if (!functionLike?.body || visited.has(functionLike)) return;
    visited.add(functionLike);
    functions.push(functionLike);
    const expressions = [];
    if (includeInvokedFunctions) {
      for (const call of findReachableCallsInFunction(functionLike, () => true)) {
        expressions.push(call.expression, ...call.arguments);
      }
    } else {
      for (const returned of findReachableReturnedExpressions(functionLike)) {
        for (const call of findReachableCallsInExpression(returned, () => true)) {
          expressions.push(call.expression, ...call.arguments);
        }
      }
    }
    expressions.push(...findJsxCallbackBindings(functionLike));
    expressions.push(...findRenderedJsxComponentBindings(functionLike));
    const functionSourceFile = functionLike.getSourceFile();
    for (const expression of expressions) {
      for (const resolved of resolveCallableBindings(
        functionSourceFile,
        expression,
        expression,
        new Set(),
        componentSources
      )) {
        enqueue(resolved);
      }
    }
  }
  enqueue(component);
  return functions;
}

function isFileLibraryBackendBypassCallable(expression, sourceFile, referenceNode) {
  let callee = unwrapExpression(expression);
  while (callee
    && ts.isBinaryExpression(callee)
    && callee.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    callee = unwrapExpression(callee.right);
  }
  if (!callee) return false;
  if (ts.isIdentifier(callee)
    && (isImportedTauriHelper(callee) || isUnresolvedQueryHelper(callee, sourceFile))) return true;
  return isFileLibraryQueryCallable(callee, referenceNode);
}

function isFileLibraryBackendBypassCall(call, sourceFile) {
  let callee = unwrapExpression(call.expression);
  while (callee
    && ts.isBinaryExpression(callee)
    && callee.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    callee = unwrapExpression(callee.right);
  }
  if (isFileLibraryBackendCommand(call.arguments[0], call)
    && isTauriInvocationCallable(callee, call)) return true;
  return isFileLibraryBackendBypassCallable(callee, sourceFile, call);
}

function hasReachableBackendBypassCallableArgument(
  argument,
  sourceFile,
  componentSources,
  visitedFunctions
) {
  if (isFileLibraryBackendBypassCallable(argument, sourceFile, argument)) return true;
  const callbackFunctions = resolveCallableBindings(
    sourceFile,
    argument,
    argument,
    new Set(),
    componentSources
  );
  return callbackFunctions.some((callback) => (
    hasReachableBackendBypassInCallback(callback, componentSources, visitedFunctions)
  ));
}

function hasFileLibraryBackendBypassInCall(
  call,
  sourceFile,
  componentSources,
  visitedFunctions = new Set()
) {
  return isFileLibraryBackendBypassCall(call, sourceFile)
    || call.arguments.some((argument) => (
      hasReachableBackendBypassCallableArgument(
        argument,
        sourceFile,
        componentSources,
        visitedFunctions
      )
    ));
}

function hasReachableBackendBypassInCallback(functionLike, componentSources, visitedFunctions = new Set()) {
  if (!functionLike?.body || visitedFunctions.has(functionLike)) return false;
  visitedFunctions.add(functionLike);
  const sourceFile = functionLike.getSourceFile();
  const calls = findReachableCallsInFunction(functionLike, () => true);
  if (calls.some((call) => (
    hasFileLibraryBackendBypassInCall(call, sourceFile, componentSources, visitedFunctions)
  ))) return true;

  for (const call of calls) {
    const calledFunctions = resolveCallableBindings(sourceFile, call.expression, call, new Set(), componentSources);
    if (calledFunctions.some((calledFunction) => (
      hasReachableBackendBypassInCallback(calledFunction, componentSources, visitedFunctions)
    ))) {
      return true;
    }
  }

  for (const expression of findJsxCallbackBranchExpressions(functionLike)) {
    const callbackFunctions = resolveCallableBindings(
      sourceFile,
      expression,
      expression,
      new Set(),
      componentSources
    );
    if (callbackFunctions.some((callback) => (
      hasReachableBackendBypassInCallback(callback, componentSources, visitedFunctions)
    ))) {
      return true;
    }
  }
  return false;
}

function hasReachableBackendBypass(viewSource, componentSources = {}) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  const reachableFunctions = findReachableVaultFunctions(sourceFile, component, true, componentSources);
  if (reachableFunctions.some((functionLike) => (
    hasReachableUnresolvedFileLibrarySpread(functionLike)
      || hasReachableUnresolvedImportedComponent(functionLike, componentSources)
      || hasReachableUnresolvedLocalClassComponent(functionLike, componentSources)
  ))) {
    return true;
  }
  return reachableFunctions.some((functionLike) => {
    const functionSourceFile = functionLike.getSourceFile();
    return findReachableCallsInFunction(functionLike, () => true)
      .some((call) => (
        hasFileLibraryBackendBypassInCall(call, functionSourceFile, componentSources)
      ));
  }) || (() => {
    const visitedCallbackFunctions = new Set();
    return reachableFunctions.some((functionLike) => (
      findJsxCallbackBranchExpressions(functionLike).some((expression) => {
        const callbackFunctions = resolveCallableBindings(
          functionLike.getSourceFile(),
          expression,
          expression,
          new Set(),
          componentSources
        );
        return callbackFunctions.some((callback) => (
          hasReachableBackendBypassInCallback(
            callback,
            componentSources,
            visitedCallbackFunctions
          )
        ));
      })
    ));
  })();
}

function expressionReferencesBinding(expression, expectedDeclaration) {
  let referenced = false;
  function visit(node) {
    if (referenced || isFunctionLikeNode(node)) return;
    if (ts.isIdentifier(node)) {
      const declarations = findLexicalNamedDeclarations(node, node.text);
      if (declarations.length === 1
        && declarations[0].kind === "variable"
        && declarations[0].node === expectedDeclaration) {
        referenced = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(expression);
  return referenced;
}

function isCanonicalLoadNextPageInvocation(call, sourceFile) {
  const callee = unwrapExpression(call.expression);
  return ts.isIdentifier(callee)
    && callee.text === "loadNextPage"
    && isCanonicalStoreBinding(
      sourceFile,
      "loadNextPage",
      "loadNextPage",
      findEnclosingFunctionLike(callee)
    );
}

function isPaginationInvocation(call, sourceFile) {
  if (isCanonicalLoadNextPageInvocation(call, sourceFile)) return true;
  const callee = unwrapExpression(call.expression);
  return isFileLibraryQueryCallable(callee, call)
    || (isFileLibraryBackendCommand(call.arguments[0], call)
      && isTauriInvocationCallable(callee, call));
}

function findReachablePaginationCalls(functions) {
  return functions.flatMap((functionLike) => {
    const sourceFile = functionLike.getSourceFile();
    return findReachableCallsInFunction(functionLike, (call) => (
      isPaginationInvocation(call, sourceFile)
    ));
  });
}

function hasFrontendOwnedCursor(viewSource, componentSources = {}) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  const reachableFunctions = findReachableVaultFunctions(sourceFile, component, true, componentSources);
  const declarations = [...new Set(reachableFunctions.flatMap((functionLike) => (
    findReachableVariableDeclarationsInFunction(functionLike)
      .filter((declaration) => (
        ts.isVariableDeclarationList(declaration.parent)
        && (declaration.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0
      ))
  )))]
  const paginationCalls = findReachablePaginationCalls(reachableFunctions);
  return declarations.some((declaration) => (
    paginationCalls.some((call) => call.arguments.some((argument) => (
      expressionReferencesBinding(argument, declaration)
    )))
  ));
}

function findVariableDeclarationsInFunction(functionLike, name) {
  const declarations = [];
  if (!ts.isBlock(functionLike.body)) return declarations;
  function visit(node) {
    if (node !== functionLike.body && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    )) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  return declarations;
}

function collectReachableCallsInExpression(expression, predicate, calls) {
  const node = unwrapExpression(expression);
  if (!node || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
  if (ts.isCallExpression(node)) {
    if (predicate(node)) calls.push(node);
    collectReachableCallsInExpression(node.expression, predicate, calls);
    for (const argument of node.arguments) {
      collectReachableCallsInExpression(argument, predicate, calls);
    }
    return;
  }
  if (ts.isConditionalExpression(node)) {
    collectReachableCallsInExpression(node.condition, predicate, calls);
    const branch = staticBranchValue(node.condition);
    if (branch === true) {
      collectReachableCallsInExpression(node.whenTrue, predicate, calls);
    } else if (branch === false) {
      collectReachableCallsInExpression(node.whenFalse, predicate, calls);
    } else {
      collectReachableCallsInExpression(node.whenTrue, predicate, calls);
      collectReachableCallsInExpression(node.whenFalse, predicate, calls);
    }
    return;
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.getText(node.getSourceFile());
    collectReachableCallsInExpression(node.left, predicate, calls);
    const leftValue = staticBranchValue(node.left);
    if (operator === "&&" && leftValue === false) return;
    if (operator === "||" && leftValue === true) return;
    collectReachableCallsInExpression(node.right, predicate, calls);
    return;
  }
  ts.forEachChild(node, (child) => {
    if (ts.isArrowFunction(child)
      || ts.isFunctionDeclaration(child)
      || ts.isFunctionExpression(child)
      || ts.isMethodDeclaration(child)) return;
    collectReachableCallsInExpression(child, predicate, calls);
  });
}

function findReachableCallsInExpression(expression, predicate) {
  const calls = [];
  collectReachableCallsInExpression(expression, predicate, calls);
  return calls;
}

function collectReachableCallsInStatement(statement, predicate, calls) {
  if (ts.isExpressionStatement(statement)) {
    calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    return;
  }
  if (ts.isReturnStatement(statement)) {
    if (statement.expression) calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    return;
  }
  if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.initializer) {
        calls.push(...findReachableCallsInExpression(declaration.initializer, predicate));
      }
    }
    return;
  }
  if (ts.isBlock(statement)) {
    collectReachableCallsInSequence(statement.statements, predicate, calls);
    return;
  }
  if (ts.isIfStatement(statement)) {
    calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    const branch = staticBranchValue(statement.expression);
    if (branch === true) {
      collectReachableCallsInStatement(statement.thenStatement, predicate, calls);
    } else if (branch === false) {
      if (statement.elseStatement) {
        collectReachableCallsInStatement(statement.elseStatement, predicate, calls);
      }
    } else {
      collectReachableCallsInStatement(statement.thenStatement, predicate, calls);
      if (statement.elseStatement) {
        collectReachableCallsInStatement(statement.elseStatement, predicate, calls);
      }
    }
    return;
  }
  if (ts.isTryStatement(statement)) {
    collectReachableCallsInStatement(statement.tryBlock, predicate, calls);
    if (statement.catchClause) {
      collectReachableCallsInStatement(statement.catchClause.block, predicate, calls);
    }
    if (statement.finallyBlock) {
      collectReachableCallsInStatement(statement.finallyBlock, predicate, calls);
    }
    return;
  }
  if (ts.isForStatement(statement)) {
    if (statement.initializer) {
      if (ts.isVariableDeclarationList(statement.initializer)) {
        for (const declaration of statement.initializer.declarations) {
          if (declaration.initializer) {
            calls.push(...findReachableCallsInExpression(declaration.initializer, predicate));
          }
        }
      } else {
        calls.push(...findReachableCallsInExpression(statement.initializer, predicate));
      }
    }
    if (statement.condition) {
      calls.push(...findReachableCallsInExpression(statement.condition, predicate));
      if (staticBranchValue(statement.condition) === false) return;
    }
    collectReachableCallsInStatement(statement.statement, predicate, calls);
    if (statement.incrementor) {
      calls.push(...findReachableCallsInExpression(statement.incrementor, predicate));
    }
    return;
  }
  if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
    if (!ts.isVariableDeclarationList(statement.initializer)) {
      calls.push(...findReachableCallsInExpression(statement.initializer, predicate));
    }
    calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    collectReachableCallsInStatement(statement.statement, predicate, calls);
    return;
  }
  if (ts.isWhileStatement(statement)) {
    calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    if (staticBranchValue(statement.expression) !== false) {
      collectReachableCallsInStatement(statement.statement, predicate, calls);
    }
    return;
  }
  if (ts.isDoStatement(statement)) {
    collectReachableCallsInStatement(statement.statement, predicate, calls);
    calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    return;
  }
  if (ts.isSwitchStatement(statement)) {
    calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    for (const clause of statement.caseBlock.clauses) {
      if (ts.isCaseClause(clause)) {
        calls.push(...findReachableCallsInExpression(clause.expression, predicate));
      }
      collectReachableCallsInSequence(clause.statements, predicate, calls);
    }
    return;
  }
  if (ts.isLabeledStatement(statement) || ts.isWithStatement(statement)) {
    if (ts.isWithStatement(statement)) {
      calls.push(...findReachableCallsInExpression(statement.expression, predicate));
    }
    collectReachableCallsInStatement(statement.statement, predicate, calls);
  }
}

function collectReachableCallsInSequence(statements, predicate, calls) {
  for (const statement of statements) {
    collectReachableCallsInStatement(statement, predicate, calls);
    if (!canFallThroughStatement(statement)) return;
  }
}

function findReachableCallsInFunction(functionLike, predicate) {
  const calls = [];
  if (!functionLike.body) return calls;
  if (ts.isBlock(functionLike.body)) {
    collectReachableCallsInSequence(functionLike.body.statements, predicate, calls);
  } else {
    calls.push(...findReachableCallsInExpression(functionLike.body, predicate));
  }
  return calls;
}

function collectReachableVariableDeclarationsInStatement(statement, declarations) {
  if (ts.isVariableStatement(statement)) {
    declarations.push(...statement.declarationList.declarations);
    return;
  }
  if (ts.isBlock(statement)) {
    collectReachableVariableDeclarationsInSequence(statement.statements, declarations);
    return;
  }
  if (ts.isIfStatement(statement)) {
    const branch = staticBranchValue(statement.expression);
    if (branch === true) {
      collectReachableVariableDeclarationsInStatement(statement.thenStatement, declarations);
    } else if (branch === false) {
      if (statement.elseStatement) {
        collectReachableVariableDeclarationsInStatement(statement.elseStatement, declarations);
      }
    } else {
      collectReachableVariableDeclarationsInStatement(statement.thenStatement, declarations);
      if (statement.elseStatement) {
        collectReachableVariableDeclarationsInStatement(statement.elseStatement, declarations);
      }
    }
    return;
  }
  if (ts.isTryStatement(statement)) {
    collectReachableVariableDeclarationsInStatement(statement.tryBlock, declarations);
    if (statement.catchClause) {
      collectReachableVariableDeclarationsInStatement(statement.catchClause.block, declarations);
    }
    if (statement.finallyBlock) {
      collectReachableVariableDeclarationsInStatement(statement.finallyBlock, declarations);
    }
    return;
  }
  if (ts.isForStatement(statement)) {
    if (statement.initializer && ts.isVariableDeclarationList(statement.initializer)) {
      declarations.push(...statement.initializer.declarations);
    }
    collectReachableVariableDeclarationsInStatement(statement.statement, declarations);
    return;
  }
  if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
    if (ts.isVariableDeclarationList(statement.initializer)) {
      declarations.push(...statement.initializer.declarations);
    }
    collectReachableVariableDeclarationsInStatement(statement.statement, declarations);
    return;
  }
  if (ts.isWhileStatement(statement) || ts.isDoStatement(statement)) {
    collectReachableVariableDeclarationsInStatement(statement.statement, declarations);
    return;
  }
  if (ts.isSwitchStatement(statement)) {
    for (const clause of statement.caseBlock.clauses) {
      collectReachableVariableDeclarationsInSequence(clause.statements, declarations);
    }
    return;
  }
  if (ts.isLabeledStatement(statement) || ts.isWithStatement(statement)) {
    collectReachableVariableDeclarationsInStatement(statement.statement, declarations);
  }
}

function collectReachableVariableDeclarationsInSequence(statements, declarations) {
  for (const statement of statements) {
    collectReachableVariableDeclarationsInStatement(statement, declarations);
    if (!canFallThroughStatement(statement)) return;
  }
}

function findReachableVariableDeclarationsInFunction(functionLike) {
  const declarations = [];
  if (functionLike.body && ts.isBlock(functionLike.body)) {
    collectReachableVariableDeclarationsInSequence(functionLike.body.statements, declarations);
  }
  return declarations;
}

function isZustandCreateCall(callExpression) {
  const call = unwrapExpression(callExpression);
  if (!ts.isCallExpression(call)) return false;
  const callee = unwrapExpression(call.expression);
  return ts.isIdentifier(callee)
    && importBindingMatches(
      resolveImportProvenance(callee, call),
      ZUSTAND_MODULE,
      "named",
      "create"
    );
}

function isStoreCreatorCallback(node) {
  return (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
    && Boolean(node.parameters[1])
    && ts.isIdentifier(node.parameters[1].name);
}

function findCanonicalStoreCreatorCallback(sourceFile) {
  const declarations = findNamedDeclarations(sourceFile, "useFileLibraryResultStore");
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return undefined;
  const initializer = unwrapExpression(declarations[0].node.initializer);
  if (!ts.isCallExpression(initializer)) return undefined;
  if (isZustandCreateCall(initializer)) {
    const callback = unwrapExpression(initializer.arguments[0]);
    return isStoreCreatorCallback(callback) ? callback : undefined;
  }
  const creatorCall = unwrapExpression(initializer.expression);
  if (!isZustandCreateCall(creatorCall)) return undefined;
  const callback = unwrapExpression(initializer.arguments[0]);
  return isStoreCreatorCallback(callback) ? callback : undefined;
}

function collectReachableReturnedExpressionsInStatement(statement, returned) {
  if (ts.isReturnStatement(statement)) {
    returned.push(statement.expression);
    return;
  }
  if (ts.isBlock(statement)) {
    collectReachableReturnedExpressionsInSequence(statement.statements, returned);
    return;
  }
  if (ts.isIfStatement(statement)) {
    const branch = staticBranchValue(statement.expression);
    if (branch === true) {
      collectReachableReturnedExpressionsInStatement(statement.thenStatement, returned);
    } else if (branch === false) {
      if (statement.elseStatement) {
        collectReachableReturnedExpressionsInStatement(statement.elseStatement, returned);
      }
    } else {
      collectReachableReturnedExpressionsInStatement(statement.thenStatement, returned);
      if (statement.elseStatement) {
        collectReachableReturnedExpressionsInStatement(statement.elseStatement, returned);
      }
    }
    return;
  }
  if (ts.isTryStatement(statement)) {
    collectReachableReturnedExpressionsInStatement(statement.tryBlock, returned);
    if (statement.catchClause) {
      collectReachableReturnedExpressionsInStatement(statement.catchClause.block, returned);
    }
    if (statement.finallyBlock) {
      collectReachableReturnedExpressionsInStatement(statement.finallyBlock, returned);
    }
    return;
  }
  if (ts.isSwitchStatement(statement)) {
    for (const clause of statement.caseBlock.clauses) {
      collectReachableReturnedExpressionsInSequence(clause.statements, returned);
    }
    return;
  }
  if (ts.isForStatement(statement)) {
    if (statement.condition && staticBranchValue(statement.condition) === false) return;
    collectReachableReturnedExpressionsInStatement(statement.statement, returned);
    return;
  }
  if (ts.isForInStatement(statement) || ts.isForOfStatement(statement)) {
    collectReachableReturnedExpressionsInStatement(statement.statement, returned);
    return;
  }
  if (ts.isWhileStatement(statement)) {
    if (staticBranchValue(statement.expression) === false) return;
    collectReachableReturnedExpressionsInStatement(statement.statement, returned);
    return;
  }
  if (ts.isDoStatement(statement)) {
    collectReachableReturnedExpressionsInStatement(statement.statement, returned);
    return;
  }
  if (ts.isLabeledStatement(statement) || ts.isWithStatement(statement)) {
    collectReachableReturnedExpressionsInStatement(statement.statement, returned);
  }
}

function collectReachableReturnedExpressionsInSequence(statements, returned) {
  for (const statement of statements) {
    collectReachableReturnedExpressionsInStatement(statement, returned);
    if (!canFallThroughStatement(statement)) return;
  }
}

function findReachableReturnedExpressions(functionLike) {
  if (!functionLike?.body) return [];
  if (!ts.isBlock(functionLike.body)) return [functionLike.body];
  const returned = [];
  collectReachableReturnedExpressionsInSequence(functionLike.body.statements, returned);
  return returned;
}

function isStableStoreObjectBinding(declaration, referenceNode) {
  if (!ts.isIdentifier(declaration.name)
    || !ts.isVariableDeclarationList(declaration.parent)
    || (declaration.parent.flags & ts.NodeFlags.Const) === 0
    || !declaration.initializer
    || declaration.getStart(declaration.getSourceFile()) >= referenceNode.getStart(referenceNode.getSourceFile())) {
    return false;
  }
  const owner = findEnclosingFunctionLike(declaration);
  const scope = owner ?? declaration.getSourceFile();
  return !hasBindingWrite(scope, declaration.name.text, declaration)
    && (!owner || !hasObjectPropertyWrite(owner, declaration.name.text));
}

function resolveStableStoreObject(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return undefined;
  if (ts.isObjectLiteralExpression(node)) return node;
  if (!ts.isIdentifier(node)) return undefined;
  const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return undefined;
  const declaration = declarations[0].node;
  if (!isStableStoreObjectBinding(declaration, referenceNode)) return undefined;
  const key = `returned-store-object:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) return undefined;
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  return resolveStableStoreObject(declaration.initializer, declaration, nextVisitedBindings);
}

function resolveFinalStoreObjectProperty(objectLiteral, propertyName, visitedObjects = new Set()) {
  if (visitedObjects.has(objectLiteral)) return { known: false };
  const nextVisitedObjects = new Set(visitedObjects);
  nextVisitedObjects.add(objectLiteral);
  let result = { known: true, present: false };

  for (const property of objectLiteral.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spreadObject = resolveStableStoreObject(property.expression, property);
      if (!spreadObject) {
        result = { known: false };
        continue;
      }
      const spreadResult = resolveFinalStoreObjectProperty(
        spreadObject,
        propertyName,
        nextVisitedObjects
      );
      if (!spreadResult.known) {
        result = { known: false };
      } else if (spreadResult.present) {
        result = spreadResult;
      }
      continue;
    }

    const isComputedProperty = (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
      && ts.isComputedPropertyName(property.name);
    if (isComputedProperty) {
      result = { known: false };
      continue;
    }

    const name = ts.isShorthandPropertyAssignment(property)
      ? property.name.text
      : (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
        ? propertyNameText(property.name)
        : undefined;
    if (name !== propertyName) continue;

    if (ts.isMethodDeclaration(property)) {
      result = { known: true, present: true, value: property, referenceNode: property };
    } else if (ts.isShorthandPropertyAssignment(property)) {
      result = { known: true, present: true, value: property.name, referenceNode: property };
    } else if (ts.isPropertyAssignment(property)) {
      result = {
        known: true,
        present: true,
        value: unwrapExpression(property.initializer),
        referenceNode: property
      };
    }
  }

  return result;
}

function resolveStoreActionFunctions(sourceFile, expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return [];
  if (isFunctionLikeNode(node)) return [node];
  if (!ts.isIdentifier(node)) return [];
  const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
  if (declarations.length !== 1) return [];
  const declarationInfo = declarations[0];
  if (declarationInfo.kind === "function") return [declarationInfo.node];
  if (declarationInfo.kind !== "variable") return [];
  const declaration = declarationInfo.node;
  if (!isStableStoreObjectBinding(declaration, referenceNode)) return [];
  const key = `returned-store-action:${declaration.getStart(sourceFile)}`;
  if (visitedBindings.has(key)) return [];
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  return resolveStoreActionFunctions(sourceFile, declaration.initializer, declaration, nextVisitedBindings);
}

function findCanonicalStoreActionFunctions(sourceFile, propertyName) {
  const creator = findCanonicalStoreCreatorCallback(sourceFile);
  if (!creator) return [];
  const returnedExpressions = findReachableReturnedExpressions(creator);
  if (returnedExpressions.length === 0 || returnedExpressions.some((expression) => !expression)) return [];
  const functions = [];

  for (const returnedExpression of returnedExpressions) {
    const objectLiteral = resolveStableStoreObject(returnedExpression, returnedExpression);
    if (!objectLiteral) return [];
    const property = resolveFinalStoreObjectProperty(objectLiteral, propertyName);
    if (!property.known || !property.present) return [];
    const resolved = resolveStoreActionFunctions(
      sourceFile,
      property.value,
      property.referenceNode ?? returnedExpression
    );
    if (resolved.length === 0) return [];
    functions.push(...resolved);
  }

  return [...new Set(functions)];
}

function findCanonicalStoreGetterParameter(sourceFile) {
  return findCanonicalStoreCreatorCallback(sourceFile)?.parameters[1];
}

function resolveLexicalParameterDeclaration(referenceNode, name) {
  const binding = resolveLexicalBinding(referenceNode, name);
  if (!binding || binding.kind !== "local" || binding.declarationKind !== "parameter") return undefined;
  const functionLike = binding.declaration;
  const parameters = functionLike.parameters.filter((parameter) => (
    bindingPatternContainsName(parameter.name, name)
  ));
  return parameters.length === 1 ? parameters[0] : undefined;
}

function isCanonicalCursorRead(expression, canonicalGetterParameter) {
  const node = unwrapExpression(expression);
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== "nextCursor") return false;
  const receiver = unwrapExpression(node.expression);
  return ts.isCallExpression(receiver)
    && ts.isIdentifier(receiver.expression)
    && resolveLexicalParameterDeclaration(receiver.expression, receiver.expression.text) === canonicalGetterParameter
    && receiver.arguments.length === 0;
}

function hasCanonicalCursorBinding(functionLike, name) {
  const declarations = findVariableDeclarationsInFunction(functionLike, name);
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  const canonicalGetterParameter = findCanonicalStoreGetterParameter(functionLike.getSourceFile());
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    && !hasBindingWrite(functionLike, name)
    && isCanonicalCursorRead(declaration.initializer, canonicalGetterParameter);
}

function canonicalStoreDeclaration(sourceFile) {
  const declarations = findNamedDeclarations(sourceFile, "useFileLibraryResultStore");
  return declarations.length === 1 && declarations[0].kind === "variable"
    ? declarations[0].node
    : undefined;
}

function isStableConstVariableDeclaration(declaration, referenceNode, name) {
  if (!declaration
    || !ts.isVariableDeclarationList(declaration.parent)
    || (declaration.parent.flags & ts.NodeFlags.Const) === 0
    || !declaration.initializer
    || !ts.isIdentifier(declaration.name)) {
    return false;
  }
  const bindingScope = findEnclosingFunctionLike(declaration) ?? declaration.getSourceFile();
  return !hasBindingWrite(bindingScope, name, declaration);
}

function findBindingElementByName(pattern, name) {
  let result;
  function visit(node) {
    if (result || !node) return;
    if (ts.isBindingElement(node) && bindingPatternContainsName(node.name, name)) {
      result = node;
      return;
    }
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      node.elements.forEach(visit);
    }
  }
  visit(pattern);
  return result;
}

function isCanonicalStoreGetterCall(expression, sourceFile, referenceNode = expression) {
  const node = unwrapExpression(expression);
  if (!ts.isCallExpression(node) || node.arguments.length !== 0) return false;
  const callee = unwrapExpression(node.expression);
  const canonicalGetterParameter = findCanonicalStoreGetterParameter(sourceFile);
  return ts.isIdentifier(callee)
    && resolveLexicalParameterDeclaration(callee, callee.text) === canonicalGetterParameter;
}

function isCanonicalStoreHookReference(
  expression,
  sourceFile,
  referenceNode = expression,
  visitedBindings = new Set()
) {
  const node = unwrapExpression(expression);
  if (!ts.isIdentifier(node)) return false;
  const canonicalStore = canonicalStoreDeclaration(sourceFile);
  if (!canonicalStore) return false;
  const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
  if (!binding || binding.kind === "ambiguous") return false;
  if (binding.kind !== "local" || binding.declarationKind !== "variable") return false;
  if (binding.declaration === canonicalStore) return true;

  const declaration = binding.declaration;
  const key = `canonical-store-hook:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) {
    return false;
  }
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  const values = findReachableBindingValuesAt(referenceNode ?? node, declaration, node.text);
  return values.length > 0
    && values.every((value) => !value.unknown
      && Boolean(value.expression)
      && isCanonicalStoreHookReference(
        value.expression,
        sourceFile,
        value.referenceNode ?? declaration,
        nextVisitedBindings
      ));
}

function isCanonicalStoreStateRead(expression, sourceFile, referenceNode = expression) {
  const node = unwrapExpression(expression);
  if (!ts.isCallExpression(node) || node.arguments.length !== 0) return false;
  const callee = unwrapExpression(node.expression);
  return ts.isPropertyAccessExpression(callee)
    && callee.name.text === "getState"
    && isCanonicalStoreHookReference(callee.expression, sourceFile, callee);
}

function isCanonicalStoreStateExpression(
  expression,
  sourceFile,
  referenceNode = expression,
  visitedBindings = new Set()
) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (isCanonicalStoreGetterCall(node, sourceFile, referenceNode)
    || isCanonicalStoreStateRead(node, sourceFile, referenceNode)) {
    return true;
  }
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => (
      ts.isSpreadAssignment(property)
      && isCanonicalStoreStateExpression(property.expression, sourceFile, property, visitedBindings)
    ));
  }
  if (!ts.isIdentifier(node)) return false;
  const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
  if (!binding || binding.kind !== "local" || binding.declarationKind !== "variable") return false;
  const declaration = binding.declaration;
  const key = `canonical-store-state:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) {
    return false;
  }
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  const values = findReachableBindingValuesAt(referenceNode ?? node, declaration, node.text);
  return values.length > 0
    && values.every((value) => !value.unknown
      && Boolean(value.expression)
      && isCanonicalStoreStateExpression(
        value.expression,
        sourceFile,
        value.referenceNode ?? declaration,
        nextVisitedBindings
      ));
}

function resolvesToCanonicalStoreObjectProperty(
  expression,
  sourceFile,
  functionName,
  referenceNode = expression,
  visitedBindings = new Set()
) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return isCanonicalStoreStateExpression(property.expression, sourceFile, property, visitedBindings)
          || resolvesToCanonicalStoreObjectProperty(
            property.expression,
            sourceFile,
            functionName,
            property,
            visitedBindings
          );
      }
      const propertyName = ts.isShorthandPropertyAssignment(property)
        ? property.name.text
        : (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
          ? propertyNameText(property.name)
          : undefined;
      if (propertyName !== functionName) return false;
      if (ts.isShorthandPropertyAssignment(property)) {
        return resolvesToCanonicalStoreAction(
          property.name,
          sourceFile,
          functionName,
          property,
          visitedBindings
        );
      }
      if (ts.isPropertyAssignment(property)) {
        return resolvesToCanonicalStoreAction(
          property.initializer,
          sourceFile,
          functionName,
          property,
          visitedBindings
        );
      }
      return false;
    });
  }
  if (!ts.isIdentifier(node)) return false;
  const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
  if (!binding || binding.kind !== "local" || binding.declarationKind !== "variable") return false;
  const declaration = binding.declaration;
  const key = `canonical-store-object:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key) || !isStableConstVariableDeclaration(declaration, referenceNode, node.text)) {
    return false;
  }
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  return resolvesToCanonicalStoreObjectProperty(
    declaration.initializer,
    sourceFile,
    functionName,
    declaration,
    nextVisitedBindings
  );
}

function resolvesToCanonicalStoreAction(
  expression,
  sourceFile,
  functionName,
  referenceNode = expression,
  visitedBindings = new Set()
) {
  const node = unwrapExpression(expression);
  if (!node) return false;

  if (ts.isBinaryExpression(node)
    && ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(node.getSourceFile()))) {
    return resolvesToCanonicalStoreAction(
      node.right,
      sourceFile,
      functionName,
      node,
      visitedBindings
    );
  }
  if (ts.isConditionalExpression(node)) {
    return resolvesToCanonicalStoreAction(
      node.whenTrue,
      sourceFile,
      functionName,
      node,
      visitedBindings
    ) || resolvesToCanonicalStoreAction(
      node.whenFalse,
      sourceFile,
      functionName,
      node,
      visitedBindings
    );
  }
  if (ts.isBinaryExpression(node)
    && (node.operatorToken.kind === ts.SyntaxKind.BarBarToken
      || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      || node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) {
    return resolvesToCanonicalStoreAction(
      node.left,
      sourceFile,
      functionName,
      node,
      visitedBindings
    ) || resolvesToCanonicalStoreAction(
      node.right,
      sourceFile,
      functionName,
      node,
      visitedBindings
    );
  }

  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    const method = callablePropertyName(callee);
    return (method === "bind" || method === "call" || method === "apply")
      && (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))
      && resolvesToCanonicalStoreAction(
        callee.expression,
        sourceFile,
        functionName,
        callee,
        visitedBindings
      );
  }

  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const property = callablePropertyName(node);
    if (property === "bind" || property === "call" || property === "apply") {
      return resolvesToCanonicalStoreAction(
        node.expression,
        sourceFile,
        functionName,
        node,
        visitedBindings
      );
    }
    return property === functionName
      && (isCanonicalStoreStateExpression(node.expression, sourceFile, node)
        || canonicalStoreObjectPropertyStatus(
          node.expression,
          sourceFile,
          functionName,
          node
        ) !== "safe");
  }

  if (!ts.isIdentifier(node)) return false;
  const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
  if (!binding || binding.kind === "ambiguous") {
    return node.text === functionName;
  }
  if (binding.kind !== "local" || binding.declarationKind !== "variable") return false;

  const declaration = binding.declaration;
  const key = `canonical-store-action:${declaration.getStart(declaration.getSourceFile())}:${functionName}`;
  if (visitedBindings.has(key)) {
    return false;
  }
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  const values = findReachableBindingValuesAt(referenceNode ?? node, declaration, node.text);
  if (values.length === 0) return false;
  return values.some((value) => {
    if (value.unknown || !value.expression) return true;
    if (value.propertyName) {
      return value.propertyName === functionName
        && canonicalStoreObjectPropertyStatus(
          value.expression,
          sourceFile,
          functionName,
          value.referenceNode ?? declaration,
          nextVisitedBindings
        ) !== "safe";
    }
    return resolvesToCanonicalStoreAction(
      value.expression,
      sourceFile,
      functionName,
      value.referenceNode ?? declaration,
      nextVisitedBindings
    );
  });
}

function findPotentialCallbackFunctions(
  expression,
  sourceFile,
  referenceNode,
  visitedBindings = new Set(),
  allowUnknown = true
) {
  const node = unwrapExpression(expression);
  if (!node) return [];
  if (isFunctionLikeNode(node)) return [node];
  const resolved = resolveCallableBindings(sourceFile, node, referenceNode);
  if (resolved.length > 0) return resolved;
  if (ts.isIdentifier(node)) {
    const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
    if (binding?.kind === "local" && binding.declarationKind === "variable") {
      const key = `potential-callback:${binding.declaration.getStart(binding.declaration.getSourceFile())}`;
      if (visitedBindings.has(key)) return [];
      const nextVisitedBindings = new Set(visitedBindings);
      nextVisitedBindings.add(key);
      const values = findReachableBindingValuesAt(referenceNode ?? node, binding.declaration, node.text);
      if (values.some((value) => value.unknown || value.propertyName || !value.expression)) {
        return [UNKNOWN_CALLBACK_CANDIDATE];
      }
      const functions = values.flatMap((value) => findPotentialCallbackFunctions(
        value.expression,
        sourceFile,
        value.referenceNode ?? binding.declaration,
        nextVisitedBindings,
        allowUnknown
      ));
      if (functions.length > 0) return [...new Set(functions)];
      return allowUnknown && values.some((value) => isPotentiallyCallableExpression(value.expression))
        ? [UNKNOWN_CALLBACK_CANDIDATE]
        : [];
    }
    if (binding?.kind === "function") return [binding.declaration];
    if (binding) return [];
    return [];
  }
  const functions = [];
  ts.forEachChild(node, (child) => {
    if (isFunctionLikeNode(child)) {
      functions.push(child);
      return;
    }
    functions.push(...findPotentialCallbackFunctions(child, sourceFile, referenceNode, visitedBindings, false));
  });
  return [...new Set(functions)];
}

function isPotentiallyCallableExpression(expression) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (isFunctionLikeNode(node)) return true;
  if (ts.isStringLiteral(node)
    || ts.isNoSubstitutionTemplateLiteral(node)
    || ts.isNumericLiteral(node)
    || ts.isBigIntLiteral(node)
    || node.kind === ts.SyntaxKind.TrueKeyword
    || node.kind === ts.SyntaxKind.FalseKeyword
    || node.kind === ts.SyntaxKind.NullKeyword
    || node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return false;
  }
  if (ts.isObjectLiteralExpression(node) || ts.isArrayLiteralExpression(node)) return false;
  if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
    && NON_CALLABLE_RESULT_STORE_PROPERTIES.has(callablePropertyName(node))) return false;
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.getText(node.getSourceFile());
    if (!ASSIGNMENT_OPERATORS.has(operator)
      && operator !== "&&"
      && operator !== "||"
      && operator !== "??") return false;
  }
  return true;
}

function canonicalStoreObjectPropertyStatus(
  expression,
  sourceFile,
  functionName,
  referenceNode = expression,
  visitedBindings = new Set()
) {
  const node = unwrapExpression(expression);
  if (!node) return "unknown";
  if (isCanonicalStoreStateExpression(node, sourceFile, referenceNode, visitedBindings)) {
    return "canonical";
  }
  if (ts.isObjectLiteralExpression(node)) {
    let unknown = false;
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spreadStatus = canonicalStoreObjectPropertyStatus(
          property.expression,
          sourceFile,
          functionName,
          property,
          visitedBindings
        );
        if (spreadStatus === "canonical") return "canonical";
        if (spreadStatus === "unknown") unknown = true;
        continue;
      }
      const computed = (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
        && ts.isComputedPropertyName(property.name);
      if (computed) {
        unknown = true;
        continue;
      }
      const propertyName = ts.isShorthandPropertyAssignment(property)
        ? property.name.text
        : (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
          ? propertyNameText(property.name)
          : undefined;
      if (propertyName !== functionName) continue;
      if (ts.isMethodDeclaration(property)) continue;
      const value = ts.isShorthandPropertyAssignment(property)
        ? property.name
        : property.initializer;
      if (resolvesToCanonicalStoreAction(value, sourceFile, functionName, property, visitedBindings)) {
        return "canonical";
      }
      unknown = true;
    }
    return unknown ? "unknown" : "safe";
  }
  if (!ts.isIdentifier(node)) return "unknown";
  const binding = resolveLexicalBinding(referenceNode ?? node, node.text);
  if (!binding || binding.kind !== "local" || binding.declarationKind !== "variable") return "unknown";
  const declaration = binding.declaration;
  const key = `canonical-store-object-status:${declaration.getStart(declaration.getSourceFile())}`;
  if (visitedBindings.has(key)) {
    return "unknown";
  }
  const nextVisitedBindings = new Set(visitedBindings);
  nextVisitedBindings.add(key);
  const states = findReachableBindingStatesAt(
    referenceNode ?? node,
    declaration,
    node.text,
    { trackPropertyContainer: true }
  );
  if (states.length === 0) return "unknown";

  const stateStatuses = states.map((state) => {
    const directAssignments = state.filter((value) => (
      value.propertyAssignment
        && (value.unknown || value.propertyName === functionName)
    ));
    if (directAssignments.length > 0) {
      const latest = directAssignments[directAssignments.length - 1];
      if (latest.unknown || !latest.expression) return "unknown";
      if (resolvesToCanonicalStoreAction(
        latest.expression,
        sourceFile,
        functionName,
        latest.referenceNode ?? declaration,
        nextVisitedBindings
      )) {
        return "canonical";
      }
      const latestNode = unwrapExpression(latest.expression);
      if ((ts.isPropertyAccessExpression(latestNode) || ts.isElementAccessExpression(latestNode))
        && callablePropertyName(latestNode) !== functionName
        && isCanonicalStoreStateExpression(latestNode.expression, sourceFile, latestNode, nextVisitedBindings)) {
        return "safe";
      }
      return "unknown";
    }
    const baseValues = state.filter((value) => !value.propertyAssignment);
    if (baseValues.length === 0) return "unknown";
    let unknown = false;
    for (const value of baseValues) {
      if (value.unknown || !value.expression) {
        unknown = true;
        continue;
      }
      const status = canonicalStoreObjectPropertyStatus(
        value.expression,
        sourceFile,
        functionName,
        value.referenceNode ?? declaration,
        nextVisitedBindings
      );
      if (status === "canonical") return "canonical";
      if (status === "unknown") unknown = true;
    }
    return unknown ? "unknown" : "safe";
  });
  if (stateStatuses.includes("canonical")) return "canonical";
  if (stateStatuses.includes("unknown")) return "unknown";
  return "safe";
}

function hasCanonicalStoreActionValueInExpression(
  expression,
  sourceFile,
  functionName,
  referenceNode = expression
) {
  const node = unwrapExpression(expression);
  if (!node || isFunctionLikeNode(node)) return false;
  if (resolvesToCanonicalStoreAction(node, sourceFile, functionName, referenceNode)) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && !isFunctionLikeNode(child)) {
      found = hasCanonicalStoreActionValueInExpression(
        child,
        sourceFile,
        functionName,
        referenceNode
      );
    }
  });
  return found;
}

function hasCanonicalStoreActionReentry(functionLike, sourceFile, functionName, visitedFunctions = new Set()) {
  if (!functionLike?.body || visitedFunctions.has(functionLike)) return false;
  const nextVisitedFunctions = new Set(visitedFunctions);
  nextVisitedFunctions.add(functionLike);

  return findReachableCallsInFunction(functionLike, () => true).some((call) => {
    const callee = unwrapExpression(call.expression);
    if (resolvesToCanonicalStoreAction(callee, sourceFile, functionName, call)) return true;
    if (call.arguments.some((argument) => (
      hasCanonicalStoreActionValueInExpression(argument, sourceFile, functionName, call)
    ))) {
      return true;
    }
    if (call.arguments.some((argument) => (
      findPotentialCallbackFunctions(argument, sourceFile, call).some((callback) => (
        callback === UNKNOWN_CALLBACK_CANDIDATE
          || hasCanonicalStoreActionReentry(
            callback,
            sourceFile,
            functionName,
            nextVisitedFunctions
        )
      ))
    ))) {
      return true;
    }

    return resolveCallableBindings(sourceFile, callee, call).some((calledFunction) => (
      hasCanonicalStoreActionReentry(
        calledFunction,
        sourceFile,
        functionName,
        nextVisitedFunctions
      )
    ));
  });
}

function isCanonicalLibraryQueryInvocation(call, backendContext) {
  const callee = unwrapExpression(call.expression);
  return ts.isIdentifier(callee)
    && callee.text === "executeLibraryQuery"
    && resolvesToFunctionBinding(callee, "executeLibraryQuery", backendContext.functionLike);
}

function findReachableCanonicalLibraryQueryCalls(
  functionLike,
  sourceFile,
  backendContext,
  visitedFunctions = new Set()
) {
  if (!functionLike?.body || visitedFunctions.has(functionLike)) return [];
  const nextVisitedFunctions = new Set(visitedFunctions);
  nextVisitedFunctions.add(functionLike);

  return findReachableCallsInFunction(functionLike, () => true).flatMap((call) => {
    if (isCanonicalLibraryQueryInvocation(call, backendContext)) return [call];

    const callee = unwrapExpression(call.expression);
    return resolveCallableBindings(sourceFile, callee, call).flatMap((calledFunction) => (
      findReachableCanonicalLibraryQueryCalls(
        calledFunction,
        sourceFile,
        backendContext,
        nextVisitedFunctions
      )
    ));
  });
}

function propertyNameText(name) {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
    ? name.text
    : undefined;
}

function objectPropertyValue(objectLiteral, propertyName) {
  const values = [];
  for (const property of objectLiteral.properties) {
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
      values.push(property.name);
    } else if (ts.isPropertyAssignment(property) && propertyNameText(property.name) === propertyName) {
      values.push(unwrapExpression(property.initializer));
    }
  }
  return values.length === 1 ? values[0] : undefined;
}

function hasProtectedRequestSpread(objectLiteral) {
  let guardedFieldSeen = false;
  for (const property of objectLiteral.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (guardedFieldSeen) return true;
      continue;
    }
    const name = ts.isShorthandPropertyAssignment(property)
      ? property.name.text
      : ts.isPropertyAssignment(property)
        ? propertyNameText(property.name)
        : undefined;
    if (name === "pageSize" || name === "cursor") guardedFieldSeen = true;
  }
  return false;
}

function hasProtectedRequestComputedProperty(objectLiteral) {
  let guardedFieldSeen = false;
  for (const property of objectLiteral.properties) {
    if (ts.isSpreadAssignment(property)) continue;
    if (ts.isPropertyAssignment(property) && ts.isComputedPropertyName(property.name)) {
      if (guardedFieldSeen) return true;
      continue;
    }
    const name = ts.isShorthandPropertyAssignment(property)
      ? property.name.text
      : ts.isPropertyAssignment(property)
        ? propertyNameText(property.name)
        : undefined;
    if (name === "pageSize" || name === "cursor") guardedFieldSeen = true;
  }
  return false;
}

function resolveObjectLiteral(functionLike, expression) {
  const node = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(node)) return node;
  if (!ts.isIdentifier(node)) return undefined;
  const declarations = findVariableDeclarationsInFunction(functionLike, node.text);
  if (declarations.length !== 1) return undefined;
  const initializer = unwrapExpression(declarations[0].initializer);
  return ts.isObjectLiteralExpression(initializer) ? initializer : undefined;
}

function isObjectPropertyAccess(expression, objectName) {
  const node = unwrapExpression(expression);
  if (ts.isPropertyAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    return ts.isIdentifier(receiver) && receiver.text === objectName;
  }
  if (ts.isElementAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    const argument = unwrapExpression(node.argumentExpression);
    return ts.isIdentifier(receiver)
      && receiver.text === objectName
      && Boolean(argument)
      && (ts.isStringLiteral(argument) || ts.isNumericLiteral(argument));
  }
  return false;
}

function isObjectMutationHelper(call, objectName) {
  const callee = unwrapExpression(call.expression);
  if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression)) return false;
  const receiver = callee.expression.text;
  const method = callee.name.text;
  const methods = receiver === "Object"
    ? new Set(["assign", "defineProperty", "defineProperties"])
    : receiver === "Reflect"
      ? new Set(["set", "defineProperty"])
      : undefined;
  return Boolean(methods?.has(method))
    && ts.isIdentifier(unwrapExpression(call.arguments[0]))
    && unwrapExpression(call.arguments[0]).text === objectName;
}

function hasObjectPropertyWrite(
  functionLike,
  objectName,
  beforePosition,
  visitedFunctions = new Set(),
  depth = 0
) {
  if (!functionLike.body
    || depth > MAX_CALLBACK_ANALYSIS_DEPTH
    || visitedFunctions.has(functionLike)) return false;
  const nextVisitedFunctions = new Set(visitedFunctions);
  nextVisitedFunctions.add(functionLike);
  const sourceFile = functionLike.getSourceFile();
  let written = false;
  function visit(node) {
    if (written) return;
    if (beforePosition !== undefined && node.getStart(sourceFile) >= beforePosition) return;
    if (node !== functionLike.body && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    ) && !isImmediatelyInvokedFunctionLike(node)) return;
    if (ts.isBinaryExpression(node)
      && ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(sourceFile))
      && assignmentTargetWritesObjectProperty(node.left, objectName)) {
      written = true;
      return;
    }
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
      && (node.operator === ts.SyntaxKind.PlusPlusToken || node.operator === ts.SyntaxKind.MinusMinusToken)
      && isObjectPropertyAccess(node.operand, objectName)) {
      written = true;
      return;
    }
    if (ts.isCallExpression(node) && isObjectMutationHelper(node, objectName)) {
      written = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  if (written) return true;
  return findReachableCallsInFunction(functionLike, () => true).some((call) => {
    if (beforePosition !== undefined && call.getStart(sourceFile) >= beforePosition) return false;
    return resolveCallableBindings(sourceFile, call.expression, call).some((calledFunction) => (
      !hasFunctionLocalBinding(calledFunction, objectName)
      && hasObjectPropertyWrite(
        calledFunction,
        objectName,
        undefined,
        nextVisitedFunctions,
        depth + 1
      )
    ));
  });
}

function assignmentTargetWritesObjectProperty(expression, objectName) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (isObjectPropertyAccess(node, objectName)) return true;
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isPropertyAssignment(property)) {
        return assignmentTargetWritesObjectProperty(property.initializer, objectName);
      }
      if (ts.isShorthandPropertyAssignment(property)) return false;
      if (ts.isSpreadAssignment(property)) {
        return assignmentTargetWritesObjectProperty(property.expression, objectName);
      }
      return false;
    });
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.some((element) => (
      ts.isSpreadElement(element)
        ? assignmentTargetWritesObjectProperty(element.expression, objectName)
        : assignmentTargetWritesObjectProperty(element, objectName)
    ));
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    return assignmentTargetWritesObjectProperty(node.left, objectName);
  }
  return false;
}

function hasObjectAlias(functionLike, objectName, beforePosition) {
  if (!functionLike.body) return false;
  const sourceFile = functionLike.getSourceFile();
  let aliased = false;
  function visit(node) {
    if (aliased) return;
    if (beforePosition !== undefined && node.getStart(sourceFile) >= beforePosition) return;
    if (node !== functionLike.body && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    ) && !isImmediatelyInvokedFunctionLike(node)) return;
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && containsRequestAliasValue(node.initializer, objectName)) {
      aliased = true;
      return;
    }
    if (ts.isBinaryExpression(node)
      && ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(functionLike.getSourceFile()))
      && containsRequestAliasValue(node.right, objectName)) {
      aliased = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  return aliased;
}

function containsRequestAliasValue(expression, objectName) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isIdentifier(node)) return node.text === objectName;
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isShorthandPropertyAssignment(property)) return property.name.text === objectName;
      if (ts.isPropertyAssignment(property)) {
        return containsRequestAliasValue(property.initializer, objectName);
      }
      if (ts.isSpreadAssignment(property)) {
        const spread = unwrapExpression(property.expression);
        return (ts.isObjectLiteralExpression(spread) || ts.isArrayLiteralExpression(spread))
          && containsRequestAliasValue(spread, objectName);
      }
      return false;
    });
  }
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.some((element) => {
      if (ts.isSpreadElement(element)) {
        const spread = unwrapExpression(element.expression);
        return (ts.isObjectLiteralExpression(spread) || ts.isArrayLiteralExpression(spread))
          && containsRequestAliasValue(spread, objectName);
      }
      return containsRequestAliasValue(element, objectName);
    });
  }
  return false;
}

function inspectCanonicalBackendRequest(storeSource, sourceFileOverride) {
  const sourceFile = sourceFileOverride
    ?? createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) return undefined;
  const declarations = findNamedDeclarations(sourceFile, "executeLibraryQuery");
  if (declarations.length !== 1 || declarations[0].kind !== "function") return undefined;
  const functionLike = declarations[0].node;
  const pageSizeParameter = functionLike.parameters[1]?.name;
  const cursorParameter = functionLike.parameters[2]?.name;
  if (!pageSizeParameter || !ts.isIdentifier(pageSizeParameter)
    || !cursorParameter || !ts.isIdentifier(cursorParameter)) return undefined;
  const calls = findReachableCallsInFunction(functionLike, (call) => {
    const callee = unwrapExpression(call.expression);
    return ts.isPropertyAccessExpression(callee)
      && isImportedTauriApiReceiver(callee.expression, call)
      && callee.name.text === "queryFileLibraryV2";
  });
  if (calls.length !== 1 || isInsideRepeatingExecution(calls[0])) return undefined;
  const requestArgument = unwrapExpression(calls[0].arguments[0]);
  const request = resolveObjectLiteral(functionLike, requestArgument);
  if (!request) return undefined;
  return {
    sourceFile,
    functionLike,
    requestArgument,
    request,
    backendCall: calls[0],
    pageSizeParameter,
    cursorParameter
  };
}

function hasCanonicalBackendPageSize(storeSource) {
  const context = inspectCanonicalBackendRequest(storeSource);
  if (!context) return false;
  const pageSize = objectPropertyValue(context.request, "pageSize");
  return Boolean(pageSize)
    && ts.isIdentifier(pageSize)
    && pageSize.text === context.pageSizeParameter.text
    && resolvesToFunctionParameter(pageSize, pageSize.text, context.functionLike)
    && !hasBindingWrite(context.functionLike, context.pageSizeParameter.text);
}

function hasCanonicalBackendCursor(storeSource) {
  const context = inspectCanonicalBackendRequest(storeSource);
  if (!context) return false;
  const cursor = objectPropertyValue(context.request, "cursor");
  return Boolean(cursor)
    && ts.isIdentifier(cursor)
    && cursor.text === context.cursorParameter.text
    && resolvesToFunctionParameter(cursor, cursor.text, context.functionLike)
    && !hasBindingWrite(context.functionLike, context.cursorParameter.text);
}

function hasImmutableBackendRequestBinding(storeSource) {
  const context = inspectCanonicalBackendRequest(storeSource);
  if (!context) return false;
  if (!ts.isIdentifier(context.requestArgument)) return true;
  const declarations = findVariableDeclarationsInFunction(context.functionLike, context.requestArgument.text);
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  const backendStart = context.backendCall.getStart(context.sourceFile);
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    && !hasBindingWrite(context.functionLike, context.requestArgument.text, declaration, backendStart)
    && !hasObjectPropertyWrite(context.functionLike, context.requestArgument.text, backendStart)
    && !hasObjectAlias(context.functionLike, context.requestArgument.text, backendStart);
}

function hasRequestEscape(context) {
  if (!ts.isIdentifier(context.requestArgument)) return false;
  const requestDeclarations = findVariableDeclarationsInFunction(
    context.functionLike,
    context.requestArgument.text
  );
  if (requestDeclarations.length !== 1) return true;
  const requestDeclaration = requestDeclarations[0];
  const backendStart = context.backendCall.getStart(context.sourceFile);
  return findReachableCallsInFunction(context.functionLike, () => true).some((call) => (
    call !== context.backendCall
    && call.getStart(context.sourceFile) < backendStart
    && call.arguments.some((argument) => expressionReferencesBinding(argument, requestDeclaration))
  ));
}

function isNullLiteral(expression) {
  return Boolean(expression) && expression.kind === ts.SyntaxKind.NullKeyword;
}

const REPEATING_ITERATION_METHODS = new Set([
  "every",
  "filter",
  "find",
  "findIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some"
]);

function isRepeatingIterationCallback(functionLike) {
  const parent = functionLike.parent;
  if (!parent || !ts.isCallExpression(parent)) return false;
  const callee = unwrapExpression(parent.expression);
  const method = ts.isPropertyAccessExpression(callee)
    ? callee.name.text
    : ts.isElementAccessExpression(callee)
      ? propertyNameText(unwrapExpression(callee.argumentExpression))
      : undefined;
  return REPEATING_ITERATION_METHODS.has(method)
    && parent.arguments.some((argument) => unwrapExpression(argument) === functionLike);
}

function isInsideRepeatingExecution(node) {
  let current = node;
  while (current?.parent) {
    const parent = current.parent;
    if (ts.isForStatement(parent)
      || ts.isForInStatement(parent)
      || ts.isForOfStatement(parent)
      || ts.isWhileStatement(parent)
      || ts.isDoStatement(parent)) {
      return true;
    }
    if (isFunctionLikeNode(current)) return isRepeatingIterationCallback(current);
    current = parent;
  }
  return false;
}

function hasCanonicalLibraryQueryCall(storeSource, functionName, cursorKind) {
  const sourceFile = createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const pageSizeDeclaration = findExactPageSizeConstantDeclaration(sourceFile);
  if (!pageSizeDeclaration) return false;
  const backendContext = inspectCanonicalBackendRequest(storeSource, sourceFile);
  if (!backendContext) return false;
  const functions = findCanonicalStoreActionFunctions(sourceFile, functionName);
  if (functions.length === 0) return false;

  return functions.every((functionLike) => {
    if (hasCanonicalStoreActionReentry(functionLike, sourceFile, functionName)) return false;
    const calls = findReachableCanonicalLibraryQueryCalls(
      functionLike,
      sourceFile,
      backendContext
    );
    if (calls.length !== 1 || calls.some((call) => isInsideRepeatingExecution(call))) return false;

    const [spec, pageSize, cursor] = calls[0].arguments;
    const exactPageSize = ts.isIdentifier(pageSize)
      && pageSize.text === "FILE_LIBRARY_V2_PAGE_SIZE"
      && resolvesToVariableBinding(pageSize, "FILE_LIBRARY_V2_PAGE_SIZE", pageSizeDeclaration);
    const exactCursor = cursorKind === "null"
      ? isNullLiteral(cursor)
      : ts.isIdentifier(cursor)
        && cursor.text === "cursor"
        && hasCanonicalCursorBinding(functionLike, "cursor");
    return Boolean(spec) && exactPageSize && exactCursor;
  });
}

function hasNamedInvocationInExpression(expression, name) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  const calls = findReachableCallsInExpression(node, (call) => (
    ts.isIdentifier(call.expression)
      && call.expression.text === name
      && isCanonicalStoreBinding(
        call.getSourceFile(),
        name,
        name,
        findEnclosingFunctionLike(call.expression)
      )
  ));
  return calls.length > 0 && !calls.some((call) => isInsideRepeatingExecution(call));
}

function hasNamedInvocationInStatement(statement, name) {
  if (ts.isExpressionStatement(statement)) return hasNamedInvocationInExpression(statement.expression, name);
  if (ts.isReturnStatement(statement)) return Boolean(statement.expression)
    && hasNamedInvocationInExpression(statement.expression, name);
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some((declaration) => (
    declaration.initializer && hasNamedInvocationInExpression(declaration.initializer, name)
  ));
  if (ts.isBlock(statement)) return hasNamedInvocationInSequence(statement.statements, name);
  if (ts.isIfStatement(statement)) {
    const branch = staticBranchValue(statement.expression);
    if (branch === true) return hasNamedInvocationInStatement(statement.thenStatement, name);
    if (branch === false) return statement.elseStatement
      ? hasNamedInvocationInStatement(statement.elseStatement, name)
      : false;
    return hasNamedInvocationInStatement(statement.thenStatement, name)
      || (statement.elseStatement ? hasNamedInvocationInStatement(statement.elseStatement, name) : false);
  }
  if (ts.isTryStatement(statement)) {
    return hasNamedInvocationInStatement(statement.tryBlock, name)
      || (statement.catchClause ? hasNamedInvocationInStatement(statement.catchClause.block, name) : false)
      || (statement.finallyBlock ? hasNamedInvocationInStatement(statement.finallyBlock, name) : false);
  }
  return false;
}

function hasNamedInvocationInSequence(statements, name) {
  for (const statement of statements) {
    if (hasNamedInvocationInStatement(statement, name)) return true;
    if (!canFallThroughStatement(statement)) return false;
  }
  return false;
}

function hasReachableNamedInvocation(functionLike, name, canonicalParameterFunctions = new Set()) {
  const invocations = findReachableNamedInvocations(functionLike, name, new Set(), canonicalParameterFunctions);
  return invocations.length === 1
    && !isInsideRepeatingExecution(invocations[0]);
}

function findReachableNamedInvocations(
  functionLike,
  name,
  visitedFunctions = new Set(),
  canonicalParameterFunctions = new Set()
) {
  if (!functionLike?.body || visitedFunctions.has(functionLike)) return [];
  const nextVisitedFunctions = new Set(visitedFunctions);
  nextVisitedFunctions.add(functionLike);
  const sourceFile = functionLike.getSourceFile();
  const calls = findReachableCallsInFunction(functionLike, () => true);
  const invocations = calls.filter((call) => {
    const callee = unwrapExpression(call.expression);
    return ts.isIdentifier(callee)
      && callee.text === name
      && (isCanonicalStoreBinding(
        sourceFile,
        name,
        name,
        findEnclosingFunctionLike(callee)
      ) || (() => {
        const declarations = findLexicalNamedDeclarations(callee, name);
        return declarations.length === 1
          && declarations[0].kind === "parameter"
          && canonicalParameterFunctions.has(declarations[0].node);
      })());
  });

  for (const call of calls) {
    for (const argument of call.arguments) {
      const callbacks = resolveCallableBindings(sourceFile, argument, call);
      for (const callback of callbacks) {
        invocations.push(...findReachableNamedInvocations(
          callback,
          name,
          nextVisitedFunctions,
          canonicalParameterFunctions
        ));
      }
    }
  }
  return [...new Set(invocations)];
}

function isEffectCall(call) {
  const callee = unwrapExpression(call.expression);
  return isReactEffectHook(callee, call)
    && Boolean(call.arguments[0])
    && call.arguments.length === 2
    && ts.isArrayLiteralExpression(unwrapExpression(call.arguments[1]))
    && (ts.isArrowFunction(unwrapExpression(call.arguments[0]))
      || ts.isFunctionExpression(unwrapExpression(call.arguments[0])));
}

function selectedResultStoreProperty(initializer, referenceNode = initializer) {
  const node = unwrapExpression(initializer);
  if (!ts.isCallExpression(node)
    || !isCanonicalResultStoreHook(node.expression, referenceNode ?? node)
    || node.arguments.length !== 1) return undefined;
  const selector = unwrapExpression(node.arguments[0]);
  if (!ts.isArrowFunction(selector) && !ts.isFunctionExpression(selector)) return undefined;
  const returned = findReturnedExpressions(selector).map(unwrapExpression);
  if (returned.length === 0 || returned.some((expression) => !expression)) return undefined;
  const parameter = selector.parameters[0]?.name;
  if (ts.isIdentifier(parameter)) {
    const properties = returned.map((expression) => (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === parameter.text
        ? ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : propertyNameText(unwrapExpression(expression.argumentExpression))
        : undefined
    ));
    return properties.every((property) => property && property === properties[0])
      ? properties[0]
      : undefined;
  }
  if (!ts.isObjectBindingPattern(parameter)) return undefined;
  const returnedNames = returned.map((expression) => ts.isIdentifier(expression) ? expression.text : undefined);
  if (!returnedNames[0] || returnedNames.some((name) => name !== returnedNames[0])) return undefined;
  const binding = parameter.elements.find((element) => (
    ts.isBindingElement(element)
    && ts.isIdentifier(element.name)
    && element.name.text === returnedNames[0]
  ));
  return binding
    ? propertyNameText(binding.propertyName ?? binding.name)
    : undefined;
}

function expressionDependsOnResultState(expression, referenceNode, visitedBindings = new Set(), depth = 0) {
  if (!expression || depth > MAX_CALLBACK_ANALYSIS_DEPTH) return false;
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isIdentifier(node)) {
    const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
    if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
    const declaration = declarations[0].node;
    const key = `effect-dependency:${declaration.getStart(declaration.getSourceFile())}`;
    if (visitedBindings.has(key)) return false;
    const initializer = unwrapExpression(declaration.initializer);
    const isResultStoreSelection = ts.isCallExpression(initializer)
      && isCanonicalResultStoreHook(initializer.expression, initializer);
    const selectedProperty = selectedResultStoreProperty(initializer, referenceNode);
    if (isResultStoreSelection) {
      return !selectedProperty || !FILE_LIBRARY_RESULT_ACTIONS.has(selectedProperty);
    }
    const nextVisited = new Set(visitedBindings);
    nextVisited.add(key);
    return expressionDependsOnResultState(
      declaration.initializer,
      declaration,
      nextVisited,
      depth + 1
    );
  }
  let dependsOnResult = false;
  ts.forEachChild(node, (child) => {
    if (!dependsOnResult) {
      dependsOnResult = expressionDependsOnResultState(
        child,
        referenceNode,
        visitedBindings,
        depth + 1
      );
    }
  });
  return dependsOnResult;
}

function hasSafeFirstPageDependencies(call) {
  const dependencies = unwrapExpression(call.arguments[1]);
  return ts.isArrayLiteralExpression(dependencies)
    && dependencies.elements.every((dependency) => (
      !ts.isSpreadElement(dependency)
      && isStableFirstPageDependency(dependency)
      && !expressionDependsOnResultState(dependency, dependency)
    ));
}

function isReactHookCall(expression, hookName, referenceNode) {
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    return importBindingMatches(
      resolveImportProvenance(node, referenceNode),
      REACT_MODULE,
      "named",
      hookName
    );
  }
  return ts.isPropertyAccessExpression(node)
    && node.name.text === hookName
    && importBindingMatches(
      resolveImportProvenance(node.expression, referenceNode),
      REACT_MODULE,
      "namespace"
    );
}

function selectedStoreProperty(initializer, referenceNode = initializer) {
  const node = unwrapExpression(initializer);
  if (!ts.isCallExpression(node) || node.arguments.length !== 1) return undefined;
  const selector = unwrapExpression(node.arguments[0]);
  if (!ts.isArrowFunction(selector) && !ts.isFunctionExpression(selector)) return undefined;
  const returned = findReturnedExpressions(selector).map(unwrapExpression);
  if (returned.length === 0 || returned.some((expression) => !expression)) return undefined;
  const parameter = selector.parameters[0]?.name;
  if (ts.isIdentifier(parameter)) {
    const properties = returned.map((expression) => (
      (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression))
      && ts.isIdentifier(expression.expression)
      && expression.expression.text === parameter.text
        ? ts.isPropertyAccessExpression(expression)
          ? expression.name.text
          : propertyNameText(unwrapExpression(expression.argumentExpression))
        : undefined
    ));
    return properties.every((property) => property && property === properties[0])
      ? properties[0]
      : undefined;
  }
  if (!ts.isObjectBindingPattern(parameter)) return undefined;
  const returnedNames = returned.map((expression) => ts.isIdentifier(expression) ? expression.text : undefined);
  if (!returnedNames[0] || returnedNames.some((name) => name !== returnedNames[0])) return undefined;
  const binding = parameter.elements.find((element) => (
    ts.isBindingElement(element)
    && ts.isIdentifier(element.name)
    && element.name.text === returnedNames[0]
  ));
  return binding
    ? propertyNameText(binding.propertyName ?? binding.name)
    : undefined;
}

function isStableStoreActionProperty(property) {
  return Boolean(property)
    && (FILE_LIBRARY_RESULT_ACTIONS.has(property)
      || /^(?:set|load|clear|refresh|reset|select|toggle|update|add|remove|start|stop|retry|cancel|commit|hydrate|open|close|enable|disable|run|apply|save|delete|mutate|reconcile|resolve)/i.test(property));
}

function isStableImportedStoreActionCall(call, referenceNode) {
  const callee = unwrapExpression(call.expression);
  const binding = resolveImportProvenance(callee, referenceNode);
  return binding?.kind === "import"
    && binding.importKind === "named"
    && binding.importedName?.startsWith("use")
    && /(^|\/)store\//.test(binding.moduleSpecifier)
    && isStableStoreActionProperty(selectedStoreProperty(call, referenceNode));
}

function isStableReactHookBinding(declaration, call, name, referenceNode) {
  const hookName = ["useState", "useReducer", "useRef", "useMemo", "useCallback"]
    .find((name) => isReactHookCall(call.expression, name, referenceNode));
  if (!hookName) return false;
  if (hookName === "useRef") return true;
  if (hookName === "useMemo" || hookName === "useCallback") {
    const dependencies = unwrapExpression(call.arguments[1]);
    return ts.isArrayLiteralExpression(dependencies) && dependencies.elements.length === 0;
  }
  if (!ts.isArrayBindingPattern(declaration.name)) return false;
  const element = findBindingElementByName(declaration.name, name);
  if (!element) return false;
  const index = declaration.name.elements.indexOf(element);
  return index === 0 || index === 1;
}

function isStablePrimitiveCall(call, referenceNode) {
  const callee = unwrapExpression(call.expression);
  if (ts.isPropertyAccessExpression(callee)
    && callee.name.text === "stringify"
    && ts.isIdentifier(callee.expression)
    && callee.expression.text === "JSON"
    && !resolveLexicalBinding(referenceNode, "JSON")) {
    return true;
  }
  if (!ts.isIdentifier(callee)
    || resolveLexicalBinding(referenceNode, callee.text)) return false;
  return new Set(["BigInt", "Boolean", "Number", "String"]).has(callee.text);
}

function isStableDebounceCall(call, referenceNode) {
  const binding = resolveImportProvenance(call.expression, referenceNode);
  return binding?.kind === "import"
    && binding.importKind === "named"
    && binding.importedName === "useDebounce"
    && /(^|\/)hooks\/useDebounce$/.test(binding.moduleSpecifier);
}

function isStableFirstPageCallInitializer(call, declaration, name, referenceNode) {
  return isStableImportedStoreActionCall(call, referenceNode)
    || isStableReactHookBinding(declaration, call, name, referenceNode)
    || isStablePrimitiveCall(call, referenceNode)
    || isStableDebounceCall(call, referenceNode);
}

function isStableFirstPageDependency(expression, referenceNode = expression, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isIdentifier(node)) {
    const declarations = findLexicalNamedDeclarations(referenceNode, node.text);
    if (declarations.length !== 1 || declarations[0].kind !== "variable") return true;
    const declaration = declarations[0].node;
    if (isCanonicalStoreBinding(
      referenceNode.getSourceFile(),
      node.text,
      "loadFirstPage",
      referenceNode
    )) return true;
    const key = `stable-effect-dependency:${declaration.getStart(declaration.getSourceFile())}`;
    if (visitedBindings.has(key) || !declaration.initializer) return false;
    const nextVisitedBindings = new Set(visitedBindings);
    nextVisitedBindings.add(key);
    const initializer = unwrapExpression(declaration.initializer);
    if (ts.isCallExpression(initializer)) {
      return isStableFirstPageCallInitializer(initializer, declaration, node.text, referenceNode);
    }
    return isStableFirstPageDependency(initializer, declaration, nextVisitedBindings);
  }
  return Boolean(node)
    && !ts.isObjectLiteralExpression(node)
    && !ts.isArrayLiteralExpression(node)
    && !ts.isArrowFunction(node)
    && !ts.isFunctionExpression(node)
    && !ts.isClassExpression(node)
    && !ts.isNewExpression(node)
    && !ts.isCallExpression(node)
    && !ts.isTaggedTemplateExpression(node)
    && !ts.isAwaitExpression(node)
    && !ts.isYieldExpression(node);
}

function findCanonicalParameterFunctions(
  name,
  componentSources,
  reachableFunctions
) {
  const canonicalParameterFunctions = new Set();
  for (const functionLike of reachableFunctions) {
    for (const call of findReachableCallsInFunction(functionLike, () => true)) {
      const calledFunctions = resolveCallableBindings(
        functionLike.getSourceFile(),
        call.expression,
        call,
        new Set(),
        componentSources
      );
      for (const calledFunction of calledFunctions) {
        const properties = call.arguments.flatMap((argument) => {
          const object = unwrapExpression(argument);
          return object && ts.isObjectLiteralExpression(object) ? object.properties : [];
        });
        const property = properties.find((candidate) => (
          (ts.isPropertyAssignment(candidate) && propertyNameText(candidate.name) === name)
            || (ts.isShorthandPropertyAssignment(candidate) && candidate.name.text === name)
        ));
        if (!property) continue;
        const value = ts.isPropertyAssignment(property) ? unwrapExpression(property.initializer) : property.name;
        if (ts.isIdentifier(value)
          && isCanonicalStoreBinding(
            functionLike.getSourceFile(),
            value.text,
            name,
            value
          )) {
          const declarations = findLexicalNamedDeclarations(calledFunction, name);
          if (declarations.some((declaration) => (
            declaration.kind === "parameter"
            && declaration.node === calledFunction
          ))) {
            canonicalParameterFunctions.add(calledFunction);
          }
        }
      }
    }
  }
  return canonicalParameterFunctions;
}

function hasMountedFirstPageInvocation(sourceFile, name, componentSources = {}) {
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component) return false;
  const reachableFunctions = findReachableVaultFunctions(sourceFile, component, true, componentSources);
  const canonicalParameterFunctions = findCanonicalParameterFunctions(
    name,
    componentSources,
    reachableFunctions
  );
  const effects = reachableFunctions.flatMap((functionLike) => (
    findReachableCallsInFunction(functionLike, (call) => (
      isEffectCall(call) && hasSafeFirstPageDependencies(call)
    ))
  ));
  return effects.some((call) => hasReachableNamedInvocation(
    unwrapExpression(call.arguments[0]),
    name,
    canonicalParameterFunctions
  ));
}

function hasCanonicalFirstPageBinding(viewSource, componentSources = {}) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  return sourceFile.parseDiagnostics.length === 0
    && component
    && isCanonicalStoreBinding(sourceFile, "loadFirstPage", "loadFirstPage", component)
    && hasMountedFirstPageInvocation(sourceFile, "loadFirstPage", componentSources);
}

function hasCanonicalResultStoreUsage(viewSource, componentSources = {}) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  const reachableFunctions = findReachableVaultFunctions(sourceFile, component, true, componentSources);
  return reachableFunctions.some((functionLike) => (
    findReachableCallsInFunction(functionLike, (call) => (
      isCanonicalResultStoreHook(call.expression, call)
    )).length > 0
  ));
}

function hasCanonicalLoadMoreBinding(viewSource, componentSources = {}) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  const reachableFunctions = findReachableVaultFunctions(sourceFile, component, false, componentSources);
  const expressions = reachableFunctions.flatMap((functionLike) => (
    findFileLibraryLoadMoreExpressions(functionLike.body)
  ));
  return expressions.length > 0 && expressions.every(({ expression, hasUnresolvedSpreadOverride }) => (
    !hasUnresolvedSpreadOverride
      && expression
      && analyzeCallbackBinding(expression, sourceFile, 0, new Set())
  ));
}

function findExactPageSizeConstantDeclaration(sourceFile) {
  const declarations = findNamedDeclarations(sourceFile, "FILE_LIBRARY_V2_PAGE_SIZE");
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return undefined;
  const declaration = declarations[0].node;
  if (!ts.isVariableDeclarationList(declaration.parent)
    || (declaration.parent.flags & ts.NodeFlags.Const) === 0
    || hasBindingWrite(sourceFile, "FILE_LIBRARY_V2_PAGE_SIZE")) {
    return undefined;
  }
  const initializer = declaration.initializer;
  return Boolean(initializer)
    && ts.isNumericLiteral(initializer)
    && Number(initializer.text) === MAX_FILE_LIBRARY_PAGE_SIZE
    ? declaration
    : undefined;
}

function hasExactPageSizeConstant(storeSource) {
  const sourceFile = createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
  return sourceFile.parseDiagnostics.length === 0
    && Boolean(findExactPageSizeConstantDeclaration(sourceFile));
}

function lastSection(source, startMarker, endMarker) {
  const start = source.lastIndexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end < 0 ? undefined : end);
}

export function findVaultPaginationArchitectureViolations({ viewSource, storeSource, componentSources = {} }) {
  const violations = [];

  if (!hasCanonicalResultStoreUsage(viewSource, componentSources)) {
    violations.push("Vault must use useFileLibraryResultStore for paginated rows.");
  }
  if (!hasCanonicalFirstPageBinding(viewSource, componentSources)) {
    violations.push("Vault must request its first page through the canonical store.");
  }
  if (!hasCanonicalLoadMoreBinding(viewSource, componentSources)) {
    violations.push("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  }
  if (hasReachableBackendBypass(viewSource, componentSources)) {
    violations.push("Vault must not call the File Library V2 backend directly.");
  }
  if (hasFrontendOwnedCursor(viewSource, componentSources)) {
    violations.push("Vault must not own a frontend pagination cursor.");
  }

  if (!hasExactPageSizeConstant(storeSource)) {
    violations.push("File Library V2 store must define FILE_LIBRARY_V2_PAGE_SIZE as exactly 50.");
  }
  if (!/\bqueryFileLibraryV2\s*\(/.test(storeSource)) {
    violations.push("File Library V2 store must use queryFileLibraryV2.");
  }
  if (!hasCanonicalBackendPageSize(storeSource)) {
    violations.push("File Library V2 backend request must use its exact page-size parameter.");
  }
  if (!hasCanonicalBackendCursor(storeSource)) {
    violations.push("File Library V2 backend request must forward its exact cursor parameter.");
  }
  if (!hasImmutableBackendRequestBinding(storeSource)) {
    violations.push("File Library V2 backend request object must not be mutated before the query.");
  }
  const backendRequest = inspectCanonicalBackendRequest(storeSource);
  if (backendRequest && hasProtectedRequestSpread(backendRequest.request)) {
    violations.push("File Library V2 backend request must not use an unresolved spread after guarded fields.");
  }
  if (backendRequest && hasProtectedRequestComputedProperty(backendRequest.request)) {
    violations.push("File Library V2 backend request must not use an unresolved computed property after guarded fields.");
  }
  if (backendRequest && hasRequestEscape(backendRequest)) {
    violations.push("File Library V2 backend request must not escape to an arbitrary helper before the query.");
  }
  const storeSourceFile = createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
  const nextPageFunctions = storeSourceFile.parseDiagnostics.length === 0
    ? findCanonicalStoreActionFunctions(storeSourceFile, "loadNextPage")
    : [];
  if (nextPageFunctions.length === 0
    || !nextPageFunctions.every((functionLike) => hasCanonicalCursorBinding(functionLike, "cursor"))) {
    violations.push("File Library V2 store must own and read the backend nextCursor.");
  }
  if (!hasCanonicalLibraryQueryCall(storeSource, "loadFirstPage", "null")) {
    violations.push("The first File Library V2 request must use a bounded page size and no cursor.");
  }
  if (!hasCanonicalLibraryQueryCall(storeSource, "loadNextPage", "cursor")) {
    violations.push("The next File Library V2 request must use a bounded page size and backend cursor.");
  }
  return violations;
}
