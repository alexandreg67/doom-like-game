import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@doom-like/effects': new URL('./src/index.ts', import.meta.url).pathname
    }
  }
});