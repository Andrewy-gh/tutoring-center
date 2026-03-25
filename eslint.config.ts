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
    rules: {
      'no-console': 'warn' as const,
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts'])
)

export default eslintConfig
