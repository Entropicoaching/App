import { foldNavn, grundnavn } from './exerciseNames.js'

// Read-time lift identity. Original row names and IDs remain unchanged for writes.
const NUM = '(?:\\s*\\d+)?'
const TYPE = '(top(?:[ -]?(?:s(?:æ|ae)t|set))?' + NUM + '|back[ -]?off(?:[ -]?(?:s(?:æ|ae)t|set))?' + NUM +
  '|straight(?:[ -]?(?:s(?:æ|ae)t|sets?))?' + NUM + '|s(?:æ|ae)t\\s*\\d+)'
const suffix = new RegExp(`(?:\\s*[-\u2013:,]\\s*|\\s+)${TYPE}\\s*$`, 'i')
const parentheses = new RegExp(`\\s*\\(${TYPE}\\)\\s*$`, 'i')
const prefix = new RegExp(`^${TYPE}(?:\\s*[-\u2013:,]\\s*|\\s+)(.+)$`, 'i')

const LIFT_ALIASES = {
  squat: 'Squat', 'back squat': 'Squat', 'competition squat': 'Squat', baenk: 'Bænkpres', baenkpres: 'Bænkpres',
  bench: 'Bænkpres', 'bench press': 'Bænkpres',
  doedloeft: 'Dødløft', deadlift: 'Dødløft', dl: 'Dødløft',
  'konventionel doedloeft': 'Dødløft', 'conventional deadlift': 'Dødløft',
  'sumo doedloeft': 'Sumo dødløft', 'sumo deadlift': 'Sumo dødløft',
}

// Programlaegningens egne suffikser ("(comp)", "- volumen") foeles ind via
// grundnavn(); "Doedloeft (sumo)" / "Doedloeft - sumo" er sumo, ikke konventionel.
const SUMO_SUFFIX = /^(d(?:oe|ø)dl(?:oe|ø)ft|deadlift)\s*(?:[-–]\s*sumo|\(\s*sumo\s*\)|sumo)$/i
function foldBase(base) {
  let s = base
  for (let i = 0; i < 4; i++) {
    const g = grundnavn(s).replace(/\s*\((?:comp|competition)\)\s*$/i, '').trim()
    const t = g.replace(suffix, '').replace(parentheses, '').trim()
    const next = t || g
    if (next === s) break
    s = next
  }
  return SUMO_SUFFIX.test(s) ? 'Sumo dødløft' : s
}

export function exerciseSetView(input) {
  const raw = String(input ?? '').trim()
  const leading = raw.match(prefix)
  const match = raw.match(parentheses) || raw.match(suffix) || leading
  const base0 = leading && match === leading ? leading[2].trim() : match ? raw.slice(0, match.index).trim() : raw
  const base = base0 ? foldBase(base0) : base0
  // A bare "Topsaet" is ambiguous; never infer an exercise from its neighbour.
  if (!base) return { name: raw, key: foldNavn(raw), type: 'straight', label: 'Sæt' }
  const token = foldNavn(match?.[1] || '')
  const type = token.startsWith('top') ? 'top' : token.startsWith('back') ? 'backoff' : 'straight'
  const display = base.replace(/ae/gi, m => m[0] === 'A' ? 'Æ' : 'æ')
    .replace(/oe/gi, m => m[0] === 'O' ? 'Ø' : 'ø')
  // Transliteration is deliberately limited to the common lift names below.
  const known = /^(?:baenkpres|doedloeft|sumo doedloeft|konventionel doedloeft)$/i.test(base)
  const alias = LIFT_ALIASES[foldNavn(base)]
  const name = alias || (known ? display : base)
  return { name, key: foldNavn(name), type,
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

export function mainLiftName(name) {
  const view = exerciseSetView(name)
  return ['squat', 'baenkpres', 'doedloeft', 'sumo doedloeft'].includes(view.key) ? view.name : null
}
