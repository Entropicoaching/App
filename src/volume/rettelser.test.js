// ORDRE 185, commit 3: samme in-memory fake-storage-mønster som
// readinessDraft.test.js.
//
// ORDRE 209, commit 2: alle offentlige funktioner er nu async (Supabase-
// bagenden kræver det), og opts sendes som ét objekt i stedet for
// positionelt. Nye tests dækker Supabase-bagenden via `fakeClient` — en
// minimal fake af den del af @supabase/supabase-js's kæde-API rettelser.js
// rent faktisk bruger (.from().select/.insert/.delete(), .eq(), afventelig
// uden .then()-boilerplate i hver test) — ikke en generel PostgREST-klon,
// samme ånd som e2e/mock-supabase.mjs, bare på unit-niveau og uden HTTP.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hentRettelser, gemRettelse, fjernRettelse, hentLagerType, TABELNAVN } from './rettelser.js'
import { PRIMÆR, MEDVIRKENDE } from './muskelkort.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

/** @param {{ tabelFindes?: boolean, rows?: object[] }} [opts] */
function fakeClient({ tabelFindes = true, rows = [] } = {}) {
  const state = { rows: rows.map(r => ({ ...r })) }

  function lav(table, handling, payload) {
    if (table !== TABELNAVN) throw new Error(`uventet tabel i test: ${table}`)
    const filtre = []
    const builder = {
      eq(kolonne, vaerdi) { filtre.push([kolonne, vaerdi]); return builder },
      then(resolve, reject) { return koer().then(resolve, reject) },
      catch(reject) { return koer().catch(reject) },
    }
    async function koer() {
      if (!tabelFindes) return { data: null, error: { code: '42P01', message: 'relation findes ikke' }, count: null }
      if (handling === 'probe') return { data: null, error: null, count: state.rows.length }
      if (handling === 'select') {
        const matched = state.rows.filter(r => filtre.every(([k, v]) => r[k] === v))
        return { data: matched, error: null }
      }
      if (handling === 'insert') {
        state.rows.push({ ...payload })
        return { error: null }
      }
      if (handling === 'delete') {
        const foer = state.rows.length
        state.rows = state.rows.filter(r => !filtre.every(([k, v]) => r[k] === v))
        return { error: null, count: foer - state.rows.length }
      }
      throw new Error(`ukendt handling i test: ${handling}`)
    }
    return builder
  }

  return {
    get _rows() { return state.rows },
    from(table) {
      return {
        select: (_cols, selectOpts) => lav(table, selectOpts?.head ? 'probe' : 'select'),
        insert: (obj) => lav(table, 'insert', obj),
        delete: (delOpts) => lav(table, 'delete', delOpts),
      }
    },
  }
}

// ---- localStorage-bagenden (ingen client) ----

test('ingen rettelser gemt endnu: hentRettelser giver et tomt Map', async () => {
  const storage = fakeStorage()
  assert.equal((await hentRettelser({ storage })).size, 0)
})

test('gem, hent, find igen — nøglet på normaliseret navn', async () => {
  const storage = fakeStorage()
  const ok = await gemRettelse({ oevelseNavn: 'Zercher squat', grupper: [{ gruppe: 'kneeExtensors', andel: PRIMÆR }] }, { storage })
  assert.equal(ok, true)
  const rettelser = await hentRettelser({ storage })
  assert.equal(rettelser.size, 1)
  const r = rettelser.get('zercher squat')
  assert.equal(r.oevelseNavn, 'Zercher squat')
  assert.deepEqual(r.grupper, [{ gruppe: 'kneeExtensors', andel: PRIMÆR }])
  assert.equal(r.satAf, 'Marc')
})

test('stavevariant/suffiks rammer samme rettelse som grundnavnet (samme normalisering som muskelkort.js)', async () => {
  const storage = fakeStorage()
  await gemRettelse({ oevelseNavn: 'Bænkpres', grupper: [{ gruppe: 'triceps', andel: PRIMÆR }] }, { storage })
  const rettelser = await hentRettelser({ storage })
  assert.ok(rettelser.has('baenkpres'))
  assert.ok(rettelser.get('baenkpres'))
})

test('gem igen for samme øvelse overskriver, opretter ikke to poster', async () => {
  const storage = fakeStorage()
  await gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, { storage })
  await gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }, { gruppe: 'biceps', andel: MEDVIRKENDE }] }, { storage })
  const rettelser = await hentRettelser({ storage })
  assert.equal(rettelser.size, 1)
  assert.equal(rettelser.get('roning').grupper.length, 2)
})

test('fjernRettelse sletter — hentRettelser ser den ikke mere', async () => {
  const storage = fakeStorage()
  await gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, { storage })
  const fjernet = await fjernRettelse('Roning', { storage })
  assert.equal(fjernet, true)
  assert.equal((await hentRettelser({ storage })).size, 0)
})

test('fjernRettelse for en øvelse uden rettelse: false, ingen fejl', async () => {
  const storage = fakeStorage()
  assert.equal(await fjernRettelse('Findes ikke', { storage }), false)
})

test('gemRettelse afviser ugyldig andel (kun PRIMÆR/MEDVIRKENDE er tilladt)', async () => {
  const storage = fakeStorage()
  const ok = await gemRettelse({ oevelseNavn: 'Test', grupper: [{ gruppe: 'lats', andel: 0.75 }] }, { storage })
  assert.equal(ok, false)
  assert.equal((await hentRettelser({ storage })).size, 0)
})

