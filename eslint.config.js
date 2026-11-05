import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/.nuxt/',
      '**/.output/',
      '**/.data/',
      '.scratch/',
      '.claude/skills/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // packages/core holds domain logic only: no I/O and no app frameworks (CLAUDE.md, ADR 8).
    files: ['packages/core/src/**/*.ts'],
    languageOptions: { globals: { ...globals['shared-node-browser'] } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^node:', message: 'packages/core does no I/O; keep Node APIs in apps/api.' },
            {
              regex: '^(fs|path|os|http|https|net|child_process|crypto)(/|$)',
              message: 'packages/core does no I/O; keep Node APIs in apps/api.',
            },
            {
              regex: '^(hono|@hono/|nuxt|#app|drizzle-orm|drizzle-kit|postgres$|@electric-sql/)',
              message: 'packages/core must not depend on Hono, Nuxt or Drizzle.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'packages/core does no I/O.' },
        { name: 'process', message: 'packages/core does no I/O.' },
      ],
    },
  },
  {
    // Nuxt auto-imports components, so single-word names like <Card> are fine.
    files: ['apps/web/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    // `@myvgc/core` loads Showdown's data (about 900 KB gzipped). The web app gets display
    // names from the API and imports only the light entry point.
    files: ['apps/web/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@myvgc/core',
              message:
                "Import from '@myvgc/core/schema'; the full entry point is too heavy for the browser.",
            },
          ],
        },
      ],
    },
  },
  {
    // shadcn-vue registry code: kept as generated so it can be re-added from the registry.
    files: ['apps/web/app/components/ui/**/*.vue'],
    rules: { 'vue/require-default-prop': 'off' },
  },
  {
    // Nuxt auto-imports (defineNuxtConfig, $fetch, ...) are checked by `nuxt typecheck`.
    files: ['apps/web/**/*.{ts,vue}'],
    rules: { 'no-undef': 'off' },
  },
  prettier,
)
