// node tools/pageshot.mjs <url> <out.png> [width] — снимок всей страницы в headless Chrome (без зависимостей).
// Нужен для проверки рисунков техники глазами: tools/anim-preview.html?ids=…
import {spawn} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const [URL, OUT, WIDTH = '1100'] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Порт выбирает сам Chrome (0) и пишет его в DevToolsActivePort — несколько снимков параллельно не мешают друг другу.
const dir = mkdtempSync(join(tmpdir(), 'shot-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--hide-scrollbars', '--user-data-dir=' + dir, 'about:blank'], {stdio: 'ignore'});
try {
  let tabs, port;
  for (let i = 0; i < 60 && !tabs; i++) {
    try {port = port || readFileSync(join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0]; tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();} catch (e) {await sleep(250);}
  }
  if (!tabs) throw new Error('Chrome не запустился');
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), logs = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) {pend.get(d.id)(d); pend.delete(d.id);}
    if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  };
  const send = (method, params = {}) => new Promise(r => {const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params}));});
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {width: +WIDTH, height: 800, deviceScaleFactor: 1, mobile: false});
  await send('Page.enable');
  await send('Page.navigate', {url: URL});
  await sleep(1500);
  const h = (await send('Runtime.evaluate', {expression: 'document.documentElement.scrollHeight', returnByValue: true})).result.result.value;
  await send('Emulation.setDeviceMetricsOverride', {width: +WIDTH, height: Math.min(h, 16000), deviceScaleFactor: 1, mobile: false});
  await sleep(300);
  const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
  writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
  console.log('wrote', OUT, logs.length ? 'ERRORS: ' + logs.join(' | ') : '');
  ws.close();
} finally {chrome.kill();}