test('gemRettelse afviser tomt navn eller tom grupperliste', async () => {
  const storage = fakeStorage()
  assert.equal(await gemRettelse({ oevelseNavn: '', grupper: [{ gruppe: 'lats', andel: 1 }] }, { storage }), false)
  assert.equal(await gemRettelse({ oevelseNavn: 'Noget', grupper: [] }, { storage }), false)
})

test('en fejlende storage (fx privat vindue) vælter ikke, returnerer false/tomt', async () => {
  const throwingStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(await gemRettelse({ oevelseNavn: 'Test', grupper: [{ gruppe: 'lats', andel: 1 }] }, { storage: throwingStorage }), false)
  assert.equal((await hentRettelser({ storage: throwingStorage })).size, 0)
  await assert.doesNotReject(() => fjernRettelse('Test', { storage: throwingStorage }))
})

test('ingen client: hentLagerType giver "lokalt"', async () => {
  assert.equal(await hentLagerType({}), 'lokalt')
})

// ---- Supabase-bagenden (client + coachId, tabellen findes) ----

test('tabellen findes + coachId: hentLagerType giver "supabase"', async () => {
  const client = fakeClient()
  assert.equal(await hentLagerType({ client, coachId: 'coach-1' }), 'supabase')
})

test('gem, hent, find igen mod Supabase-bagenden', async () => {
  const storage = fakeStorage()
  const client = fakeClient()
  const ok = await gemRettelse({ oevelseNavn: 'Zercher squat', grupper: [{ gruppe: 'kneeExtensors', andel: PRIMÆR }] }, { storage, client, coachId: 'coach-1' })
  assert.equal(ok, true)
  const rettelser = await hentRettelser({ storage, client, coachId: 'coach-1' })
  assert.equal(rettelser.size, 1)
  assert.equal(rettelser.get('zercher squat').oevelseNavn, 'Zercher squat')
})

test('gem igen for samme øvelse mod Supabase overskriver, opretter ikke to poster', async () => {
  const storage = fakeStorage()
  const client = fakeClient()
  await gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, { storage, client, coachId: 'coach-1' })
  await gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }, { gruppe: 'biceps', andel: MEDVIRKENDE }] }, { storage, client, coachId: 'coach-1' })
  const rettelser = await hentRettelser({ storage, client, coachId: 'coach-1' })
  assert.equal(rettelser.size, 1)
  assert.equal(rettelser.get('roning').grupper.length, 2)
})

test('to coaches deler ikke rettelser (coach_id-scoping)', async () => {
  const storage1 = fakeStorage()
  const storage2 = fakeStorage()
  const client = fakeClient()
  await gemRettelse({ oevelseNavn: 'Squat', grupper: [{ gruppe: 'kneeExtensors', andel: PRIMÆR }] }, { storage: storage1, client, coachId: 'coach-1' })
  const rettelserCoach2 = await hentRettelser({ storage: storage2, client, coachId: 'coach-2' })
  assert.equal(rettelserCoach2.size, 0)
})

test('fjernRettelse mod Supabase sletter — hentRettelser ser den ikke mere', async () => {
  const storage = fakeStorage()
  const client = fakeClient()
  await gemRettelse({ oevelseNavn: 'Roning', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, { storage, client, coachId: 'coach-1' })
  const fjernet = await fjernRettelse('Roning', { storage, client, coachId: 'coach-1' })
  assert.equal(fjernet, true)
  assert.equal((await hentRettelser({ storage, client, coachId: 'coach-1' })).size, 0)
})

test('tabellen findes IKKE (fx før migration): falder stille tilbage til localStorage', async () => {
  const storage = fakeStorage()
  const client = fakeClient({ tabelFindes: false })
  assert.equal(await hentLagerType({ client, coachId: 'coach-1' }), 'lokalt')
  const ok = await gemRettelse({ oevelseNavn: 'Squat', grupper: [{ gruppe: 'kneeExtensors', andel: PRIMÆR }] }, { storage, client, coachId: 'coach-1' })
  assert.equal(ok, true)
  const rettelser = await hentRettelser({ storage, client, coachId: 'coach-1' })
  assert.equal(rettelser.size, 1) // gemt lokalt, ikke tabt
})

test('flyt-op: lokale rettelser fra før migrationen flyttes til Supabase første gang tabellen findes, én gang', async () => {
  const storage = fakeStorage()
  // Simulerer en browser med rettelser gemt FØR tabellen fandtes.
  await gemRettelse({ oevelseNavn: 'Gammel rettelse', grupper: [{ gruppe: 'lats', andel: PRIMÆR }] }, { storage })
  assert.equal((await hentRettelser({ storage })).size, 1) // stadig lokalt her

  const client = fakeClient()
  const rettelser = await hentRettelser({ storage, client, coachId: 'coach-1' })
  assert.equal(rettelser.size, 1)
  assert.ok(rettelser.has('gammel rettelse'))
  assert.equal(client._rows.length, 1)
  assert.equal(storage.getItem('entropi_muskelkort_rettelser_flyttet'), '1')

  // Anden gang: flyttes ikke igen (ingen dubletter, selvom den lokale liste
  // stadig ligger urørt i storage).
  await hentRettelser({ storage, client, coachId: 'coach-1' })
  assert.equal(client._rows.length, 1)
})

test('flyt-op med ingen lokale rettelser markeres flyttet uden at skrive noget', async () => {
  const storage = fakeStorage()
  const client = fakeClient()
  await hentRettelser({ storage, client, coachId: 'coach-1' })
  assert.equal(client._rows.length, 0)
  assert.equal(storage.getItem('entropi_muskelkort_rettelser_flyttet'), '1')
})
