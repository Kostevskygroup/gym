// Живая картинка техники в шторке «Техника»: повтор в темпе «подъём — пауза — опускание», нажатие — пауза.
// При «Уменьшении движения» в системе — два неподвижных кадра: старт и финиш.
import {frameSvg, viewBox} from './draw.js';
import {lerpPose, phaseAt} from './rig.js';
import {moveFor} from '../data/moves.js';

const FRAME_MS = 33; // ~30 кадров в секунду: плавно и бережёт батарею
const LABELS = {rep: ['Старт', 'Финиш'], fast: ['Старт', 'Финиш'], hold: ['Держи', 'Держи']};
let seq = 0;

const reduced = () => {try {return matchMedia('(prefers-reduced-motion: reduce)').matches;} catch (e) {return false;}};

// Разметка блока; '' — если для упражнения нет движения (своё упражнение и т. п.).
export function moveHtml(id, e) {
  const m = moveFor(id, e);
  if (!m) return '';
  const [la, lb] = m.la ? [m.la, m.lb || m.la] : LABELS[m.tempo] || LABELS.rep;
  const hold = m.tempo === 'hold';
  return `<div class="mv" data-mv="${id}" role="img" aria-label="Анимация техники">
    <div class="mvs"></div>
    ${hold ? '<div class="mvl one"><span>Удерживай положение — дыши ровно</span></div>' : `<div class="mvl"><span data-st="a">${la}</span><i><b></b></i><span data-st="b">${lb}</span></div>`}
    <button class="mvp" type="button" aria-label="Пауза">❚❚</button></div>`;
}

// Запускает анимацию в root (элемент .mv). Возвращает функцию остановки — вызвать при закрытии шторки.
export function mountMove(root, id, e) {
  const m = moveFor(id, e), box = root && root.querySelector('.mvs');
  if (!m || !box) return () => {};
  const uid = 'mv' + (++seq), mid = lerpPose(m.a, m.b, 0.5), vb = viewBox(m, [m.a, mid, m.b]);
  const bar = root.querySelector('.mvl b'), la = root.querySelector('[data-st=a]'), lb = root.querySelector('[data-st=b]');
  if (reduced()) {
    box.classList.add('two');
    box.innerHTML = frameSvg(m, m.a, 0, uid + 'a', vb) + frameSvg(m, m.b, 1, uid + 'b', vb);
    root.querySelector('.mvp')?.remove();
    return () => {};
  }
  let raf = 0, last = 0, t0 = performance.now(), paused = false, pausedAt = 0;
  const draw = now => {
    const {k, stage} = phaseAt(now - t0, m.tempo);
    box.innerHTML = frameSvg(m, lerpPose(m.a, m.b, k), k, uid, vb);
    if (bar) bar.style.width = (k * 100).toFixed(1) + '%';
    if (la) la.classList.toggle('on', stage === 'bottom' || stage === 'down');
    if (lb) lb.classList.toggle('on', stage === 'top' || stage === 'up');
  };
  const tick = now => {
    raf = requestAnimationFrame(tick);
    if (now - last < FRAME_MS) return;
    last = now;
    draw(now);
  };
  const play = () => {if (!raf) raf = requestAnimationFrame(tick);};
  const stop = () => {cancelAnimationFrame(raf); raf = 0;};
  const btn = root.querySelector('.mvp');
  const toggle = () => {
    paused = !paused;
    if (paused) {pausedAt = performance.now(); stop();} else {t0 += performance.now() - pausedAt; play();}
    root.classList.toggle('paused', paused);
    if (btn) {btn.textContent = paused ? '▶' : '❚❚'; btn.setAttribute('aria-label', paused ? 'Продолжить' : 'Пауза');}
  };
  root.onclick = toggle;
  const vis = () => {if (document.hidden) stop(); else if (!paused) play();};
  document.addEventListener('visibilitychange', vis);
  draw(t0);
  play();
  return () => {stop(); document.removeEventListener('visibilitychange', vis); root.onclick = null;};
}
