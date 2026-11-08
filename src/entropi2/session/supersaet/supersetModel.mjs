import { parsePlannedRest } from '../tempo/tempoParser.mjs'

// Read-only contract over existing exercise rows. Only complete note clauses
// declare groups: "Supersæt: A" or "Cirkel: B" (semicolon/newline separated).
const clauses = note => typeof note === 'string' ? note.split(/[;\r\n]+/).map(s => s.trim()) : []
function metadata(exercise) {
  const markers = [], rests = []
  let invalidMarker = false, invalidRest = false
  for (const clause of clauses(exercise.note)) {
    if (/^(?:supersæt|supersaet|cirkel)\s*:/i.test(clause)) {
      const match = clause.match(/^(supersæt|supersaet|cirkel)\s*:\s*([a-z0-9_-]{1,32})$/i)
      if (match) markers.push({ kind: /^cirkel$/i.test(match[1]) ? 'circuit' : 'superset', key: match[2].toUpperCase() })
      else invalidMarker = true
    }
    const rest = clause.match(/^(?:pause|hvile|rest)\s*:?\s*(.+)$/i)
    if (rest) {
      const parsed = parsePlannedRest(rest[1])
      if (parsed.status === 'valid') rests.push(parsed.seconds)
      else invalidRest = true
    }
  }
  // Conflicting or repeated declarations never silently choose a group.
  return { marker: !invalidMarker && markers.length === 1 ? markers[0] : null,
    invalidMarker: invalidMarker || markers.length > 1,
    restSeconds: !invalidRest && rests.length ? Math.max(...rests) : null, invalidRest }
}
const numeric = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '')
  && Number.isFinite(Number(value)) ? Number(value) : null

// Optional overview only advertises groups with known members and dosage.
// Preserve the underlying parser and each exercise's independent logging plan.
export function sessionGroupsForDisplay(exercises) {
  const displayWarnings = []
  const model = buildSessionGroups(exercises, displayWarnings)
  const groups = model.groups.filter(group => group.members.every(member =>
    typeof exercises?.[member.sourceIndex]?.name === 'string' && exercises[member.sourceIndex].name.trim()
    && member.sets != null && member.sets > 0))
  return { groups, message: displayWarnings.length || groups.length !== model.groups.length
    ? 'Øvelsesgruppen er ufuldstændig. Følg planen for hver øvelse, og bed din coach rette gruppen.' : null }
}

export function groupSessionExercises(exercises = []) {
  return buildSessionGroups(exercises)
}

function buildSessionGroups(exercises = [], displayWarnings = []) {
  const warnings = []
  const warn = (message, forDisplay = true) => {
    warnings.push(message)
    if (forDisplay) displayWarnings.push(message)
  }
  if (!Array.isArray(exercises)) { warn('Øvelseslisten kan ikke læses.'); return { groups: [], warnings } }
  const rows = exercises.flatMap((exercise, sourceIndex) => {
    if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
      warn(`Øvelse ${sourceIndex + 1} kan ikke læses.`); return []
    }
    const meta = metadata(exercise), count = numeric(exercise.sets)
    const sets = Number.isInteger(count) && count >= 0 && count <= 1000 ? count : null
    if (sets == null) warn(`Øvelse ${sourceIndex + 1}: antal sæt kan ikke læses (0–1000 hele sæt).`)
    if (meta.invalidMarker) warn(`Øvelse ${sourceIndex + 1}: gruppemarkering er ugyldig eller gentaget.`)
    // A single's unreadable rest is still a raw warning, but is no evidence of
    // an incomplete group. Reuse parsed marker metadata, including bad markers.
    if (meta.invalidRest) warn(`Øvelse ${sourceIndex + 1}: pause kan ikke læses.`, !!meta.marker || meta.invalidMarker)
    return [{ exercise, sourceIndex, order: numeric(exercise.exercise_order), sets, ...meta }]
  }).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.sourceIndex - b.sourceIndex)
  // An unreadable row could separate two groups. Never bridge that gap.
  if (rows.length !== exercises.length) return { groups: [], warnings }
  const groups = []
  for (const row of rows) {
    let group = groups.at(-1)
    if (!row.marker || !group?.marker || group.marker.kind !== row.marker.kind || group.marker.key !== row.marker.key) {
      group = { marker: row.marker, members: [] }; groups.push(group)
    }
    group.members.push(row)
  }
  return { warnings, groups: groups.map((group, index) => {
    const kind = group.marker && group.members.length > 1 ? group.marker.kind : 'single'
    if (group.marker && kind === 'single') warn(`Gruppe ${group.marker.key} har kun én sammenhængende øvelse og vises enkeltvis.`)
    const rounds = Math.max(0, ...group.members.map(row => row.sets ?? 0))
    const pauses = group.members.map(row => row.restSeconds).filter(value => value != null)
    // A group honours the longest declared pause after each round. Unknown
    // pauses stay unknown; between members there is no planned pause.
    const restSeconds = pauses.length ? Math.max(...pauses) : null
    const steps = []
    // Partial prescriptions cannot provide a trustworthy execution sequence.
    const complete = group.members.every(row => row.sets != null)
    for (let round = 1; complete && round <= rounds; round++) {
      const active = group.members.filter(row => row.sets != null && row.sets >= round)
      active.forEach((row, memberIndex) => {
        const roundEnd = memberIndex === active.length - 1
        steps.push({ sourceIndex: row.sourceIndex, exerciseId: row.exercise.id ?? null,
          name: typeof row.exercise.name === 'string' ? row.exercise.name : 'Øvelse uden navn',
          setNumber: round, round, roundEnd,
          restAfterSeconds: roundEnd ? restSeconds : 0 })
      })
    }
    return { key: `group-${index}`, kind, label: kind === 'single' ? 'Enkeltøvelse'
      : `${kind === 'superset' ? 'Supersæt' : 'Cirkel'} ${group.marker.key}`,
    members: group.members.map(row => ({ sourceIndex: row.sourceIndex, exerciseId: row.exercise.id ?? null,
      name: typeof row.exercise.name === 'string' ? row.exercise.name : 'Øvelse uden navn', sets: row.sets })),
    rounds, restSeconds, steps }
  }) }
}
