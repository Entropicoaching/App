import { createElement as h, useState } from 'react'

export const DEFAULT_MOBILITY_HELPED = false
export const LOCAL_NOTICE = 'Kun gemt i denne browser på denne enhed. Ikke sendt til coach. Modtagelse hos coach: ukendt.'
const limit = 100
const validText = value => typeof value === 'string' && value.length > 0 && value.length <= 200
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const key = athleteId => 'hara:mobility-helped:v1:' + JSON.stringify(athleteId)
const storageFor = supplied => supplied === undefined ? globalThis.localStorage : supplied
function validRow(row) {
  return row && validText(row.id) && validText(row.name) && validDate(row.date)
}
export function readHelped(athleteId, supplied) {
  if (!validText(athleteId)) return { rows: [], error: 'Atlet mangler.' }
  try {
    const raw = storageFor(supplied).getItem(key(athleteId))
    if (raw === null) return { rows: [], error: null }
    if (raw.length > 100000) throw Error('size')
    const data = JSON.parse(raw)
    if (data?.version !== 1 || data.athleteId !== athleteId || !Array.isArray(data.rows) ||
      data.rows.length > limit || !data.rows.every(validRow) ||
      new Set(data.rows.map(row => JSON.stringify([row.date, row.id]))).size !== data.rows.length) throw Error('format')
    return { rows: data.rows.map(({ id, name, date }) => ({ id, name, date })), error: null }
  } catch {
    return { rows: [], error: 'Lokale markeringer kunne ikke læses. Intet er ændret.' }
  }
}
export function toggleHelped(athleteId, exercise, date, supplied) {
  if (!validText(athleteId) || !validRow({ ...exercise, date })) return { rows: [], error: 'Markeringen mangler gyldig atlet, øvelse eller dato.' }
  const previous = readHelped(athleteId, supplied)
  if (previous.error) return previous
  const exists = previous.rows.some(row => row.id === exercise.id && row.date === date)
  const rows = previous.rows.filter(row => row.id !== exercise.id || row.date !== date)
  if (!exists) rows.unshift({ id: exercise.id, name: exercise.name, date })
  try {
    storageFor(supplied).setItem(key(athleteId), JSON.stringify({ version: 1, athleteId, rows: rows.slice(0, limit) }))
    return { rows: rows.slice(0, limit), error: null }
  } catch {
    return { ...previous, error: 'Markeringen kunne ikke gemmes. Prøv igen.' }
  }
}
const button = { minHeight: 48, padding: 12, width: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', font: 'inherit', cursor: 'pointer' }
function HelpedChoices({ athleteId, exercises, date, storage }) {
  const [result, setResult] = useState(() => readHelped(athleteId, storage))
  return h('section', { 'aria-label': 'Hvad hjalp efter passet?' },
    h('h3', null, 'Hvad hjalp efter passet?'),
    h('p', null, 'Valgfrit. Markér de øvelser, du oplevede hjalp. Tryk igen for at fjerne en markering.'),
    h('p', null, LOCAL_NOTICE),
    ...exercises.map(exercise => h('button', { key: exercise.id, type: 'button', style: button,
      'aria-pressed': result.rows.some(row => row.date === date && row.id === exercise.id),
      onClick: () => setResult(toggleHelped(athleteId, exercise, date, storage)) }, `Hjalp: ${exercise.name}`)),
    h('p', { role: 'status', 'aria-live': 'polite' }, result.error || 'Dine lokale markeringer vises på knapperne.'))
}
export function MobilityHelped({ enabled = DEFAULT_MOBILITY_HELPED, athleteId, exercises = [], date, storage }) {
  if (enabled !== true || !validText(athleteId) || !validDate(date)) return null
  const choices = exercises.filter(ex => ex && validText(ex.id) && validText(ex.name))
    .filter((ex, index, all) => all.findIndex(other => other.id === ex.id) === index)
  if (!choices.length) return null
  return h(HelpedChoices, { key: JSON.stringify([athleteId, date, choices.map(ex => [ex.id, ex.name])]), athleteId, date, exercises: choices, storage })
}
function HelpedProfile({ athleteId, storage }) {
  const [result, setResult] = useState(() => readHelped(athleteId, storage))
  return h('section', { 'aria-label': 'Atletens lokale mobilitetsmarkeringer' },
    h('h3', null, 'Mobilitet som atleten oplevede hjalp'),
    h('p', null, 'Kun lokale markeringer for denne atlet i denne browser. Markeringer fra atletens anden enhed er ikke tilgængelige. Modtagelse hos coach: ukendt.'),
    h('button', { type: 'button', style: button, onClick: () => setResult(readHelped(athleteId, storage)) }, 'Genindlæs lokale markeringer'),
    h('p', { role: 'status' }, result.error || (result.rows.length ? `${result.rows.length} lokale markeringer` : 'Ingen lokale markeringer tilgængelige. Det siger ikke, om atleten har markeret noget på en anden enhed.')),
    h('ul', null, ...result.rows.map(row => h('li', { key: JSON.stringify([row.date, row.id]), style: { overflowWrap: 'anywhere' } }, `${row.date}: ${row.name} · Hjalp`))))
}
export function MobilityHelpedProfile({ enabled = DEFAULT_MOBILITY_HELPED, athleteId, storage }) {
  if (enabled !== true || !validText(athleteId)) return null
  return h(HelpedProfile, { key: athleteId, athleteId, storage })
}
