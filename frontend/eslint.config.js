import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        __BUILD_ID__: 'readonly',
        __APP_VERSION__: 'readonly',
        process: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-undef": "error",
    },
  },
  {
    files: ['vite.config.js', 'postcss.config.js', '*.config.{js,mjs,cjs}', 'scripts/**/*.{js,mjs,cjs}', 'api/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        __BUILD_ID__: 'readonly',
        __APP_VERSION__: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/*.spec.{js,jsx}', '**/setupTests.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        vi: 'readonly',
        __BUILD_ID__: 'readonly',
        __APP_VERSION__: 'readonly',
        process: 'readonly',
      },
    },
  },
])
