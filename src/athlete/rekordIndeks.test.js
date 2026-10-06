// ORDRE 450 · blok 1: rekord-indekset (rekordIndeks.js). node --test src/athlete/rekordIndeks.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  tomtIndeks, loadRekordIndeks, saveRekordIndeks, flet, foldForbi, laegRaekkerTil, medUgensSaet, grundlagFoer, hentSiden, OVERLAP_MS,
} from './rekordIndeks.js'
import { bygGrundlag, findRekord, rekordListe, tidligereSaet, ugensSaet } from './rekorder.js'
import { clearOfflineSnapshots } from './offlineSnapshot.js'

function hukommelse() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size },
  }
}

// Tre uger, én øvelse (Squat) pr. uge; uge 3 er den aktive.
const uge = (id, exId) => ({ id, sessions: [{ id: `s-${id}`, exercises: [{ id: exId, name: 'Squat' }] }] })
const allWeeks = [uge('u1', 'ex1'), uge('u2', 'ex2'), uge('u3', 'ex3'), uge('u4', 'ex4')]
const [u1, u2, u3] = allWeeks
const raekke = (exId, weight, reps, dag) => ({ exercise_id: exId, weight, reps_completed: reps, logged_at: `2026-09-${String(dag).padStart(2, '0')}T10:00:00.000Z`, exercises: { name: 'Squat' } })
const historik = [raekke('ex1', 95, 5, 1), raekke('ex1', 95, 5, 1), raekke('ex2', 97.5, 5, 8), raekke('ex2', 90, 8, 8)]

test('grundlaget fra indekset er det samme som 439 regnede ud fra hele historikken', () => {
  const ix = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  assert.deepEqual(grundlagFoer(ix, u3), bygGrundlag(tidligereSaet(historik, u3)))
})

test('den aktive uges rækker fra serveren tæller ikke (exerciseLogs ejer dem), og "til" rykker ikke for dem', () => {
  const ix = laegRaekkerTil(tomtIndeks('a1'), [...historik, raekke('ex3', 120, 5, 15)], allWeeks, u3)
  assert.equal(Math.round(grundlagFoer(ix, u3).squat.e1rm), 114)
  assert.equal(ix.til, '2026-09-08T10:00:00.000Z')
})

test('ugens spand erstattes af exerciseLogs: et fortrudt sæt forsvinder også fra indekset', () => {
  let ix = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  const log = (n, w, r) => ({ exercise_id: 'ex3', set_number: n, weight: w, reps_completed: r, skipped: false, logged_at: '2026-09-15T10:00:00Z' })
  ix = medUgensSaet(ix, bygGrundlag(ugensSaet([log(1, 100, 5), log(2, 110, 5)], u3, allWeeks)), allWeeks, u3)
  assert.equal(Math.round(ix.uger.u3.squat.e1rm), 128)
  ix = medUgensSaet(ix, bygGrundlag(ugensSaet([log(1, 100, 5)], u3, allWeeks)), allWeeks, u3)
  assert.equal(Math.round(ix.uger.u3.squat.e1rm), 117)
  // Grundlaget "før" ser aldrig den aktive uge.
  assert.equal(Math.round(grundlagFoer(ix, u3).squat.e1rm), 114)
})

test('ny uge: sidste uges spand lægges ned i base, så dens sæt er "før"', () => {
  let ix = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  ix = medUgensSaet(ix, bygGrundlag([{ navn: 'Squat', weight: 100, reps: 5 }]), allWeeks, u3)
  const u4 = allWeeks[3]
  ix = medUgensSaet(ix, {}, allWeeks, u4)
  assert.deepEqual(Object.keys(ix.uger), ['u4'])
  assert.equal(Math.round(grundlagFoer(ix, u4).squat.e1rm), 117)
  // Et sæt på 100 × 5 er nu ingen rekord; 102,5 × 5 er.
  assert.equal(findRekord(grundlagFoer(ix, u4), { navn: 'Squat', weight: 100, reps: 5 }), null)
  assert.ok(findRekord(grundlagFoer(ix, u4), { navn: 'Squat', weight: 102.5, reps: 5 }))
})

test('samme række to gange (overlap, genindlæsning, Fremgang) ændrer intet', () => {
  const en = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  const to = laegRaekkerTil(en, historik, allWeeks, u3)
  assert.deepEqual(grundlagFoer(to, u3), grundlagFoer(en, u3))
  assert.deepEqual(flet(en.base, en.base), en.base)
})

test('hentSiden: intet indeks = alt; ellers en uge før indeksets nyeste række', () => {
  assert.equal(hentSiden(null), null)
  assert.equal(hentSiden(tomtIndeks('a1')), null)
  const ix = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  assert.equal(Date.parse(ix.til) - Date.parse(hentSiden(ix)), OVERLAP_MS)
})

test('intet indeks, eller et der aldrig er bygget: intet grundlag, så intet fejres (som 439)', () => {
  assert.equal(grundlagFoer(null, u3), null)
  assert.equal(grundlagFoer(medUgensSaet(tomtIndeks('a1'), {}, allWeeks, u3), u3), null)
  // En atlet uden en eneste række: bygget, men tomt grundlag.
  assert.deepEqual(grundlagFoer(laegRaekkerTil(tomtIndeks('a1'), [], allWeeks, u3), u3), {})
})

test('en uge der er slettet fra programmet foldes også ned', () => {
  const ix = foldForbi({ ...tomtIndeks('a1'), bygget: true, uger: { gammel: bygGrundlag([{ navn: 'Squat', weight: 100, reps: 5 }]) } }, allWeeks, u2)
  assert.deepEqual(Object.keys(ix.uger), [])
  assert.ok(ix.base.squat)
})

test('rekordListe med indeksets grundlag = 439 over hele historikken (ugens rekorder)', () => {
  const logs = [
    { exercise_id: 'ex3', set_number: 1, weight: 100, reps_completed: 5, skipped: false, logged_at: '2026-09-15T10:00:00Z' },
    { exercise_id: 'ex3', set_number: 2, weight: 100, reps_completed: 5, skipped: false, logged_at: '2026-09-15T10:03:00Z' },
    { exercise_id: 'ex3', set_number: 3, weight: 95, reps_completed: 8, skipped: false, logged_at: '2026-09-15T10:06:00Z' },
  ]
  const ix = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  const nye = rekordListe(ugensSaet(logs, u3, allWeeks), grundlagFoer(ix, u3)).filter(r => r.denneUge)
  const gamle = rekordListe([...tidligereSaet(historik, u3), ...ugensSaet(logs, u3, allWeeks)]).filter(r => r.denneUge)
  assert.deepEqual(nye, gamle)
  assert.equal(nye.length, 2)
})

test('telefonen: gem, hent, anden atlet giver intet, log ud rydder', () => {
  const st = hukommelse()
  const ix = laegRaekkerTil(tomtIndeks('a1'), historik, allWeeks, u3)
  assert.ok(saveRekordIndeks('bruger-1', ix, st))
  assert.deepEqual(loadRekordIndeks('bruger-1', null, st), ix)
  assert.equal(loadRekordIndeks('bruger-1', 'a2', st), null)
  st.setItem('entropi_offline_sets:a1', '{}')
  clearOfflineSnapshots(st)
  assert.equal(loadRekordIndeks('bruger-1', null, st), null)
  assert.equal(st.getItem('entropi_offline_sets:a1'), '{}')
  assert.ok(JSON.stringify(ix).length < 1000, 'indekset er lille')
  void u1
})
