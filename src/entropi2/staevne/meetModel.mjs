export const LIFTS = Object.freeze({ squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' })
export const STRATEGIES = Object.freeze({ conservative: 'Konservativ', normal: 'Normal', aggressive: 'Aggressiv' })
const ratios = { conservative: [0.87, 0.94, 0.98], normal: [0.90, 0.97, 1], aggressive: [0.92, 1, 1.03] }
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const positive = value => typeof value === 'number' && Number.isFinite(value) && value >= 2.5 && value <= 2000
const down = value => Math.floor((value + 1e-9) / 2.5) * 2.5
const fail = message => ({ status: 'error', message, attempts: [], warmup: [] })
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null
}
const timeText = minutes => `${String(Math.floor(((minutes % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((minutes % 60) + 60) % 60).padStart(2, '0')}`

/** Pure proposals; dates and times are supplied by the caller, never read from a clock. */
export function planLift(input, strategy = 'normal', referenceDate) {
  if (!Object.hasOwn(ratios, strategy)) return fail('Ukendt strategi. Vælg konservativ, normal eller aggressiv.')
  if (input == null) return { status: 'empty', message: 'Ingen e1RM eller nylige tunge singler.', attempts: [], warmup: [] }
  if (!record(input)) return fail('Løftets data har forkert format.')
  const { e1RM, heavySingles = [], openerTime } = input
  if (e1RM != null && !positive(e1RM)) return fail('e1RM skal være et tal fra 2,5 til 2000 kg.')
  if (!Array.isArray(heavySingles)) return fail('Tunge singler skal være en liste.')
  if (heavySingles.length && day(referenceDate) === null) return fail('Angiv en gyldig referencedato for singler.')
  if (heavySingles.some(single => !record(single) || !positive(single.kg) || day(single.date) === null))
    return fail('En tung single mangler gyldig dato eller vægt.')
  const recent = heavySingles.filter(single => {
    const age = (day(referenceDate) - day(single.date)) / 86400000
    return age >= 0 && age <= 42
  }).slice().sort((a, b) => day(b.date) - day(a.date)).slice(0, 3)
  const best = recent.length ? Math.max(...recent.map(single => single.kg)) : null
  // A recent single can lower an older estimate. A single alone is an observed
  // reference, not a newly invented e1RM. No RPE assumption is made.
  const reference = e1RM != null ? (best === null ? e1RM : Math.min(e1RM, best / 0.95)) : best
  if (reference === null) return { status: 'empty', message: 'Ingen e1RM eller tunge singler fra de seneste 42 dage.', attempts: [], warmup: [] }
  const attempts = ratios[strategy].map(ratio => Math.min(2000, Math.max(2.5, down(reference * ratio))))
  let openerMinutes = null
  if (openerTime != null && openerTime !== '') {
    if (typeof openerTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(openerTime)) return fail('Åbnertid skal være HH:MM.')
    const [hour, minute] = openerTime.split(':').map(Number)
    openerMinutes = hour * 60 + minute
  }
  const seen = new Set()
  const warmup = [[0.4, 5, 35], [0.6, 3, 25], [0.75, 2, 15], [0.87, 1, 7]].flatMap(([ratio, reps, minutesBefore]) => {
    const kg = down(attempts[0] * ratio)
    if (kg < 2.5 || kg >= attempts[0] || seen.has(kg)) return []
    seen.add(kg)
    const minutes = openerMinutes === null ? null : openerMinutes - minutesBefore
    return [{ kg, reps, minutesBefore, time: minutes === null ? null : timeText(minutes), previousDay: minutes !== null && minutes < 0 }]
  })
  return { status: 'ready', attempts, warmup, reference, recentCount: recent.length,
    basis: e1RM == null ? 'Observeret tung single; e1RM mangler.' : best === null ? 'e1RM; ingen nylige tunge singler.' : 'e1RM begrænset af nylige tunge singler.',
    openerTime: openerMinutes === null ? null : openerTime }
}

/** Accept Danish decimal text from controlled inputs; never coerce booleans or blanks to zero. */
export function validateResult(value) {
  if (value == null) return { status: 'empty' }
  if (!record(value)) return { status: 'error', message: 'Resultatet har forkert format.' }
  const status = value.status ?? 'pending'
  if (!['pending', 'good', 'miss'].includes(status)) return { status: 'error', message: 'Vælg afventer, godkendt eller underkendt.' }
  const raw = value.kg
  if (raw == null || raw === '') return status === 'pending' ? { status: 'empty' } : { status: 'error', message: 'Angiv kg for det faktiske forsøg.' }
  const kg = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN
  if (!positive(kg) || !Number.isInteger(kg / 2.5)) return { status: 'error', message: 'Faktisk vægt skal være 2,5–2000 kg i trin på 2,5 kg.' }
  return { status: 'valid', kg, outcome: status }
}
