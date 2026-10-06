// Обложки для своих упражнений без фото тренажёра: первое своё фото.
// Кэш ссылок на blob, чтобы отрисовка карточек оставалась синхронной.
import {allPhotos} from '../photos.js';

let covers = {};
export const ownCover = id => covers[id] || null;
// Старые ссылки освобождаем позже: карточки на экране ещё могут их показывать.
export async function refreshCovers() {
  const old = Object.values(covers), next = {};
  try {
    (await allPhotos()).sort((a, b) => a.ts - b.ts).forEach(p => {if (!next[p.ex]) next[p.ex] = URL.createObjectURL(p.blob);});
  } catch (e) {console.warn('photos unavailable', e);}
  covers = next;
  setTimeout(() => old.forEach(u => URL.revokeObjectURL(u)), 5000);
}
