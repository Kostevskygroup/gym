// Собирает sw.js: список файлов приложения и версию по их содержимому.
// Запускай `npm run build` перед каждой публикацией — иначе телефон не увидит обновление.
import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, relative} from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const walk = d => readdirSync(join(root, d)).flatMap(f => {const p = join(d, f); return statSync(join(root, p)).isDirectory() ? walk(p) : [p];});

export function assetList() {
  const files = ['index.html', 'styles.css', 'manifest.webmanifest', ...walk('js'), ...walk('img'), ...walk('icons').filter(f => f.endsWith('.png'))];
  return files.filter(f => !f.endsWith('.DS_Store')).map(f => relative(root, join(root, f))).sort();
}
export function versionOf(files) {
  const h = createHash('sha256');
  files.forEach(f => {h.update(f); h.update(readFileSync(join(root, f)));});
  return h.digest('hex').slice(0, 12);
}
export function swSource(files, version) {
  const tpl = readFileSync(join(root, 'tools/sw.template.js'), 'utf8');
  return tpl.replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(['./', ...files], null, 1));
}

if (process.argv[1] && process.argv[1].endsWith('build-sw.js')) {
  const files = assetList(), v = versionOf(files);
  writeFileSync(join(root, 'sw.js'), swSource(files, v));
  console.log(`sw.js: ${files.length} files, version ${v}`);
}
