import { defineConfig, globalIgnores } from 'eslint/config'
import { FlatCompat } from '@eslint/eslintrc'
import path from 'path'
import { fileURLToPath } from 'url'
import { noInvalidUseServerExports } from './eslint-rules/no-invalid-use-server-exports.js'
import eslintConfigPrettier from 'eslint-config-prettier'
import { noUntrackedTypeAssertions } from './eslint-rules/no-untracked-type-assertions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = defineConfig(
  ...compat.extends('eslint-config-next/core-web-vitals', 'eslint-config-next/typescript'),
  { rules: eslintConfigPrettier.rules },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message: 'Use unknown only at route handlers or DB loading boundaries.',
        },
      ],
    },
  },
  {
    plugins: {
      local: {
        rules: {
          'no-invalid-use-server-exports': noInvalidUseServerExports,
          'no-untracked-type-assertions': noUntrackedTypeAssertions,
        },
      },
    },
    rules: {
      'no-console': 'warn' as const,
      'local/no-invalid-use-server-exports': 'error',
      'local/no-untracked-type-assertions': 'error',
    },
  },
  {
    files: ['app/**/route.ts', 'db/**/*.ts', 'features/**/*-service.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])
)

export default eslintConfig
