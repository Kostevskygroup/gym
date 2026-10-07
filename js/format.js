// Форматирование чисел, дат и текста. Без DOM — тестируется в node.
export const DAY = 864e5;
export const UNIT = {w: 'кг', r: 'повт', t: 'с', c: 'мин'};

export const r1 = x => Math.round(x * 10) / 10;
export const plural = (n, a, b, c) => {const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c;};
export const fmtD = d => new Date(d).toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'}).replace('.', '');
export const fmtT = s => {s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');};
// Числа для экрана — по-русски: «29,5», «1 250». Для отчёта и хранения остаются точки.
export const fmtN = (x, d = 2) => x === null || x === undefined || String(x).trim() === '' || !Number.isFinite(+x) ? String(x ?? '') : Number(x).toLocaleString('ru-RU', {maximumFractionDigits: d});
// Десятичные точки в готовом тексте («29.5 кг × 10») → запятые.
export const ruDec = s => String(s ?? '').replace(/(\d)\.(\d)/g, '$1,$2');
// Знак изменения: «+1,5» / «−3,5» (настоящий минус U+2212).
export const signed = x => (x > 0 ? '+' : x < 0 ? '\u2212' : '') + fmtN(Math.abs(x), 1);
export const NNBSP = '\u202F';
export const fmtVol = v => v >= 1000 ? fmtN(r1(v / 1000), 1) + '<span>т</span>' : Math.round(v) + '<span>кг</span>';
export const fmtVolT = v => v >= 1000 ? fmtN(r1(v / 1000), 1) + NNBSP + 'т' : Math.round(v) + NNBSP + 'кг';
export const num = v => {const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : NaN;};
// «только что» / «5 мин назад» / «3 ч назад» / дата — для строк «синхронизировано …».
export const ago = (iso, now = Date.now()) => {const m = Math.round((now - Date.parse(iso)) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : fmtD(iso);};

const ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
// Всё, что ввёл пользователь (заметки, свои упражнения), выводим только через esc.
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

// Имя кириллицей → латиница: «Ксюша» → ksyusha. Остальные символы не трогаем.
const TR = {а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'};
export const translit = s => String(s ?? '').toLowerCase().replace(/[а-яё]/g, c => TR[c] ?? c);
// Логин по умолчанию из имени: латиница в нижнем регистре, без пробелов и лишних знаков.
export const loginFrom = name => translit(name).replace(/[^a-z0-9._-]/g, '');

// Код приглашения: ZAL-XXXX-XXXX (из приложения) или ZAL-XXXX-XXXX-XXXX (мастер-код владельца).
// Чиним то, что делает клавиатура телефона: регистр, пробелы, длинные тире, русские буквы-двойники, «ЗАЛ».
const LOOK = {А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X', У: 'Y', З: '3'};
const INVITE_BODY = /^ZAL([A-Z0-9]{4}){2,3}$/;
export const cleanInvite = v => {
  const s = String(v ?? '').trim().toUpperCase().replace(/^ЗАЛ/, 'ZAL').replace(/[А-ЯЁ]/g, c => LOOK[c] ?? c).replace(/[\u2010-\u2015\u2212]/g, '-');
  const body = s.replace(/[\s-]/g, '');
  // не похоже на ZAL-код — отдаём как ввели (только без краевых пробелов): пусть решает сервер
  return INVITE_BODY.test(body) ? 'ZAL-' + body.slice(3).match(/.{4}/g).join('-') : String(v ?? '').trim();
};
export const isInviteCode = v => INVITE_BODY.test(cleanInvite(v).replace(/-/g, ''));

// Дата в виде YYYY-MM-DD по местному времени — для имён файлов и сравнения дней.
export const ymd = d => {const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;};
