// ORDRE 450 · blok 1 — et lille rekord-indeks på telefonen, så rekorderne
// (rekorder.js, ordre 439) ikke kræver hele historikken (op til 4000 rækker)
// ved hver åbning. Indekset er kun maksima: bedste e1RM og flest reps pr.
// vægt pr. øvelse (samme grundlag som bygGrundlag). Det bygges én gang fra
// historikken og holdes derefter ajour af ugens egne sæt (exerciseLogs, også
// dem i den lokale kø) og af de rækker, der er nyere end indekset.
//
// Samme regel som 439: den aktive uges egne sæt tages altid fra exerciseLogs
// (fortrudte, rettede og ventende sæt), aldrig fra serveren. Derfor ligger
// sættene i spande pr. uge, så længe ugen er den aktive eller en senere; når
// ugen er forbi, lægges spanden ned i "base". Så er indekset lille (ét
// grundlag + et par uger), uanset hvor lang historikken er.
//
// Rene funktioner, storage som parameter, enhver fejl sluger sig selv (samme
// mønster som offlineSnapshot.js).
import { laegTil } from './rekorder.js'

// Nøglens præfiks står i offlineSnapshot.js, som rydder indekset ved log ud
// (uden at hovedbundtet skal have rekorder.js med).
import { REKORD_INDEKS_PREFIX as PREFIX } from './offlineSnapshot.js'
const VERSION = 1
// Rækker hentes fra lidt før indeksets nyeste række: et sæt, der først når
// serveren senere (fx fra en anden telefon), har et ældre logged_at. Det er
// ufarligt at se en række to gange, for indekset er kun maksima.
export const OVERLAP_MS = 7 * 24 * 3600 * 1000

const noegle = (userId) => `${PREFIX}:${userId}`

export function tomtIndeks(athleteId) {
  return { v: VERSION, athleteId, bygget: false, til: null, base: {}, uger: {} }
}

export function loadRekordIndeks(userId, athleteId = null, storage = globalThis.localStorage) {
  try {
    if (!storage || !userId) return null
    const raw = storage.getItem(noegle(userId))
    const x = raw ? JSON.parse(raw) : null
    if (!x || x.v !== VERSION || typeof x.base !== 'object' || typeof x.uger !== 'object') return null
    if (athleteId && x.athleteId && x.athleteId !== athleteId) return null
    return x
  } catch {
    return null
  }
}

export function saveRekordIndeks(userId, indeks, storage = globalThis.localStorage) {
  try {
    if (!storage || !userId || !indeks) return false
    storage.setItem(noegle(userId), JSON.stringify(indeks))
    return true
  } catch {
    return false
  }
}

// To grundlag lagt sammen (maksima). Ændrer ingen af dem.
export function flet(a, b) {
  const ud = { ...(a || {}) }
  for (const [k, v] of Object.entries(b || {})) {
    const cur = ud[k]
    if (!cur) { ud[k] = v; continue }
    const vaegte = { ...cur.vaegte }
    for (const [w, r] of Object.entries(v.vaegte || {})) vaegte[w] = Math.max(vaegte[w] || 0, r)
    ud[k] = { e1rm: Math.max(cur.e1rm, v.e1rm), vaegte }
  }
  return ud
}

// exercise_id → ugens position og id i programmet (allWeeks er sorteret efter
// week_number, se fetchProgram).
function ugeKort(allWeeks) {
  const m = new Map()
  ;(allWeeks || []).forEach((w, i) => {
    for (const s of w.sessions || []) for (const e of s.exercises || []) m.set(e.id, { weekId: w.id, idx: i })
  })
  return m
}

const aktivIdx = (allWeeks, currentWeek) => (allWeeks || []).findIndex(w => w.id === currentWeek?.id)

// Uger, der er forbi (eller ikke findes længere i programmet), lægges ned i base.
export function foldForbi(indeks, allWeeks, currentWeek) {
  const idx = aktivIdx(allWeeks, currentWeek)
  if (idx < 0) return indeks
  const pos = new Map((allWeeks || []).map((w, i) => [w.id, i]))
  let base = indeks.base
  const uger = {}
  for (const [weekId, g] of Object.entries(indeks.uger || {})) {
    const p = pos.get(weekId)
    if (p == null || p < idx) base = flet(base, g)
    else uger[weekId] = g
  }
  return { ...indeks, base, uger }
}

// Rækker fra serveren (samme felter som fremgangLogsQuery: exercise_id,
// weight, reps_completed, logged_at, exercises.name). Den aktive uges rækker
// springes over (dem ejer exerciseLogs); senere uger får deres egen spand;
// alt andet (tidligere uger, øvelser der ikke findes i programmet) går i base.
export function laegRaekkerTil(indeks, rows, allWeeks, currentWeek) {
  const kort = ugeKort(allWeeks)
  const idx = aktivIdx(allWeeks, currentWeek)
  const base = { ...indeks.base }
  const uger = { ...indeks.uger }
  let til = indeks.til
  for (const r of rows || []) {
    const saet = { navn: r?.exercises?.name, weight: r?.weight, reps: r?.reps_completed, skipped: !!r?.skipped }
    const u = r?.exercise_id ? kort.get(r.exercise_id) : null
    if (u && idx >= 0 && u.idx === idx) continue
    if (u && idx >= 0 && u.idx > idx) { uger[u.weekId] = laegTil({ ...(uger[u.weekId] || {}) }, saet); continue }
    laegTil(base, saet)
    // "til" rykker kun for rækker i base. Den aktive og senere ugers rækker
    // hentes derfor igen ved næste åbning, til ugen er forbi og de hører til
    // base; så går et sæt fra en anden telefon ikke tabt undervejs.
    if (r?.logged_at && (!til || r.logged_at > til)) til = r.logged_at
  }
  return foldForbi({ ...indeks, base, uger, til, bygget: true }, allWeeks, currentWeek)
}

// Den aktive uges spand = præcis ugens sæt, som telefonen kender dem nu
// (ugensSaet fra exerciseLogs). Erstattes hver gang, så et fortrudt sæt også
// forsvinder fra indekset. Uger der er forbi, foldes først.
export function medUgensSaet(indeks, ugensGrundlag, allWeeks, currentWeek) {
  if (!currentWeek?.id) return indeks
  const foldet = foldForbi(indeks, allWeeks, currentWeek)
  return { ...foldet, uger: { ...foldet.uger, [currentWeek.id]: ugensGrundlag || {} } }
}

// Grundlaget fra "tidligere" (alle andre uger end den aktive), som
// rekorder.js's findRekord/rekordListe tager som start.
export function grundlagFoer(indeks, currentWeek) {
  if (!indeks?.bygget || !currentWeek?.id) return null
  let g = indeks.base
  for (const [weekId, ug] of Object.entries(indeks.uger || {})) if (weekId !== currentWeek.id) g = flet(g, ug)
  return g
}

// Fra hvilket tidspunkt skal der hentes? null = hent det hele (intet indeks
// endnu, eller en atlet uden en eneste række: det koster ingenting).
export function hentSiden(indeks) {
  if (!indeks?.bygget || !indeks.til) return null
  const t = Date.parse(indeks.til)
  return Number.isFinite(t) ? new Date(t - OVERLAP_MS).toISOString() : null
}
