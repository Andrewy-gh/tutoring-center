import { defineConfig, globalIgnores } from 'eslint/config'
import { FlatCompat } from '@eslint/eslintrc'
import path from 'path'
import { fileURLToPath } from 'url'
import eslintConfigPrettier from 'eslint-config-prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = defineConfig(
  ...compat.extends('eslint-config-next/core-web-vitals', 'eslint-config-next/typescript'),
  { rules: eslintConfigPrettier.rules },
  {
    files: ['app/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
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
    rules: {
      'no-console': 'warn' as const,
    },
  },
  {
    files: ['app/**/route.ts', 'lib/db/**/*.ts', 'lib/data/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])
)

export default eslintConfig
