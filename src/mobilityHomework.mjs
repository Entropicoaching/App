import { createElement as h, useState } from 'react'
import { WARMUP_BASE } from './athlete/mobilityCatalog.mjs'

export const DEFAULT_MOBILITY_HOMEWORK = false
export const HOMEWORK_NOTICE = 'Kun gemt i denne browser på denne enhed. Ikke sendt til atletens anden enhed.'
export const MARC_HOMEWORK_TEXT = 'tekst fra Marc'
const definitions = [
  ['squat-hip', 'Squat', 'Hoftemobilitet for squatdybde', 'Squat', ['sq-mob-1', 'sq-mob-3', 'sq-mob-4', 'sq-mov-1']],
  ['squat-ankle', 'Squat', 'Ankel for squatdybde', 'Squat', ['sq-mob-2', 'sq-mov-3']],
  ['bench-shoulder', 'Bænkpres', 'Skulderposition i bænk', 'Bænkpres', ['bp-mob-1', 'bp-mob-2', 'bp-mob-3', 'bp-mob-4']],
  ['deadlift-hip', 'Dødløft', 'Hofteposition i dødløft', 'Dødløft — Konventionel', ['dk-mob-3', 'dk-akt-1', 'dk-mov-1', 'dk-mov-2']],
  ['sumo-hip', 'Dødløft', 'Hofteposition i sumo', 'Dødløft — Sumo', ['ds-mob-1', 'ds-mob-2', 'ds-mob-3', 'ds-mob-4']],
]
export function homeworkLibrary() {
  return definitions.map(([id, lift, title, catalog, ids]) => ({
    id, lift, title, explanation: MARC_HOMEWORK_TEXT,
    exercises: ids.map(id => WARMUP_BASE[catalog].flatMap(slot => slot.options).find(ex => ex.id === id)).filter(Boolean).map(ex => ({ ...ex })),
  }))
}
const validId = id => typeof id === 'string' && id.trim().length > 0 && id.length <= 200
const key = id => 'hara:mobility-homework:v1:' + JSON.stringify(id)
function assignment(value) {
  if (value === null) return null
  const problem = homeworkLibrary().find(item => item.id === value?.problemId)
  const ids = value?.exerciseIds
  if (!problem || !Array.isArray(ids) || ids.length < 1 || ids.length > 4 ||
    new Set(ids).size !== ids.length || !ids.every(id => problem.exercises.some(ex => ex.id === id))) throw Error('assignment')
  return { problemId: problem.id, exerciseIds: [...ids] }
}
export function readHomework(athleteId, storage) {
  if (!validId(athleteId)) return { value: null, error: 'Atlet mangler.' }
  try {
    const raw = (storage === undefined ? globalThis.localStorage : storage).getItem(key(athleteId))
    if (raw === null) return { value: null, error: null }
    if (raw.length > 10000) throw Error('size')
    const data = JSON.parse(raw)
    if (data?.version !== 1 || data.athleteId !== athleteId) throw Error('scope')
    return { value: assignment(data.value), error: null }
  } catch {
    return { value: null, error: 'Tildelingen kunne ikke læses. Intet er ændret.' }
  }
}
export function saveHomework(athleteId, value, storage) {
  if (!validId(athleteId)) return { value: null, error: 'Atlet mangler.' }
  let clean
  try { clean = assignment(value) } catch { return { value: null, error: 'Vælg en problematik og en til fire tilhørende øvelser.' } }
  const previous = readHomework(athleteId, storage)
  if (previous.error) return previous
  try {
    (storage === undefined ? globalThis.localStorage : storage).setItem(key(athleteId), JSON.stringify({ version: 1, athleteId, value: clean }))
    return { value: clean, error: null }
  } catch { return { ...previous, error: 'Tildelingen kunne ikke gemmes. Prøv igen.' } }
}
const button = { minHeight: 48, padding: 12, font: 'inherit', whiteSpace: 'normal', overflowWrap: 'anywhere', cursor: 'pointer' }
const section = { minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.6, padding: 16, marginBottom: 16, border: '1px solid #736043', borderRadius: 8 }
function CoachEditor({ athleteId, storage }) {
  const [result, setResult] = useState(() => readHomework(athleteId, storage))
  const [problemId, setProblemId] = useState(result.value?.problemId || 'squat-hip')
  const [ids, setIds] = useState(result.value?.exerciseIds || [])
  const [message, setMessage] = useState('')
  const problems = homeworkLibrary()
  const problem = problems.find(item => item.id === problemId)
  const save = value => {
    const next = saveHomework(athleteId, value, storage)
    setResult(next)
    setMessage(next.error || (value === null ? 'Lokal tildeling fjernet.' : 'Tildeling gemt lokalt.'))
    if (!next.error && value === null) setIds([])
  }
  return h('section', { style: section, 'aria-label': 'Tildel hjemmeøvelser' },
    h('h2', null, 'Hjemmeøvelser til atleten'), h('p', null, HOMEWORK_NOTICE),
    h('label', null, 'Problematik efter hovedløft', h('select', { value: problemId, style: { ...button, width: '100%' }, onChange: event => { setProblemId(event.target.value); setIds([]); setMessage('Valget er ikke gemt.') } },
      ...['Squat', 'Bænkpres', 'Dødløft'].map(lift => h('optgroup', { key: lift, label: lift },
        ...problems.filter(item => item.lift === lift).map(item => h('option', { key: item.id, value: item.id }, item.title)))))),
    h('p', null, problem.explanation),
    h('fieldset', null, h('legend', null, 'Vælg en til fire hjemmeøvelser'),
      ...problem.exercises.map(ex => h('label', { key: ex.id, style: { display: 'block', padding: 12, minHeight: 48 } },
        h('input', { type: 'checkbox', checked: ids.includes(ex.id), disabled: !ids.includes(ex.id) && ids.length >= 4,
          onChange: () => { setIds(ids.includes(ex.id) ? ids.filter(id => id !== ex.id) : [...ids, ex.id].slice(0, 4)); setMessage('Valget er ikke gemt.') } }),
        ` ${ex.name} (${ex.label})`))),
    h('button', { type: 'button', style: button, disabled: ids.length < 1 || !!result.error, onClick: () => save({ problemId, exerciseIds: ids }) }, 'Gem hjemmeøvelser lokalt'),
    h('button', { type: 'button', style: button, disabled: !result.value || !!result.error, onClick: () => save(null) }, 'Fjern lokal tildeling'),
    h('button', { type: 'button', style: button, onClick: () => {
      const next = readHomework(athleteId, storage); setResult(next)
      setProblemId(next.value?.problemId || 'squat-hip'); setIds(next.value?.exerciseIds || []); setMessage('')
    } }, 'Genindlæs lokal tildeling'),
    h('p', { role: 'status', 'aria-live': 'polite' }, result.error || message || (result.value ? 'Atleten har en lokal tildeling.' : 'Ingen lokal tildeling.')))
}
export function MobilityHomeworkCoach({ enabled = DEFAULT_MOBILITY_HOMEWORK, athleteId, storage }) {
  if (enabled !== true || !validId(athleteId)) return null
  return h(CoachEditor, { key: athleteId, athleteId, storage })
}
function HomeworkHome({ athleteId, storage }) {
  const [result, setResult] = useState(() => readHomework(athleteId, storage))
  const problem = homeworkLibrary().find(item => item.id === result.value?.problemId)
  return h('section', { style: section, 'aria-label': 'Hjemmeøvelser fra din coach' },
    h('h2', null, 'Hjemmeøvelser fra din coach'), h('p', null, HOMEWORK_NOTICE),
    h('button', { type: 'button', style: button, onClick: () => setResult(readHomework(athleteId, storage)) }, 'Genindlæs hjemmeøvelser'),
    h('p', { role: 'status' }, result.error || (problem ? `${problem.lift}: ${problem.title}` : 'Ingen hjemmeøvelser fra din coach gemt på denne enhed.')),
    problem ? h('div', null, h('p', null, problem.explanation),
      h('ol', null, ...result.value.exerciseIds.map(id => {
        const ex = problem.exercises.find(item => item.id === id)
        return h('li', { key: id }, h('h3', null, ex.name), h('p', null, ex.label), h('p', null, ex.desc))
      }))) : null)
}
export function MobilityHomeworkHome({ enabled = DEFAULT_MOBILITY_HOMEWORK, athleteId, storage }) {
  if (enabled !== true || !validId(athleteId)) return null
  return h(HomeworkHome, { key: athleteId, athleteId, storage })
}
