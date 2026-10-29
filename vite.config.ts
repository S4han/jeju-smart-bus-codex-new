import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  // User approved browser delivery of this public identifier; never inject a secret.
  define: { __NAVER_MAP_CLIENT_ID__: JSON.stringify(loadEnv(mode, '.', 'VITE_NAVER_MAP_CLIENT_ID').VITE_NAVER_MAP_CLIENT_ID ?? '') },
  build: { modulePreload: false, rolldownOptions: { input: 'app.html' } },
  plugins: [{
    name: 'app-entry',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const incoming = request as unknown as { url?: string };
        if (incoming.url === '/' || incoming.url === '/index.html') incoming.url = '/app.html';
        next();
      });
    },
  }],
  server: { headers: { 'Cache-Control': 'no-store' }, proxy: { '/api': 'http://127.0.0.1:8765' } },
  preview: { headers: { 'Cache-Control': 'no-store' }, proxy: { '/api': 'http://127.0.0.1:8765' } },
}));
