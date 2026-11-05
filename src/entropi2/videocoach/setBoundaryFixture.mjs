// Only synthetic positions; no images, media, timers or transport.
export function motionSeries(lift, segments) {
  const rest = lift === 'deadlift' ? 1 : 0
  const samples = [{ time: 0, position: rest, atRest: true }]
  let tick = 0, position = rest
  for (const [seconds, next, atRest = false] of segments) {
    const ticks = Math.round(seconds * 10), from = position
    for (let i = 1; i <= ticks; i++) samples.push({ time: (tick + i) / 10,
      position: from + (next - from) * i / ticks, atRest })
    tick += ticks; position = next
  }
  return { lift, samples }
}
export function pausedSet(lift = 'bench', { chestPause = 1.8, lockoutPause = 1.4, finalRest = 3 } = {}) {
  const rest = lift === 'deadlift' ? 1 : 0, other = 1 - rest
  return motionSeries(lift, [[1.5, rest, true], [0.6, other], [chestPause, other],
    [0.6, rest], [lockoutPause, rest, lift === 'deadlift'],
    [0.6, other], [0.2, other], [0.6, rest], [finalRest, rest, true]])
}
export function sourceFor(motion, duration = 15) {
  return { id: 'synthetic-source', label: 'Syntetisk bevægelsesserie', duration, motion }
}
