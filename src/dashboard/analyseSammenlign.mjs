import { analyseDemo } from './analyseSamlet.mjs'

export const DEFAULT_ANALYSE_SAMMENLIGN = false
export function analyseSammenlignEnabled(search = '') {
  const release = new URLSearchParams(search).getAll('rel1030')
  const values = new URLSearchParams(search).getAll('analyseSammenlign')
  return (release.length === 1 && release[0] === '1') || (values.length === 1 && values[0] === '1')
}

// Local fixture contract only. Seconds and normalized image coordinates, not
// backend analysis fields or measured technique. Existing formats stay separate.
export const comparisonClips = Object.freeze(analyseDemo.map((row, i) => Object.freeze({
  id: row.id, lift: row.lift, label: row.label, date: row.date,
  duration: i === 0 ? 6 : 5,
  points: Object.freeze([
    Object.freeze({ time: 0, x: 0.50, y: 0.20, label: 'Start' }),
    Object.freeze({ time: 2, x: i === 0 ? 0.48 : 0.42, y: 0.75, label: 'Bund' }),
    Object.freeze({ time: 4, x: 0.50, y: 0.20, label: 'Slut' }),
  ]),
})))
const candidates = lift => comparisonClips.filter(clip => clip.lift === lift)
export function comparisonState(lift = 'squat') {
  const clips = candidates(lift)
  return { lift, left: clips[0]?.id || '', right: clips[1]?.id || '', time: 0, playing: false, rate: 1 }
}
export function selectedPair(state) {
  const clips = candidates(state.lift)
  const left = clips.find(clip => clip.id === state.left)
  const right = clips.find(clip => clip.id === state.right)
  return left && right && left.id !== right.id ? [left, right] : []
}
export function comparisonDuration(state) {
  const pair = selectedPair(state)
  return pair.length ? Math.min(...pair.map(clip => clip.duration)) : 0
}
export function comparisonTransition(state, action) {
  if (action.type === 'lift') return comparisonState(action.value)
  if (action.type === 'select' && ['left', 'right'].includes(action.side)) {
    if (!candidates(state.lift).some(clip => clip.id === action.value)) return state
    return { ...state, [action.side]: action.value, time: 0, playing: false }
  }
  const duration = comparisonDuration(state)
  if (action.type === 'rate') return [0.25, 0.5, 1].includes(action.value) ? { ...state, rate: action.value } : state
  if (action.type === 'pause') return { ...state, playing: false }
  if (!duration) return state
  if (action.type === 'play') return { ...state, playing: true, time: state.time >= duration ? 0 : state.time }
  if (action.type === 'seek' && Number.isFinite(action.value)) {
    return { ...state, time: Math.max(0, Math.min(duration, action.value)), playing: false }
  }
  if (action.type === 'tick' && state.playing && Number.isFinite(action.seconds) && action.seconds >= 0) {
    const time = Math.min(duration, state.time + action.seconds * state.rate)
    return { ...state, time, playing: time < duration }
  }
  return state
}
export function comparisonPoint(clip, time) {
  const points = clip.points
  const end = points.findIndex(point => point.time >= time)
  if (end <= 0) return end === 0 ? points[0] : points.at(-1)
  const a = points[end - 1], b = points[end]
  const t = (time - a.time) / (b.time - a.time)
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function renderComparison(h, state, dispatch) {
  const pair = selectedPair(state), clips = candidates(state.lift)
  const duration = comparisonDuration(state)
  const style = { minHeight: 44, padding: '0.6rem', maxWidth: '100%' }
  const action = (label, event, disabled = false) => h('button', { type: 'button', style, disabled, onClick: event }, label)
  return h('section', { 'aria-label': 'To videoer side om side', style: { padding: '1rem', border: '2px solid #c8923a', marginBottom: '1rem', minWidth: 0 } },
    h('h2', null, 'Sammenlign to videoer'),
    h('p', { role: 'note' }, 'Syntetiske videospillere og billedpunkter. Ingen rigtig video, teknikvurdering eller måling. Ingen gemning.'),
    h('label', null, 'Løft til sammenligning ', h('select', { style, value: state.lift, onChange: e => dispatch({ type: 'lift', value: e.target.value }) },
      ...[['squat', 'Squat'], ['bench', 'Bænkpres'], ['deadlift', 'Dødløft']].map(([value, label]) => h('option', { value, key: value }, label)))),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 } },
      ...['left', 'right'].map((side, index) => {
        const clip = pair[index], point = clip && comparisonPoint(clip, state.time)
        const label = side === 'left' ? 'Venstre video' : 'Højre video'
        return h('section', { key: side, 'aria-label': label, style: { minWidth: 0 } },
          h('label', null, label, h('select', { style: { ...style, width: '100%' }, value: state[side], onChange: e => dispatch({ type: 'select', side, value: e.target.value }) },
            !state[side] && h('option', { value: '' }, 'Vælg video'),
            ...clips.map(row => h('option', { key: row.id, value: row.id }, `${row.date} ${row.label}`)))),
          clip ? h('div', null,
            h('p', null, `${clip.date} ${clip.label}. Kliplængde ${clip.duration} s.`),
            h('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': `${label}, syntetisk billede ved ${state.time.toFixed(2)} sekunder`, 'data-time': state.time, style: { width: '100%', background: '#20282c', maxHeight: 300 } },
              h('polyline', { points: clip.points.map(p => `${p.x * 100},${p.y * 100}`).join(' '), fill: 'none', stroke: '#c8923a', strokeWidth: 1 }),
              ...clip.points.map(p => h('circle', { key: p.time, cx: p.x * 100, cy: p.y * 100, r: 2, fill: '#fff' })),
              h('circle', { cx: point.x * 100, cy: point.y * 100, r: 4, fill: '#72daca', 'data-current-point': side })),
            h('p', null, 'Billedpunkter fra syntetisk fixture. Ingen fysisk enhed eller automatisk konklusion.'),
            ...clip.points.map(p => action(`${label}: ${p.label} ${p.time} s`, () => dispatch({ type: 'seek', value: p.time })))) : h('p', null, 'Vælg to forskellige videoer af samme løft.'))
      })),
    h('p', { role: 'status', 'aria-live': 'polite' }, pair.length ? `${state.playing ? 'Afspiller' : 'Pause'}. Fælles tid ${state.time.toFixed(2)} af ${duration} s. Begge starter ved 0. Stop ved korteste klip.` : 'Der kræves to forskellige videoer af samme løft. Ingen sammenligning endnu.'),
    action('Afspil begge', () => dispatch({ type: 'play' }), !duration || state.playing),
    action('Pause begge', () => dispatch({ type: 'pause' }), !state.playing),
    action('Til start', () => dispatch({ type: 'seek', value: 0 }), !duration),
    h('label', null, 'Fælles tid ', h('input', { type: 'range', min: 0, max: duration, step: 0.01, value: state.time, disabled: !duration, style: { width: '100%', minHeight: 44 }, onChange: e => dispatch({ type: 'seek', value: Number(e.target.value) }) })),
    h('label', null, 'Hastighed for begge ', h('select', { style, value: state.rate, onChange: e => dispatch({ type: 'rate', value: Number(e.target.value) }) },
      ...[0.25, 0.5, 1].map(rate => h('option', { value: rate, key: rate }, `${rate} x`)))))
}
