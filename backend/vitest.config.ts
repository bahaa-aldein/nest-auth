import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // The first run may need to start an in-memory MongoDB.
    hookTimeout: 60_000,
  },
});
