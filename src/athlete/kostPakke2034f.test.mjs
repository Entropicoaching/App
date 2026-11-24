import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'

// Ordre 2034f (Marc 23. nov.: kost sælges som pakke med træning, skjult for atleter uden).
// Atletens egen læsning sætter athlete.kostPakke ud fra en godkendt kostplan de sidste 42 dage
// eller frem; kostValg.mjs skjuler Kost kun ved et udtrykkeligt false. Kun syntetiske id'er.
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
const { lavLaesninger, laesKostPakke, medKostPakke, kostPakkeFra, KOST_PAKKE_DAGE } = await import('./laesninger.js')
const { kostSynlig, kostPakkeSkjult, kostDestination } = await import('./kostValg.mjs')

const ATLET = { id: '33333333-3333-4333-8333-333333333333', user_id: '22222222-2222-4222-8222-222222222222', name: 'Syntetisk' }

// Falsk klient: athletes svarer med atletrækken, kostplan_v1_plans med det, prøven bestemmer.
function klient({ planer = [], planFejl = null, planKaster = false } = {}) {
  const kald = []
  return {
    kald,
    from(table) {
      kald.push(table)
      if (table === 'kostplan_v1_plans') {
        if (planKaster) throw new TypeError('ingen gte i denne klient')
        const filtre = []
        const q = {
          select: () => q,
          eq: (k, v) => { filtre.push([k, v]); return q },
          gte: (k, v) => { filtre.push([k, v]); return q },
          limit: () => q,
          then: (ok, nej) => Promise.resolve({ data: planFejl ? null : planer, error: planFejl, filtre }).then(ok, nej),
        }
        return q
      }
      // Alle andre tabeller: enhver kæde svarer tomt; athletes svarer med rækken.
      const svar = table === 'athletes' ? { ...ATLET } : []
      const q = new Proxy({}, { get: (_, navn) => navn === 'then'
        ? (ok, nej) => Promise.resolve({ data: svar, error: null }).then(ok, nej)
        : () => q })
      return q
    },
    rpc() { return Promise.resolve({ data: null, error: null }) },
  }
}

async function hentAtlet(db, { coachAthleteId } = {}) {
  const s = { athlete: [], loadError: [], loading: [] }
  const faste = {
    role: coachAthleteId ? 'coach' : 'athlete', coachAthleteId, indbakke2: false,
    session: { user: { id: ATLET.user_id, email: 'syntetisk@e2e.test' } }, sessionRefs: { current: null },
    guardSession: () => db, guardWrite: () => db, isSessionCurrent: () => true, mountedRef: { current: true },
    setLoadError: v => s.loadError.push(v), setLoading: v => s.loading.push(v), setAthlete: v => s.athlete.push(v),
    athlete: null, currentWeek: null, exerciseHistory: {}, guideStep: 0, readinessInput: {}, readinessCardRef: { current: null }, exerciseLogsReadRef: { current: null },
  }
  // Resten af vært-funktionerne (setX, fetchX, onReadError) er uden betydning her og bliver tomme funktioner.
  const h = lavLaesninger(new Proxy(faste, { get: (m, navn) => navn in m ? m[navn] : () => {} }))
  await h.fetchAthlete()
  await new Promise(r => setTimeout(r, 30))
  return s
}

test('kostSynlig skjuler Kost kun ved et udtrykkeligt kostPakke === false', () => {
  assert.equal(kostSynlig({ id: 'syn-a', kostPakke: false }), false)
  assert.equal(kostPakkeSkjult({ id: 'syn-a', kostPakke: false }), true)
  for (const athlete of [{ id: 'syn-a' }, { id: 'syn-a', kostPakke: true }, { id: 'syn-a', kostPakke: undefined },
    { id: 'syn-a', kostPakke: null }, { id: 'syn-a', kostPakke: 0 }, { id: 'syn-a', kostPakke: 'false' }, null, undefined]) {
    assert.equal(kostSynlig(athlete), true, JSON.stringify(athlete))
    assert.equal(kostPakkeSkjult(athlete), false)
  }
  // Den gamle pr.-atlet-regel gælder stadig, og kostPakke false vinder over et ja dér.
  assert.equal(kostSynlig({ id: 'syn-a', kostPakke: false }, true, { 'syn-a': true }), false)
  assert.equal(kostSynlig({ id: 'syn-a', kostPakke: true }, true, { 'syn-a': true }), true)
  assert.equal(kostDestination('kost', false), 'hjem')
})

test('laesKostPakke: godkendt plan de sidste 42 dage eller frem giver true, ingen giver false', async () => {
  const now = new Date('2026-11-24T12:00:00Z')
  assert.equal(KOST_PAKKE_DAGE, 42)
  assert.equal(kostPakkeFra(now), '2026-10-13')
  const med = klient({ planer: [{ id: 'p1' }] })
  assert.equal(await laesKostPakke(med, ATLET.id, now), true)
  const svar = await med.from('kostplan_v1_plans').select('id').eq('athlete_id', ATLET.id).eq('status', 'godkendt').gte('valid_from', kostPakkeFra(now)).limit(1)
  assert.deepEqual(svar.filtre, [['athlete_id', ATLET.id], ['status', 'godkendt'], ['valid_from', '2026-10-13']])
  assert.equal(await laesKostPakke(klient({ planer: [] }), ATLET.id, now), false)
})

test('laesKostPakke: fejl, kastende klient eller manglende id giver intet felt (Kost vises som før)', async () => {
  assert.equal(await laesKostPakke(klient({ planFejl: { code: 'PGRST205', message: 'tabel mangler' } }), ATLET.id), undefined)
  assert.equal(await laesKostPakke(klient({ planKaster: true }), ATLET.id), undefined)
  assert.equal(await laesKostPakke(klient(), ''), undefined)
  assert.equal(await laesKostPakke(klient(), null), undefined)
  const uroert = { id: ATLET.id }
  assert.equal(await medKostPakke(klient({ planKaster: true }), uroert), uroert)
  assert.equal('kostPakke' in uroert, false)
  // Samme række, ikke en kopi: AthleteView nøgler trænings-lease'en på rækkens identitet.
  const raekke = { id: ATLET.id }
  assert.equal(await medKostPakke(klient({ planer: [] }), raekke), raekke)
  assert.deepEqual(raekke, { id: ATLET.id, kostPakke: false })
})

test('fetchAthlete lægger kostPakke på atletrækken i atletens egen visning', async () => {
  const uden = await hentAtlet(klient({ planer: [] }))
  assert.equal(uden.athlete.length, 1)
  assert.equal(uden.athlete[0].kostPakke, false)
  assert.equal(uden.athlete[0].id, ATLET.id)
  assert.deepEqual(uden.loadError, [])
  const med = await hentAtlet(klient({ planer: [{ id: 'p1' }] }))
  assert.equal(med.athlete[0].kostPakke, true)
  const fejl = await hentAtlet(klient({ planFejl: { message: 'net' } }))
  assert.equal('kostPakke' in fejl.athlete[0], false)
})

test('coachens forhåndsvisning læser ikke kostpakken og ser alt', async () => {
  const db = klient({ planer: [] })
  const s = await hentAtlet(db, { coachAthleteId: ATLET.id })
  assert.equal(s.athlete.length, 1)
  assert.equal('kostPakke' in s.athlete[0], false)
  assert.equal(db.kald.includes('kostplan_v1_plans'), false)
  assert.equal(kostSynlig(s.athlete[0]), true)
})
