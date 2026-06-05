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

function isAllowedExport(node) {
  if (node.type === 'ExportNamedDeclaration') {
    return isAsyncFunctionDeclaration(node.declaration);
  }

  if (node.type === 'ExportDefaultDeclaration') {
    return isAsyncFunctionDeclaration(node.declaration) || isAsyncFunctionExpression(node.declaration);
  }

  return false;
}

function isExportDeclaration(node) {
  return node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' || node.type === 'ExportAllDeclaration';
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

        for (const node of program.body) {
          if (!isExportDeclaration(node) || isAllowedExport(node)) {
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
