// APP-S1. Pure suggestions only. No I/O, clock, storage or application imports.
export const BAR = 20
export const NOTICE = 'Forslag til coachens tilpasning. Ingen medicinsk eller sportsregelgaranti. Rettelser og tjek gemmes kun mens fanen er åben.'
export const CHECKLIST = Object.freeze([
  Object.freeze({ id: 'weighin', label: 'Vejning: bekræft tid og sted med arrangøren' }),
  Object.freeze({ id: 'equipment', label: 'Udstyr: pak og afklar krav med coach og arrangør' }),
  Object.freeze({ id: 'openers', label: 'Åbningsforsøg: gennemgå alle dagens løft med coach' }),
])
export const LIFTS = Object.freeze([
  Object.freeze({ key: 'squat', label: 'Squat' }),
  Object.freeze({ key: 'bench', label: 'Bænkpres' }),
  Object.freeze({ key: 'deadlift', label: 'Dødløft' }),
])
export function number(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !/^\d+(?:[.,]\d+)?$/.test(value.trim())) return null
  const n = Number(typeof value === 'string' ? value.trim().replace(',', '.') : value)
  return Number.isFinite(n) ? n : null
}
export function roundWeight(value) {
  const n = number(value)
  return n !== null && n > 0 && n <= 1000 ? Math.round(n / 2.5) * 2.5 : null
}
export function labelWeight(weight, opener) {
  return weight === BAR ? 'Stang' : `${Math.round(weight / opener * 100)}%`
}
// Split bar-to-opener distance into descending integer 2.5 kg gaps.
// Ratios are suggestions, not physiology: 8:4:2:1:1. Repair rounding
// by moving a grid unit left until every subsequent gap is <= its predecessor.
export function suggestSets(value) {
  const opener = number(value)
  if (opener === null || opener <= BAR || opener > 1000) return []
  // A non-grid opener is preserved; only suggested weights are rounded.
  const ceiling = Math.ceil(opener / 2.5)
  const units = ceiling - BAR / 2.5
  const count = Math.min(5, units)
  const ratios = [8, 4, 2, 1, 1].slice(0, count)
  const sum = ratios.reduce((a, b) => a + b, 0)
  const gaps = ratios.map(r => Math.max(1, Math.floor(units * r / sum)))
  let remaining = units - gaps.reduce((a, b) => a + b, 0)
  for (let i = 0; remaining > 0; i = (i + 1) % count, remaining--) gaps[i]++
  // floors with minimum 1 can overshoot only for short ramps.
  while (gaps.reduce((a, b) => a + b, 0) > units) {
    const i = gaps.findIndex(g => g > 1)
    gaps[i]--
  }
  for (let i = gaps.length - 1; i > 0;) {
    if (gaps[i] > gaps[i - 1]) { gaps[i]--; gaps[i - 1]++; i = gaps.length - 1 }
    else i--
  }
  const rows = [{ weight: BAR, reps: 5, pct: 'Stang', minutesBefore: 25 }]
  let weight = BAR
  for (let i = 0; i < gaps.length - 1; i++) {
    weight += gaps[i] * 2.5
    if (weight >= opener) break
    rows.push({ weight, reps: [3, 2, 1, 1][i], pct: labelWeight(weight, opener), minutesBefore: [18, 12, 8, 4][i] })
  }
  return rows
}
export function parseTime(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}
export function setTime(start, minutesBefore) {
  const base = parseTime(start)
  if (base === null || !Number.isInteger(minutesBefore) || minutesBefore < 1 || minutesBefore > 180) return null
  const absolute = base - minutesBefore
  const minute = ((absolute % 1440) + 1440) % 1440
  return { time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, dayOffset: Math.floor(absolute / 1440) }
}
export function timeLabel(start, minutesBefore) {
  const result = setTime(start, minutesBefore)
  return result ? `${result.time}${result.dayOffset < 0 ? ' (dagen før)' : ''}` : `${minutesBefore} min før åbner`
}
export function correctSet(rows, index, patch, opener) {
  if (!Array.isArray(rows) || !Number.isInteger(index) || !rows[index] || !patch) return rows
  if (patch.skipped === true) return rows.filter((_, i) => i !== index)
  const old = rows[index]
  const next = { ...old }
  if ('weight' in patch) {
    const rawWeight = number(patch.weight)
    if (rawWeight === null || rawWeight < BAR) return rows
    const weight = roundWeight(rawWeight)
    if (weight === null || weight < BAR || weight >= number(opener)) return rows
    next.weight = weight
    next.pct = labelWeight(weight, number(opener))
  }
  for (const [field, max] of [['reps', 20], ['minutesBefore', 180]]) {
    if (!(field in patch)) continue
    const n = number(patch[field])
    if (!Number.isInteger(n) || n < 1 || n > max) return rows
    next[field] = n
  }
  return rows.map((row, i) => i === index ? next : { ...row })
}
export function checklistState(previous, id, checked) {
  if (!CHECKLIST.some(item => item.id === id) || typeof checked !== 'boolean') return previous
  return { ...previous, [id]: checked }
}
export function meetPlan(attempts, meetType) {
  return LIFTS.filter(lift => meetType === 'sbd' || lift.key === 'bench').map(lift => {
    const opener = number(attempts?.[lift.key]?.[0]?.w)
    return { ...lift, opener, sets: suggestSets(opener) }
  })
}

export function finalizeDraft(draft, opener) {
  const error = 'Brug vægt fra 20 kg til under åbneren, 1 til 20 reps og 1 til 180 hele minutter.'
  const opening = number(opener)
  if (!Array.isArray(draft) || opening === null || opening <= BAR || opening > 1000) return { ok: false, error }
  const sets = []
  for (const row of draft) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !['weight', 'reps', 'minutesBefore'].every(key => key in row)) return { ok: false, error }
    const base = [{ weight: BAR, reps: 5, pct: 'Stang', minutesBefore: 25 }]
    const result = correctSet(base, 0, { weight: row.weight, reps: row.reps, minutesBefore: row.minutesBefore }, opening)
    if (result === base) return { ok: false, error }
    sets.push(result[0])
  }
  if (sets.some((row, i) => i > 0 && row.minutesBefore >= sets[i - 1].minutesBefore)) {
    return { ok: false, error: 'Tiderne skal komme i rækkefølge med færre minutter før åbneren.' }
  }
  return { ok: true, sets }
}
