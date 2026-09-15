// ORDRE 185 (14. sep), commit 3: Marc retter kortlægningen selv, uden at
// åbne kildekoden. Oprindeligt kun localStorage (se git-historik for den
// version og dens begrundelse) — den ærlige grænse dengang: rettelser var
// pr. browser, ikke synkroniseret mellem Marcs enheder.
//
// ORDRE 209 (15. sep): den grænse løftes. Samme fem funktioner udadtil
// (hentRettelser, gemRettelse, fjernRettelse, plus de to interne
// laesAlle/skrivAlle), men nu bag ÉT lager med to bagender:
// - Supabase-tabellen `exercise_muscle_overrides` (docs/supabase/
//   20260915-exercise_muscle_overrides.sql), hvis den findes og der er en
//   coachId at scope til.
// - localStorage, som før — fallback når tabellen endnu ikke er migreret,
//   eller når der ikke er en indlogget coach at gemme under.
// Valget sker ved kørsel, med ét billigt opslag (`select .. head:true`) der
// fejler stille og falder tilbage til localStorage, ligesom hver eneste
// anden fejl i dette modul altid har gjort. Opslaget cachtes pr. klient
// (WeakMap), så det kun sker én gang pr. sideindlæsning, ikke ved hvert
// hentRettelser/gemRettelse/fjernRettelse-kald.
//
// Alle offentlige funktioner er derfor nu ASYNC (de var synkrone før 209) —
// en Supabase-bagende kan ikke være andet. Kaldere (VolumenKort.jsx,
// KortlaegningRedigering.jsx) er opdateret til at afvente dem.
//
// FLYT-OP, ÉN GANG: findes der lokale rettelser fra før migrationen, når
// tabellen første gang findes, flyttes de op automatisk (delete+insert pr.
// række, samme "sidste skrivning vinder"-ånd som localStorage-versionen
// altid har haft) og markeres flyttet i localStorage
// (entropi_muskelkort_rettelser_flyttet), så det kun sker én gang pr.
// browser. Lykkes det ikke (netværk nede), markeres intet, og det prøves
// igen ved næste kald.

import { normaliserOevelsesnavn } from './muskelkort.js'

const NOEGLE = 'entropi_muskelkort_rettelser'
const FLYTTET_NOEGLE = 'entropi_muskelkort_rettelser_flyttet'

/** Tabelnavnet i docs/supabase/20260915-exercise_muscle_overrides.sql. */
export const TABELNAVN = 'exercise_muscle_overrides'

// ---------------------------------------------------------------------
// localStorage-bagende — uændret facon ift. ordre 185.
// ---------------------------------------------------------------------

