import { foldNavn } from './exerciseNames.js'

// Presentation only. Never change names/IDs used by history, defaults or writes.
const TYPE = '(top(?:[ -]?(?:s(?:\u00e6|ae)t|set))?|back[ -]?off(?:[ -]?(?:s(?:\u00e6|ae)t|set))?|straight(?:[ -]?(?:s(?:\u00e6|ae)t|sets?))?)'
const suffix = new RegExp(`(?:\\s*[-\u2013:,]\\s*|\\s+)${TYPE}\\s*$`, 'i')
const parentheses = new RegExp(`\\s*\\(${TYPE}\\)\\s*$`, 'i')
const prefix = new RegExp(`^${TYPE}(?:\\s*[-\u2013:,]\\s*|\\s+)(.+)$`, 'i')

export function exerciseSetView(name) {
  const raw = String(name ?? '').trim()
  const leading = raw.match(prefix)
  const match = raw.match(parentheses) || raw.match(suffix) || leading
  const base = leading && match === leading ? leading[2].trim() : match ? raw.slice(0, match.index).trim() : raw
  // A bare "Topsaet" is ambiguous; never infer an exercise from its neighbour.
  if (!base) return { name: raw, key: foldNavn(raw), type: 'straight', label: 'Sæt' }
  const token = foldNavn(match?.[1] || '')
  const type = token.startsWith('top') ? 'top' : token.startsWith('back') ? 'backoff' : 'straight'
  const display = base.replace(/ae/gi, m => m[0] === 'A' ? 'Æ' : 'æ')
    .replace(/oe/gi, m => m[0] === 'O' ? 'Ø' : 'ø')
  // Transliteration is deliberately limited to the common lift names below.
  const known = /^(?:baenkpres|doedloeft|sumo doedloeft|konventionel doedloeft)$/i.test(base)
  return { name: known ? display : base, key: foldNavn(base), type,
    label: type === 'top' ? 'Top' : type === 'backoff' ? 'Backoff' : 'Sæt' }
}

// Consecutive rows become one visual exercise. A return to a lift after another
// exercise remains in its programmed position (circuits/supersets stay intact).
export function exerciseViewGroups(exercises = []) {
  const groups = []
  for (const ex of exercises || []) {
    const view = exerciseSetView(ex.name)
    let group = groups.at(-1)
    if (!group || !view.key || group.key !== view.key) {
      group = { key: view.key, name: view.name, rows: [], totalSets: 0 }
      groups.push(group)
    }
    const offset = group.totalSets
    group.rows.push({ ex, ...view, offset })
    group.totalSets += Number(ex.sets) || 0
  }
  return groups
}

export function exerciseViewRows(exercises) {
  return exerciseViewGroups(exercises).flatMap(group => group.rows.map((row, i) => ({
    ...row, name: group.name, startsGroup: i === 0, endsGroup: i === group.rows.length - 1,
    totalSets: group.totalSets,
    showPrescription: i === 0 || prescriptionKey(row.ex) !== prescriptionKey(group.rows[i - 1].ex),
  })))
}

// Only collapse identical adjacent prescriptions; differing loads/reps stay visible.
const prescriptionKey = ex => JSON.stringify([ex.sets, ex.reps, ex.intensity,
  ex.recommended_weight ?? null, ex.recommended_weight == null ? ex.name : null])

export function bestExerciseRecords(records = []) {
  const best = new Map()
  for (const r of records) {
    const view = exerciseSetView(r.exercise_name)
    const cur = best.get(view.key)
    const weight = Number(r.weight) || 0, reps = Number(r.reps) || 0
    if (!cur || weight > cur.weight || (weight === cur.weight && reps > cur.reps))
      best.set(view.key, { name: view.name, weight, reps })
  }
  return [...best.values()]
}
