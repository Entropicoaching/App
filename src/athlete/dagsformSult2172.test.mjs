import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'

// Ordre 2172 (Marc 24. nov. kl. 21:13 "1 ja til alle tre"): kostklientens korte Dagsform er søvn, energi og sult (vægt har sin egen række).
// Sult gemmes i readiness_logs.hunger, når migrationen er kørt. Før migrationen må gem ikke gå i stykker. Kun syntetiske id'er.
registerHooks({ resolve(specifier, context, next) {
  if (/(?:^|\/)supabase(?:\.js)?$/.test(specifier) || specifier.endsWith('/progressionState.js')) {
    return { url: new URL('../appRev2Fakes.mjs', import.meta.url).href, shortCircuit: true }
  }
  if (specifier.startsWith('.') && context.parentURL && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(specifier + '.js', context.parentURL)
    if (existsSync(url)) return { url: url.href, shortCircuit: true }
  }
  return next(specifier, context)
} })
const { lavLaesninger, manglerSultKolonne } = await import('./laesninger.js')
const { readinessValue } = await import('../entropi2/tracking/hurtig/model.mjs')
const { createQuickController } = await import('../entropi2/tracking/hurtig/controller.mjs')

const ATLET = { id: '33333333-3333-4333-8333-333333333333' }
const MANGLER = { code: 'PGRST204', message: "Could not find the 'hunger' column of 'readiness_logs' in the schema cache" }

// Falsk skriveklient: medKolonne=false svarer som produktionen før migrationen, når hunger er med.
function skriver({ medKolonne }) {
  const inserts = []
  return { inserts, from: tabel => ({ insert: async payload => {
    inserts.push({ tabel, payload: { ...payload } })
    return { error: !medKolonne && 'hunger' in payload ? MANGLER : null }
  } }) }
}
async function gem(input, { medKolonne }) {
  const db = skriver({ medKolonne })
  const s = { log: [], fejl: [] }
  const { saveReadiness } = lavLaesninger({ athlete: ATLET, readinessInput: input, guardWrite: () => db,
    setSavingReadiness: () => {}, setReadinessError: v => s.fejl.push(v), setReadinessLog: v => s.log.push(v) })
  await saveReadiness()
  return { ...s, inserts: db.inserts }
}

test('kort Dagsform med sult gemmer hunger, når kolonnen findes', async () => {
  const r = await gem({ kort: true, sleep: '7', energy: '4', hunger: '2' }, { medKolonne: true })
  assert.equal(r.inserts.length, 1)
  assert.equal(r.inserts[0].payload.hunger, 2)
  assert.equal(r.inserts[0].payload.motivation, null)
  assert.equal(r.log.at(-1).hunger, 2)
  assert.deepEqual(r.fejl.filter(Boolean), [])
})
test('uden kolonnen (live i dag): søvn og energi gemmes alligevel, ingen fejl for atleten', async () => {
  const r = await gem({ kort: true, sleep: '7', energy: '4', hunger: '2' }, { medKolonne: false })
  assert.equal(r.inserts.length, 2)
  assert.equal('hunger' in r.inserts[1].payload, false)
  assert.equal(r.inserts[1].payload.energy, 4)
  assert.deepEqual(r.fejl.filter(Boolean), [])
  assert.equal(r.log.length, 1)
})
test('kort Dagsform uden sult sender ingen hunger-nøgle; ugyldig sult stoppes før gem', async () => {
  const r = await gem({ kort: true, sleep: '', energy: '3', hunger: '' }, { medKolonne: false })
  assert.equal(r.inserts.length, 1)
  assert.equal('hunger' in r.inserts[0].payload, false)
  const u = await gem({ kort: true, energy: '3', hunger: '9' }, { medKolonne: true })
  assert.equal(u.inserts.length, 0)
  assert.match(u.fejl.at(-1), /sult/)
})
test('fuld Dagsform (atlet med træning) sender aldrig hunger, heller ikke hvis feltet findes', async () => {
  const r = await gem({ sleep: '8', energy: '3', motivation: '3', stress: '2', soreness: '1', hunger: '4' }, { medKolonne: true })
  assert.equal(r.inserts.length, 1)
  assert.equal('hunger' in r.inserts[0].payload, false)
  assert.equal(r.inserts[0].payload.motivation, 3)
})
test('andre gem-fejl prøves ikke igen og vises som før', async () => {
  const db = { inserts: [], from: () => ({ insert: async p => { db.inserts.push(p); return { error: { code: '23505', message: 'duplicate' } } } }) }
  const fejl = []
  const { saveReadiness } = lavLaesninger({ athlete: ATLET, readinessInput: { kort: true, energy: '3', hunger: '2' }, guardWrite: () => db,
    setSavingReadiness: () => {}, setReadinessError: v => fejl.push(v), setReadinessLog: () => {} })
  await saveReadiness()
  assert.equal(db.inserts.length, 1)
  assert.match(fejl.at(-1), /Kunne ikke gemme/)
  assert.equal(manglerSultKolonne({ code: 'PGRST204', message: "Could not find the 'motivation' column" }), false)
  assert.equal(manglerSultKolonne({ code: '42703', message: 'column "hunger" does not exist' }), true)
})
test('model: sult valgfri 1 til 5 kun i kort Dagsform', () => {
  const kort = { sleep_hours: '7', energy: '4', motivation: '', stress: '', soreness_level: '', hunger: '5' }
  assert.deepEqual(readinessValue(kort, true), { sleep_hours: 7, energy: 4, motivation: null, stress: null, soreness_level: null, hunger: 5 })
  assert.equal('hunger' in readinessValue({ ...kort, hunger: '' }, true), false)
  assert.throws(() => readinessValue({ ...kort, hunger: '0' }, true), /sult/)
  const fuld = readinessValue({ ...kort, motivation: '3', stress: '3', soreness_level: '3' })
  assert.equal('hunger' in fuld, false)
})
test('controller: kort Dagsform har feltet sult og sender det; fuld Dagsform har det ikke', async () => {
  const data = { status: 'ready', complete: true, readinessRows: [], weightRows: [], mealRows: [] }
  const sendt = []
  let udloes = null, nu = 0
  const clock = { now: () => nu, setTimeout: fn => { udloes = fn; return 1 }, clearTimeout: () => {} }
  const kort = createQuickController({ enabled: true, athleteId: ATLET.id, date: '2026-11-25', data, clock, kortDagsform: true,
    save: { readiness: async p => { sendt.push(p); return true } } })
  assert.equal(kort.snapshot().draft.readiness.hunger, '')
  assert.equal(kort.setField('readiness', 'energy', '4'), true)
  assert.equal(kort.setField('readiness', 'hunger', '3'), true)
  assert.equal(kort.save('readiness'), true); nu = 10000; udloes?.()
  for (let i = 0; i < 20 && !sendt.length; i++) await new Promise(r => setTimeout(r, 5))
  assert.equal(sendt[0]?.hunger, 3)
  const fuld = createQuickController({ enabled: true, athleteId: ATLET.id, date: '2026-11-25', data, clock })
  assert.equal(fuld.setField('readiness', 'hunger', '3'), false)
})
