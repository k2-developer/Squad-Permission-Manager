import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend listens on 4000, backend on 4005.
// Both bound to 127.0.0.1 only — exposing them publicly is intentional
// only behind a reverse proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4000,
    host: '127.0.0.1',
    // Regex keys (leading `^`) so we proxy only the namespaces and don't
    // accidentally swallow SPA routes that happen to share a prefix —
    // e.g. `/api-keys` is a React route, NOT the same as `/api/...`.
    proxy: {
      '^/api/': 'http://127.0.0.1:4005',
      '^/output/': 'http://127.0.0.1:4005',
      '^/v1/': 'http://127.0.0.1:4005',
    },
  },
});
