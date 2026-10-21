import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await rm('dist', {recursive: true, force: true});
await mkdir('dist', {recursive: true});
await cp('public', 'dist', {recursive: true});
await build({entryPoints: {dashboard: 'src/ui/main.jsx', worker: 'src/worker.js'}, outdir: 'dist', bundle: true, format: 'esm', target: 'chrome120', minify: true, legalComments: 'eof', define: {'process.env.NODE_ENV': '"production"'}});
execFileSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'src/ui/styles.css', '-o', 'dist/dashboard.css', '--minify'], {stdio: 'inherit'});
