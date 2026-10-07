// Иллюстрация техники в шторке «Техника»: две картинки — «Старт» → «Финиш» (для удержаний — одна).
import {frameSvg, viewBox} from './draw.js';
import {moveFor} from '../data/moves.js';

const LABELS = ['Старт', 'Финиш'];
let seq = 0;

// Разметка блока; '' — если для упражнения нет рисунка (своё упражнение и т. п.).
export function moveHtml(id, e) {
  const m = moveFor(id, e);
  if (!m) return '';
  const uid = 'mv' + (++seq), vb = viewBox(m, [m.a, m.b]), [la, lb] = m.la ? [m.la, m.lb || m.la] : LABELS;
  if (m.tempo === 'hold') {
    return `<div class="mv one" role="img" aria-label="Положение: ${la}"><figure>${frameSvg(m, m.a, 0, uid, vb)}<figcaption>Удерживай положение</figcaption></figure></div>`;
  }
  return `<div class="mv" role="img" aria-label="Иллюстрация: ${la} и ${lb}">
    <figure>${frameSvg(m, m.a, 0, uid + 'a', vb)}<figcaption>1 · ${la}</figcaption></figure>
    <span class="mva" aria-hidden="true">→</span>
    <figure>${frameSvg(m, m.b, 1, uid + 'b', vb)}<figcaption>2 · ${lb}</figcaption></figure></div>`;
}
