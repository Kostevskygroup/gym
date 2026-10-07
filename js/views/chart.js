// Линейный график: зелёная линия, золотые точки рекордов, пунктир цели (SVG строкой). Цвета — в CSS.
import {r1, fmtD, fmtN, esc} from '../format.js';

let gidN = 0;
export function chart(pts, label, goal) {
  if (pts.length < 2) return `<div class="chart"><p class="empty">${pts.length ? 'Ещё одна запись — и появится график' : 'Пока нет данных'}</p></div>`;
  const Wd = 340, H = 190, pl = 38, pr = 14, pt = 24, pb = 28;
  const ys = goal ? [...pts.map(x => x.y), goal] : pts.map(x => x.y);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  const pad = (mx - mn) * 0.15 || 1; mn -= pad; mx += pad;
  const n = pts.length, X = i => pl + i * (Wd - pl - pr) / (n - 1), Y = v => pt + (mx - v) / (mx - mn) * (H - pt - pb);
  let line = `M${X(0)},${Y(pts[0].y)}`;
  for (let i = 1; i < n; i++) {const x0 = X(i - 1), y0 = Y(pts[i - 1].y), x1 = X(i), y1 = Y(pts[i].y), cx = (x0 + x1) / 2; line += `C${cx},${y0} ${cx},${y1} ${x1},${y1}`;}
  const ticks = [mx - pad, (mx + mn) / 2, mn + pad].map(r1), gid = 'g' + (++gidN);
  const lastI = n - 1, lx = X(lastI), ly = Y(pts[lastI].y), mid = Math.floor(lastI / 2);
  const xt = [[0, 'start'], ...(n >= 3 ? [[mid, 'middle']] : []), [lastI, 'end']];
  return `<div class="chart"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(label)}">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop class="ar0" offset="0"/><stop class="ar1" offset="1"/></linearGradient></defs>
  ${ticks.map(t => `<line class="gl" x1="${pl}" x2="${Wd - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${fmtN(t, 1)}</text>`).join('')}
  ${goal ? `<line class="goal" x1="${pl}" x2="${Wd - pr}" y1="${Y(goal)}" y2="${Y(goal)}"/><text class="goalt" x="${pl + 6}" y="${Y(goal) - 7}">цель ${fmtN(goal, 1)}</text>` : ''}
  <path d="${line}L${lx},${H - pb}L${pl},${H - pb}Z" fill="url(#${gid})"/>
  <path class="ln" d="${line}"/>
  ${pts.map((q, i) => q.pr && i !== lastI ? `<circle class="pr" cx="${X(i)}" cy="${Y(q.y)}" r="3"/>` : '').join('')}
  <circle class="last${pts[lastI].pr ? ' isrec' : ''}" cx="${lx}" cy="${ly}" r="5"/>
  <text class="lv" x="${lx + 5}" y="${ly - 10}" text-anchor="end">${fmtN(pts[lastI].y, 1)}</text>
  ${xt.map(([i, a]) => `<text x="${a === 'start' ? pl : a === 'end' ? Wd - pr : X(i)}" y="${H - 7}" text-anchor="${a}">${fmtD(pts[i].d)}</text>`).join('')}
  </svg></div>`;
}
