import { addCalendarDays } from '../../../calendarDate.js'
import { isDay } from '../visning/trackingContract.mjs'
import { exportCoachMonthlyReport } from './monthlyReport.mjs'

const PAGE = 500
const CAP = 10000
const failure = () => ({ status: 'error', message: 'Eksporten kunne ikke hentes komplet. Prøv igen.' })
export const validExportScope = scope => typeof scope?.coachId === 'string' && !!scope.coachId.trim() &&
  typeof scope.athleteId === 'string' && !!scope.athleteId.trim() && isDay(scope.asOf)

const fields = [
  ['exerciseLogs', 'exercise_logs', 'logged_at',
    'id,athlete_id,exercise_id,set_number,logged_at,weight,reps_completed,skipped,exercises(name,sessions(weeks(block_name)))'],
  ['mealRows', 'meal_logs', 'date', 'id,athlete_id,date,meal,kcal,protein,carb,fat'],
  ['weightRows', 'weight_logs', 'logged_at', 'id,athlete_id,logged_at,weight'],
  ['dailyRows', 'readiness_logs', 'logged_date', 'id,athlete_id,logged_date,sleep_hours,energy,stress'],
]

function project(key, row) {
  const pick = keys => Object.fromEntries(keys.map(name => [name, row[name]]))
  if (key === 'exerciseLogs') return {
    ...pick(['id', 'athlete_id', 'exercise_id', 'set_number', 'logged_at', 'weight', 'reps_completed', 'skipped']),
    exercises: { name: row.exercises?.name,
      sessions: { weeks: { block_name: row.exercises?.sessions?.weeks?.block_name } } },
  }
  if (key === 'dailyRows') return { ...pick(['athlete_id', 'logged_date', 'sleep_hours', 'energy', 'stress']),
    source: 'athlete_manual' }
  return pick(key === 'mealRows' ? ['athlete_id', 'date', 'meal', 'kcal', 'protein', 'carb', 'fat']
    : ['athlete_id', 'logged_at', 'weight'])
}

// Click-only, read-only adapter. Never treats legacy graph arrays as complete.
// Readiness is manually entered; its legacy 1..5 soreness is deliberately omitted.
export async function readMonthlyExport(client, scope, { enabled = false, format = 'csv' } = {}) {
  if (enabled !== true) return null
  if (!client || !validExportScope(scope) || !['csv', 'json'].includes(format)) return failure()
  const endDate = addCalendarDays(scope.asOf, -1)
  const from = addCalendarDays(endDate, -27)
  try {
    const collections = await Promise.all(fields.map(async ([key, table, date, columns]) => {
      const rows = [], ids = new Set()
      for (let offset = 0; offset <= CAP; offset += PAGE) {
        let query = client.from(table).select(columns).eq('athlete_id', scope.athleteId)
        query = key === 'exerciseLogs'
          ? query.gte(date, `${addCalendarDays(from, -1)}T00:00:00Z`).lt(date, `${addCalendarDays(endDate, 1)}T00:00:00Z`)
          : query.gte(date, from).lte(date, endDate)
        const result = await query.order(date).order('id').range(offset, offset + PAGE - 1)
        if (result?.error || !Array.isArray(result?.data) || result.data.length > PAGE) throw Error('incomplete')
        for (const row of result.data) {
          if (!row || row.athlete_id !== scope.athleteId || row.id == null || ids.has(String(row.id))) throw Error('identity')
          ids.add(String(row.id))
          rows.push(project(key, row))
        }
        if (rows.length > CAP) throw Error('cap')
        if (result.data.length < PAGE) return [key, rows]
      }
      throw Error('incomplete')
    }))
    return exportCoachMonthlyReport({ status: 'ready', complete: true, athleteId: scope.athleteId,
      endDate, ...Object.fromEntries(collections) }, { enabled: true, format })
  } catch {
    return failure()
  }
}

// Called only after an explicit click and a final current-scope check.
export function downloadMonthlyExport(file, browser = globalThis) {
  if (!['ready', 'empty'].includes(file?.status) || typeof file.content !== 'string') throw Error('No export')
  let url, link
  try {
    const blob = new browser.Blob([file.content], { type: file.mimeType })
    url = browser.URL.createObjectURL(blob)
    link = browser.document.createElement('a')
    link.href = url
    link.download = file.filename
    browser.document.body.appendChild(link)
    link.click()
  } finally {
    try { link?.remove() } finally {
      // A later task lets the browser consume the click before releasing its URL.
      if (url) browser.setTimeout(() => browser.URL.revokeObjectURL(url), 0)
    }
  }
}

export function createMonthlyExportRequest(client, scope) {
  let generation = 0, busy = false
  return {
    cancel() { generation++; busy = false },
    async run(format, { isCurrent, update, download = downloadMonthlyExport }) {
      if (busy || !isCurrent()) return
      busy = true
      const version = ++generation
      const current = () => generation === version && isCurrent()
      update({ status: 'loading' })
      try {
        const file = await readMonthlyExport(client, scope, { enabled: true, format })
        if (!current()) return
        if (!['ready', 'empty'].includes(file?.status)) { update(failure()); return }
        download(file)
        update({ status: file.status, message: file.status === 'empty'
          ? 'Ingen registreringer i perioden. Filen viser manglende data.' : 'Eksporten er klar til lokal download.' })
      } catch {
        if (current()) update(failure())
      } finally {
        if (generation === version) busy = false
      }
    },
  }
}
