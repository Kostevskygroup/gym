import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translit, loginFrom, plural, signed, ruDec} from '../js/format.js';

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
