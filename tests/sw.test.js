import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assetList, versionOf, swSource} from '../tools/build-sw.js';

const root = new URL('..', import.meta.url).pathname;

test('sw.js is up to date with the app files (run `npm run build`)', () => {
  const files = assetList();
  assert.equal(readFileSync(root + 'sw.js', 'utf8'), swSource(files, versionOf(files)));
});

test('offline cache covers the page, styles, every module and every photo', () => {
  const files = assetList();
  for (const f of ['index.html', 'styles.css', 'manifest.webmanifest', 'js/app.js', 'img/legpress.jpg', 'icons/icon-180.png']) assert.ok(files.includes(f), f);
  assert.ok(!files.some(f => f.startsWith('tests/') || f.startsWith('tools/')));
});
