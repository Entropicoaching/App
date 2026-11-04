import { WARMUP_BASE } from '../public-mobilityCatalog.mjs'

export const DEFAULT_MOBILITY_PLAN = false

// Independent of calendar, logs, storage and the existing recommendation's
// fallback. The caller supplies today's session in program order.
const recipes = {
  squat: { title: 'Squat', catalog: 'Squat', ids: ['sq-mob-2', 'sq-mob-3', 'sq-mov-1'] },
  bench: { title: 'Bænkpres', catalog: 'Bænkpres', ids: ['bp-mob-2', 'bp-akt-3', 'bp-akt-1'] },
  deadlift: { title: 'Dødløft', catalog: 'Dødløft — Konventionel', ids: ['dk-mob-3', 'dk-akt-1', 'dk-mov-1'] },
  sumo: { title: 'Sumodødløft', catalog: 'Dødløft — Sumo', ids: ['ds-mob-2', 'ds-mob-1', 'ds-mov-1'] },
}

function liftKind(name) {
  if (typeof name !== 'string') return null
  const n = name.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  if (/(?:^| )(?:row|rows|fly|flyes|raise|extension)(?: |$)/.test(n)) return null
  // Match lift names, not incidental references such as "row on bench".
  const prefix = '(?:(?:pause|paused|tempo|front|back|high bar|low bar|safety bar|box|pin|goblet|db|dumbbell|haandvaegt|close grip|smal|incline|skraa|larsen|spoto|slingshot|deficit|rack|romanian|rumaensk|sumo|konventionel|conventional) )*'
  if (new RegExp('^' + prefix + 'squat(?: |$)').test(n)) return 'squat'
  if (new RegExp('^' + prefix + '(?:baenkpres|baenk|bench(?: press)?)(?: |$)').test(n)) return 'bench'
  if (new RegExp('^' + prefix + '(?:doedloeft|deadlift|rdl)(?: |$)').test(n) || /^sumodoedloeft(?: |$)/.test(n)) {
    return /(?:^| )sumo(?: |$)|^sumodoedloeft/.test(n) ? 'sumo' : 'deadlift'
  }
  return null
}

const empty = () => ({ kind: 'empty', lifts: [], steps: [], rounds: 0, totalSeconds: 0,
  message: 'Ingen rutine klar. Dagens program har ingen genkendte squat-, bænk- eller dødløftøvelser.' })
const error = () => ({ kind: 'error', lifts: [], steps: [], rounds: 0, totalSeconds: 0,
  message: 'Rutinen kunne ikke laves. Kontrollér dagens program og mobilitetsøvelser.' })

/** Pure opt-in model. Missing session is empty; malformed supplied data is an
 * error. Optional sets must be finite nonnegative numbers/numeric strings;
 * zero-set entries are ignored. No catalog fallback for unknown lifts.
 * Each exercise gets an estimated minute per round, preserving catalog doses.
 * One lift: two rounds; multiple lifts: one round + one minute for transitions.
 * Conventional/sumo share one family, so at most nine steps / ten minutes.
 */
export function mobilityPlan(options = {}) {
  if (options.enabled !== true) return null
  const { session, catalog = WARMUP_BASE } = options
  if (session == null) return empty()
  if (typeof session !== 'object' || !Array.isArray(session.exercises)) return error()
  const selected = [], families = new Set()
  for (const exercise of session.exercises) {
    if (!exercise || typeof exercise !== 'object' || typeof exercise.name !== 'string' || !exercise.name.trim()) return error()
    const { sets } = exercise
    if (sets !== undefined) {
      if (!['number', 'string'].includes(typeof sets) || String(sets).trim() === '' ||
          !Number.isFinite(Number(sets)) || Number(sets) < 0) return error()
      if (Number(sets) === 0) continue
    }
    const kind = liftKind(exercise.name)
    if (!kind) continue
    const family = kind === 'sumo' ? 'deadlift' : kind
    if (families.has(family)) continue
    families.add(family)
    selected.push(recipes[kind])
  }
  if (!selected.length) return empty()
  const steps = []
  for (const recipe of selected) {
    const slots = catalog?.[recipe.catalog]
    if (!Array.isArray(slots) || slots.some(slot => !Array.isArray(slot?.options))) return error()
    const exercises = slots.flatMap(slot => slot.options)
    for (const id of recipe.ids) {
      const ex = exercises.find(item => item?.id === id)
      if (!ex || !['name', 'desc', 'label'].every(key => typeof ex[key] === 'string' && ex[key].trim()) ||
          !['timer', 'reps'].includes(ex.type) ||
          (ex.type === 'timer' && (!Number.isFinite(ex.duration) || ex.duration <= 0))) return error()
      steps.push({ id, name: ex.name, desc: ex.desc, label: ex.label, type: ex.type,
        ...(ex.type === 'timer' ? { duration: ex.duration } : {}), lift: recipe.title, estimatedSeconds: 60 })
    }
  }
  const rounds = selected.length === 1 ? 2 : 1
  return { kind: 'ready', lifts: selected.map(recipe => recipe.title), steps, rounds,
    transitionSeconds: 60, totalSeconds: steps.length * rounds * 60 + 60 }
}
