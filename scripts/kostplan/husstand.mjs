// Omsætter husstandsplanens format (PLAN-DATA.json, ordre 96) til ugeplan-JSON for
// skriv-forslag.mjs. Kun Frida-koblede varer; en ukoblet vare stopper med varens navn.
// Kun syntetiske data i repoet. Ingen personnavne, ingen lagring, intet net.
import { ForslagFejl } from './forslag.mjs'
import { FRIDA_KOBLING } from './fridaKobling.mjs'

export const SLOT_NAVN = Object.freeze({
  morgenmad: 'Morgenmad', frokost: 'Frokost', 'foer-traening': 'Før træning',
  aftensmad: 'Aftensmad', aftensnack: 'Aftensnack',
})
const stop = message => { throw new ForslagFejl(message) }

// planData: { dage: [{ dato, personer: { <nøgle>: { maaltider: { <slot>: { items } } } } }] }.
// felter: athleteId, goal, intensity, rationale, basisAsOf, targets, calculationBasis.
export function husstandTilUgeplan(planData, { person, fra, ...felter } = {}) {
  if (!Array.isArray(planData?.dage)) stop('PLAN-DATA mangler dage.')
  const start = planData.dage.findIndex(dag => dag?.dato === fra)
  if (start < 0) stop(`PLAN-DATA har ingen dag ${fra}.`)
  const dage = planData.dage.slice(start, start + 7)
  if (dage.length !== 7) stop(`PLAN-DATA har kun ${dage.length} dage fra ${fra}.`)
  const ukoblede = new Set()
  const days = dage.map(dag => {
    const maaltider = dag.personer?.[person]?.maaltider
    if (!maaltider || typeof maaltider !== 'object') stop(`${dag.dato}: personen findes ikke i planen.`)
    const meals = Object.entries(maaltider).map(([slot, maaltid]) => {
      if (!SLOT_NAVN[slot]) stop(`${dag.dato}: ukendt måltid ${slot}.`)
      return { name: SLOT_NAVN[slot], portions: (maaltid?.items ?? []).map(item => {
        const navn = item?.name
        if (typeof navn !== 'string' || item.foodId !== 'local:' + encodeURIComponent(navn)) stop(`${dag.dato}: varen ${navn ?? item?.foodId} har et foodId, der ikke passer til navnet.`)
        const foodId = FRIDA_KOBLING[navn]
        if (!foodId) ukoblede.add(navn)
        return { foodId, grams: item.grams, dagligvare: navn }
      }) }
    })
    return { date: dag.dato, meals }
  })
  if (ukoblede.size) stop(`Varen er ikke koblet til Frida: ${[...ukoblede].sort((a, b) => a.localeCompare(b, 'da')).join(', ')}.`)
  return { ...felter, days }
}
