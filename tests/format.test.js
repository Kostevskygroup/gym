import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translit, loginFrom, plural, signed, ruDec, cleanInvite, isInviteCode} from '../js/format.js';

test('translit: Cyrillic name becomes a lowercase Latin login', () => {
  assert.equal(translit('Ксюша'), 'ksyusha');
  assert.equal(translit('Слава'), 'slava');
  assert.equal(translit('Юля Щербакова'), 'yulya scherbakova');
  assert.equal(translit('Ольга'), 'olga');
  assert.equal(translit('slava'), 'slava');
});

test('loginFrom: only [a-z0-9._-] survive; spaces and punctuation are dropped', () => {
  assert.equal(loginFrom('Ксюша'), 'ksyusha');
  assert.equal(loginFrom('Анна Мария'), 'annamariya');
  assert.equal(loginFrom('Slava K.'), 'slavak.');
  assert.equal(loginFrom('Я'), 'ya');
  assert.equal(loginFrom(''), '');
  assert.equal(loginFrom(null), '');
});

test('plural / signed / ruDec', () => {
  assert.equal(plural(1, 'день', 'дня', 'дней'), 'день');
  assert.equal(plural(3, 'день', 'дня', 'дней'), 'дня');
  assert.equal(plural(11, 'день', 'дня', 'дней'), 'дней');
  assert.equal(signed(-3.5), '−3,5');
  assert.equal(ruDec('29.5 кг × 10'), '29,5 кг × 10');
});

test('cleanInvite: case, spaces, typographic dashes, Cyrillic look-alikes and missing dashes are fixed', () => {
  assert.equal(cleanInvite('  zal-ab2c-de3f \n'), 'ZAL-AB2C-DE3F');
  assert.equal(cleanInvite('ZAL\u2014AB2C\u2013DE3F'), 'ZAL-AB2C-DE3F');
  assert.equal(cleanInvite('зал-ав2с-dе3f'), 'ZAL-AB2C-DE3F');
  assert.equal(cleanInvite('zal ab2c de3f gh4k'), 'ZAL-AB2C-DE3F-GH4K');
  assert.equal(cleanInvite('ZALAB2CDE3F'), 'ZAL-AB2C-DE3F');
  assert.equal(cleanInvite('ZALAB2CDE3FGH4K'), 'ZAL-AB2C-DE3F-GH4K');
  assert.equal(cleanInvite(null), '');
  assert.equal(cleanInvite('  код-1 '), 'код-1', 'non-ZAL text is only trimmed, never rewritten');
});

test('isInviteCode: app codes (2 groups) and the master code (3 groups) both pass', () => {
  assert.ok(isInviteCode('ZAL-AB2C-DE3F'));
  assert.ok(isInviteCode('ZAL-AB2C-DE3F-GH4K'));
  assert.ok(isInviteCode('zal-ab2c-de3f-gh4k'));
  assert.ok(!isInviteCode(''));
  assert.ok(!isInviteCode('ZAL-AB2C'));
  assert.ok(!isInviteCode('ZAL-AB2C-DE3F-GH4K-XY5Z'));
  assert.ok(!isInviteCode('hello'));
});
