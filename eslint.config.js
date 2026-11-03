import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/node_modules/', '**/dist/', '**/.nuxt/', '**/.output/', '**/.data/', '.scratch/'],
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
    // Nuxt auto-imports components, so single-word names like <Card> are fine.
    files: ['apps/web/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  {
    // Nuxt auto-imports (defineNuxtConfig, $fetch, ...) are checked by `nuxt typecheck`.
    files: ['apps/web/**/*.{ts,vue}'],
    rules: { 'no-undef': 'off' },
  },
  prettier,
)
