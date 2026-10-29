import { createElement as h, cloneElement, useEffect, useState } from 'react'
import { readHelped, toggleHelped } from './mobilityHelped.mjs'

export const DEFAULT_MOBILITY_ADHERENCE = false
export const ADHERENCE_NOTICE = 'Kun lokale markeringer i denne browser på denne enhed. Ikke sendt til coachens anden enhed. Modtagelse hos coach: ukendt.'
const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const key = id => 'hara:mobility-done:v1:' + JSON.stringify(id)
const storageFor = supplied => supplied === undefined ? globalThis.localStorage : supplied
const clockNow = () => new Date()
const limit = 400
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function readDone(athleteId, storage) {
  if (!validText(athleteId)) return { rows: [], error: 'Atlet mangler.' }
  try {
    const raw = storageFor(storage).getItem(key(athleteId))
    if (raw === null) return { rows: [], error: null }
    if (raw.length > 200000) throw Error('size')
    const data = JSON.parse(raw)
    if (data?.version !== 1 || data.athleteId !== athleteId || !Array.isArray(data.rows) || data.rows.length > limit ||
      !data.rows.every(row => row && validText(row.id) && validText(row.name) && validDate(row.date)) ||
      new Set(data.rows.map(row => JSON.stringify([row.date, row.id]))).size !== data.rows.length) throw Error('format')
    return { rows: data.rows.map(({ id, name, date }) => ({ id, name, date })), error: null }
  } catch { return { rows: [], error: 'Lokale udførelser kunne ikke læses. Intet er ændret.' } }
}
export function toggleDone(athleteId, exercise, date, storage) {
  if (!validText(athleteId) || !validText(exercise?.id) || !validText(exercise?.name) || !validDate(date))
    return { rows: [], error: 'Markeringen mangler gyldig atlet, øvelse eller dato.' }
  const previous = readDone(athleteId, storage)
  if (previous.error) return previous
  const exists = previous.rows.some(row => row.id === exercise.id && row.date === date)
  const rows = previous.rows.filter(row => row.id !== exercise.id || row.date !== date)
  if (!exists) rows.push({ id: exercise.id, name: exercise.name, date })
  rows.sort((a, b) => b.date.localeCompare(a.date))
  try {
    storageFor(storage).setItem(key(athleteId), JSON.stringify({ version: 1, athleteId, rows: rows.slice(0, limit) }))
    return { rows: rows.slice(0, limit), error: null }
  } catch { return { ...previous, error: 'Udførelsen kunne ikke gemmes. Prøv igen.' } }
}
// Calendar arithmetic avoids a 23/25-hour daylight-saving day changing the window.
export function adherenceSummary(done, helped, today) {
  if (!validDate(today)) throw Error('Ugyldig dato')
  const start = new Date(today + 'T12:00:00Z')
  start.setUTCDate(start.getUTCDate() - 13)
  const first = start.toISOString().slice(0, 10)
  const inWindow = row => validDate(row.date) && row.date >= first && row.date <= today
  const rows = done.filter(inWindow)
  return { first, today, days: new Set(rows.map(row => row.date)).size,
    done: rows, helped: helped.filter(inWindow) }
}
// Only refresh the date; this sends no reminder and performs no storage/network work.
export function watchLocalDay(onDay, clock = clockNow, host = globalThis.window, doc = globalThis.document) {
  if (!host) return () => {}
  const refresh = () => onDay(localDay(clock()))
  const timer = host.setInterval(refresh, 30000)
  host.addEventListener('focus', refresh)
  doc?.addEventListener('visibilitychange', refresh)
  return () => {
    host.clearInterval(timer)
    host.removeEventListener('focus', refresh)
    doc?.removeEventListener('visibilitychange', refresh)
  }
}
function useDay(clock) {
  const [day, setDay] = useState(() => localDay(clock()))
  useEffect(() => watchLocalDay(setDay, clock), [clock])
  return [day, setDay]
}
const button = { minHeight: 48, padding: 12, width: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', font: 'inherit', cursor: 'pointer' }
function ExerciseProgress({ athleteId, exercise, storage, clock }) {
  const [day, setDay] = useDay(clock)
  const [, redraw] = useState(0)
  const [message, setMessage] = useState('')
  const done = readDone(athleteId, storage), helped = readHelped(athleteId, storage)
  const mark = (toggle, label) => {
    const today = localDay(clock()) // A handler retained across midnight must use the new day.
    const result = toggle(athleteId, exercise, today, storage)
    setDay(today); redraw(value => value + 1)
    setMessage(result.error || `${label} opdateret for ${today}.`)
  }
  return h('div', { style: { minWidth: 0 } },
    h('p', null, ADHERENCE_NOTICE),
    h('button', { type: 'button', style: button, 'aria-pressed': done.rows.some(row => row.id === exercise.id && row.date === day),
      onClick: () => mark(toggleDone, 'Udførelse') }, `Lavet i dag: ${exercise.name}`),
    h('button', { type: 'button', style: button, 'aria-pressed': helped.rows.some(row => row.id === exercise.id && row.date === day),
      onClick: () => mark(toggleHelped, 'Hjalp') }, `Hjalp i dag: ${exercise.name}`),
    h('p', { role: 'status', 'aria-live': 'polite' }, done.error || helped.error || message))
}
export function HomeworkExerciseProgress({ enabled = DEFAULT_MOBILITY_ADHERENCE, athleteId, exercise, storage, clock = clockNow }) {
  if (enabled !== true || !validText(athleteId) || !validText(exercise?.id) || !validText(exercise?.name)) return null
  return h(ExerciseProgress, { key: JSON.stringify([athleteId, exercise.id]), athleteId, exercise, storage, clock })
}
function AdherenceProfile({ athleteId, storage, clock }) {
  const [day, setDay] = useDay(clock)
  const [, redraw] = useState(0)
  const done = readDone(athleteId, storage), helped = readHelped(athleteId, storage)
  const summary = adherenceSummary(done.rows, helped.rows, day)
  return h('section', { 'aria-label': 'Hjemmeøvelser de seneste 14 dage', style: { minWidth: 0, overflowWrap: 'anywhere', padding: 16 } },
    h('h3', null, 'Hjemmeøvelser de seneste 14 dage'),
    h('p', null, ADHERENCE_NOTICE),
    h('button', { type: 'button', style: button, onClick: () => { setDay(localDay(clock())); redraw(value => value + 1) } }, 'Genindlæs lokale udførelser'),
    h('p', null, `${summary.first} til ${summary.today}, begge dage medregnet.`),
    done.error ? h('p', { role: 'status' }, done.error) : h('p', { role: 'status' }, `${summary.days} af 14 dage med mindst én hjemmeøvelse markeret som lavet.`),
    !done.error && !summary.days ? h('p', null, 'Ingen lokale udførelser i perioden. Det siger ikke, om øvelser er lavet på en anden enhed.') : null,
    h('h4', null, 'Øvelser markeret som hjalp i perioden'),
    helped.error ? h('p', { role: 'status' }, helped.error) : summary.helped.length ?
      h('ul', null, ...summary.helped.map(row => h('li', { key: JSON.stringify([row.date, row.id]) }, `${row.date}: ${row.name} · Hjalp`))) :
      h('p', null, 'Ingen lokale hjalp-markeringer i perioden.'))
}
export function MobilityAdherenceProfile({ enabled = DEFAULT_MOBILITY_ADHERENCE, athleteId, storage, clock = clockNow }) {
  if (enabled !== true || !validText(athleteId)) return null
  return h(AdherenceProfile, { key: athleteId, athleteId, storage, clock })
}

// Preserve the existing Home element and inject progress only for explicit ON.
export function MobilityHomeworkProgress({ enabled = false, athleteId, children }) {
  const home = Array.isArray(children) ? children[0] : children
  if (enabled !== true || !home) return home
  return cloneElement(home, { adherenceEnabled: true, renderExerciseProgress: exercise =>
    h(HomeworkExerciseProgress, { enabled: true, athleteId, exercise }) })
}
