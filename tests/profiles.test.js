import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
  key: i => [...mem.keys()][i],
  get length() {return mem.size;},
};
const store = await import('../js/store.js');
const {emptyDB} = await import('../js/backup.js');

beforeEach(() => {mem.clear(); store.load();});

test('the existing data is the main profile and keeps its storage keys', () => {
  mem.set('gym.db', JSON.stringify({...emptyDB(), goal: 90}));
  store.load();
  assert.equal(store.activeProfile(), 'main');
  assert.equal(store.state.db.goal, 90);
  assert.deepEqual(store.profiles().map(p => p.id), ['main']);
});

test('a new profile starts empty and has its own data', () => {
  store.setDB({...store.state.db, goal: 90});
  const id = store.addProfile('Ксюша', {knee: false});
  assert.equal(store.activeProfile(), id);
  assert.equal(store.state.db.goal, null);
  assert.equal(store.state.db.settings.name, 'Ксюша');
  assert.deepEqual(store.state.db.settings.pain, []);
  store.setDB({...store.state.db, goal: 60});
  store.switchProfile('main');
  assert.equal(store.state.db.goal, 90);
  store.switchProfile(id);
  assert.equal(store.state.db.goal, 60);
});

test('drafts are per profile', () => {
  store.patchDraft('p1|А', c => ({...c, start: 1}));
  const id = store.addProfile('Гость');
  assert.equal(store.state.dr['p1|А'], undefined);
  store.switchProfile('main');
  assert.equal(store.state.dr['p1|А'].start, 1);
});

test('rename and delete; the main profile cannot be deleted', () => {
  const id = store.addProfile('Гость');
  store.renameProfile(id, 'Друг');
  assert.equal(store.profiles().find(p => p.id === id).name, 'Друг');
  assert.equal(store.deleteProfile('main'), false);
  store.switchProfile('main');
  assert.equal(store.deleteProfile(id), true);
  assert.deepEqual(store.profiles().map(p => p.id), ['main']);
  assert.ok(![...mem.keys()].some(k => k.includes(id)));
});

test('deleting the active profile switches back to main', () => {
  const id = store.addProfile('Гость');
  store.deleteProfile(id);
  assert.equal(store.activeProfile(), 'main');
});

test('profile names are trimmed and limited', () => {
  assert.throws(() => store.addProfile('   '), /имя/i);
  const id = store.addProfile('x'.repeat(80));
  assert.ok(store.profiles().find(p => p.id === id).name.length <= 24);
});
