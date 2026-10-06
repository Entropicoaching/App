// ORDRE 439 · blok 1 — nye rekorder, regnet ud fra de sæt appen allerede har
// (exercise_logs: Fremgangs historik + ugens sæt). Intet nyt i databasen.
// Rene funktioner, samme mønster som ugeStatus.js, så de testes uden browser.
//
// Ordre 1451: kun TUNGE sæt kan sætte eller slå en rekord (erTungtSaet, samme
// regel som Fremgang-kurven, forsidens styrkelinje og coachens visning): højst
// 8 reps, ikke backoff/volumen/teknik-single. Navnet skal være det RÅ navn.
//
// En rekord er et gennemført sæt (vægt > 0, reps > 0, ikke sprunget over), der
// enten giver øvelsens højeste e1RM (Epley, afrundet til hele kg, så "+0 kg"
// aldrig fejres), eller flest reps på en vægt, der er løftet før. Øvelsens
// allerførste sæt er ingen rekord: der er intet at slå. Et fortrudt sæt er
// væk fra loggen og tæller derfor heller ikke.
import { exerciseSetView } from '../exerciseSetView.js'
import { estimatedOneRepMax, erTungtSaet, erDeloadBlok, erDeloadLog, hovedloeftFamilie } from '../exerciseProgress.js'

export const e1rmKg = (weight, reps) => Math.round(estimatedOneRepMax(weight, reps))

const noegle = (navn) => exerciseSetView(navn).key
const vaegtNoegle = (weight) => String(Number(weight))

export function gyldigtSaet(saet) {
  return !!saet && !saet.skipped && Number(saet.weight) > 0 && Number(saet.reps) > 0 && !!noegle(saet.navn) && !saet.deload && erTungtSaet(saet.navn, saet.reps)
}

// Grundlaget er kun maksima (bedste e1RM og flest reps pr. vægt pr. øvelse),
// så rækkefølgen sættene lægges til i er ligegyldig.
export function laegTil(grundlag, saet) {
  if (!gyldigtSaet(saet)) return grundlag
  const k = noegle(saet.navn)
  const cur = grundlag[k] || { e1rm: 0, vaegte: {} }
  const w = vaegtNoegle(saet.weight)
  const reps = Number(saet.reps)
  grundlag[k] = {
    e1rm: Math.max(cur.e1rm, estimatedOneRepMax(saet.weight, reps)),
    vaegte: { ...cur.vaegte, [w]: Math.max(cur.vaegte[w] || 0, reps) },
  }
  return grundlag
}

export function bygGrundlag(saetListe, start = {}) {
  const g = normaliserGrundlag(start)
  for (const s of saetListe || []) laegTil(g, s)
  return g
}

// null, eller { type: 'e1rm', navn, e1rm, plus } | { type: 'reps', navn, weight, reps, plus }.
export function findRekord(grundlag, saet) {
  if (!gyldigtSaet(saet)) return null
  const cur = normaliserGrundlag(grundlag)[noegle(saet.navn)]
  const navn = exerciseSetView(saet.navn).name
  if (!cur) return null
  const ny = e1rmKg(saet.weight, saet.reps)
  const bedst = Math.round(cur.e1rm)
  if (ny > bedst) return { type: 'e1rm', navn, e1rm: ny, plus: ny - bedst, weight: Number(saet.weight), reps: Number(saet.reps) }
  const foer = cur.vaegte[vaegtNoegle(saet.weight)]
  if (foer && Number(saet.reps) > foer) return { type: 'reps', navn, weight: Number(saet.weight), reps: Number(saet.reps), plus: Number(saet.reps) - foer }
  return null
}

const kg = (n) => String(n).replace('.', ',')

export function rekordTekst(r) {
  if (!r) return ''
  if (r.type === 'e1rm') return `Ny rekord: ${r.navn} e1RM ${r.e1rm} kg, +${r.plus} kg`
  return `Ny rekord: ${r.navn} ${kg(r.weight)} kg × ${r.reps}, ${r.plus === 1 ? '1 rep' : `${r.plus} reps`} mere end før`
}

// Kronologisk gennemgang: hver rekord med dato (Fremgang og "din uge").
// saetListe: [{ navn, weight, reps, dato, ...ekstra }]; ekstra-felterne følger med.
// start (ORDRE 450): et grundlag fra før listen (rekord-indekset); ændres ikke.
export function rekordListe(saetListe, start = {}) {
  const sorteret = [...(saetListe || [])].filter(gyldigtSaet).sort((a, b) => String(a.dato || '').localeCompare(String(b.dato || '')))
  const g = normaliserGrundlag(start)
  const ud = []
  for (const s of sorteret) {
    const r = findRekord(g, s)
    if (r) ud.push({ ...s, ...r })
    laegTil(g, s)
  }
  return ud
}

// ---- Fra appens egne data ----

// Øvelsens navn ud fra id (programmet, allWeeks).
export function navnForOevelse(allWeeks) {
  const m = new Map()
  for (const w of allWeeks || []) for (const s of w.sessions || []) for (const e of s.exercises || []) m.set(e.id, e.name)
  return m
}

export function ugensOevelsesIds(week) {
  return new Set((week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id)))
}

// Historikken (Fremgang, fra serveren) uden ugens egne øvelser — dem kender
// exerciseLogs bedre (fortrudte, rettede og ventende sæt). Rækker uden
// exercise_id (ældre select) tages med som de er.
export function tidligereSaet(fremgangLogs, week) {
  const ids = ugensOevelsesIds(week)
  return (fremgangLogs || [])
    .filter(l => !l.exercise_id || !ids.has(l.exercise_id))
    .map(l => ({ navn: l.exercises?.name, weight: l.weight, reps: l.reps_completed, dato: l.logged_at, skipped: false, deload: erDeloadLog(l) }))
}

export function ugensSaet(exerciseLogs, week, allWeeks, udenNoegle = null) {
  const ids = ugensOevelsesIds(week)
  const navne = navnForOevelse(allWeeks?.length ? allWeeks : [week])
  return (exerciseLogs || [])
    .filter(l => ids.has(l.exercise_id) && `${l.exercise_id}_${l.set_number}` !== udenNoegle)
    .map(l => ({ navn: navne.get(l.exercise_id), weight: l.weight, reps: l.reps_completed, dato: l.logged_at || '9999', skipped: !!l.skipped, deload: erDeloadBlok(week?.block_name), denneUge: true, noegle: `${l.exercise_id}_${l.set_number}` }))
}

export function normaliserGrundlag(input = {}) {
  const out = {}
  for (const [name, value] of Object.entries(input || {})) {
    const key = noegle(name)
    const cur = out[key] || { e1rm: 0, vaegte: {} }
    const vaegte = { ...cur.vaegte }
    for (const [weight, reps] of Object.entries(value.vaegte || {}))
      vaegte[weight] = Math.max(vaegte[weight] || 0, reps)
    out[key] = { e1rm: Math.max(cur.e1rm, value.e1rm || 0), vaegte }
  }
  return out
}

// Ordre 1469 (1467-5): "Dine rekorder" viser de fire hovedloeft (squat, baenkpres,
// konventionel og sumo doedloeft) foerst, varianter og assistance samlet nederst.
// Sumo og konventionel er to loeft, som i Fremgangs faner. Listen er nyeste foerst.
export function grupperRekorder(rekorder, { hoved = 8, andre = 4 } = {}) {
  const h = [], a = []
  for (const r of rekorder || []) (hovedloeftFamilie(r.navn) ? h : a).push(r)
  return { hoved: h.slice(0, hoved), andre: a.slice(0, andre) }
}
