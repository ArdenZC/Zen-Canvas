import ts from "typescript";

const MAX_FILE_LIBRARY_PAGE_SIZE = 50;
const MAX_CALLBACK_ANALYSIS_DEPTH = 8;
const FILE_LIBRARY_RESULT_ACTIONS = new Set(["loadFirstPage", "loadNextPage", "refresh", "clear"]);
const importBindingsCache = new WeakMap();
const CANONICAL_RESULT_STORE_MODULE = "../../store/useFileLibraryV2Store";
const ZUSTAND_MODULE = "zustand";
const REACT_MODULE = "react";
const TAURI_CORE_MODULES = new Set(["@tauri-apps/api/core", "@tauri-apps/api/tauri"]);
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
    || ts.isMethodDeclaration(node);
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

function resolveCallableBindings(sourceFile, expression, referenceNode = expression, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return [];
  if (isFunctionLikeNode(node)) return [node];
  if (ts.isIdentifier(node)) {
    const resolved = resolveFunctionBinding(sourceFile, node.text, referenceNode);
    if (resolved) return [resolved];

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
    return resolveCallableBindings(sourceFile, initializer.arguments[0], initializer, nextVisited);
  }
  if (!ts.isPropertyAccessExpression(node) && !ts.isElementAccessExpression(node)) return [];
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
          nextVisited
        ));
      } else if (ts.isShorthandPropertyAssignment(property) && property.name.text === propertyName) {
        resolved.push(...resolveCallableBindings(sourceFile, property.name, property, nextVisited));
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
      return analyzeInvocationExpression(callee.expression, sourceFile, depth + 1, visitedBindings);
    }
    return false;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return analyzeInvocationExpression(node.expression, sourceFile, depth + 1, visitedBindings);
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
            if (hasLoadMoreAttribute) hasUnresolvedSpreadOverride = true;
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

