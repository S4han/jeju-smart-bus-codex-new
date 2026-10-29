import { cp, readFile, writeFile, rm } from 'node:fs/promises';
// Browser app with approved public map identifier only; no API or provider secret deployed.
await rm('review-dist', { recursive: true, force: true });
await cp('dist', 'review-dist', { recursive: true });
let html = await readFile('review-dist/index.html', 'utf8');
html = html.replace('<html lang="ko">', '<html lang="ko" data-deployment-review="true">');
if (!html.includes('data-deployment-review="true"')) throw new Error('Review API boundary missing');
await writeFile('review-dist/index.html', html);
const budget = JSON.parse(await readFile('src/data/bis-verification-budget.json', 'utf8'));
await writeFile('review-dist/deployment.json', JSON.stringify({ mode: 'map-review', mapConfigured: Boolean(process.env.VITE_NAVER_MAP_CLIENT_ID), bis: 'awaiting-budget-store', usedCheckpoint: budget.usedCheckpoint, ceiling: budget.ceiling }));
console.log('Vercel map review prepared. BIS disabled. Public map configuration present: '+Boolean(process.env.VITE_NAVER_MAP_CLIENT_ID));
