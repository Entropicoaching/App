// ORDRE 185 (14. sep), commit 3: Marc retter kortlægningen selv, uden at
// åbne kildekoden. Samme lagerformønster som readinessDraft.js/
// videoCoachSubmission.js: storage sendes eksplicit (default
// globalThis.localStorage), så det kan enhedstestes uden en rigtig browser,
// og enhver fejl (privat vindue, fuld storage) sluger sig selv i stedet for
// at vælte kortet.
//
// GRÆNSE (ordrens egen ordlyd): "ingen ændring af Supabase-skemaet i denne
// ordre — gem det på den letteste holdbare måde appen allerede har". Appen
// har allerede localStorage til coach-niveau-indstillinger der ikke er
// pr.-atlet (se Dashboard.jsx's entropi_my_athlete_id) — samme mønster her,
// da rettelser "gælder for alle atleter" (ordrens ordlyd), ikke én atlet.
// DEN ÆRLIGE GRÆNSE: localStorage er pr. browser, IKKE synkroniseret mellem
// Marcs enheder eller til atletens egen visning af "planlagt". En rigtig
// løsning kræver en ny Supabase-tabel (fx
// `muscle_mapping_overrides(exercise_name text primary key, groups jsonb,
// set_by text, set_at timestamptz)`, RLS der kun tillader coach-rollen at
// skrive) — ingen migration skrevet her, se docs/VOLUMEN.md.

import { normaliserOevelsesnavn } from './muskelkort.js'

const NOEGLE = 'entropi_muskelkort_rettelser'

function laesAlle(storage) {
  try {
    if (!storage) return []
    const raw = storage.getItem(NOEGLE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function skrivAlle(liste, storage) {
  try {
    if (!storage) return false
    storage.setItem(NOEGLE, JSON.stringify(liste))
    return true
  } catch {
    return false
  }
}

/**
 * Alle gemte rettelser, som et Map keyed på normaliseret øvelsesnavn — den
 * facon `slaaOevelseOp` i muskelkort.js forventer som sit `rettelser`-param.
 *
 * @param {Storage} [storage]
 * @returns {Map<string, { oevelseNavn: string, grupper: Array<{ gruppe: string, andel: number }>, satAf: string, tidspunkt: string }>}
 */
export function hentRettelser(storage = globalThis.localStorage) {
  const liste = laesAlle(storage)
  const kort = new Map()
  for (const r of liste) {
    if (!r?.oevelseNavn || !Array.isArray(r.grupper)) continue
    kort.set(normaliserOevelsesnavn(r.oevelseNavn), r)
  }
  return kort
}

/**
 * Gemmer (opretter eller overskriver) en rettelse for én øvelse. Overskriver
 * en evt. tidligere rettelse for samme øvelse — der findes kun én "sat af
 * Marc"-version pr. øvelse ad gangen.
 *
 * @param {{ oevelseNavn: string, grupper: Array<{ gruppe: string, andel: number }> }} rettelse
 * @param {Storage} [storage]
 * @param {() => string} [nu] injicerbart ur, til deterministiske tests
 * @returns {boolean} true hvis gemt
 */
export function gemRettelse({ oevelseNavn, grupper }, storage = globalThis.localStorage, nu = () => new Date().toISOString()) {
  if (!oevelseNavn?.trim() || !Array.isArray(grupper) || grupper.length === 0) return false
  const gyldig = grupper.every(g => g?.gruppe && (g.andel === 1 || g.andel === 0.5))
  if (!gyldig) return false

  const noegle = normaliserOevelsesnavn(oevelseNavn)
  const liste = laesAlle(storage).filter(r => normaliserOevelsesnavn(r?.oevelseNavn) !== noegle)
  liste.push({
    oevelseNavn: oevelseNavn.trim(),
    grupper: grupper.map(g => ({ gruppe: g.gruppe, andel: g.andel })),
    satAf: 'Marc',
    tidspunkt: nu(),
  })
  return skrivAlle(liste, storage)
}

/**
 * Fjerner en rettelse — øvelsen falder tilbage til modellens oprindelige
 * skøn (eller "ukendt", hvis rettelsen var den eneste kortlægning øvelsen
 * nogensinde har haft).
 *
 * @param {string} oevelseNavn
 * @param {Storage} [storage]
 */
export function fjernRettelse(oevelseNavn, storage = globalThis.localStorage) {
  const noegle = normaliserOevelsesnavn(oevelseNavn)
  const liste = laesAlle(storage)
  const tilbage = liste.filter(r => normaliserOevelsesnavn(r?.oevelseNavn) !== noegle)
  if (tilbage.length === liste.length) return false // ingen rettelse fandtes
  return skrivAlle(tilbage, storage)
}
