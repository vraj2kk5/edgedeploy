import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'storage/origin/**/tests/suite.test.ts'],
    exclude: ['**/node_modules/**', 'storage/builds/**'],
  },
});
