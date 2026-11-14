/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // src/lib/*.test.ts read the JSON contract with node:fs, so the default
    // environment is node. Component tests that need a DOM go in *.dom.test.tsx.
    environment: 'node',
    environmentMatchGlobs: [['src/**/*.dom.test.tsx', 'jsdom']],
  },
});
