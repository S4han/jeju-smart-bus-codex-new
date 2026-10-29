import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes:true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(join(dir,e.name)) : join(dir,e.name)))).flat();
}
const rules = [
  ['server environment access', /(?:process\.env|import\.meta\.env|JEJU_BUS_API_KEY|serviceKey)/],
  ['persistence or continuous location API', /(?:localStorage|sessionStorage|indexedDB|document\.cookie|\bwatchPosition\b)/],
  ['external network API', /(?:new\s+(?:WebSocket|XMLHttpRequest)|navigator\.sendBeacon)/],
];
for (const file of [...await files('src'), ...await files('dist')]) {
  if (!/\.(?:js|ts|tsx|html|css)$/.test(file)) continue;
  const source = await readFile(file,'utf8');
  if (file.startsWith('src/') && /\bfetch\s*\(/.test(source) && file !== 'src/browser/arrivals.ts')
    throw new Error(`Network API outside reviewed adapter in ${file}`);
  if (file.startsWith('src/') && /(?:\.geolocation|\bgetCurrentPosition\b)/.test(source) && file !== 'src/browser/position.ts')
    throw new Error(`Location API outside reviewed adapter in ${file}`);
  for (const [label,pattern] of rules) if (pattern.test(source)) throw new Error(`${label} found in ${file}`);
}
// Match known runtime secrets without printing their values or the matched text.
for (const name of ['JEJU_BUS_API_KEY']) {
  const value = process.env[name];
  if (!value || value.length < 8) continue;
  for (const file of await files('dist')) {
    const source = await readFile(file,'utf8');
    if (source.includes(value)) throw new Error(`Configured server value found in ${file}`);
  }
}
console.log('Client source/bundle: no configured server secret or prohibited API reference found.');
