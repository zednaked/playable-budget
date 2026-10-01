// Smoke test: abre o build com ?autoplay num Chromium headless e espera o end
// card. Sai com 0 se ele apareceu antes do prazo, e salva um print para olhar.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:8765/index.webgl.html?autoplay';
const port = 9333;
const chrome = spawn('chromium', ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`,
  '--window-size=480,800', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0;
const pending = new Map(), errors = [];
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

await send('Runtime.enable');
await send('Page.navigate', { url });
const t0 = Date.now();
let won = false;
while (Date.now() - t0 < 60000) {
  await sleep(1000);
  // O end card é o único texto com "coins!" no palco.
  const r = await send('Runtime.evaluate', { expression: 'document.title' });
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync('dist/smoke.png', Buffer.from(shot.data, 'base64'));
  const probe = await send('Runtime.evaluate', { expression: 'window.__bunnyHopOver === true', returnByValue: true });
  if (probe.result?.value) { won = true; break; }
  void r;
}
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(won ? `end card after ${secs} s` : `no end card after ${secs} s`);
if (errors.length) console.log('errors:\n' + errors.join('\n'));
ws.close();
chrome.kill();
process.exit(won && !errors.length ? 0 : 1);
