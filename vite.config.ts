import { fileURLToPath } from 'node:url';
import solid from 'vite-plugin-solid';
import { defineConfig } from 'vitest/config';

// The pages are served by PHP: the app at /app and the read-only trip page at /trips/{id}
// and /t/{token}, each from its own entry. Vite builds into public/build (a path no page
// route uses) and the PHP templates read the manifest for the asset names. In development
// the templates load from the dev server instead.
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
      input: [fileURLToPath(new URL('frontend/main.tsx', import.meta.url)), fileURLToPath(new URL('frontend/view.tsx', import.meta.url))],
    },
    // MapLibre alone is about 1 MB minified; the HEIC decoder, loaded on demand, 2 MB.
    chunkSizeWarningLimit: 2500,
  },
  test: {
    environment: 'jsdom',
  },
});
