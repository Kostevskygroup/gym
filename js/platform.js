// Возможности iPhone и браузера: экран «Домой», звук, отклик, экран не гаснет, офлайн, файлы.
export const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// ---- звук: AudioContext создаём и «будим» только по нажатию, иначе iOS молчит ----
let ctx = null;
export function unlockAudio() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'transient') navigator.audioSession.type = 'transient';
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') ctx.resume();
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
  } catch (e) {console.warn('audio unlock', e);}
}
export function beep() {
  if (!ctx) return;
  try {
    if (ctx.state !== 'running') ctx.resume();
    [0, 0.22, 0.44].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) {console.warn('beep', e);}
}

// ---- отклик: на Android — вибрация, на iOS 18+ — системный отклик переключателя (только по нажатию) ----
let hapticLabel = null;
export function haptic(pattern = 10) {
  try {
    if ('vibrate' in navigator) {navigator.vibrate(pattern); return;}
    if (!isIOS()) return;
    if (!hapticLabel) {
      hapticLabel = document.createElement('label');
      hapticLabel.setAttribute('aria-hidden', 'true');
      hapticLabel.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0';
      const i = document.createElement('input');
      i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      hapticLabel.append(i);
      document.body.append(hapticLabel);
    }
    hapticLabel.click();
  } catch (e) {}
}

// ---- экран не гаснет, пока идёт тренировка ----
let lock = null, wantLock = false;
export const wakeLockSupported = () => 'wakeLock' in navigator;
export async function keepAwake(on) {
  wantLock = on;
  try {
    if (on && !lock && wakeLockSupported() && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => {lock = null;});
    } else if (!on && lock) {await lock.release(); lock = null;}
  } catch (e) {console.warn('wake lock', e);}
}
document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible' && wantLock) keepAwake(true);});

// ---- хранилище не очищается системой ----
export async function persistStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return 'unknown';
    if (await navigator.storage.persisted()) return 'yes';
    return (await navigator.storage.persist()) ? 'yes' : 'no';
  } catch (e) {return 'unknown';}
}

// ---- офлайн и обновления ----
export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {if (reloading) location.reload();});
  navigator.serviceWorker.register('./sw.js', {scope: './'}).then(reg => {
    const offer = w => onUpdate(() => {reloading = true; w.postMessage('skip');});
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => {if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);});
    });
    document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible') reg.update().catch(() => {});});
  }).catch(e => console.warn('sw', e));
}

// ---- файл: на iPhone — меню «Поделиться» (Сохранить в Файлы / iCloud), иначе — скачивание ----
export function saveFile(name, text, type = 'application/json') {
  const f = new File([text], name, {type});
  if (navigator.canShare && navigator.canShare({files: [f]})) return navigator.share({files: [f]}).then(() => 'shared');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return Promise.resolve('downloaded');
}
export function pickFile(accept) {
  return new Promise(res => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = accept;
    i.onchange = () => res(i.files && i.files[0] ? i.files[0] : null);
    i.click();
  });
}
