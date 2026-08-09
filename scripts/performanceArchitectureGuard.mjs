import ts from "typescript";

const MAX_FILE_LIBRARY_PAGE_SIZE = 50;
const MAX_CALLBACK_ANALYSIS_DEPTH = 8;
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
  const parameter = selector.parameters[0]?.name;
  if (!parameter || !ts.isIdentifier(parameter)) return false;
  const returned = unwrapExpression(findReturnedExpression(selector));
  return ts.isPropertyAccessExpression(returned)
    && ts.isIdentifier(returned.expression)
    && returned.expression.text === parameter.text
    && returned.name.text === propertyName;
}

function hasBindingWrite(sourceOrNode, name) {
  const sourceFile = sourceOrNode.getSourceFile?.() ?? sourceOrNode;
  let written = false;
  function visit(node) {
    if (written) return;
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
  visit(sourceFile);
  return written;
}

function isCanonicalStoreBinding(sourceFile, name, propertyName) {
  const declarations = findNamedDeclarations(sourceFile, name);
  if (declarations.length !== 1 || declarations[0].kind !== "variable") return false;
  const declaration = declarations[0].node;
  if (!ts.isVariableDeclarationList(declaration.parent)
    || (declaration.parent.flags & ts.NodeFlags.Const) === 0
    || hasBindingWrite(sourceFile, name)) {
    return false;
  }
  const initializer = unwrapExpression(declaration.initializer);
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

function staticBranchValue(expression) {
  const node = unwrapExpression(expression);
  if (!node) return undefined;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
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
    if (!statement.catchClause) return true;
    return canFallThroughStatement(statement.tryBlock)
      || canFallThroughStatement(statement.catchClause.block);
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

function findStoreFunctionBodies(sourceFile, propertyName) {
  const functions = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === propertyName) {
      const initializer = unwrapExpression(node.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) functions.push(initializer);
    } else if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === propertyName) {
      functions.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return functions;
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

function findCallsInFunction(functionLike, predicate) {
  const calls = [];
  if (!functionLike.body) return calls;
  function visit(node) {
    if (node !== functionLike.body && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    )) return;
    if (ts.isCallExpression(node) && predicate(node)) calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  return calls;
}

function findReachableCallsInExpression(expression, predicate) {
  const calls = [];
  const root = unwrapExpression(expression);
  if (!root) return calls;
  function visit(node) {
    if (node !== root && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    )) return;
    if (ts.isCallExpression(node) && predicate(node)) calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
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

function isCanonicalCursorRead(expression) {
  const node = unwrapExpression(expression);
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== "nextCursor") return false;
  const receiver = unwrapExpression(node.expression);
  return ts.isCallExpression(receiver)
    && ts.isIdentifier(receiver.expression)
    && receiver.expression.text === "get"
    && receiver.arguments.length === 0;
}

function hasCanonicalCursorBinding(functionLike, name) {
  const declarations = findVariableDeclarationsInFunction(functionLike, name);
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    && !hasBindingWrite(functionLike.getSourceFile(), name)
    && isCanonicalCursorRead(declaration.initializer);
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

function hasObjectPropertyWrite(functionLike, objectName) {
  if (!functionLike.body) return false;
  const sourceFile = functionLike.getSourceFile();
  let written = false;
  function visit(node) {
    if (written) return;
    if (node !== functionLike.body && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    )) return;
    if (ts.isBinaryExpression(node)
      && ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(sourceFile))
      && isObjectPropertyAccess(node.left, objectName)) {
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
  return written;
}

function hasObjectAlias(functionLike, objectName) {
  if (!functionLike.body) return false;
  let aliased = false;
  function visit(node) {
    if (aliased) return;
    if (node !== functionLike.body && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    )) return;
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && ts.isIdentifier(unwrapExpression(node.initializer))
      && unwrapExpression(node.initializer).text === objectName) {
      aliased = true;
      return;
    }
    if (ts.isBinaryExpression(node)
      && ts.isIdentifier(node.left)
      && ASSIGNMENT_OPERATORS.has(node.operatorToken.getText(functionLike.getSourceFile()))
      && ts.isIdentifier(unwrapExpression(node.right))
      && unwrapExpression(node.right).text === objectName) {
      aliased = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionLike.body);
  return aliased;
}

function inspectCanonicalBackendRequest(storeSource) {
  const sourceFile = createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
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
      && ts.isIdentifier(callee.expression)
      && callee.expression.text === "tauriApi"
      && callee.name.text === "queryFileLibraryV2";
  });
  if (calls.length !== 1) return undefined;
  const requestArgument = unwrapExpression(calls[0].arguments[0]);
  const request = resolveObjectLiteral(functionLike, requestArgument);
  if (!request) return undefined;
  return { sourceFile, functionLike, requestArgument, request, pageSizeParameter, cursorParameter };
}

function hasCanonicalBackendPageSize(storeSource) {
  const context = inspectCanonicalBackendRequest(storeSource);
  if (!context) return false;
  const pageSize = objectPropertyValue(context.request, "pageSize");
  return Boolean(pageSize)
    && ts.isIdentifier(pageSize)
    && pageSize.text === context.pageSizeParameter.text
    && !hasBindingWrite(context.functionLike, context.pageSizeParameter.text);
}

function hasCanonicalBackendCursor(storeSource) {
  const context = inspectCanonicalBackendRequest(storeSource);
  if (!context) return false;
  const cursor = objectPropertyValue(context.request, "cursor");
  return Boolean(cursor)
    && ts.isIdentifier(cursor)
    && cursor.text === context.cursorParameter.text;
}

function hasImmutableBackendRequestBinding(storeSource) {
  const context = inspectCanonicalBackendRequest(storeSource);
  if (!context) return false;
  if (!ts.isIdentifier(context.requestArgument)) return true;
  const declarations = findVariableDeclarationsInFunction(context.functionLike, context.requestArgument.text);
  if (declarations.length !== 1) return false;
  const declaration = declarations[0];
  return ts.isVariableDeclarationList(declaration.parent)
    && (declaration.parent.flags & ts.NodeFlags.Const) !== 0
    && !hasBindingWrite(context.sourceFile, context.requestArgument.text)
    && !hasObjectPropertyWrite(context.functionLike, context.requestArgument.text)
    && !hasObjectAlias(context.functionLike, context.requestArgument.text);
}

function isNullLiteral(expression) {
  return Boolean(expression) && expression.kind === ts.SyntaxKind.NullKeyword;
}

function hasCanonicalLibraryQueryCall(storeSource, functionName, cursorKind) {
  const sourceFile = createSourceFile(storeSource, "useFileLibraryV2Store.ts", ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) return false;
  const functions = findStoreFunctionBodies(sourceFile, functionName);
  if (functions.length !== 1) return false;

  const calls = findReachableCallsInFunction(functions[0], (call) => (
    ts.isIdentifier(call.expression) && call.expression.text === "executeLibraryQuery"
  ));
  if (calls.length !== 1) return false;

  const [spec, pageSize, cursor] = calls[0].arguments;
  const exactPageSize = ts.isIdentifier(pageSize) && pageSize.text === "FILE_LIBRARY_V2_PAGE_SIZE";
  const exactCursor = cursorKind === "null"
    ? isNullLiteral(cursor)
    : ts.isIdentifier(cursor)
      && cursor.text === "cursor"
      && hasCanonicalCursorBinding(functions[0], "cursor");
  return Boolean(spec) && exactPageSize && exactCursor;
}

function hasNamedInvocationInExpression(expression, name) {
  let found = false;
  function visit(node) {
    if (found) return;
    if (node !== expression && (
      ts.isArrowFunction(node)
      || ts.isFunctionDeclaration(node)
      || ts.isFunctionExpression(node)
      || ts.isMethodDeclaration(node)
    )) return;
    if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === name) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  const node = unwrapExpression(expression);
  if (!node) return false;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return false;
  visit(node);
  return found;
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
  return ts.isIdentifier(callee)
    && (callee.text === "useEffect" || callee.text === "useLayoutEffect")
    && Boolean(call.arguments[0])
    && (ts.isArrowFunction(unwrapExpression(call.arguments[0]))
      || ts.isFunctionExpression(unwrapExpression(call.arguments[0])));
}

function hasMountedFirstPageInvocation(sourceFile, name) {
  const component = resolveFunctionBinding(sourceFile, "VaultView");
  if (!component) return false;
  if (hasReachableNamedInvocation(component, name)) return true;
  const effects = findCallsInFunction(component, isEffectCall);
  return effects.some((call) => hasReachableNamedInvocation(unwrapExpression(call.arguments[0]), name));
}

function hasCanonicalFirstPageBinding(viewSource) {
  const sourceFile = createSourceFile(viewSource, "VaultView.tsx", ts.ScriptKind.TSX);
  return sourceFile.parseDiagnostics.length === 0
    && isCanonicalStoreBinding(sourceFile, "loadFirstPage", "loadFirstPage")
    && hasMountedFirstPageInvocation(sourceFile, "loadFirstPage");
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
  const declaration = declarations[0].node;
  if (!ts.isVariableDeclarationList(declaration.parent)
    || (declaration.parent.flags & ts.NodeFlags.Const) === 0
    || hasBindingWrite(sourceFile, "FILE_LIBRARY_V2_PAGE_SIZE")) {
    return false;
  }
  const initializer = declaration.initializer;
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
  const nextPage = lastSection(storeSource, "loadNextPage: async", "refresh:");

  if (!/\buseFileLibraryResultStore\s*\(/.test(viewSource)) {
    violations.push("Vault must use useFileLibraryResultStore for paginated rows.");
  }
  if (!hasCanonicalFirstPageBinding(viewSource)) {
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
  if (!hasCanonicalBackendPageSize(storeSource)) {
    violations.push("File Library V2 backend request must use its exact page-size parameter.");
  }
  if (!hasCanonicalBackendCursor(storeSource)) {
    violations.push("File Library V2 backend request must forward its exact cursor parameter.");
  }
  if (!hasImmutableBackendRequestBinding(storeSource)) {
    violations.push("File Library V2 backend request object must not be mutated before the query.");
  }
  if (!/\bnextCursor\b/.test(storeSource) || !/const\s+cursor\s*=\s*get\(\)\.nextCursor/.test(nextPage)) {
    violations.push("File Library V2 store must own and read the backend nextCursor.");
  }
  if (!hasCanonicalLibraryQueryCall(storeSource, "loadFirstPage", "null")) {
    violations.push("The first File Library V2 request must use a bounded page size and no cursor.");
  }
  if (!hasCanonicalLibraryQueryCall(storeSource, "loadNextPage", "cursor")) {
    violations.push("The next File Library V2 request must use a bounded page size and backend cursor.");
  }
  if (hasUnboundedPageRequest(viewSource) || hasUnboundedPageRequest(storeSource)) {
    violations.push("File Library pagination must not issue an unbounded page request.");
  }

  return violations;
}
