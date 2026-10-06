import { foldNavn } from './exerciseNames.js'

// Presentation only. Never change names/IDs used by history, defaults or writes.
const TYPE = '(top(?:s(?:æ|ae)t|set)?|back[ -]?off(?:[ -]?(?:s(?:æ|ae)t|set))?|straight(?:[ -]?(?:s(?:æ|ae)t|sets?))?)'
const suffix = new RegExp(`(?:\\s*[-–:]\\s*|\\s+)${TYPE}\\s*$`, 'i')
const parentheses = new RegExp(`\\s*\\(${TYPE}\\)\\s*$`, 'i')

export function exerciseSetView(name) {
  const raw = String(name ?? '').trim()
  const match = raw.match(parentheses) || raw.match(suffix)
  const base = match ? raw.slice(0, match.index).trim() : raw
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
  })))
}
