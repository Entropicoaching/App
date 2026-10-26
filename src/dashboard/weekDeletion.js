export const WEEK_UNDO_MS = 10_000

// Slet først efter fristen. Fortryd bevarer de oprindelige id'er og alle logs.
export function createWeekDeletionQueue(onChange, { now = Date.now, later = setTimeout, cancel = clearTimeout } = {}) {
  const entries = new Map()
  let disposed = false
  const publish = () => {
    if (!disposed) onChange([...entries.values()].map(entry => ({
      weekId: entry.weekId, weekNumber: entry.weekNumber, athleteName: entry.athleteName,
      expiresAt: entry.expiresAt, deleting: entry.deleting,
    })))
  }
  return {
    activate() { disposed = false },
    hasPending: () => entries.size > 0,
    schedule({ weekId, weekNumber, athleteName, remove, onDeleted, onError }) {
      if (disposed || entries.has(weekId)) return
      const entry = { weekId, weekNumber, athleteName, remove, onDeleted, onError, expiresAt: now() + WEEK_UNDO_MS, deleting: false }
      entries.set(weekId, entry)
      entry.timer = later(async () => {
        entry.deleting = true
        publish()
        try {
          await remove()
          if (!disposed) onDeleted()
        } catch {
          if (!disposed) onError()
        } finally {
          entries.delete(weekId)
          publish()
        }
      }, WEEK_UNDO_MS)
      publish()
    },
    undo(weekId) {
      const entry = entries.get(weekId)
      if (!entry || entry.deleting || now() >= entry.expiresAt) return false
      cancel(entry.timer)
      entries.delete(weekId)
      publish()
      return true
    },
    dispose() {
      disposed = true
      for (const entry of entries.values()) cancel(entry.timer)
      entries.clear()
    },
  }
}
