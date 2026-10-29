import { rename } from 'node:fs/promises';
// Vite's source entry is separate from the root static preview.
await rename('dist/app.html', 'dist/index.html');
