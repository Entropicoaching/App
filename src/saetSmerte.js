// Ordre 1560: smerte skrevet i en SAET-note (ikke kun dagens pas-kommentar)
// 1) standser stigningsforslaget paa de loeft, regionen rammer (V10 3A,
//    V-SMERTE B: rolig linje, intet forslag), og 2) staar oeverst hos coachen
//    som signal med loeft og dato. Kun kropsdel og dato; noten citeres aldrig.
// Rene funktioner, ingen React/Supabase. smerteNoter staar i coachFremgang.js.
import { exerciseSetView } from './exerciseSetView.js'
import { smerteNoter, lokalDag } from './coachFremgang.js'

export const SMERTE_LINJE = 'Ingen forslag i dag: tal med din coach om smerten'

// Hvilke hovedloeft en kropsdel belaster. Ukendt kropsdel: kun det loeft/den
// oevelse, noten blev skrevet paa. Hellere et forslag for lidt end for meget.
const DEL_RAMMER = {
  'knæet': ['Squat'],
  'hoften': ['Squat', 'Dødløft', 'Sumo dødløft'],
  'lysken': ['Squat', 'Sumo dødløft'],
  'ryggen': ['Squat', 'Dødløft', 'Sumo dødløft'],
  'skulderen': ['Bænkpres'],
  'albuen': ['Bænkpres'],
  'håndleddet': ['Bænkpres', 'Squat'],
  'anklen': ['Squat'],
  'nakken': ['Squat'],
}

export function ramteLoeft(note) {
  const ramt = new Set(DEL_RAMMER[note.del] || [])
  if (note.loeft) ramt.add(note.loeft)
  return [...ramt]
}

/** Seneste smerte-note (inden for 14 dage), der rammer oevelsen; ellers null. */
export function smerteStopFor(noter, oevelseNavn) {
  if (!oevelseNavn) return null
  const navn = String(oevelseNavn).toLowerCase()
  const view = exerciseSetView(oevelseNavn).name
  return (noter || []).find(n => (n.navn && String(n.navn).toLowerCase() === navn) || ramteLoeft(n).includes(view)) || null
}

/** Atletens historik ({navn: [{date, sets:[{note}]}]}) som logs til smerteNoter. */
export function historikSomLogs(historik) {
  const ud = []
  for (const [navn, dage] of Object.entries(historik || {})) {
    for (const { date, sets } of dage || []) {
      for (const s of sets || []) if (s.note) ud.push({ exercises: { name: navn }, note: s.note, logged_at: `${date}T12:00:00Z`, exercise_id: `${navn}|${s.set}` })
    }
  }
  return ud
}

const MAANEDER = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
export const dagTekst = (dag) => `${Number(dag.slice(8, 10))}. ${MAANEDER[Number(dag.slice(5, 7)) - 1]}`

/**
 * Coachens signaler (samme form som entropi_training_signals_v1) fra smerte i
 * saet-noter: et pr. atlet, alert, med loeft og dato. logs: {athlete_id, note,
 * logged_at, exercise_id, exercises:{name}}; atleter: [{id, name}].
 */
export function saetSmerteSignaler(logs, atleter, today = lokalDag()) {
  const perAtlet = new Map()
  for (const log of logs || []) {
    if (!log.athlete_id) continue
    if (!perAtlet.has(log.athlete_id)) perAtlet.set(log.athlete_id, [])
    perAtlet.get(log.athlete_id).push(log)
  }
  const ud = []
  for (const atlet of atleter || []) {
    const noter = smerteNoter(perAtlet.get(atlet.id) || [], today).filter(n => n.kilde === 'sæt-note')
    if (!noter.length) continue
    const n = noter[0]
    const loefter = [...new Set(noter.flatMap(ramteLoeft).map(l => l.toLowerCase()))]
    const hvor = [n.loeft ? n.loeft.toLowerCase() : n.navn, `sæt-note ${dagTekst(n.dag)}`].filter(Boolean).join(', ')
    ud.push({
      o_athlete_id: atlet.id, o_athlete_name: atlet.name, o_detector: 'pain', o_severity: 'alert',
      o_headline: `${atlet.name}: melder ondt i ${n.del || 'kroppen'} (${hvor})`,
      o_detail: `Ingen stigning${loefter.length ? ` på ${loefter.join(', ')}` : ''}, før du har talt med atleten. Kontakt før næste pas`,
      o_metrics: { body_part: n.del, lift: n.loeft, dag: n.dag, kilde: 'sæt-note', stoppede_loeft: loefter },
    })
  }
  return ud
}

/** Erstatter atletens evt. SQL-smertesignal med saet-note-signalet (samme nøgle, ingen dobbelt). */
export function medSaetSmerte(signaler, saetSignaler) {
  const ramt = new Set(saetSignaler.map(s => s.o_athlete_id))
  return [...(signaler || []).filter(s => !(s.o_detector === 'pain' && ramt.has(s.o_athlete_id))), ...saetSignaler]
}
