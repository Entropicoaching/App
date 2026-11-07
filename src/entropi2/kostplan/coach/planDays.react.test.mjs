import test from 'node:test'
import assert from 'node:assert/strict'
import { act } from 'react'
import { withDatabase, mounted, date, coachId, athleteId, names } from './generatorSql.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'
import { draftKey } from './portalModel.mjs'
import { FOODS } from '../foedevarer/index.mjs'

const nextDay = n => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const props = n => {
  const key = Object.keys(n ?? {}).find(k => k.startsWith('__reactProps$'))
  assert.ok(key, 'Actual committed React input'); return n[key]
}
function controls(ui) {
  const named = name => [...ui.host.querySelectorAll('input'), ...ui.host.querySelectorAll('select'), ...ui.host.querySelectorAll('textarea')]
    .find(n => (n.name ?? n.getAttribute('name')) === name)
  const change = (name, value) => act(async () => { props(named(name)).onChange({ currentTarget: { value } }) })
  return { named, change }
}
const ready = ui => ui.wait(() => ui.host.querySelectorAll('button').some(n => n.textContent === 'Aktivér for atleten' && props(n).disabled === false))

test('actual mounted coach controls prepare, save and explicitly approve three future days through original SQL', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage(), days = [1, 2, 3].map(nextDay), advices = days.map((d, i) => `Coachens råd ${i}: væske, vitaminer, mineraler og timing <b>som tekst</b> ${d}`)
  await mounted(f.client, storage, async ui => {
    await ui.open(); const t = controls(ui)
    assert.equal(t.named('plan-date').value, date)
    for (let i = 0; i < 3; i++) {
      await t.change('plan-date', days[i])
      assert.equal(t.named('plan-date').value, days[i]); assert.equal(t.named('portionGuidance').value, '')
      assert.match(ui.host.textContent, /Fremtidigt indtag er ukendt/)
      assert.match(ui.host.textContent, /aktuelt kendte profil/)
      assert.equal(f.calls.filter(c => c.payload).length, i * 3)
      for (let m = 0; m < 3; m++) {
        await t.change(`template-food-${m}-0`, FOODS[m].id)
        await t.change(`template-minGrams-${m}-0`, '50')
        await t.change(`template-maxGrams-${m}-0`, '300')
      }
      await t.change('portionGuidance', advices[i]); await ui.submit()
      for (let m = 0; m < 3; m++) await t.change(`grams-${m}-0`, String(125 + i * 10 + m))
      assert.equal(storage.data.size, i)
      await ui.click('Gem som kladde')
      const saved = JSON.parse(storage.data.get(draftKey(coachId, athleteId, days[i])))
      assert.equal(saved.plan.date, days[i]); assert.equal(saved.plan.portionGuidance, advices[i])
      assert.deepEqual(saved.plan.meals.map(m => m.items[0].grams), [125,126,127].map(n => n+i*10))
      assert.equal(f.calls.filter(c => c.payload).length, i * 3)
      await ready(ui); await ui.click('Aktivér for atleten')
      await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
      const rows = (await f.db.query('select * from public.kostplan_v1_versions order by effective_from')).rows
      assert.equal(rows.length, i + 1); assert.equal(rows[i].effective_from.toISOString().slice(0, 10), days[i]); assert.equal(rows[i].portion_guidance, advices[i])
      assert.deepEqual(rows[i].meals.map(m => m.portions[0].grams), saved.plan.meals.map(m => m.items[0].grams))
      assert.equal((await f.db.query('select * from public.kostplan_v1_approvals')).rows.length, i + 1)
      assert.equal(f.calls.filter(c => c.payload).length, (i + 1) * 3)
    }
    await t.change('plan-date', days[0]); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
    assert.equal(t.named('portionGuidance').value, advices[0])
    const count = f.calls.filter(c => c.payload).length
    await t.change('portionGuidance', advices[0]); assert.equal(f.calls.filter(c => c.payload).length, count)
    assert.equal(props(ui.host.querySelectorAll('button').find(n => n.textContent === 'Aktivér for atleten')).disabled, true)
  })
  await mounted(f.client, storage, async ui => {
    await ui.open(); const t = controls(ui); assert.equal(t.named('plan-date').value, date)
    await t.change('plan-date', days[1]); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
    assert.equal(t.named('portionGuidance').value, advices[1])
    assert.equal(f.calls.filter(c => c.payload).length, 9)
    await t.change('portionGuidance', 'Ændrede coachråd <script>plain text</script>')
    assert.equal(props(ui.host.querySelectorAll('button').find(n => n.textContent === 'Aktivér for atleten')).disabled, true)
    await ui.click('Gem som kladde'); await ready(ui); await ui.click('Aktivér for atleten')
    await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
    assert.equal((await f.db.query('select * from public.kostplan_v1_approvals')).rows.length, 4)
    assert.equal(ui.host.querySelectorAll('script').length, 0)
  })
  for (const table of names) assert.equal(Number((await f.db.query(`select count(*) n from public.${table}`)).rows[0].n), 4)
}))

