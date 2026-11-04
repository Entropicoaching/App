// Synthetic fixtures only. No real clock handles, backend, storage or identities.
export const athleteId = 'synthetic-athlete'
export const date = '2026-11-04'
export const scores = { sleep_hours: 7.5, energy: 3, motivation: 4, stress: 2, soreness_level: 1 }
export const meal = (name = 'Syntetisk grød', extra = {}) => ({ athlete_id: athleteId,
  date: '2026-11-03', meal: name, kcal: 320, protein: 22, carb: 44, fat: 8, ...extra })
export const data = (extra = {}) => ({ status: 'ready', complete: true,
  readinessRows: [{ athlete_id: athleteId, logged_date: '2026-11-03', ...scores }],
  weightRows: [{ athlete_id: athleteId, logged_at: '2026-11-03', weight: 80.2 }],
  mealRows: [meal()], ...extra })

export function manualClock() {
  let time = 1000, nextId = 0
  const tasks = new Map()
  const clock = { now: () => time,
    setTimeout(fn, delay) { const id = ++nextId; tasks.set(id, { fn, at: time + delay }); return id },
    clearTimeout(id) { tasks.delete(id) } }
  return { clock, handles: () => tasks.size, setNow(value) { time = value },
    async advance(ms) {
      time += ms
      for (const [id, task] of [...tasks]) if (task.at <= time) { tasks.delete(id); task.fn() }
      // Drain promises from the actual async adapter/commit; never sleep.
      for (let i = 0; i < 6; i++) await Promise.resolve()
    },
    fireEarly() { const [id, task] = [...tasks][0]; tasks.delete(id); task.fn() } }
}
