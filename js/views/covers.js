// Обложки для своих упражнений без фото тренажёра: первое своё фото.
// Кэш ссылок на blob, чтобы отрисовка карточек оставалась синхронной.
import {allPhotos} from '../photos.js';

let covers = {};
export const ownCover = id => covers[id] || null;
export async function refreshCovers() {
  Object.values(covers).forEach(u => URL.revokeObjectURL(u));
  covers = {};
  try {
    (await allPhotos()).sort((a, b) => a.ts - b.ts).forEach(p => {if (!covers[p.ex]) covers[p.ex] = URL.createObjectURL(p.blob);});
  } catch (e) {console.warn('photos unavailable', e);}
}