function laesAlleLokalt(storage) {
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

function skrivAlleLokalt(liste, storage) {
  try {
    if (!storage) return false
    storage.setItem(NOEGLE, JSON.stringify(liste))
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------
// Supabase-bagende.
// ---------------------------------------------------------------------

const tabelFindesCache = new WeakMap()

/**
 * Findes tabellen, og er der en coach at scope til? Cachet pr. klient, så
 * det ægte netværkskald kun sker én gang. Enhver fejl (tabel findes ikke
 * endnu, ingen forbindelse, RLS afviser) tolkes som "brug localStorage" —
 * ingen af dem skal væltet kortet.
 */
async function klarTilSupabase({ client, coachId }) {
  if (!client || !coachId) return false
  if (tabelFindesCache.has(client)) return tabelFindesCache.get(client)
  const findes = await client
    .from(TABELNAVN)
    .select('id', { head: true, count: 'exact' })
    .then(({ error }) => !error)
    .catch(() => false)
  tabelFindesCache.set(client, findes)
  return findes
}

async function laesAlleSupabase(client, coachId) {
  try {
    const { data, error } = await client
      .from(TABELNAVN)
      .select('exercise_name, groups, set_by, updated_at, created_at')
      .eq('coach_id', coachId)
    if (error || !Array.isArray(data)) return []
    return data.map(row => ({
      oevelseNavn: row.exercise_name,
      grupper: row.groups,
      satAf: row.set_by || 'Marc',
      tidspunkt: row.updated_at || row.created_at,
    }))
  } catch {
    return []
  }
}

async function skrivEnSupabase(client, coachId, { oevelseNavn, grupper, satAf, tidspunkt }) {
  try {
    const noegle = normaliserOevelsesnavn(oevelseNavn)
    // Delete+insert, ikke upsert — samme "erstat helt" som localStorage-
    // versionens filter+push, og undgår at skulle emulere en sammensat
    // on_conflict-nøgle i e2e-mocken.
    await client.from(TABELNAVN).delete().eq('coach_id', coachId).eq('exercise_key', noegle)
    const { error } = await client.from(TABELNAVN).insert({
      coach_id: coachId,
      exercise_key: noegle,
      exercise_name: oevelseNavn,
      groups: grupper,
      set_by: satAf,
      updated_at: tidspunkt,
    })
    return !error
  } catch {
    return false
  }
}

async function fjernEnSupabase(client, coachId, oevelseNavn) {
  try {
    const noegle = normaliserOevelsesnavn(oevelseNavn)
    const { error, count } = await client
      .from(TABELNAVN)
      .delete({ count: 'exact' })
      .eq('coach_id', coachId)
      .eq('exercise_key', noegle)
    return !error && (count ?? 0) > 0
  } catch {
    return false
  }
}

async function flytLokaleRettelserOpEnGang({ storage, client, coachId }) {
  if (!storage) return
  try {
    if (storage.getItem(FLYTTET_NOEGLE) === '1') return
  } catch {
    return
  }
  const lokale = laesAlleLokalt(storage)
  if (lokale.length === 0) {
    try { storage.setItem(FLYTTET_NOEGLE, '1') } catch { /* prøves igen næste gang */ }
    return
  }
  try {
    for (const r of lokale) {
      if (!r?.oevelseNavn || !Array.isArray(r.grupper)) continue
      const ok = await skrivEnSupabase(client, coachId, {
        oevelseNavn: r.oevelseNavn,
        grupper: r.grupper,
        satAf: r.satAf || 'Marc',
        tidspunkt: r.tidspunkt || new Date().toISOString(),
      })
      if (!ok) throw new Error('flyt-op fejlede')
    }
    storage.setItem(FLYTTET_NOEGLE, '1')
  } catch {
    // Fejler stille — flyttet-flaget sættes IKKE, så næste kald prøver
    // igen. Delete+insert er idempotent, så et gentaget forsøg er trygt.
  }
}

// ---------------------------------------------------------------------
// Offentlig, bagende-agnostisk API.
// ---------------------------------------------------------------------

/**
 * Hvor gemmes rettelser lige nu — til UI'ets "gemmes på denne enhed" / "på
 * din konto"-linje (KortlaegningRedigering.jsx).
 *
 * @param {{ client?: object, coachId?: string }} [opts]
 * @returns {Promise<'supabase'|'lokalt'>}
 */
export async function hentLagerType({ client = null, coachId = null } = {}) {
  return (await klarTilSupabase({ client, coachId })) ? 'supabase' : 'lokalt'
}

/**
 * Alle gemte rettelser, som et Map keyed på normaliseret øvelsesnavn — den
 * facon `slaaOevelseOp` i muskelkort.js forventer som sit `rettelser`-param.
 *
 * @param {{ storage?: Storage, client?: object, coachId?: string }} [opts]
 * @returns {Promise<Map<string, { oevelseNavn: string, grupper: Array<{ gruppe: string, andel: number }>, satAf: string, tidspunkt: string }>>}
 */
export async function hentRettelser({ storage = globalThis.localStorage, client = null, coachId = null } = {}) {
  let liste
  if (await klarTilSupabase({ client, coachId })) {
    await flytLokaleRettelserOpEnGang({ storage, client, coachId })
    liste = await laesAlleSupabase(client, coachId)
  } else {
    liste = laesAlleLokalt(storage)
  }
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
 * @param {{ storage?: Storage, client?: object, coachId?: string, nu?: () => string }} [opts] `nu` er et injicerbart ur, til deterministiske tests
 * @returns {Promise<boolean>} true hvis gemt
 */
export async function gemRettelse({ oevelseNavn, grupper }, { storage = globalThis.localStorage, client = null, coachId = null, nu = () => new Date().toISOString() } = {}) {
  if (!oevelseNavn?.trim() || !Array.isArray(grupper) || grupper.length === 0) return false
  const gyldig = grupper.every(g => g?.gruppe && (g.andel === 1 || g.andel === 0.5))
  if (!gyldig) return false

  const rettelse = {
    oevelseNavn: oevelseNavn.trim(),
    grupper: grupper.map(g => ({ gruppe: g.gruppe, andel: g.andel })),
    satAf: 'Marc',
    tidspunkt: nu(),
  }

  if (await klarTilSupabase({ client, coachId })) {
    await flytLokaleRettelserOpEnGang({ storage, client, coachId })
    return skrivEnSupabase(client, coachId, rettelse)
  }

  const noegle = normaliserOevelsesnavn(oevelseNavn)
  const liste = laesAlleLokalt(storage).filter(r => normaliserOevelsesnavn(r?.oevelseNavn) !== noegle)
  liste.push(rettelse)
  return skrivAlleLokalt(liste, storage)
}

/**
 * Fjerner en rettelse — øvelsen falder tilbage til modellens oprindelige
 * skøn (eller "ukendt", hvis rettelsen var den eneste kortlægning øvelsen
 * nogensinde har haft).
 *
 * @param {string} oevelseNavn
 * @param {{ storage?: Storage, client?: object, coachId?: string }} [opts]
 * @returns {Promise<boolean>}
 */
export async function fjernRettelse(oevelseNavn, { storage = globalThis.localStorage, client = null, coachId = null } = {}) {
  if (await klarTilSupabase({ client, coachId })) {
    await flytLokaleRettelserOpEnGang({ storage, client, coachId })
    return fjernEnSupabase(client, coachId, oevelseNavn)
  }

  const noegle = normaliserOevelsesnavn(oevelseNavn)
  const liste = laesAlleLokalt(storage)
  const tilbage = liste.filter(r => normaliserOevelsesnavn(r?.oevelseNavn) !== noegle)
  if (tilbage.length === liste.length) return false // ingen rettelse fandtes
  return skrivAlleLokalt(tilbage, storage)
}
