import { defineConfig } from 'vite';

export default defineConfig({
  build: { modulePreload: false },
  server: { headers: { 'Cache-Control': 'no-store' }, proxy: { '/api': 'http://127.0.0.1:8765' } },
  preview: { headers: { 'Cache-Control': 'no-store' }, proxy: { '/api': 'http://127.0.0.1:8765' } },
});
