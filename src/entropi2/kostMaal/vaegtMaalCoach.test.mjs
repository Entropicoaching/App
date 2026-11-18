import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text } from './reactFixture.mjs'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('./reactFixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
const { vaegtMaalLinje, vaegtRaekker } = await import('../kostplan/atlet/vaegtMaalModel.mjs')
const { kostMaalPlanVersion } = await import('../kostMaalKobling.mjs')

// Ordre 1620: coachen ser samme vægtlinje mod planens mål som atleten. Syntetiske data, kun visning.
const today = '2026-11-16', id = 'synthetic-vaegt-athlete'
const dag = n => new Date(Date.parse(today + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10)
const logs = (perDag, dage = 14) => Array.from({ length: dage }, (_, i) => ({ id: 'w' + i, athlete_id: id,
  logged_at: dag(dage - 1 - i), weight: Math.round((80 + perDag * i) * 100) / 100 }))
const cut = { goal: 'cut', intensity: 0.1 }
const props = (weightLogs, planVersion, extra = {}) => ({ enabled: true, athlete: { id, bodyweight: 80 }, today, weightLogs, planVersion, ...extra })
const linje = p => nodes(mount(KostMaal, p).render(), n => n.props?.['data-vaegt-maal'] !== undefined)

test('plan med mål: coachen får præcis atletens tekst for de samme vejninger', () => {
  for (const [perDag, status] of [[-0.057, 'paa-sporet'], [-0.2, 'hurtigere'], [0, 'langsommere']]) {
    const weightLogs = logs(perDag)
    const atlet = vaegtMaalLinje({ rows: vaegtRaekker(weightLogs, id), date: today, version: cut })
    const found = linje(props(weightLogs, cut))
    assert.equal(found.length, 1)
    assert.equal(text(found[0]), atlet.text)
    assert.equal(found[0].props['data-vaegt-maal'], status)
  }
  assert.equal(text(linje(props(logs(-0.057), cut))[0]), 'Vægten falder 0,4 kg pr. uge de seneste 14 dage. På sporet.')
})

test('linjen står under kg-trenden og over vægtgrundlaget, uden ny overskrift', () => {
  const all = text(mount(KostMaal, props(logs(-0.057), cut)).render())
  assert.ok(all.indexOf('Vægten falder') > all.indexOf('Trend'))
  assert.ok(all.indexOf('Vægten falder') < all.indexOf('Vægtgrundlag'))
  assert.equal(all.split('Vægten falder').length, 2)
})

test('uden plan, uden mål eller for få vejninger er visningen som før', () => {
  const base = text(mount(KostMaal, props(logs(-0.057), null)).render())
  assert.equal(linje(props(logs(-0.057), null)).length, 0)
  assert.equal(linje(props(logs(-0.057), undefined)).length, 0)
  assert.equal(linje(props(logs(-0.057), { goal: 'ukendt', intensity: 0.1 })).length, 0)
  assert.equal(linje(props(logs(-0.057), { goal: 'vedligehold', intensity: 0 })).length, 0)
  assert.equal(linje(props(logs(-0.057, 9), cut)).length, 0)
  assert.equal(linje(props([], cut)).length, 0)
  assert.equal(text(mount(KostMaal, props(logs(-0.057), cut)).render()).replace(/Vægten falder 0,4 kg pr\. uge de seneste 14 dage\. På sporet\. /, ''), base)
})

test('null og 0 i loggen bliver ikke til vægt; vægtstatus under læsning giver ingen linje', () => {
  const rows = logs(-0.057).map((r, i) => i === 3 ? { ...r, weight: null } : i === 4 ? { ...r, weight: 0 } : r)
  const found = linje(props(rows, cut))
  assert.equal(found.length === 0 || /^Vægten (falder|stiger) \d,\d kg pr\. uge/.test(text(found[0])), true)
  assert.equal(linje(props(logs(-0.057), cut, { weightState: 'loading' })).length, 0)
  assert.equal(linje(props(logs(-0.057), cut, { weightState: 'error' })).length, 0)
})

test('datoer regnes i Europe/Copenhagen: sen aftenvejning dagen før tæller som den dag', () => {
  const rows = logs(-0.057).map(r => ({ ...r, logged_at: r.logged_at + 'T23:30:00Z' }))
  const found = linje(props(rows, cut))
  const atlet = vaegtMaalLinje({ rows: vaegtRaekker(rows, id), date: today, version: cut })
  assert.equal(found.length, atlet ? 1 : 0)
  if (atlet) assert.equal(text(found[0]), atlet.text)
})

test('fremmede atleters vejninger tæller ikke', () => {
  assert.equal(linje(props(logs(-0.057).map(r => ({ ...r, athlete_id: 'en-anden' })), cut)).length, 0)
})

test('planVersion hentes fra dagsreferencen for netop i dag og kun når den er godkendt', () => {
  const refs = days => ({ dailyReferences: { days } })
  assert.deepEqual(kostMaalPlanVersion(refs([{ date: dag(1), state: 'approved', goal: 'bulk', intensity: 0.05 },
    { date: today, state: 'approved', goal: 'cut', intensity: 0.1 }]), today), cut)
  assert.equal(kostMaalPlanVersion(refs([{ date: today, state: 'unknown' }]), today), null)
  assert.equal(kostMaalPlanVersion(refs([{ date: dag(1), state: 'approved', goal: 'cut', intensity: 0.1 }]), today), null)
  assert.equal(kostMaalPlanVersion({}, today), null)
  assert.equal(kostMaalPlanVersion(null, today), null)
})
