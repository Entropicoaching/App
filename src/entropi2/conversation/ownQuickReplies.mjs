// Local coach preferences only. Never write the dashboard template namespace.
export function createOwnQuickReplies(storage) {
  const sessions = new Map()
  const key = owner => `entropi2:conversation:own-quick-replies:v1:${encodeURIComponent(owner)}`
  const valid = text => typeof text === 'string' && text.trim().length > 0 && text.length <= 240
  function read(owner) {
    if (!sessions.has(owner)) {
      let rows = []
      try {
        const raw = storage?.()?.getItem(key(owner))
        const parsed = raw == null ? [] : JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length <= 12 && parsed.every(valid)) rows = parsed
      } catch { /* Denied/malformed storage must not prevent conversation use. */ }
      sessions.set(owner, rows)
    }
    return sessions.get(owner)
  }
  function write(owner, rows) {
    sessions.set(owner, rows)
    let persisted = false
    try {
      const store = storage?.()
      if (store) { store.setItem(key(owner), JSON.stringify(rows)); persisted = true }
    } catch { /* Keep the edit in this session and report the persistence failure. */ }
    return { rows: [...rows], persisted }
  }
  return {
    list: owner => [...read(owner)],
    save(owner, index, text) {
      if (!valid(text)) throw Error('Skriv mellem 1 og 240 tegn.')
      const rows = [...read(owner)]
      if (index === null) {
        if (rows.length >= 12) throw Error('Du kan gemme højst 12 egne hurtigsvar.')
        rows.push(text.trim())
      } else {
        if (!Number.isInteger(index) || index < 0 || index >= rows.length) throw Error('Svaret findes ikke længere.')
        rows[index] = text.trim()
      }
      return write(owner, rows)
    },
    remove(owner, index) {
      const rows = [...read(owner)]
      if (!Number.isInteger(index) || index < 0 || index >= rows.length) throw Error('Svaret findes ikke længere.')
      rows.splice(index, 1)
      return write(owner, rows)
    },
  }
}
