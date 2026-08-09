import ts from "typescript";

const MAX_FILE_LIBRARY_PAGE_SIZE = 50;
const MAX_CALLBACK_ANALYSIS_DEPTH = 8;

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
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      declarations.push({ kind: "variable", node });
    } else if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      declarations.push({ kind: "function", node });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return declarations;
}

function findReturnedExpression(functionLike) {
  if (!ts.isBlock(functionLike.body)) return functionLike.body;
  for (const statement of functionLike.body.statements) {
    if (ts.isReturnStatement(statement) && statement.expression) return statement.expression;
  }
  return undefined;
}

function selectorReturnsProperty(selector, propertyName) {
  if (!ts.isArrowFunction(selector) && !ts.isFunctionExpression(selector)) return false;
  const returned = unwrapExpression(findReturnedExpression(selector));
  return ts.isPropertyAccessExpression(returned)
    && ts.isIdentifier(returned.expression)
    && returned.name.text === propertyName;
}

function isCanonicalStoreBinding(sourceFile, name, propertyName) {
  const declarations = findNamedDeclarations(sourceFile, name);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
  const initializer = unwrapExpression(declarations[0].node.initializer);
  if (!ts.isCallExpression(initializer) || !ts.isIdentifier(initializer.expression)) return false;
  return initializer.expression.text === "useFileLibraryResultStore"
    && initializer.arguments.length === 1
    && selectorReturnsProperty(initializer.arguments[0], propertyName);
}

function resolveFunctionBinding(sourceFile, name) {
  const declarations = findNamedDeclarations(sourceFile, name);
  if (declarations.length !== 1) return undefined;
  const declaration = declarations[0];
  if (declaration.kind === "function") return declaration.node;
  const initializer = unwrapExpression(declaration.node.initializer);
  return ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer) ? initializer : undefined;
}

