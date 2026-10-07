import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveAccount, seal, open, normName} from '../js/sync-crypto.js';

test('same name and password give the same account on any phone; name is case-insensitive', async () => {
  const a = await deriveAccount('Ксюша', 'секрет123'), b = await deriveAccount('  ксюша ', 'секрет123');
  assert.equal(a.userId, b.userId);
  assert.equal(a.token, b.token);
  assert.equal(a.userId.length, 32);
  assert.equal(a.token.length, 64);
});

test('different password → different token, same user id', async () => {
  const a = await deriveAccount('Слава', 'пароль-1'), b = await deriveAccount('Слава', 'пароль-2');
  assert.equal(a.userId, b.userId);
  assert.notEqual(a.token, b.token);
});

test('sealed data round-trips and the server cannot read it', async () => {
  const {key} = await deriveAccount('Слава', 'пароль-1');
  const box = await seal({sessions: [{id: 1, note: 'жим 100 кг'}]}, key);
  assert.ok(!JSON.stringify(box).includes('жим'));
  assert.deepEqual(await open(box, key), {sessions: [{id: 1, note: 'жим 100 кг'}]});
});

test('wrong password cannot decrypt', async () => {
  const {key} = await deriveAccount('Слава', 'пароль-1'), other = await deriveAccount('Слава', 'пароль-2');
  const box = await seal({a: 1}, key);
  await assert.rejects(open(box, other.key), /пароль/);
});

test('weak input is refused', async () => {
  await assert.rejects(deriveAccount('С', 'пароль-1'), /Имя/);
  await assert.rejects(deriveAccount('Слава', '123'), /Пароль/);
  assert.equal(normName('  Ксюша  Иванова '), 'ксюша иванова');
});
