import { isDayReceipt } from '../../mealEvidence.mjs'

const scalar = value => {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) return value
  throw new TypeError('Eksportfelt skal være tekst, et endeligt tal, boolean eller null.')
}
const definitions = {
  training: {
    source: 'exerciseLogs', filename: 'traening',
    fields: {
      log_id: r => r.id, logged_at: r => r.logged_at,
      exercise_id: r => r.exercise_id, exercise: r => r.exercises?.name,
      set_number: r => r.set_number, weight_kg: r => r.weight,
      reps_completed: r => r.reps_completed, rpe_planned: r => r.rpe_planned,
      rpe_actual: r => r.rpe_actual, skipped: r => r.skipped, note: r => r.note,
    },
  },
  nutrition: {
    source: 'mealLogs', filename: 'kost',
    fields: {
      log_id: r => r.id, date: r => r.date, meal: r => r.meal,
      kcal: r => r.kcal, protein_g: r => r.protein, carbs_g: r => r.carb, fat_g: r => r.fat,
    },
  },
  weight: {
    source: 'weightLogs', filename: 'vaegt',
    fields: { log_id: r => r.id, logged_at: r => r.logged_at, weight_kg: r => r.weight },
  },
}

// No reads, implicit clock, mutation or side effects. Each source must be a
// complete persisted snapshot: { athleteId, state: 'ready', complete: true, rows }.
// Caller supplies the CURRENT athlete's athletes.id (never user_id) and handles
// authorization, pagination and load failures before enabling an export action.
export function buildAthleteExport({ athleteId, exerciseLogs, mealLogs, weightLogs } = {}) {
  if (typeof athleteId !== 'string' || !athleteId.trim()) {
    throw new TypeError('Et eksplicit atlet-id er påkrævet.')
  }
  const sources = { exerciseLogs, mealLogs, weightLogs }
  const result = { schema: 'entropi-athlete-export/v1', datasets: {} }
  for (const [key, definition] of Object.entries(definitions)) {
    const source = sources[definition.source]
    if (source?.athleteId !== athleteId || source.state !== 'ready' ||
        source.complete !== true || !Array.isArray(source.rows)) {
      throw new TypeError('Alle kilder skal være komplette og klar for den aktuelle atlet.')
    }
    result.datasets[key] = source.rows
      .filter(row => row && !Array.isArray(row) && row.athlete_id === athleteId &&
        !row._optimistic && !row.pending && !(key === 'nutrition' && isDayReceipt(row)))
      .map(row => Object.fromEntries(Object.entries(definition.fields)
        .map(([column, read]) => [column, scalar(read(row))])))
  }
  return result
}

// Quote every cell (RFC 4180). Only string values need formula neutralization;
// actual numeric negatives stay numeric. JSON always preserves the original text.
function csvCell(value) {
  let text = value == null ? '' : String(value)
  if (typeof value === 'string' && /^(?:[\s\uFEFF]*[=+\-@]|[\t\r\n])/u.test(value)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}

// JSON: one file with all three datasets. CSV: three files, one per dataset.
// UI integration should offer one download button per CSV (browser gesture rules).
export function createAthleteExportFiles(input, format) {
  if (format !== 'json' && format !== 'csv') throw new TypeError('Vælg csv eller json.')
  const data = buildAthleteExport(input)
  if (format === 'json') return [{
    filename: 'entropi-egne-data.json', type: 'application/json;charset=utf-8',
    content: JSON.stringify(data, null, 2) + '\n',
  }]
  return Object.entries(definitions).map(([key, definition]) => {
    const columns = Object.keys(definition.fields)
    const lines = [columns, ...data.datasets[key].map(row => columns.map(column => row[column]))]
    return {
      filename: `entropi-egne-${definition.filename}.csv`, type: 'text/csv;charset=utf-8',
      content: '\uFEFF' + lines.map(line => line.map(csvCell).join(',')).join('\r\n') + '\r\n',
    }
  })
}
