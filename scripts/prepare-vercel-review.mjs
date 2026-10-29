import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
// Publish only the identifier-free standalone preview, never the runtime dist or local API.
const html = await readFile('web-preview.html', 'utf8');
if (!html.includes('data-static-preview="true"') || !html.includes("connect-src 'none'"))
  throw new Error('Standalone review boundary missing');
for (const name of ['VITE_NAVER_MAP_CLIENT_ID', 'JEJU_BUS_API_KEY']) {
  const value = process.env[name];
  if (value && html.includes(value)) throw new Error('Configured value detected in review output');
}
await rm('review-dist', { recursive: true, force: true });
await mkdir('review-dist', { recursive: true });
await writeFile('review-dist/index.html', html);
console.log('Vercel review prepared: one standalone HTML, no configured values, no live API/map access.');
