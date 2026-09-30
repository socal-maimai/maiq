import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['typescript', 'import', 'unicorn', 'oxc'],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    perf: 'error',
  },
  rules: {
    'import/no-cycle': 'error',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['./*', '../*', '!./$types'],
            message: 'Use absolute imports: the package name (@maiq/core/geo) or $lib/...',
          },
        ],
      },
    ],
  },
  ignorePatterns: ['**/.svelte-kit/**', '**/build/**', 'packages/db/migrations/**'],
})
