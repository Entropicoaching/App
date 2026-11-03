import { createQuickReplyUsage } from './quickReplyUsage.mjs'
import { threadFor, timestampContent } from './conversationModel.mjs'

export function createConversation({ enabled = false, adapters, storage, uuid = () => globalThis.crypto.randomUUID() }) {
  let active = true, generation = 0, busy = false, loading = false, error = '', draft = '', operation = null
  let messages = [], analyses = [], submissions = new Map(), loaded = false
  const usage = createQuickReplyUsage(storage)
  const listeners = new Set()
  const initial = enabled === true ? adapters.scope() : null
  const guard = () => {
    if (!active || enabled !== true) throw Error('Samtalen er slået fra.')
    const s = adapters.scope()
    if (s.athleteId !== initial.athleteId || s.role !== initial.role || s.ownerId !== initial.ownerId)
      throw Error('Åbn samtalen igen for den valgte atlet.')
    return s
  }
  const snapshot = () => {
    let available = false
    try { guard(); available = true } catch { /* Never expose a previous scope's records or draft. */ }
    return { loaded: available && loaded, loading: available && loading, busy: available && busy,
      error: available ? error : enabled === true ? 'Samtalen er ikke længere tilgængelig.' : '',
      draft: available ? draft : '', role: initial?.role, athleteId: initial?.athleteId,
      thread: available ? threadFor(initial?.athleteId, messages, [...submissions.values(), ...analyses]) : [],
      operation: available && operation ? { ...operation, row: { ...operation.row } } : null }
  }
  const emit = () => { if (active) for (const fn of listeners) fn(snapshot()) }
  async function refresh() {
    if (enabled !== true || !active) return false
    const token = ++generation
    try {
      guard(); loading = true; error = ''; emit()
      const data = await adapters.load()
      guard()
      if (token !== generation) return false
      messages = data.messages; analyses = data.analyses; loaded = true
      return true
    } catch (e) { if (active && token === generation) error = e.message; return false }
    finally { if (active && token === generation) { loading = false; emit() } }
  }
  async function transmit() {
    if (busy || !operation || operation.status === 'sent') return false
    try {
      guard(); busy = true; error = ''; operation.status = 'pending'; emit()
      const saved = await adapters.send(operation.row)
      guard()
      messages = [...messages.filter(row => row.id !== saved.id), saved]
      operation.status = 'sent'
      if (draft === operation.draft) draft = ''
      // A failed refresh is a read error, never a failed send.
      await refresh()
      return true
    } catch (e) {
      if (active) { operation.status = 'error'; error = e.message }
      return false
    } finally { busy = false; emit() }
  }
  async function action(fn) {
    try { guard(); error = ''; const result = await fn(); guard(); return result }
    catch (e) { if (active) error = e.message; return false }
    finally { emit() }
  }
  return {
    snapshot, refresh,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn) },
    draft(text) {
      guard()
      if (busy || operation?.status === 'error') return false
      draft = String(text).slice(0, 10000); emit(); return true
    },
    send({ analysisId, seconds } = {}) {
      if (busy || operation?.status === 'error') return Promise.resolve(false)
      try {
        const s = guard()
        if (!draft.trim()) return Promise.resolve(false)
        let content = draft.trim(), category = 'besked'
        if (analysisId !== undefined) {
          const row = snapshot().thread.find(item => item.kind === 'video' && item.value.id === analysisId)?.value
          if (s.role !== 'coach') throw Error('Tidsfeedback kræver coachrollen.')
          content = timestampContent(row, seconds, draft); category = 'teknik'
        }
        operation = { status: 'pending', draft, row: { id: uuid(), athlete_id: s.athleteId,
          sender_role: s.role, content, category } }
        return transmit()
      } catch (e) { error = e.message; emit(); return Promise.resolve(false) }
    },
    retry: transmit,
    // Do not discard an unknown outcome and silently allocate a new send identity.
    async seen(key) {
      return action(async () => {
        if (!loaded || loading) throw Error('Opdatér samtalen først.')
        const item = snapshot().thread.find(row => row.key === key)
        if (!item || !(initial.role === 'athlete' ? item.unreadAthlete : item.unreadCoach)) return true
        const saved = await adapters.seen(item)
        guard()
        if (item.kind === 'message') messages = messages.map(row => row.id === saved.id ? saved : row)
        else analyses = analyses.map(row => row.id === saved.id ? saved : row)
        return true
      })
    },
    templates: () => {
      const s = guard()
      return s.role === 'coach' ? usage.order(adapters.templates(), s.ownerId) : []
    },
    selectTemplate(name) {
      const s = guard()
      if (s.role !== 'coach' || busy || operation?.status === 'error') return false
      const row = adapters.templates().find(row => row.name === name)
      guard()
      if (!row) return false
      draft = String(row.text).slice(0, 10000)
      // Count explicit use in the editor, never template reads or automatic sends.
      usage.record(name, s.ownerId)
      emit(); return true
    },
    upload: () => action(() => adapters.upload()),
    open: key => action(() => {
      const item = snapshot().thread.find(row => row.key === key && row.kind === 'video')
      if (!item) throw Error('Videoen findes ikke i denne samtale.')
      return adapters.open(item.value)
    }),
    submission: clientAnalysisId => action(async () => {
      const row = await adapters.submission(clientAnalysisId)
      guard(); submissions.set(row.id, row); return true
    }),
    dispose() { active = false; generation++; listeners.clear() },
  }
}
