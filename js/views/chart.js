// Линейный график с точками рекордов и линией цели (SVG строкой).
import {r1, fmtD, esc} from '../format.js';

let gidN = 0;
export function chart(pts, label, goal) {
  if (pts.length < 2) return `<div class="chart"><p class="empty">${pts.length ? 'Ещё одна запись — и появится график' : 'Пока нет данных'}</p></div>`;
  const Wd = 340, H = 190, pl = 38, pr = 12, pt = 16, pb = 28;
  const ys = goal ? [...pts.map(x => x.y), goal] : pts.map(x => x.y);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  const pad = (mx - mn) * 0.15 || 1; mn -= pad; mx += pad;
  const X = i => pl + i * (Wd - pl - pr) / (pts.length - 1), Y = v => pt + (mx - v) / (mx - mn) * (H - pt - pb);
  let line = `M${X(0)},${Y(pts[0].y)}`;
  for (let i = 1; i < pts.length; i++) {const x0 = X(i - 1), y0 = Y(pts[i - 1].y), x1 = X(i), y1 = Y(pts[i].y), cx = (x0 + x1) / 2; line += `C${cx},${y0} ${cx},${y1} ${x1},${y1}`;}
  const ticks = [mx - pad, (mx + mn) / 2, mn + pad].map(r1), gid = 'g' + (++gidN);
  return `<div class="chart"><svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(label)}">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F5C842" stop-opacity=".32"/><stop offset="1" stop-color="#F5C842" stop-opacity="0"/></linearGradient></defs>
  ${ticks.map(t => `<line x1="${pl}" x2="${Wd - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2C493C" stroke-dasharray="3 5"/><text x="${pl - 8}" y="${Y(t) + 4}" font-size="12" font-weight="600" fill="#A3B8AD" text-anchor="end">${t}</text>`).join('')}
  ${goal ? `<line x1="${pl}" x2="${Wd - pr}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="#6BC28A" stroke-width="2" stroke-dasharray="7 5"/><text x="${Wd - pr}" y="${Y(goal) - 7}" font-size="12" font-weight="700" fill="#6BC28A" text-anchor="end">цель ${goal}</text>` : ''}
  <path d="${line}L${X(pts.length - 1)},${H - pb}L${pl},${H - pb}Z" fill="url(#${gid})"/>
  <path d="${line}" fill="none" stroke="#F5C842" stroke-width="3" stroke-linecap="round"/>
  ${pts.map((q, i) => `<circle cx="${X(i)}" cy="${Y(q.y)}" r="${q.pr ? 6 : 4}" fill="${q.pr ? '#F5C842' : '#15261F'}" stroke="#F5C842" stroke-width="2.5"/>`).join('')}
  <text x="${pl}" y="${H - 7}" font-size="12" font-weight="600" fill="#A3B8AD">${fmtD(pts[0].d)}</text><text x="${Wd - pr}" y="${H - 7}" font-size="12" font-weight="600" fill="#A3B8AD" text-anchor="end">${fmtD(pts.at(-1).d)}</text>
  </svg></div>`;
}
