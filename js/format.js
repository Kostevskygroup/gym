// Форматирование чисел, дат и текста. Без DOM — тестируется в node.
export const DAY = 864e5;
export const UNIT = {w: 'кг', r: 'повт', t: 'с', c: 'мин'};

export const r1 = x => Math.round(x * 10) / 10;
export const plural = (n, a, b, c) => {const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c;};
export const fmtD = d => new Date(d).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'}).replace('.', '');
export const fmtT = s => {s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');};
export const fmtVol = v => v >= 1000 ? r1(v / 1000) + '<span> т</span>' : Math.round(v) + '<span> кг</span>';
export const fmtVolT = v => v >= 1000 ? r1(v / 1000) + ' т' : Math.round(v) + ' кг';
export const num = v => {const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : NaN;};

const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
// Всё, что ввёл пользователь (заметки, свои упражнения), выводим только через esc.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

// Дата в виде YYYY-MM-DD по местному времени — для имён файлов и сравнения дней.
export const ymd = d => {const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;};
