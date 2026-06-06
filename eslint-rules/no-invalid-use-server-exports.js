function isUseServerDirective(node) {
  return node.type === 'ExpressionStatement' && node.directive === 'use server';
}

function hasModuleUseServerDirective(program) {
  return program.body.some(isUseServerDirective);
}

function isAsyncFunctionDeclaration(node) {
  return node?.type === 'FunctionDeclaration' && node.async && !node.generator;
}

function isAsyncFunctionExpression(node) {
  return (
    (node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression') && node.async && !node.generator
  );
}

function isAsyncFunctionVariableDeclaration(declaration) {
  return declaration?.id?.type === 'Identifier' && isAsyncFunctionExpression(declaration.init);
}

function isAllowedVariableDeclaration(node) {
  return node?.type === 'VariableDeclaration' && node.declarations.every(isAsyncFunctionVariableDeclaration);
}

function getDeclaredVariable(sourceCode, node) {
  return sourceCode.getDeclaredVariables(node)[0] ?? null;
}

function collectAsyncFunctionBindings(program, sourceCode) {
  const bindings = new Map();

  for (const [index, node] of program.body.entries()) {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;

    if (isAsyncFunctionDeclaration(declaration) && declaration.id?.name) {
      bindings.set(declaration.id.name, {
        hoisted: true,
        index,
        variable: getDeclaredVariable(sourceCode, declaration),
      });
      continue;
    }

    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }

    for (const variableDeclaration of declaration.declarations) {
      if (isAsyncFunctionVariableDeclaration(variableDeclaration)) {
        bindings.set(variableDeclaration.id.name, {
          hoisted: false,
          index,
          variable: getDeclaredVariable(sourceCode, variableDeclaration),
        });
      }
    }
  }

  return bindings;
}

function findVariable(scope, name) {
  for (let currentScope = scope; currentScope; currentScope = currentScope.upper) {
    const variable = currentScope.variables.find(candidate => candidate.name === name);

    if (variable) {
      return variable;
    }
  }

  return null;
}

function collectTopLevelFunctionDeclarations(program, sourceCode) {
  const functions = new Map();
  const memberFunctions = new Map();

  for (const node of program.body) {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;

    if (declaration?.type === 'FunctionDeclaration') {
      const variable = getDeclaredVariable(sourceCode, declaration);

      if (variable) {
        functions.set(variable, declaration);
      }

      continue;
    }

    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }

    for (const variableDeclaration of declaration.declarations) {
      if (
        variableDeclaration.id.type !== 'Identifier' ||
        !(
          variableDeclaration.init?.type === 'FunctionExpression' ||
          variableDeclaration.init?.type === 'ArrowFunctionExpression'
        )
      ) {
        continue;
      }

      const variable = getDeclaredVariable(sourceCode, variableDeclaration);

      if (variable) {
        functions.set(variable, variableDeclaration.init);
      }
    }

    for (const variableDeclaration of declaration.declarations) {
      if (variableDeclaration.id.type !== 'Identifier' || variableDeclaration.init?.type !== 'ObjectExpression') {
        continue;
      }

      const variable = getDeclaredVariable(sourceCode, variableDeclaration);
      const members = new Map();

      for (const property of variableDeclaration.init.properties) {
        const key =
          property.key?.type === 'Identifier'
            ? property.key.name
            : property.key?.type === 'Literal'
              ? String(property.key.value)
              : null;

        if (
          !key ||
          !(property.value?.type === 'FunctionExpression' || property.value?.type === 'ArrowFunctionExpression')
        ) {
          continue;
        }

        members.set(key, property.value);
      }

      if (variable && members.size > 0) {
        memberFunctions.set(variable, members);
      }
    }
  }

  return { functions, memberFunctions };
}

