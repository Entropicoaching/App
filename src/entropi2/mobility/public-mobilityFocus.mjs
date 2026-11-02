// APP-MOB1. Presentation only, explicit opt-in, no storage or backend access.
export const DEFAULT_MOBILITY_FOCUS = false
export const FOCUS_LIFTS = ['Squat', 'Bænkpres', 'Dødløft']
export const FOCUS_NEEDS = {
  Squat: ['Mere dybde', 'Plads til knæene'],
  Bænkpres: ['Skulderposition', 'Bevægelig brystryg'],
  Dødløft: ['Hofteposition', 'Plads i sumostilling'],
}
const fold = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const targets = {
  'Mere dybde': ['sq-mob-2', 'sq-mob-3', 'sq-mov-1'],
  'Plads til knæene': ['sq-mob-3', 'sq-akt-4', 'sq-mov-1'],
  Skulderposition: ['bp-mob-2', 'bp-akt-3', 'bp-akt-1'],
  'Bevægelig brystryg': ['bp-mob-1', 'bp-akt-2', 'bp-mov-1'],
  Hofteposition: ['dk-mob-3', 'dk-akt-1', 'dk-mov-1'],
  'Plads i sumostilling': ['ds-mob-2', 'ds-mob-1', 'ds-mov-1'],
}
export function focusPlan(lift, need, library, templates = []) {
  if (!FOCUS_LIFTS.includes(lift) || !FOCUS_NEEDS[lift].includes(need)) return { exercises: [], notes: [] }
  const key = lift === 'Dødløft' ? (need === 'Plads i sumostilling' ? 'Dødløft — Sumo' : 'Dødløft — Konventionel') : lift
  const catalog = (library[key] || []).flatMap(slot => slot.options || [])
  const steps = (Array.isArray(templates) ? templates : [])
    .filter(t => t.exercise_category === lift).flatMap(t => Array.isArray(t.steps) ? t.steps : [])
    .filter(step => typeof step === 'string' && step.trim())
  const exercises = [], notes = []
  const add = (ex, source) => { if (ex && !exercises.some(item => item.id === ex.id)) exercises.push({ ...ex, source }) }
  for (const step of steps) {
    const ex = catalog.find(item => item.id === step || fold(item.name) === fold(step))
    if (ex) add(ex, 'Valgt af din coach')
    else if (!notes.includes(step)) notes.push(step)
  }
  for (const id of targets[need]) add(catalog.find(ex => ex.id === id), `Dit fokus: ${need.toLowerCase()}`)
  return { exercises, notes }
}

export function renderMobilityShortcut(h, { enabled, tab, enkelOn, route, setMobilityMode, setTab, coachSummary }) {
  if (enabled !== true || tab !== 'hjem' || (enkelOn && !['traening', 'alle'].includes(route))) return null
  return h('section', { 'aria-label': 'Mobilitet til dit løft', style: { margin: '0 0 16px', padding: 18, border: '1px solid #736043', borderRadius: 12, background: 'linear-gradient(135deg, #302a20, #1c1c18)', color: '#edeae2' } },
    coachSummary,
    h('h2', { style: { margin: '0 0 8px', fontFamily: "'Playfair Display', serif", fontWeight: 400 } }, 'Mere plads til dit løft'),
    h('p', { style: { margin: '0 0 12px', lineHeight: 1.5 } }, 'Vælg dit fokus. Få øvelser fra biblioteket og din coach.'),
    h('button', { type: 'button', style: { minHeight: 48, width: '100%', padding: 12, whiteSpace: 'normal', background: '#e0ae5c', color: '#141410', border: 0, borderRadius: 6, font: 'inherit', cursor: 'pointer' },
      onClick: () => { setMobilityMode('fokus'); setTab('mobilisering') } }, 'Åbn mobilitet'))
}
