// Local review only. No database payload, athlete identity or persistence.
export const ANALYSE_PAKKE_FORMAT = 'analyse-pakke-v1'
export const ANALYSE_PAKKE_MAX_BYTES = 512 * 1024
const objekt = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const tekst = v => typeof v === 'string' && v.trim().length > 0 && v.length <= 4000
const tal = v => v === null || (typeof v === 'number' && Number.isFinite(v))
const liste = v => Array.isArray(v) && v.length <= 1000

// Mirrors video/pakke.mjs::valider; adds safe handling of malformed local JSON.
export function validerAnalysePakke(p) {
  if (!objekt(p)) return ['Pakken skal være et objekt.']
  const fejl = []
  if (p.format !== ANALYSE_PAKKE_FORMAT) fejl.push('Ukendt pakkeformat.')
  if (!tekst(p.klipId)) fejl.push('Klip-id mangler.')
  if (!['squat', 'baenk', 'doedloeft'].includes(p.loeft)) fejl.push('Ukendt løft.')
  if (typeof p.dato !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.dato)) fejl.push('Dato mangler (AAAA-MM-DD).')
  if (!liste(p.reps) || p.reps.some(r => !objekt(r) || !Number.isInteger(r.rep) ||
    ['meanMs', 'topMs', 'tabPct'].some(k => !(k in r) || !tal(r[k])))) fejl.push('Rep-tal skal være tal eller null; alle felter skal være med.')
  if (!liste(p.saet) || !p.saet.length || p.saet.some(s => !objekt(s) || !liste(s.reps) ||
    s.reps.some(r => !Number.isInteger(r)) || !('tabPct' in s) || !tal(s.tabPct))) fejl.push('Sæt og sættab mangler eller er ugyldige.')
  if (!liste(p.fund) || p.fund.some(f => !objekt(f) || !tekst(f.type) || !tekst(f.linje) ||
    !['lav', 'middel', 'hoej'].includes(f.sikkerhed) || !objekt(f.tal))) fejl.push('Fund eller sikkerhed er ugyldige.')
  if (!liste(p.ikkeRegnet) || p.ikkeRegnet.some(x => !tekst(x))) fejl.push('Grænser skal være en liste af tekster.')
  if (!objekt(p.kvalitet) || !['meta', 'raa-45cm-skive'].includes(p.kvalitet.skala) ||
    !['givet', 'automatisk'].includes(p.kvalitet.seed)) fejl.push('Skala eller seed er ukendt.')
  if (!objekt(p.kilde) || !['bane', 'hastighed', 'fund'].every(k => /^[0-9a-f]{16}$/.test(p.kilde[k] || ''))) fejl.push('Kilde-hashes mangler.')
  if (!tekst(p.forbehold)) fejl.push('Forbehold mangler.')
  return fejl
}

// Explicit projection: unknown fields never enter the review row.
export function pakkeTilReviewRaekke(pakke, ramme = {}) {
  const fejl = validerAnalysePakke(pakke)
  if (fejl.length) throw new Error(fejl.join(' '))
  return {
    lift: pakke.loeft,
    analyzed_at: pakke.dato,
    load_kg: typeof ramme.loadKg === 'number' && Number.isFinite(ramme.loadKg) ? ramme.loadKg : null,
    reps_count: pakke.reps.length,
    reps: pakke.reps.map(({ rep, meanMs, topMs, tabPct }) => ({ rep, meanMs, topMs, tabPct })),
    saet: pakke.saet.map(({ reps, tabPct }) => ({ reps: [...reps], tabPct })),
    findings: pakke.fund.map(({ type, linje, sikkerhed }) => ({ type, summary: linje, confidence: sikkerhed })),
    metrics: { velocity_loss_pct: { value: pakke.saet[0].tabPct, method: ANALYSE_PAKKE_FORMAT,
      confidence: pakke.kvalitet.skala === 'raa-45cm-skive' || pakke.kvalitet.seed === 'automatisk' ? 'lav' : 'middel' } },
    kvalitet: { skala: pakke.kvalitet.skala, seed: pakke.kvalitet.seed },
    ikkeRegnet: [...pakke.ikkeRegnet],
    forbehold: pakke.forbehold,
  }
}

export async function indlaesAnalysePakke(fil) {
  if (!fil || fil.size > ANALYSE_PAKKE_MAX_BYTES) throw new Error('Vælg en JSON-pakke på højst 512 KB.')
  let pakke
  try { pakke = JSON.parse(await fil.text()) }
  catch { throw new Error('Filen kunne ikke læses som JSON.') }
  return pakkeTilReviewRaekke(pakke)
}