function collectCalledFunctionAssignments(node, sourceCode, bindings, options) {
  if (!options.callableFunctions || node.type !== 'CallExpression') {
    return;
  }

  if (node.callee.type === 'FunctionExpression' || node.callee.type === 'ArrowFunctionExpression') {
    collectAssignedVariables(node.callee.body, sourceCode, bindings, options);
    return;
  }

  if (node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier') {
    const objectVariable = findVariable(sourceCode.getScope(node.callee.object), node.callee.object.name);
    const key =
      node.callee.property.type === 'Identifier'
        ? node.callee.property.name
        : node.callee.property.type === 'Literal'
          ? String(node.callee.property.value)
          : null;
    const declaration =
      objectVariable && key ? options.callableFunctions.memberFunctions.get(objectVariable)?.get(key) : null;

    if (declaration && options.visitedMemberFunctions?.has(declaration)) {
      return;
    }

    if (declaration) {
      options.visitedMemberFunctions?.add(declaration);
      collectAssignedVariables(declaration.body, sourceCode, bindings, options);
    }

    return;
  }

  if (node.callee.type !== 'Identifier') {
    return;
  }

  const variable = findVariable(sourceCode.getScope(node.callee), node.callee.name);
  const declaration = variable ? options.callableFunctions.functions.get(variable) : null;

  if (!variable || !declaration || options.visitedFunctions?.has(variable)) {
    return;
  }

  options.visitedFunctions?.add(variable);
  collectAssignedVariables(declaration.body, sourceCode, bindings, options);
}

function addAssignedVariables(node, sourceCode, bindings) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type === 'Identifier') {
    const variable = findVariable(sourceCode.getScope(node), node.name);

    if (variable) {
      bindings.add(variable);
    }
    return;
  }

  if (node.type === 'AssignmentPattern' || node.type === 'RestElement') {
    addAssignedVariables(node.argument ?? node.left, sourceCode, bindings);
    return;
  }

  if (node.type === 'ArrayPattern') {
    for (const element of node.elements) {
      addAssignedVariables(element, sourceCode, bindings);
    }
    return;
  }

  if (node.type === 'ObjectPattern') {
    for (const property of node.properties) {
      addAssignedVariables(property.argument ?? property.value, sourceCode, bindings);
    }
  }
}

function collectAssignedVariables(node, sourceCode, bindings = new Set(), options = {}) {
  if (!node || typeof node !== 'object') {
    return bindings;
  }

  if (
    options.skipFunctionBodies &&
    node.type !== 'Program' &&
    /Function(?:Declaration|Expression)$|ArrowFunctionExpression/.test(node.type)
  ) {
    return bindings;
  }

  if (node.type === 'AssignmentExpression') {
    addAssignedVariables(node.left, sourceCode, bindings);
    collectAssignedVariables(node.right, sourceCode, bindings, options);
  }

  if (node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
    if (node.left.type !== 'VariableDeclaration') {
      addAssignedVariables(node.left, sourceCode, bindings);
    }
  }

  if (node.type === 'UpdateExpression') {
    addAssignedVariables(node.argument, sourceCode, bindings);
    return bindings;
  }

  collectCalledFunctionAssignments(node, sourceCode, bindings, options);

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        collectAssignedVariables(child, sourceCode, bindings, options);
      }
      continue;
    }

    collectAssignedVariables(value, sourceCode, bindings, options);
  }

  return bindings;
}

function isValueExportSpecifier(specifier) {
  return specifier.exportKind !== 'type';
}

function isTypeOnlyExport(node) {
  return (
    (node.type === 'ExportAllDeclaration' && node.exportKind === 'type') ||
    (node.type === 'ExportNamedDeclaration' &&
      (node.exportKind === 'type' ||
        (node.specifiers.length > 0 && node.specifiers.every(specifier => specifier.exportKind === 'type'))))
  );
}

function isAssigned(binding, assignedVariables) {
  return Boolean(binding.variable && assignedVariables.has(binding.variable));
}

function isAllowedNamedExportSpecifier(specifier, asyncFunctionBindings, assignedVariables) {
  if (!isValueExportSpecifier(specifier)) {
    return true;
  }

  const binding = specifier.local.type === 'Identifier' ? asyncFunctionBindings.get(specifier.local.name) : null;

  return Boolean(binding && !isAssigned(binding, assignedVariables));
}

