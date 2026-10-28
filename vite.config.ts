import { defineConfig } from 'vite';

export default defineConfig({
  build: { modulePreload: false },
  server: { headers: { 'Cache-Control': 'no-store' } },
  preview: { headers: { 'Cache-Control': 'no-store' } },
});
