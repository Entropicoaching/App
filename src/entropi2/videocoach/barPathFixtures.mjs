// Deterministic synthetic signals; no frames, camera, video or private data.
export function syntheticLift(lift = 'squat', { corrupt = true } = {}) {
  const truth = [], samples = []
  let seed = 721
  const noise = () => { seed = (1664525 * seed + 1013904223) >>> 0; return (seed / 2 ** 32 - 0.5) * 12 }
  for (let index = 0; index <= 120; index++) {
    const time = index / 30, phase = index / 120
    const y = lift === 'deadlift' ? 280 - 170 * Math.sin(Math.PI * phase / 2)
      : lift === 'bench' ? 120 + 90 * Math.sin(Math.PI * phase)
        : 110 + 180 * Math.sin(Math.PI * phase)
    const x = 200 + 8 * Math.sin(2 * Math.PI * phase)
    truth.push({ time, x, y })
    let sample = { time, x: x + noise(), y: y + noise(), confidence: 0.95, diameterPx: 100 + noise() / 4 }
    if (corrupt && index >= 45 && index <= 48) sample = { time, x: null, y: null }
    if (corrupt && [25, 78, 100].includes(index)) sample = { ...sample, x: x + 220, y: y - 85, diameterPx: 300 }
    samples.push(sample)
  }
  return { samples, truth }
}

export function rmse(points, truth, include = () => true) {
  let total = 0, count = 0
  points.forEach((point, index) => {
    if (point.x === null || point.y === null || !include(point, index)) return
    total += (point.x - truth[index].x) ** 2 + (point.y - truth[index].y) ** 2; count++
  })
  return Math.sqrt(total / count)
}

// A tiny tree/DOM adapter only for local hermetic checks. It does not implement
// React, CSS layout, browser events, SVG drawing or a media player.
export const syntheticH = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(child => child !== false && child !== true && child != null) })
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export function syntheticDOM(tree) {
  if (typeof tree !== 'object' || tree === null) return tree === null ? '' : escape(tree)
  const attributes = Object.entries(tree.props).filter(([key, value]) => key !== 'children' && key !== 'key' && key !== 'style' && !key.startsWith('on') && value !== false)
    .map(([key, value]) => ` ${key}="${escape(value)}"`).join('')
  return `<${tree.type}${attributes}>${tree.children.map(syntheticDOM).join('')}</${tree.type}>`
}
export function nodes(tree, type) {
  return typeof tree !== 'object' || tree === null ? [] : [...(tree.type === type ? [tree] : []), ...tree.children.flatMap(child => nodes(child, type))]
}