function isAllowedNamedExportSpecifiers(node, asyncFunctionBindings, assignedVariables) {
  return (
    node.source === null &&
    node.exportKind !== 'type' &&
    node.specifiers.length > 0 &&
    node.specifiers.every(specifier =>
      isAllowedNamedExportSpecifier(specifier, asyncFunctionBindings, assignedVariables)
    )
  );
}

function isAllowedDefaultIdentifier(declaration, asyncFunctionBindings, assignedVariablesBeforeExport, exportIndex) {
  if (declaration.type !== 'Identifier') {
    return false;
  }

  const binding = asyncFunctionBindings.get(declaration.name);

  return Boolean(
    binding && (binding.hoisted || binding.index < exportIndex) && !isAssigned(binding, assignedVariablesBeforeExport)
  );
}

function isAllowedDefaultExport(node, asyncFunctionBindings, assignedVariablesBeforeExport, exportIndex) {
  return (
    isAsyncFunctionDeclaration(node.declaration) ||
    isAsyncFunctionExpression(node.declaration) ||
    isAllowedDefaultIdentifier(node.declaration, asyncFunctionBindings, assignedVariablesBeforeExport, exportIndex)
  );
}

function isAllowedVariableExport(node, asyncFunctionBindings, assignedVariables) {
  return (
    isAllowedVariableDeclaration(node) &&
    node.declarations.every(declaration => {
      const binding = declaration.id.type === 'Identifier' ? asyncFunctionBindings.get(declaration.id.name) : null;

      return binding && !isAssigned(binding, assignedVariables);
    })
  );
}

function isAllowedExport(node, asyncFunctionBindings, assignedVariables, assignedVariablesBeforeExport, exportIndex) {
  if (node.type === 'ExportNamedDeclaration') {
    const binding = node.declaration?.id?.name ? asyncFunctionBindings.get(node.declaration.id.name) : null;

    return (
      (isAsyncFunctionDeclaration(node.declaration) && binding && !isAssigned(binding, assignedVariables)) ||
      isAllowedVariableExport(node.declaration, asyncFunctionBindings, assignedVariables)
    );
  }

  if (node.type === 'ExportDefaultDeclaration') {
    return isAllowedDefaultExport(node, asyncFunctionBindings, assignedVariablesBeforeExport, exportIndex);
  }

  return false;
}

function isExportDeclaration(node) {
  return (
    node.type === 'ExportNamedDeclaration' ||
    node.type === 'ExportDefaultDeclaration' ||
    node.type === 'ExportAllDeclaration'
  );
}

/** @type {import('eslint').Rule.RuleModule} */
export const noInvalidUseServerExports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow non-async-function exports from module-level use server files',
    },
    messages: {
      invalidExport: 'Only async functions may be exported from a module-level `use server` file.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program(program) {
        if (!hasModuleUseServerDirective(program)) {
          return;
        }

        const asyncFunctionBindings = collectAsyncFunctionBindings(program, sourceCode);
        const assignedVariables = collectAssignedVariables(program, sourceCode);
        const callableFunctions = collectTopLevelFunctionDeclarations(program, sourceCode);

        for (const [index, node] of program.body.entries()) {
          const assignedVariablesBeforeExport =
            node.type === 'ExportDefaultDeclaration'
              ? collectAssignedVariables(
                  { type: 'Program', body: program.body.slice(0, index) },
                  sourceCode,
                  new Set(),
                  {
                    callableFunctions,
                    skipFunctionBodies: true,
                    visitedMemberFunctions: new Set(),
                    visitedFunctions: new Set(),
                  }
                )
              : assignedVariables;

          if (
            !isExportDeclaration(node) ||
            isTypeOnlyExport(node) ||
            isAllowedExport(node, asyncFunctionBindings, assignedVariables, assignedVariablesBeforeExport, index) ||
            isAllowedNamedExportSpecifiers(node, asyncFunctionBindings, assignedVariables)
          ) {
            continue;
          }

          context.report({
            node,
            messageId: 'invalidExport',
          });
        }
      },
    };
  },
};