test('mounted date control rejects malformed/boundary dates and stale callbacks during save and after date remount', { timeout: 60000 }, async () => withDatabase(async f => {
  const storage = memoryStorage()
  await mounted(f.client, storage, async ui => {
    await ui.open(); const t = controls(ui)
    assert.equal(props(t.named('portionGuidance')).maxLength, 4000)
    await t.change('portionGuidance', 'x'.repeat(4001)); assert.equal(t.named('portionGuidance').value, '')
    assert.equal(props(t.named('plan-date')).min, '1900-01-07'); assert.equal(props(t.named('plan-date')).max, '9999-12-24')
    for (const invalid of ['', '2028-02-30', '2028-2-01', '1899-12-31', '9999-12-25', '10000-01-01']) {
      await t.change('plan-date', invalid); assert.equal(t.named('plan-date').value, date)
    }
    await t.change('plan-date', nextDay(1)); await ui.submit()
    await t.change('portionGuidance', 'Gem denne dato')
    const staleDate = props(t.named('plan-date')).onChange
    const save = props(ui.host.querySelectorAll('button').find(n => n.textContent === 'Gem som kladde')).onClick
    await act(async () => {
      const pending = save(); staleDate({ currentTarget: { value: nextDay(2) } }); await pending
    })
    assert.equal(t.named('plan-date').value, nextDay(1))
    assert.ok(storage.data.has(draftKey(coachId, athleteId, nextDay(1))))
    assert.equal(storage.data.has(draftKey(coachId, athleteId, nextDay(2))), false)
    await t.change('plan-date', nextDay(2)); assert.equal(t.named('portionGuidance').value, '')
    await act(async () => staleDate({ currentTarget: { value: nextDay(3) } }))
    assert.equal(t.named('plan-date').value, nextDay(2))
    await t.change('portionGuidance', 'Ugemt tekst'); await t.change('plan-date', nextDay(1))
    assert.equal(t.named('portionGuidance').value, 'Gem denne dato')
    assert.equal(f.calls.filter(c => c.payload).length, 0)
  })
}))

test('actual mounted future approval loss locks date and advice until original SQL confirmation', { timeout: 60000 }, async () => withDatabase(async f => {
  await mounted(f.client, memoryStorage(), async ui => {
    await ui.open(); const t = controls(ui)
    await t.change('plan-date', nextDay(1)); await ui.submit(); await t.change('portionGuidance', 'Immutable future advice')
    await ui.click('Gem som kladde'); await ready(ui)
    const staleDate = props(t.named('plan-date')).onChange, staleAdvice = props(t.named('portionGuidance')).onChange
    await ui.click('Aktivér for atleten'); await ui.wait(() => ui.host.textContent.includes('uafklaret'))
    assert.equal(props(t.named('plan-date')).disabled, true); assert.equal(props(t.named('portionGuidance')).disabled, true)
    await act(async () => { staleDate({ currentTarget: { value: nextDay(2) } }); staleAdvice({ currentTarget: { value: 'forbidden edit' } }) })
    assert.equal(t.named('plan-date').value, nextDay(1)); assert.equal(t.named('portionGuidance').value, 'Immutable future advice')
    const retry = ui.host.querySelectorAll('button').filter(n => n.textContent === 'Kontrollér aktivering igen').at(-1)
    await act(async () => props(retry).onClick()); await ui.wait(() => ui.host.textContent.includes('bekræftede aktive plan'))
    assert.equal((await f.db.query('select * from public.kostplan_v1_approvals')).rows.length, 1)
    assert.equal((await f.db.query('select * from public.kostplan_v1_versions')).rows[0].portion_guidance, 'Immutable future advice')
    assert.equal(f.calls.filter(c => c.payload).length, 3)
  })
}, { lost: names[2] }))


test('actual manual gram workflow keeps authored advice through controller replacement and stale-date save guard', {timeout:60000}, async()=>withDatabase(async f=>{
 const storage=memoryStorage()
 await mounted(f.client,storage,async ui=>{
  await ui.open();const t=controls(ui)
  await t.change('plan-date',nextDay(1));await t.change('maintenanceKcal','2400');await t.change('fat','70')
  await t.change('portionGuidance','Manuelle gram og coachråd <b>tekst</b>')
  for(let m=0;m<3;m++) {await t.change(`template-food-${m}-0`,FOODS[m].id);await t.change(`template-grams-${m}-0`,'100')}
  const priorDate=props(t.named('plan-date')).onChange
  await ui.submit()
  assert.equal(t.named('portionGuidance').value,'Manuelle gram og coachråd <b>tekst</b>')
  await t.change('grams-0-0','155')
  const save=props(ui.host.querySelectorAll('button').find(n=>n.textContent==='Gem som kladde')).onClick
  await act(async()=>{const saving=save();priorDate({currentTarget:{value:nextDay(2)}});await saving})
  assert.equal(t.named('plan-date').value,nextDay(1))
  const draft=JSON.parse(storage.data.get(draftKey(coachId,athleteId,nextDay(1))))
  assert.equal(draft.plan.portionGuidance,'Manuelle gram og coachråd <b>tekst</b>');assert.equal(draft.plan.meals[0].items[0].grams,155)
  await ready(ui);await ui.click('Aktivér for atleten');await ui.wait(()=>ui.host.textContent.includes('bekræftede aktive plan'))
  assert.equal((await f.db.query('select portion_guidance from public.kostplan_v1_versions')).rows[0].portion_guidance,draft.plan.portionGuidance)
  assert.equal(f.calls.filter(c=>c.payload).length,3)
 },{athlete:{id:athleteId,protein_target:130}})
}))
