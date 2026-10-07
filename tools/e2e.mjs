// Сквозная проверка в настоящем Chrome (без зависимостей): node tools/e2e.mjs [url]
// Проходит путь пользователя: тренировка → перезапуск → замена → пресс кругом → завершение →
// восстановление копии → прогресс → работа без сети. Падает с кодом 1 при первой ошибке.
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const URL = process.argv[2] || 'http://localhost:8767/';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9400 + Math.floor(Math.random() * 300);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (cond, msg) => {console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failed++;};

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'e2e-')), 'about:blank'], {stdio: 'ignore'});
try {
  let tabs;
  for (let i = 0; i < 60; i++) {try {tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break;} catch (e) {await sleep(250);}}
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errors = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) {pend.get(d.id)(d); pend.delete(d.id);}
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value || a.description).join(' '));
  };
  const send = (method, params = {}) => new Promise(r => {const i = ++id; pend.set(i, r); ws.send(JSON.stringify({id: i, method, params}));});
  const ev = async expr => {
    const r = await send('Runtime.evaluate', {expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true});
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result.result.value;
  };
  const W = ms => `await new Promise(r=>setTimeout(r,${ms}));`;
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 2, mobile: true});
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const open = async () => {await send('Page.navigate', {url: URL}); await sleep(1500); await ev(`window.confirm = () => true; return 1;`);};

  console.log('Запуск');
  await open();
  ok(await ev(`return document.querySelector('#v-home').innerHTML.length > 500`), 'главный экран отрисован');
  ok(await ev(`return !document.querySelector('#crash').classList.contains('on')`), 'нет экрана сбоя');

  console.log('Тренировка');
  const t = await ev(`document.querySelector('#gonow').click(); ${W(400)}
    const cards = document.querySelectorAll('#list .ex').length;
    const card = [...document.querySelectorAll('#list .ex')].find(c => c.querySelector('.set.x input[data-f=a]'));
    const slot = card.dataset.slot, inp = card.querySelector('.set.x input[data-f=a]');
    inp.value = '40'; inp.dispatchEvent(new Event('input', {bubbles: true}));
    card.querySelector('.set.x [data-act=ck]').click(); ${W(700)}
    const d = JSON.parse(localStorage.getItem('gym.draft')), k = Object.keys(d).find(x => x.includes('|'));
    return {cards, slot, k, done: d[k].ex[slot]?.[0]?.done, a: d[k].ex[slot]?.[0]?.a, timer: document.querySelector('#timer').classList.contains('on')};`);
  ok(t.cards >= 6, `карточек упражнений: ${t.cards}`);
  ok(t.done === true && t.a === 40, 'подход с весом 40 сохранён');
  ok(t.timer, 'таймер отдыха запущен');

  console.log('Перезапуск посреди тренировки');
  await open();
  const r = await ev(`return {view: document.querySelector('.view.on').id, done: document.querySelectorAll('#list .set.done').length, timer: document.querySelector('#timer').classList.contains('on')}`);
  ok(r.view === 'v-train', 'открылась идущая тренировка');
  ok(r.done >= 1, 'отмеченный подход на месте');
  ok(r.timer, 'таймер отдыха восстановлен');

  console.log('Замена тренажёра');
  const s = await ev(`for (const card of [...document.querySelectorAll('#list .ex')].filter(c => c.dataset.slot !== '${t.slot}' && !c.classList.contains('inblk'))) {
      const slot = card.dataset.slot; card.querySelector('[data-act=swap]').click(); ${W(400)}
      const alt = document.querySelector('#sheet [data-to]');
      if (!alt) {document.querySelector('#sheet [data-close]').click(); ${W(200)} continue;}
      const to = alt.dataset.to; alt.click(); ${W(400)}
      return {slot, to, swp: !!document.querySelector('#ex-' + CSS.escape(slot) + ' .swp')};
    }
    return {none: true};`);
  ok(!s.none && s.swp, s.none ? 'не нашлось упражнения с заменой' : `заменено ${s.slot} → ${s.to}`);

  console.log('Пресс кругом');
  const c = await ev(`const core = [...document.querySelectorAll('#list .ex.inblk')]; if (core.length !== 3) return {n: core.length};
    const first = core[0]; first.querySelector('.set.x [data-act=ck]').click(); ${W(700)}
    return {n: 3, head: !!document.querySelector('.circ'), timer: document.querySelector('#timer').classList.contains('on'), toast: document.querySelector('#toast').textContent};`);
  ok(c.n === 3 && c.head, 'блок пресса из 3 упражнений с заголовком');
  ok(!c.timer && /без отдыха/.test(c.toast), 'внутри круга без отдыха, подсказка куда дальше');

  console.log('Завершение');
  const f = await ev(`document.querySelector('#tstop')?.click(); document.querySelector('#finish').click(); ${W(400)}
    const knee = document.querySelector('#sheet .knees [data-v="1"]'); if (knee) knee.click(); ${W(1200)}
    const db = JSON.parse(localStorage.getItem('gym.db'));
    return {done: document.querySelector('#doneov').classList.contains('on'), n: db.sessions.length, knee: db.sessions.at(-1)?.knee};`);
  ok(f.done, 'экран итогов показан');
  ok(f.n === 1, 'тренировка сохранена');

  console.log('Восстановление из копии (старый формат)');
  const b = await ev(`document.querySelector('#d-close').click(); ${W(300)} document.querySelector('nav [data-v=body]').click(); ${W(500)}
    document.querySelector('#bpaste').click(); ${W(300)}
    document.querySelector('#pt').value = JSON.stringify({sessions: [{id: 1759000000000, date: '2026-09-28T10:00:00.000Z', phase: 'p1', wo: 'А', knee: 1, entries: {lat: [{a: 35, b: 12}]}, prs: []}], bw: [{date: '2026-09-28T08:00:00.000Z', kg: 102}], waist: [], goal: 90, phase: 'p1', wo: 'А', ach: {}});
    document.querySelector('#ptgo').click(); ${W(900)}
    const db = JSON.parse(localStorage.getItem('gym.db'));
    return {n: db.sessions.length, bw: db.bw.length};`);
  ok(b.n === 2 && b.bw === 1, 'копия добавлена, ничего не удалено');

  console.log('Прогресс');
  const p = await ev(`document.querySelector('nav [data-v=prog]').click(); ${W(400)}
    const hist = document.querySelectorAll('#v-prog details.hist').length; document.querySelector('[data-edit]').click(); ${W(300)}
    return {hist, edit: document.querySelector('#sheetov').classList.contains('on')};`);
  ok(p.hist === 2, 'история: 2 тренировки');
  ok(p.edit, 'правка тренировки открывается');

  console.log('Профили');
  const pr = await ev(`document.querySelector('nav [data-v=home]').click(); ${W(400)}
    document.querySelector('#profbtn').click(); ${W(400)}
    document.querySelector('#pname').value = 'Гость'; document.querySelector('#padd').click(); ${W(800)}
    const guest = {name: document.querySelector('#v-home .pt small').textContent, hist: JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('gym.db@'))) || '{"sessions":[]}').sessions.length};
    document.querySelector('#profbtn').click(); ${W(400)}
    document.querySelector('#sheet [data-pid="main"]').click(); ${W(800)}
    const main = JSON.parse(localStorage.getItem('gym.db')).sessions.length;
    return {guest, main, home: document.querySelector('#v-home').innerHTML.length > 500, kneeOff: true};`);
  ok(/Гость/.test(pr.guest.name) && pr.guest.hist === 0, 'новый профиль «Гость» — пустой, со своим именем');
  ok(pr.main === 2 && pr.home, 'вернулся к основному профилю — обе тренировки на месте');

  console.log('Без сети');
  const sw = await ev(`if (!navigator.serviceWorker) return false; await navigator.serviceWorker.ready; ${W(1500)} return (await caches.keys()).length > 0;`);
  ok(sw, 'офлайн-кэш установлен');
  await send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  await open();
  const off = await ev(`return {home: (document.querySelector('.view.on')?.innerHTML.length || 0) > 300, imgs: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length}`);
  ok(off.home, 'без сети открывается');
  ok(off.imgs === 0, 'фото без сети загружаются');
  await send('Network.emulateNetworkConditions', {offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1});

  const real = errors.filter(e => !/serviceWorker|Failed to fetch|net::ERR_INTERNET_DISCONNECTED/i.test(e));
  ok(!real.length, 'ошибок в консоли нет' + (real.length ? ': ' + real.slice(0, 3).join(' | ') : ''));
  ws.close();
} catch (e) {
  console.error('  ✗ сбой проверки:', e.message);
  failed++;
} finally {chrome.kill();}
console.log(failed ? `\nПровалено проверок: ${failed}` : '\nВсё прошло');
process.exit(failed ? 1 : 0);
