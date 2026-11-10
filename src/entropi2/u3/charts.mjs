import * as React from 'react'

// U3b: små SVG-grafer uden nye afhængigheder. Faste pixelmål, så de aldrig
// bliver bredere end et kort på 390 px. null er et hul, aldrig 0.
const h = React.createElement
export const GOLD = '#d8b16b'
export const BLUE = '#8ab5bc'
export const MUTED = '#59564c'
const finite = value => typeof value === 'number' && Number.isFinite(value)

function scale(values, extra = []) {
  const nums = [...values.filter(finite), ...extra.filter(finite)]
  const min = Math.min(...nums), max = Math.max(...nums)
  return { min, span: max - min || 1 }
}

// Kurve over tid. Huller i data brydes, så to punkter aldrig forbindes hen over et hul.
export function Sparkline({ values, label, width = 120, height = 36, color = GOLD, target = null }) {
  if (!Array.isArray(values) || values.filter(finite).length < 2) return null
  const pad = 4, { min, span } = scale(values, [target])
  const x = i => pad + (values.length === 1 ? 0 : i / (values.length - 1)) * (width - 2 * pad)
  const y = v => pad + (1 - (v - min) / span) * (height - 2 * pad)
  const segments = []
  let current = []
  values.forEach((v, i) => {
    if (finite(v)) current.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    else if (current.length) { segments.push(current); current = [] }
  })
  if (current.length) segments.push(current)
  const last = values.findLastIndex(finite)
  return h('svg', { role: 'img', 'aria-label': label, 'data-u3-chart': 'line', width, height, viewBox: `0 0 ${width} ${height}`,
    style: { display: 'block', maxWidth: '100%' } },
  finite(target) && h('line', { x1: pad, x2: width - pad, y1: y(target), y2: y(target), stroke: MUTED, strokeDasharray: '3 3' }),
  ...segments.map((points, i) => points.length > 1
    ? h('polyline', { key: i, points: points.join(' '), fill: 'none', stroke: color, strokeWidth: 2, strokeLinejoin: 'round', strokeLinecap: 'round' })
    : null),
  h('circle', { cx: x(last), cy: y(values[last]), r: 3, fill: color }))
}

// Søjler, én pr. periode. good(v) farver søjlen guld, ellers blå. Mangler en
// værdi, står en lav grå streg, så hullet kan ses.
export function Bars({ values, label, width = 120, height = 36, target = null, good = () => true, zeroBased = true }) {
  if (!Array.isArray(values) || !values.some(finite)) return null
  const gap = 3, n = values.length, w = (width - gap * (n - 1)) / n
  const nums = [...values.filter(finite), ...(finite(target) ? [target] : [])]
  // Uden nulpunkt starter aksen ved 85 % af det mindste tal, så små forskelle ikke ser store ud.
  const max = Math.max(...nums), min = zeroBased ? 0 : Math.min(...nums) * 0.85
  const y = v => height - Math.max(2, (v - min) / ((max - min) || 1) * (height - 2))
  return h('svg', { role: 'img', 'aria-label': label, 'data-u3-chart': 'bars', width, height, viewBox: `0 0 ${width} ${height}`,
    style: { display: 'block', maxWidth: '100%' } },
  ...values.map((v, i) => finite(v)
    ? h('rect', { key: i, x: i * (w + gap), y: y(v), width: w, height: height - y(v), rx: 2, fill: good(v) ? GOLD : BLUE })
    : h('rect', { key: i, x: i * (w + gap), y: height - 2, width: w, height: 2, fill: MUTED })),
  finite(target) && h('line', { x1: 0, x2: width, y1: y(target), y2: y(target), stroke: '#edeae2', strokeOpacity: 0.6, strokeDasharray: '3 3' }))
}

// Pas: én prik pr. planlagt pas, fyldt når det er gennemført.
export function Dots({ done, total, label }) {
  if (!Number.isSafeInteger(total) || total < 1 || total > 14) return null
  const r = 6, gap = 5, width = total * (2 * r + gap) - gap
  return h('svg', { role: 'img', 'aria-label': label, 'data-u3-chart': 'dots', width, height: 2 * r + 2, viewBox: `0 0 ${width} ${2 * r + 2}`,
    style: { display: 'block', maxWidth: '100%' } },
  ...Array.from({ length: total }, (_, i) => h('circle', { key: i, cx: r + i * (2 * r + gap), cy: r + 1, r: r - 1,
    fill: i < done ? GOLD : 'none', stroke: i < done ? GOLD : '#77776b', strokeWidth: 1.5 })))
}

// Andel som vandret bjælke. Bredden følger containeren.
export function ShareBar({ share, label, color = GOLD }) {
  if (!finite(share)) return null
  const pct = Math.max(0, Math.min(1, share)) * 100
  return h('div', { role: 'img', 'aria-label': label, 'data-u3-chart': 'share',
    style: { height: 8, borderRadius: 4, background: '#2a2a24', overflow: 'hidden', marginTop: 6 } },
  h('div', { style: { width: `${pct}%`, height: '100%', background: color, borderRadius: 4 } }))
}

// Fokusboks: ét tal, der betyder noget, og én sætning om, hvad man gør nu.
export const focusStyle = { borderLeft: `3px solid ${GOLD}`, background: 'rgba(216,177,107,0.08)', padding: '10px 12px',
  borderRadius: 8, margin: '0 0 16px', lineHeight: 1.45 }
export function FocusBox({ focus, ...rest }) {
  if (!focus) return null
  return h('div', { 'data-u3-focus': focus.key ?? true, style: focusStyle, ...rest },
    focus.value && h('strong', { style: { display: 'block', fontSize: 24, lineHeight: 1.2, color: GOLD } }, focus.value),
    h('span', null, focus.text))
}
