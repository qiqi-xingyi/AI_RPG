import { build } from 'esbuild';
import { mkdir, cp, writeFile, rm, readFile } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await build({ entryPoints: ['cloud/worker.mjs'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', external: ['node:crypto'], sourcemap: false });
await cp('public', 'dist/client', { recursive: true });
await writeFile('dist/server/wrangler.json', JSON.stringify({ name: 'storybound-playtest', main: 'index.js', compatibility_date: '2026-10-07', compatibility_flags: ['nodejs_compat'], assets: { directory: '../client', binding: 'ASSETS', run_worker_first: ['/api/*','/health'] } }, null, 2));
let hosting;
try { hosting = JSON.parse(await readFile('.openai/hosting.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; hosting = { d1: 'DB', r2: null }; }
await writeFile('dist/.openai/hosting.json', JSON.stringify(hosting, null, 2));
console.log('Cloud Worker and game assets built. No runtime secrets included.');
