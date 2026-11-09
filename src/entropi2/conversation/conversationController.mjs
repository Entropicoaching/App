import { athleteQuestion, athleteAnswerContent, athleteSetContent } from './athleteConversation.mjs'
import { createQuickReplyUsage } from './quickReplyUsage.mjs'
import { createOwnQuickReplies } from './ownQuickReplies.mjs'
import { threadFor, timestampContent } from './conversationModel.mjs'

const LOAD_ERROR = 'Samtalen kunne ikke hentes sikkert. Opdatér og prøv igen.'

export function createConversation({ enabled = false, adapters, storage, uuid = () => globalThis.crypto.randomUUID() }) {
  let active = true, generation = 0, busy = false, loading = false, error = '', draft = '', operation = null
  // writes tæller bekræftede skrivninger (afsendelse, læst), så en ældre baggrundshentning ikke overskriver dem.
  let messages = [], analyses = [], submissions = new Map(), loaded = false, writes = 0
  const usage = createQuickReplyUsage(storage)
  const ownReplies = createOwnQuickReplies(storage)
  const listeners = new Set()
  const initial = enabled === true ? adapters.scope() : null
  const guard = () => {
    if (!active || enabled !== true) throw Error('Samtalen er slået fra.')
    const s = adapters.scope()
    if (s.athleteId !== initial.athleteId || s.role !== initial.role || s.ownerId !== initial.ownerId)
      throw Error('Åbn samtalen igen for den valgte atlet.')
    return s
  }
  const delivered = () => !!operation && messages.some(row => row.id === operation.row.id)
  const snapshot = () => {
    let available = false
    try { guard(); available = true } catch { /* Never expose a previous scope's records or draft. */ }
    // U2: står beskeden allerede i tråden, vises den ikke også som "Sender…".
    const shown = operation && !(operation.status === 'pending' && delivered()) ? operation : null
    return { available, loaded: available && loaded, loading: available && loading, busy: available && busy,
      error: available ? error : enabled === true ? 'Samtalen er ikke længere tilgængelig.' : '',
      draft: available ? draft : '', role: initial?.role, athleteId: initial?.athleteId,
      thread: available ? threadFor(initial?.athleteId, messages, [...submissions.values(), ...analyses]) : [],
      operation: available && shown ? { ...shown, row: { ...shown.row } } : null }
  }
  const emit = () => { if (active) for (const fn of listeners) fn(snapshot()) }
  // U2: en afsendelse med ukendt udfald afgøres af næste hentning. Står rækken
  // i tråden, er beskeden sendt; den vises én gang, og "Prøv igen" sender intet nyt.
  function settle() {
    if (operation?.status !== 'error' || !delivered()) return
    operation.status = 'sent'
    if (draft === operation.draft) draft = ''
    error = ''
  }
  // quiet: baggrundshentning (fokus, interval). Den viser ikke "Henter…", afbryder
  // aldrig en synlig hentning eller en afsendelse, og en netfejl skjuler ikke tråden.
  async function refresh({ quiet = false } = {}) {
    if (enabled !== true || !active) return false
    if (quiet === true && (loading || busy)) return false
    const token = ++generation, version = writes
    try {
      guard()
      if (quiet !== true) { loading = true; error = ''; emit() }
      const data = await adapters.load()
      guard()
      if (token !== generation) return false
      // En læsning eller afsendelse landede imens; det ældre svar må ikke overskrive den.
      if (quiet === true && version !== writes) return false
      messages = data.messages; analyses = data.analyses; loaded = true
      if (quiet === true && error === LOAD_ERROR) error = ''
      settle()
      return true
    } catch {
      if (active && token === generation && !(quiet === true && loaded)) error = LOAD_ERROR
      return false
    } finally { if (active && token === generation) { if (quiet !== true) loading = false; emit() } }
  }
  async function transmit() {
    if (busy || !operation || operation.status === 'sent') return false
    try {
      guard(); busy = true; error = ''; operation.status = 'pending'; emit()
      const saved = await adapters.send(operation.row)
      guard()
      messages = [...messages.filter(row => row.id !== saved.id), saved]
      writes++
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
  async function action(fn, failure) {
    try { guard(); error = ''; const result = await fn(); guard(); return result }
    catch (e) { if (active) error = failure || e.message; return false }
    finally { emit() }
  }
  function send({ analysisId, seconds } = {}) {
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
  }
  function athleteSend(content) {
    try {
      const s = guard()
      if (s.role !== 'athlete' || !loaded || loading || busy || error
        || operation?.status === 'error' || draft.trim()) return Promise.resolve(false)
      draft = content()
      return send()
    } catch (e) { error = e.message; emit(); return Promise.resolve(false) }
  }
  return {
    snapshot, refresh,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn) },
    draft(text) {
      guard()
      if (busy || operation?.status === 'error') return false
      draft = String(text).slice(0, 10000); emit(); return true
    },
    send,
    answerQuestion(key, answer) {
      return athleteSend(() => {
        const question = athleteQuestion(snapshot().thread)
        if (!question || question.key !== key) throw Error('Spørgsmålet er ændret. Opdatér samtalen.')
        return athleteAnswerContent(question, answer)
      })
    },
    shareSet(set, note) { return athleteSend(() => athleteSetContent(set, note)) },
    retry: transmit,
    // Do not discard an unknown outcome and silently allocate a new send identity.
    async seen(key) {
      return action(async () => {
        if (!loaded || loading) throw Error('Opdatér samtalen først.')
        const item = snapshot().thread.find(row => row.key === key)
        if (!item || !(initial.role === 'athlete' ? item.unreadAthlete : item.unreadCoach)) return true
        const saved = await adapters.seen(item)
        guard()
        writes++
        if (item.kind === 'message') messages = messages.map(row => row.id === saved.id ? saved : row)
        else analyses = analyses.map(row => row.id === saved.id ? saved : row)
        return true
      })
    },
    templates: () => {
      const s = guard()
      return s.role === 'coach' ? usage.order(adapters.templates(), s.ownerId) : []
    },
    ownQuickReplies(action, index, text) {
      const s = guard()
      if (s.role !== 'coach' || busy || operation?.status === 'error') throw Error('Hurtigsvar er ikke tilgængelige lige nu.')
      if (action === undefined) return ownReplies.list(s.ownerId)
      if (action === 'save') return ownReplies.save(s.ownerId, index, text)
      if (action === 'remove') return ownReplies.remove(s.ownerId, index)
      throw Error('Ukendt hurtigsvarhandling.')
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
    }, 'Videoen kunne ikke klargøres. Prøv igen med den valgte video.'),
    dispose() { active = false; generation++; listeners.clear() },
  }
}
