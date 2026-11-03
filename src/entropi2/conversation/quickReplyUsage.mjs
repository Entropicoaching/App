// Counts explicit template selections in the editor. Store names/counts only;
// never store expanded athlete text, drafts, or message content here.
export function createQuickReplyUsage(storage) {
  const key = owner => `entropi2:conversation:quick-reply-usage:v1:${encodeURIComponent(owner)}`
  let memory = new Map(), currentOwner, dirty = false
  function read(owner) {
    if (owner !== currentOwner) { memory = new Map(); currentOwner = owner; dirty = false }
    if (dirty) return memory
    try {
      const raw = storage?.()?.getItem(key(owner))
      if (raw == null) return memory
      const rows = JSON.parse(raw)
      if (!Array.isArray(rows) || rows.length > 50 || rows.some(row => !Array.isArray(row)
        || row.length !== 2 || typeof row[0] !== 'string' || row[0].length > 100
        || !Number.isSafeInteger(row[1]) || row[1] < 0)) return memory
      memory = new Map(rows)
    } catch { /* Local preferences must never prevent editing or sending. */ }
    return memory
  }
  return {
    order(rows, owner) {
      const counts = read(owner)
      return rows.map((row, index) => ({ row, index })).sort((a, b) =>
        (counts.get(b.row.name) || 0) - (counts.get(a.row.name) || 0) || a.index - b.index)
        .map(item => item.row)
    },
    record(name, owner) {
      const counts = read(owner)
      counts.set(name, Math.min(Number.MAX_SAFE_INTEGER, (counts.get(name) || 0) + 1))
      // Bound stale names after templates are renamed/deleted.
      if (counts.size > 50) counts.delete(counts.keys().next().value)
      dirty = true
      try {
        const store = storage?.()
        if (store) { store.setItem(key(owner), JSON.stringify([...counts])); dirty = false }
      }
      catch { /* Retain session ordering when local storage is unavailable. */ }
    },
  }
}
