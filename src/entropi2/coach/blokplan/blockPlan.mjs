import { planGrundlag, LIFTS } from '../planlaegning/planGrundlag.mjs'

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const ownKeys = (v, keys) => object(v) && Object.keys(v).every(k => keys.includes(k))
const number = (v, min, max, integer = false) => typeof v === 'number' && Number.isFinite(v) &&
  v >= min && v <= max && (!integer || Number.isInteger(v))

/** Local draft only. No dates, kg prescriptions, persistence or athlete delivery. */
export function suggestBlock(snapshot, today, options = {}) {
  const basis = planGrundlag(snapshot, today)
  const unknown = message => ({ state: 'unknown', message, weeks: [], errors: [] })
  if (basis.state !== 'ready' || !basis.planReady || !basis.logsReady ||
      !(basis.compliance.planned > 0) || !(basis.compliance.confirmed > 0))
    return unknown('Et komplet plan- og loggrundlag med gennemførte sæt mangler. Intet blokforslag er lavet.')
  const count = options.weekCount ?? basis.block.weekCount
  if (![4, 5, 6].includes(count)) return unknown('Vælg en blok på 4, 5 eller 6 uger.')
  const references = basis.lifts.map(l => ({ lift: l.lift, sets: Math.max(...l.points.map(p => p.sets)) }))
    .filter(l => l.sets > 0)
  if (!references.length) return unknown('Der mangler gennemførte hovedløftssæt. Intet blokforslag er lavet.')
  const cautious = basis.painSessions > 0 || basis.stopSessions > 0 || basis.compliance.percent < 80
  const weeks = Array.from({ length: count }, (_, i) => {
    const deload = i === count - 1
    const factor = deload ? 0.6 : cautious ? 0.7 : i === 0 ? 0.9 : 1
    return { week: i + 1, deload, lifts: references.map(l => ({ lift: l.lift,
      sets: Math.max(1, Math.round(l.sets * factor)), targetRpe: deload ? 5 : cautious ? 6 : i === 0 ? 6 : 7 })) }
  })
  const edits = options.edits ?? {}, errors = []
  if (!object(edits)) errors.push('Rettelser skal være et objekt med ugenumre.')
  else for (const [key, patch] of Object.entries(edits)) {
    const week = weeks.find(w => String(w.week) === key)
    if (!week || !ownKeys(patch, ['deload', 'lifts'])) { errors.push(`Ugyldig rettelse for uge ${key}.`); continue }
    if ('deload' in patch) {
      if (typeof patch.deload !== 'boolean') errors.push(`Uge ${key}: deload skal være ja eller nej.`)
      else week.deload = patch.deload
    }
    if (!('lifts' in patch)) continue
    if (!ownKeys(patch.lifts, references.map(l => l.lift))) { errors.push(`Uge ${key}: ukendt løft.`); continue }
    for (const [name, values] of Object.entries(patch.lifts)) {
      const lift = week.lifts.find(l => l.lift === name)
      if (!ownKeys(values, ['sets', 'targetRpe'])) { errors.push(`Uge ${key}, ${name}: ugyldige felter.`); continue }
      for (const [field, value] of Object.entries(values)) {
        const valid = field === 'sets' ? number(value, 0, 100, true) : number(value, 1, 9.5)
        if (!valid) errors.push(`Uge ${key}, ${name}: ${field === 'sets' ? 'sæt skal være et heltal fra 0 til 100' : 'RPE skal være fra 1 til 9,5'}.`)
        else lift[field] = value
      }
    }
  }
  return { state: errors.length ? 'invalid' : 'ready', weeks, errors, cautious,
    sourceBlock: { id: basis.block.id, start: basis.block.start_date, end: basis.block.end_date },
    references, omittedLifts: LIFTS.filter(l => !references.some(r => r.lift === l)),
    message: 'Lokalt coachudkast. Gennemgå og ret før brug. Ingen plan er gemt eller sendt.',
    reasons: [
      'Volumen er sæt pr. hovedløft; udgangspunktet er højeste registrerede uge i sidste blok. Varianter og assistance er ikke med.',
      cautious ? 'Smerte, stop eller under 80 % registreret gennemførelse: reduceret udkast kræver coachens vurdering.'
        : 'Første uge starter lavere; de følgende arbejdsuger fastholder referencevolumen.',
      'Sidste uge foreslås som deload med 60 % af referencevolumen og mål-RPE 5. Afrunding giver mindst ét sæt pr. løft.',
      'Intensitet er mål-RPE (oplevet anstrengelse), ikke procent af 1RM eller en beregnet vægt. Rettelser ændrer kun de valgte felter.'
    ] }
}

/** Controlled editor helper. Input objects are never modified. */
export function editBlockPlan(edits, { week, lift, field, value }) {
  const key = String(week), previous = edits?.[key] ?? {}
  if (field === 'deload') return { ...edits, [key]: { ...previous, deload: value } }
  return { ...edits, [key]: { ...previous, lifts: { ...previous.lifts,
    [lift]: { ...previous.lifts?.[lift], [field]: value } } } }
}
