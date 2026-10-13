import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TEMPLATES, templatePlan} from '../js/data/templates.js';
import {EX} from '../js/data/exercises.js';
import {EQUIP} from '../js/data/equipment.js';
import {normalizeDB, emptyDB} from '../js/backup.js';

for (const [key, t] of Object.entries(TEMPLATES)) {
  test(`template ${key}: gym exercises only, one core at the end of each day`, () => {
    for (const [ph, p] of Object.entries(t.plan)) for (const [wo, items] of Object.entries(p.w)) {
      for (const it of items) {
        assert.ok(EX[it.id], `${ph}/${wo}: нет упражнения ${it.id}`);
        assert.ok(EQUIP[EX[it.id].img], `${it.id}: не оборудование зала`);
      }
      const core = items.filter(x => x.blk === 'core');
      assert.equal(core.length, 1, `${ph}/${wo}: один пресс`);
      assert.equal(items.at(-1).blk, 'core', `${ph}/${wo}: пресс в конце`);
    }
  });

  test(`template ${key}: survives normalizeDB and is a fresh copy each time`, () => {
    const plan = templatePlan(key), db = normalizeDB({...emptyDB(), plan});
    assert.deepEqual(Object.keys(db.plan.p1.w), Object.keys(t.plan.p1.w));
    assert.equal(db.plan.p1.w[Object.keys(t.plan.p1.w)[0]].length, t.plan.p1.w[Object.keys(t.plan.p1.w)[0]].length);
    plan.p1.w[Object.keys(plan.p1.w)[0]].pop();
    assert.notEqual(templatePlan(key).p1.w[Object.keys(plan.p1.w)[0]].length, plan.p1.w[Object.keys(plan.p1.w)[0]].length);
  });
}

test('ksenia: 3 days, supersets on day 2', () => {
  const w = TEMPLATES.ksenia.plan.p1.w;
  assert.equal(Object.keys(w).length, 3);
  assert.equal(w['Спина и плечи'].filter(x => x.ss).length, 2);
});
