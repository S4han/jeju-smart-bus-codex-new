import { readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'vite';

// A standalone preview for HTML viewers that cannot transpile TSX or resolve Vite assets.
// Build separately with no map identifier; leave the runnable app's dist intact.
await build({ define: { __NAVER_MAP_CLIENT_ID__: JSON.stringify('') },
  build: { outDir: '.preview-build', emptyOutDir: true }, logLevel: 'error' });
const built = await readFile('.preview-build/index.html', 'utf8');
const scriptPath = built.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = built.match(/<link\b[^>]*\bhref="([^"]+\.css)"[^>]*>/)?.[1];
if (!scriptPath?.startsWith('/assets/') || !stylePath?.startsWith('/assets/')) throw new Error('Unexpected build layout');
const js = 'document.documentElement.dataset.staticPreview="true";\n' + (await readFile(`.preview-build${scriptPath}`, 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = (await readFile(`.preview-build${stylePath}`, 'utf8')).replace(/<\/style/gi, '<\\/style');
const hash = value => `'sha256-${createHash('sha256').update(value).digest('base64')}'`;
const csp = `default-src 'none'; script-src ${hash(js)}; style-src ${hash(css)}; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html = `<!doctype html>
<html lang="ko" data-static-preview="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>제주 스마트 버스 미리보기</title><style>${css}</style></head><body><div id="root"><p role="status">화면을 불러오는 중입니다. JavaScript 실행이 허용된 미리보기에서 열어 주세요.</p></div><script type="module">${js}</script></body></html>`;
for (const name of ['JEJU_BUS_API_KEY', 'VITE_NAVER_MAP_CLIENT_ID']) {
  const value = process.env[name];
  if (value && value.length >= 8 && html.includes(value)) throw new Error('Configured value detected in preview');
}
await writeFile('web-preview.html', html);
await rm('.preview-build', { recursive: true, force: true });
console.log('Standalone web-preview.html generated; no external assets or live API enabled.');
