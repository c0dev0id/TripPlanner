import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

// The app page is served by PHP at /app; Vite builds into public/build (a path no page route
// uses) and the PHP template reads the manifest for the asset names. In development the PHP
// template loads from the dev server instead.
export default defineConfig({
  root: 'frontend',
  base: '/build/',
  plugins: [solid()],
  server: {
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:5173',
  },
  build: {
    target: 'es2022',
    outDir: '../public/build',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: fileURLToPath(new URL('frontend/main.tsx', import.meta.url)),
    },
    // MapLibre alone is about 1 MB minified.
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
  },
});
