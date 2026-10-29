import { readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build, createServer } from 'vite';
import { Script } from 'node:vm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// A standalone preview for HTML viewers that cannot transpile TSX or resolve Vite assets.
// Build separately with no map identifier; leave the runnable app's dist intact.
await build({ define: { __NAVER_MAP_CLIENT_ID__: JSON.stringify('') },
  build: { outDir: '.preview-build', emptyOutDir: true }, logLevel: 'error' });
const built = await readFile('.preview-build/app.html', 'utf8');
const scriptPath = built.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = built.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/)?.[1];
if (!scriptPath?.startsWith('/assets/') || !stylePath?.startsWith('/assets/')) throw new Error('Unexpected build layout');
const js = '(()=>{"use strict";document.documentElement.dataset.staticPreview="true";\n' +
  (await readFile(`.preview-build${scriptPath}`, 'utf8')).replace(/<\/script/gi, '<\\/script') + '\n})();';
new Script(js); // Parse as a classic script; the viewer needs no module loader.
const css = (await readFile(`.preview-build${stylePath}`, 'utf8')).replace(/<\/style/gi, '<\\/style') +
  '\n.preview-notice{margin:12px auto;padding:12px 20px;max-width:1056px;font:13px system-ui;color:#425c4a;background:#eaf1e4;border-radius:10px}';
// Include the real initial screen even when the viewer disables script execution.
const renderer = await createServer({ appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false } });
let initialScreen;
try {
  const { App } = await renderer.ssrLoadModule('/src/App.tsx');
  initialScreen = renderToStaticMarkup(createElement(App));
} finally { await renderer.close(); }
const hash = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
const csp = `default-src 'none'; script-src ${hash(js)}; style-src ${hash(css)}; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html = `<!doctype html>
<html lang="ko" data-static-preview="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>제주 스마트 버스 미리보기</title><style>${css}</style></head><body><div id="root"><p class="preview-notice" role="status">화면 미리보기 · 기능이 반응하지 않으면 JavaScript 실행이 제한된 환경입니다.</p>${initialScreen}</div><script>${js}</script></body></html>`;
for (const name of ['JEJU_BUS_API_KEY', 'VITE_NAVER_MAP_CLIENT_ID']) {
  const value = process.env[name];
  if (value && value.length >= 8 && html.includes(value)) throw new Error('Configured value detected in preview');
}
await writeFile('web-preview.html', html);
await writeFile('index.html', html);
await rm('.preview-build', { recursive: true, force: true });
console.log('Root index.html and standalone web-preview.html generated; initial screen works without scripts.');