function analyzeInvocationExpression(expression, sourceFile, depth, visitedBindings) {
  if (!expression || depth > MAX_CALLBACK_ANALYSIS_DEPTH) return false;
  const node = unwrapExpression(expression);

  if (ts.isCallExpression(node)) {
    const callee = unwrapExpression(node.expression);
    if (ts.isIdentifier(callee)) {
      if (callee.text === "loadNextPage") return isCanonicalStoreBinding(sourceFile, "loadNextPage", "loadNextPage");
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
    return statement.statements.some((child) => analyzeStatement(child, sourceFile, depth, visitedBindings));
  }
  if (ts.isIfStatement(statement)) {
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
    return functionLike.body.statements.some((statement) => (
      analyzeStatement(statement, sourceFile, depth + 1, nextVisitedBindings)
    ));
  }
  return analyzeInvocationExpression(functionLike.body, sourceFile, depth + 1, nextVisitedBindings);
}

function analyzeCallbackBinding(expression, sourceFile, depth, visitedBindings) {
  if (!expression || depth > MAX_CALLBACK_ANALYSIS_DEPTH) return false;
  const node = unwrapExpression(expression);
  if (ts.isIdentifier(node)) {
    if (node.text === "loadNextPage") return isCanonicalStoreBinding(sourceFile, "loadNextPage", "loadNextPage");
    const functionLike = resolveFunctionBinding(sourceFile, node.text);
    return analyzeFunctionBinding(functionLike, sourceFile, depth + 1, visitedBindings);
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return analyzeFunctionBinding(node, sourceFile, depth + 1, visitedBindings);
  }
  return analyzeInvocationExpression(node, sourceFile, depth + 1, visitedBindings);
}

function findFileLibraryLoadMoreExpressions(sourceFile) {
  const expressions = [];
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
      if (ts.isIdentifier(tagName) && tagName.text === "FileLibraryList") {
        const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
        for (const property of attributes.properties) {
          if (!ts.isJsxAttribute(property) || property.name.text !== "onLoadMore") continue;
          if (property.initializer && ts.isJsxExpression(property.initializer) && property.initializer.expression) {
            expressions.push(property.initializer.expression);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return expressions;
}

function hasCanonicalLoadMoreBinding(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const expressions = findFileLibraryLoadMoreExpressions(sourceFile);
  return expressions.length > 0 && expressions.every((expression) => (
    analyzeCallbackBinding(expression, sourceFile, 0, new Set())
  ));
}

function hasExactPageSizeConstant(storeSource) {
  const sourceFile = createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const declarations = findNamedDeclarations(sourceFile, "FILE_LIBRARY_V2_PAGE_SIZE");
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
  const initializer = declarations[0].node.initializer;
  return Boolean(initializer)
    && ts.isNumericLiteral(initializer)
    && Number(initializer.text) === MAX_FILE_LIBRARY_PAGE_SIZE;
}

function lastSection(source, startMarker, endMarker) {
  const start = source.lastIndexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end < 0 ? undefined : end);
}

function hasUnboundedPageRequest(source) {
  for (const match of source.matchAll(/\b(?:pageSize|limit)\s*:\s*(\d+)/g)) {
    if (Number(match[1]) > MAX_FILE_LIBRARY_PAGE_SIZE) return true;
  }
  return /\b(?:pageSize|limit)\s*:\s*(?:Infinity|[A-Za-z_$][\w$]*\.(?:length|size))\b/.test(source);
}

export function findVaultPaginationArchitectureViolations({ viewSource, storeSource }) {
  const violations = [];
  const firstPage = lastSection(storeSource, "loadFirstPage: async", "loadNextPage: async");
  const nextPage = lastSection(storeSource, "loadNextPage: async", "refresh:");

  if (!/\buseFileLibraryResultStore\s*\(/.test(viewSource)) {
    violations.push("Vault must use useFileLibraryResultStore for paginated rows.");
  }
  if (!/\bloadFirstPage\s*\(/.test(viewSource)) {
    violations.push("Vault must request its first page through the canonical store.");
  }
  if (!hasCanonicalLoadMoreBinding(viewSource)) {
    violations.push("Vault must pass loadNextPage to FileLibraryList.onLoadMore.");
  }
  if (/\b(?:tauriApi\.)?queryFileLibraryV2\s*\(/.test(viewSource) || /\binvokeCommand\s*\([^)]*["']query_file_library_v2["']/.test(viewSource)) {
    violations.push("Vault must not call the File Library V2 backend directly.");
  }
  if (/\b(?:const|let)\s+\w*cursor\w*\s*=/.test(viewSource) || /\b(?:const|let)\s*\[\s*\w*cursor\w*\s*,/.test(viewSource)) {
    violations.push("Vault must not own a frontend pagination cursor.");
  }

  if (!hasExactPageSizeConstant(storeSource)) {
    violations.push("File Library V2 store must define FILE_LIBRARY_V2_PAGE_SIZE as exactly 50.");
  }
  if (!/\bqueryFileLibraryV2\s*\(/.test(storeSource)) {
    violations.push("File Library V2 store must use queryFileLibraryV2.");
  }
  if (!/\bnextCursor\b/.test(storeSource) || !/const\s+cursor\s*=\s*get\(\)\.nextCursor/.test(nextPage)) {
    violations.push("File Library V2 store must own and read the backend nextCursor.");
  }
  if (!firstPage.includes("FILE_LIBRARY_V2_PAGE_SIZE")) {
    violations.push("File Library V2 store must use its bounded page size for the first page.");
  }
  if (!/\bexecuteLibraryQuery\s*\([\s\S]*?\bFILE_LIBRARY_V2_PAGE_SIZE\b[\s\S]*?\bnull\b/.test(firstPage)) {
    violations.push("The first File Library V2 request must use a bounded page size and no cursor.");
  }
  if (!/\bexecuteLibraryQuery\s*\([\s\S]*?\bFILE_LIBRARY_V2_PAGE_SIZE\b[\s\S]*?\bcursor\b/.test(nextPage)) {
    violations.push("The next File Library V2 request must use a bounded page size and backend cursor.");
  }
  if (hasUnboundedPageRequest(viewSource) || hasUnboundedPageRequest(storeSource)) {
    violations.push("File Library pagination must not issue an unbounded page request.");
  }

  return violations;
}
