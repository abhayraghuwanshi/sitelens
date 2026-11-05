import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';

// Follows the API server's PORT, so dev can run next to the desktop app on 4318.
const api = `http://127.0.0.1:${process.env.PORT || 4318}`;

export default defineConfig({
  root: 'web',
  plugins: [preact()],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared/sitelens', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: ['..'] },
    proxy: { '/api': api, '/auth': api },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
