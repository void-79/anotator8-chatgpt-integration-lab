import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude worktrees (parallel branches), build output, and the fixture data
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.worktrees/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc}.config.*',
    ],
    // Reasonable defaults for a small integration lab
    testTimeout: 15000,
    hookTimeout: 15000,
    include: ['tests/**/*.test.ts'],
    // Single worker — we occasionally bind to fixed ports
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
