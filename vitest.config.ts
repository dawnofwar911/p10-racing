import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.vitest.test.{ts,tsx}'],
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', '.next/**', 'out/**'],
    },
  },
});
