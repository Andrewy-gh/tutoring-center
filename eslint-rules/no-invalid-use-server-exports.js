function isUseServerDirective(node) {
  return node.type === 'ExpressionStatement' && node.directive === 'use server';
}

function hasModuleUseServerDirective(program) {
  return program.body.some(isUseServerDirective);
}

function isAsyncFunctionDeclaration(node) {
  return node?.type === 'FunctionDeclaration' && node.async;
}

function isAsyncFunctionExpression(node) {
  return (node?.type === 'FunctionExpression' || node?.type === 'ArrowFunctionExpression') && node.async;
}

function isAsyncFunctionVariableDeclaration(declaration) {
  return declaration?.id?.type === 'Identifier' && isAsyncFunctionExpression(declaration.init);
}

function isAllowedVariableDeclaration(node) {
  return node?.type === 'VariableDeclaration' && node.declarations.every(isAsyncFunctionVariableDeclaration);
}

function collectAsyncFunctionBindings(program) {
  const bindings = new Set();

  for (const node of program.body) {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;

    if (isAsyncFunctionDeclaration(declaration) && declaration.id?.name) {
      bindings.add(declaration.id.name);
      continue;
    }

    if (declaration?.type !== 'VariableDeclaration') {
      continue;
    }

    for (const variableDeclaration of declaration.declarations) {
      if (isAsyncFunctionVariableDeclaration(variableDeclaration)) {
        bindings.add(variableDeclaration.id.name);
      }
    }
  }

  return bindings;
}

function isValueExportSpecifier(specifier) {
  return specifier.exportKind !== 'type';
}

function isAllowedNamedExportSpecifiers(node, asyncFunctionBindings) {
  return (
    node.source === null &&
    node.exportKind !== 'type' &&
    node.specifiers.length > 0 &&
    node.specifiers.every(
      specifier =>
        isValueExportSpecifier(specifier) &&
        specifier.local.type === 'Identifier' &&
        asyncFunctionBindings.has(specifier.local.name)
    )
  );
}

function isAllowedExport(node) {
  if (node.type === 'ExportNamedDeclaration') {
    return isAsyncFunctionDeclaration(node.declaration) || isAllowedVariableDeclaration(node.declaration);
  }

  if (node.type === 'ExportDefaultDeclaration') {
    return isAsyncFunctionDeclaration(node.declaration) || isAsyncFunctionExpression(node.declaration);
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
    return {
      Program(program) {
        if (!hasModuleUseServerDirective(program)) {
          return;
        }

        const asyncFunctionBindings = collectAsyncFunctionBindings(program);

        for (const node of program.body) {
          if (
            !isExportDeclaration(node) ||
            isAllowedExport(node) ||
            isAllowedNamedExportSpecifiers(node, asyncFunctionBindings)
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
