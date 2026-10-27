import { createElement as h, useState } from 'react'
import { WARMUP_BASE } from './mobilityCatalog.mjs'
import { mobilityLibrary, exercisePicture } from './mobilityLibrary.mjs'
import { foldNavn } from '../exerciseNames.js'
import { isMainLift } from '../warmup.js'

export const DEFAULT_MOBILITY_BEFORE_SESSION = false

// The session already arrives in exercise order, as for findDagensPas.
// Use the existing main-lift rule, then the three MOB1/MOB2 categories.
export function sessionMobilityPlan(pas, logs = []) {
  const exercises = pas?.session?.exercises
  if (pas?.status !== 'open' || !pas.next || !Array.isArray(exercises)) return []
  if (!Array.isArray(logs)) return []
  if (logs.some(log => exercises.some(ex => ex.id === log?.exercise_id))) return []
  const main = exercises.find(ex => {
    if (!(Number(ex?.sets) > 0) || !isMainLift(ex.name)) return false
    return /squat|baenk|bench|doedl|deadlift/.test(foldNavn(ex.name))
  })
  if (!main) return []
  const name = foldNavn(main.name)
  const lift = /squat/.test(name) ? 'Squat' : /baenk|bench/.test(name) ? 'Bænkpres' : 'Dødløft'
  const groups = mobilityLibrary(lift, WARMUP_BASE)
  return groups.filter(group => lift !== 'Dødløft' ||
    group.title === (name.includes('sumo') ? 'Hofteposition i sumo' : 'Hofteposition'))
    .flatMap(group => group.exercises.map(ex => ({ ...ex, group: group.title, lift }))).slice(0, 2)
}

const buttonStyle = { minHeight: 48, padding: 12, width: '100%', whiteSpace: 'normal',
  border: '1px solid #736043', borderRadius: 6, background: '#29251e', color: '#edeae2',
  font: 'inherit', cursor: 'pointer' }

// Keyed by athlete, day and session. No persistence or training callbacks.
// Changing the selected session cannot reuse a dismissed or advanced routine.
function Routine({ plan }) {
  const [step, setStep] = useState(0)
  const [closed, setClosed] = useState(false)
  if (closed) return null
  const exercise = plan[Math.min(step, plan.length - 1)]
  return h('section', { 'aria-label': 'Mobilitet før dagens pas', style: {
    padding: 16, marginBottom: 16, border: '1px solid #736043', borderRadius: 12, color: '#edeae2' } },
    h('h2', null, `Kort mobilitet til ${exercise.lift.toLowerCase()}`),
    h('p', null, 'Valgfrit før dit første sæt. Du kan også gå direkte til træningen.'),
    h('button', { type: 'button', style: buttonStyle, onClick: () => setClosed(true) }, 'Spring mobilitet over'),
    h('div', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
      h('p', null, `${step + 1} af ${plan.length}: ${exercise.group}`),
      h('h3', null, exercise.name), h('p', null, exercise.label), h('p', null, exercise.explanation)),
    exercisePicture(h, exercise),
    h('button', { type: 'button', style: buttonStyle, onClick: () => {
      if (step + 1 < plan.length) setStep(step + 1)
      else setClosed(true)
    } }, step + 1 < plan.length ? 'Næste mobilitetsøvelse' : 'Færdig med mobilitet'))
}

export default function MobilityBeforeSession({ enabled = DEFAULT_MOBILITY_BEFORE_SESSION,
  pas, exerciseLogs, athleteId, todayStr }) {
  if (enabled !== true || athleteId == null || !todayStr || pas?.session?.id == null) return null
  const plan = sessionMobilityPlan(pas, exerciseLogs)
  if (!plan.length) return null
  return h(Routine, { key: JSON.stringify([athleteId, todayStr, pas.session.id, plan.map(ex => ex.id)]), plan })
}