function isImportedTauriHelper(identifier) {
  const binding = resolveImportProvenance(identifier, identifier);
  return Boolean(binding)
    && binding.kind === "import"
    && /(?:^|\/)tauriApi$/.test(binding.moduleSpecifier);
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
  if (provenance?.kind === "import" && /(?:^|\/)tauriApi$/.test(provenance.moduleSpecifier)) {
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
    && /(?:^|\/)tauriApi$/.test(provenance.moduleSpecifier);
}

function isFileLibraryQueryCallable(expression, referenceNode, visitedBindings = new Set()) {
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const receiver = unwrapExpression(node.expression);
    const property = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : propertyNameText(unwrapExpression(node.argumentExpression));
    return property === "queryFileLibraryV2"
      && isTauriApiReceiver(receiver, referenceNode, visitedBindings);
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

function findJsxCallbackBindings(functionLike) {
  return findReachableJsxElementsInFunction(functionLike).flatMap((node) => {
    const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    return attributes.properties.flatMap((property) => (
      ts.isJsxAttribute(property)
        && property.initializer
        && ts.isJsxExpression(property.initializer)
        && property.initializer.expression
        ? [property.initializer.expression]
        : []
    ));
  });
}

function findRenderedJsxComponentBindings(functionLike) {
  return findReachableJsxElementsInFunction(functionLike).flatMap((node) => {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    return ts.isIdentifier(tagName) ? [tagName] : [];
  });
}

function findReachableVaultFunctions(sourceFile, component, includeInvokedFunctions = true) {
  const functions = [];
  const visited = new Set();
  function enqueue(functionLike, depth) {
    if (!functionLike?.body
      || depth > MAX_CALLBACK_ANALYSIS_DEPTH
      || visited.has(functionLike)) return;
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
    for (const expression of expressions) {
      for (const resolved of resolveCallableBindings(sourceFile, expression)) {
        enqueue(resolved, depth + 1);
      }
    }
  }
  enqueue(component, 0);
  return functions;
}

function hasReachableBackendBypass(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  return findReachableVaultFunctions(sourceFile, component).some((functionLike) => (
    findReachableCallsInFunction(functionLike, (call) => {
      const callee = unwrapExpression(call.expression);
      if (isFileLibraryBackendCommand(call.arguments[0], call)
        && isTauriInvocationCallable(callee, call)) return true;
      if (ts.isIdentifier(callee)
        && (isImportedTauriHelper(callee) || isUnresolvedQueryHelper(callee, sourceFile))) return true;
      return isFileLibraryQueryCallable(callee, call);
    }).length > 0
  ));
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

function hasPaginationArgumentBinding(functionLike, declaration) {
  const sourceFile = functionLike.getSourceFile();
  return findReachableCallsInFunction(functionLike, (call) => (
    isPaginationInvocation(call, sourceFile)
  )).some((call) => call.arguments.some((argument) => (
    expressionReferencesBinding(argument, declaration)
  )));
}

function hasFrontendOwnedCursor(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  const reachableFunctions = findReachableVaultFunctions(sourceFile, component);
  const declarations = [...new Set(reachableFunctions.flatMap((functionLike) => (
    findReachableVariableDeclarationsInFunction(functionLike)
      .filter((declaration) => (
        ts.isVariableDeclarationList(declaration.parent)
        && (declaration.parent.flags & (ts.NodeFlags.Const | ts.NodeFlags.Let)) !== 0
      ))
  )))]
  return declarations.some((declaration) => (
    reachableFunctions.some((functionLike) => hasPaginationArgumentBinding(functionLike, declaration))
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
  if (calls.length !== 1) return undefined;
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
  const backendStart = context.backendCall.getStart(context.sourceFile);
  return findReachableCallsInFunction(context.functionLike, () => true).some((call) => (
    call !== context.backendCall
    && call.getStart(context.sourceFile) < backendStart
    && call.arguments.some((argument) => {
      const node = unwrapExpression(argument);
      return ts.isIdentifier(node) && node.text === context.requestArgument.text;
    })
  ));
}

function isNullLiteral(expression) {
  return Boolean(expression) && expression.kind === ts.SyntaxKind.NullKeyword;
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
    const calls = findReachableCallsInFunction(functionLike, (call) => (
      ts.isIdentifier(call.expression)
        && call.expression.text === "executeLibraryQuery"
        && resolvesToFunctionBinding(call.expression, "executeLibraryQuery", backendContext.functionLike)
    ));
    if (calls.length !== 1) return false;

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
  return findReachableCallsInExpression(node, (call) => (
    ts.isIdentifier(call.expression)
      && call.expression.text === name
      && isCanonicalStoreBinding(
        call.getSourceFile(),
        name,
        name,
        findEnclosingFunctionLike(call.expression)
      )
  )).length > 0;
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

function hasReachableNamedInvocation(functionLike, name) {
  if (!functionLike?.body) return false;
  if (ts.isBlock(functionLike.body)) return hasNamedInvocationInSequence(functionLike.body.statements, name);
  return hasNamedInvocationInExpression(functionLike.body, name);
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

function isStableFirstPageDependency(expression) {
  const node = unwrapExpression(expression);
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

function hasMountedFirstPageInvocation(sourceFile, name) {
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component) return false;
  const effects = findReachableCallsInFunction(component, (call) => (
    isEffectCall(call) && hasSafeFirstPageDependencies(call)
  ));
  return effects.some((call) => hasReachableNamedInvocation(unwrapExpression(call.arguments[0]), name));
}

function hasCanonicalFirstPageBinding(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  return sourceFile.parseDiagnostics.length === 0
    && component
    && isCanonicalStoreBinding(sourceFile, "loadFirstPage", "loadFirstPage", component)
    && hasMountedFirstPageInvocation(sourceFile, "loadFirstPage");
}

function hasCanonicalResultStoreUsage(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  return findReachableVaultFunctions(sourceFile, component).some((functionLike) => (
    findReachableCallsInFunction(functionLike, (call) => (
      isCanonicalResultStoreHook(call.expression, call)
    )).length > 0
  ));
}

function hasCanonicalLoadMoreBinding(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component?.body) return false;
  const expressions = findReachableVaultFunctions(sourceFile, component, false).flatMap((functionLike) => (
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

export function findVaultPaginationArchitectureViolations({ viewSource, storeSource }) {
  const violations = [];

  if (!hasCanonicalResultStoreUsage(viewSource)) {
    violations.push("Vault must use useFileLibraryResultStore for paginated rows.");
  }
  if (!hasCanonicalFirstPageBinding(viewSource)) {
    violations.push("Vault must request its first page through the canonical store.");
  }
  if (!hasCanonicalLoadMoreBinding(viewSource)) {
    violations.push("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  }
  if (hasReachableBackendBypass(viewSource)) {
    violations.push("Vault must not call the File Library V2 backend directly.");
  }
  if (hasFrontendOwnedCursor(viewSource)) {
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
