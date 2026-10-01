// Gera dist/index.html, um arquivo só com tudo embutido, e mede de onde vem
// cada byte: a biblioteca, o código do jogo, a arte crua e o imposto do base64.
import { build } from 'esbuild';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const pngs = readdirSync('assets').filter(f => f.endsWith('.png')).sort();
const art = pngs.map(f => {
  const raw = readFileSync(`assets/${f}`);
  return { name: f.replace(/\.png$/, ''), raw: raw.length, uri: `data:image/png;base64,${raw.toString('base64')}` };
});
writeFileSync('src/assets.gen.js',
  `export default {\n${art.map(a => `  ${a.name}: '${a.uri}',`).join('\n')}\n};\n`);

// LEAN=1: um renderizador só. O autoDetectRenderer do Pixi importa WebGL,
// WebGPU e Canvas; num playable, WebGL cobre todo aparelho que roda o anúncio.
const lean = process.env.LEAN === '1';
const webglOnly = {
  name: 'webgl-only',
  setup(b) {
    b.onResolve({ filter: /\/(gpu\/WebGPURenderer|canvas\/CanvasRenderer)\.mjs$/ }, a =>
      a.importer.endsWith('autoDetectRenderer.mjs') ? { path: a.path, namespace: 'stub' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const WebGPURenderer = null, CanvasRenderer = null;' }));
  },
};

const result = await build({
  entryPoints: ['src/main.js'],
  plugins: lean ? [webglOnly] : [],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  metafile: true,
  write: false,
  legalComments: 'none',
});

const js = result.outputFiles[0].text;
const inputs = Object.values(result.metafile.outputs)[0].inputs;
const sum = test => Object.entries(inputs).filter(([p]) => test(p)).reduce((n, [, v]) => n + v.bytesInOutput, 0);
const pixi = sum(p => p.includes('node_modules/'));
const assetsJs = sum(p => p.endsWith('assets.gen.js'));
const game = sum(p => p.startsWith('src/') && !p.endsWith('assets.gen.js'));

const html = `<!doctype html><html><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">` +
  `<title>Bunny Hop</title><style>html,body{margin:0;height:100%;background:#0d1b2a;` +
  `display:flex;align-items:center;justify-content:center;overflow:hidden}</style></head>` +
  `<body><script type="module">${js.replace(/<\/script/g, '<\\/script')}</script></body></html>`;
mkdirSync('dist', { recursive: true });
const out = lean ? 'dist/index.webgl.html' : 'dist/index.html';
writeFileSync(out, html);

const total = Buffer.byteLength(html);
const artRaw = art.reduce((n, a) => n + a.raw, 0);
const kb = n => `${(n / 1024).toFixed(1)} KB`;
const pct = n => `${((n / total) * 100).toFixed(1)}%`;
const rows = [
  ['PixiJS (tree-shaken, minified)', pixi],
  ['game code', game],
  [`art, base64 (${art.length} PNGs, ${kb(artRaw)} raw)`, assetsJs],
  ['HTML shell', total - pixi - game - assetsJs],
];
console.log(`\n${out}  ${kb(total)}  (${total} bytes)\n`);
for (const [k, v] of rows) console.log(`  ${k.padEnd(44)} ${kb(v).padStart(10)}  ${pct(v).padStart(6)}`);
console.log(`\n  base64 tax on the art: +${kb(assetsJs - artRaw)} (${((assetsJs / artRaw - 1) * 100).toFixed(1)}%)`);
for (const [net, cap] of [['Meta, single HTML', 2 * 1024 * 1024], ['Mintegral', 4 * 1024 * 1024], ['AppLovin / Google', 5 * 1024 * 1024]])
  console.log(`  ${net.padEnd(20)} cap ${kb(cap).padStart(9)}  used ${((total / cap) * 100).toFixed(1)}%`);
const gz = gzipSync(html, { level: 9 }).length;
const br = brotliCompressSync(html, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
console.log(`\n  on the wire, if served: gzip ${kb(gz)}, brotli ${kb(br)} (the networks cap the file, not the transfer)\n`);

writeFileSync(lean ? 'dist/report.webgl.json' : 'dist/report.json', JSON.stringify({ total, pixi, game, artBase64: assetsJs, artRaw, files: art.map(({ name, raw }) => ({ name, raw })), gzip: gz, brotli: br }, null, 2));
