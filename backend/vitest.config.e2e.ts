import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts', '**/*.integration-spec.ts'],
    // The first run may need to download and start an in-memory MongoDB.
    hookTimeout: 60_000,
  },
});
