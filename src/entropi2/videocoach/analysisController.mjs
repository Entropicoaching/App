import { DEFAULT_VIDEOCOACH, validWindow } from './model.mjs'
import { createAthleteAccessController, normalizeOwnAnalysis } from './accessController.mjs'
import { createUploadController } from './uploadController.mjs'
import { validId } from '../conversation/conversationModel.mjs'

// The host provides today's set context and its existing conversation/media adapters.
// Session memory only: persistence remains with the host's existing saveLocal callback.
function context(choice) {
  const date = choice?.session_date
  if (!validId(choice?.key) || !validId(choice?.session_id) || !validId(choice?.exercise_id)
    || typeof choice.exercise_name !== 'string' || !choice.exercise_name.trim() || choice.exercise_name.length > 80
    || !Number.isInteger(choice.set_number) || choice.set_number < 1 || choice.set_number > 1000
    || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))
    || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)
    throw Error('Analysen mangler dato, pas, øvelse eller sæt.')
  return structuredClone(choice)
}

export function createVideoAnalysisController(config = {}) {
  // OFF and read-only must not inspect host adapters, options or scope.
  if ((config.enabled ?? DEFAULT_VIDEOCOACH) !== true || config.readOnly === true) {
    const access = createAthleteAccessController()
    return { access, snapshot: () => ({ enabled: false }),
      subscribe(fn) { fn({ enabled: false }); return () => {} },
      send: async () => false, retry: async () => false, cancel: () => false, dispose() {} }
  }
  const { callbacks = {}, conversation, getScope = () => 'local', options = [] } = config
  const choices = options.map(context)
  let scope
  try { scope = getScope() } catch { scope = null }
  if (typeof scope !== 'string' || !scope) return createVideoAnalysisController()
  const rows = new Map(), operations = new Map(), listeners = new Set()
  for (const value of config.records ?? []) {
    const choice = context(value.choice)
    if (!validId(value.clientAnalysisId) || rows.has(value.clientAnalysisId)
      || typeof value.source?.id !== 'string' || !value.source.id || typeof value.source.label !== 'string'
      || !validWindow(value.window, value.source.duration)) throw Error('Den gemte analyse kunne ikke læses sikkert.')
    rows.set(value.clientAnalysisId, { clientAnalysisId: value.clientAnalysisId, choice,
      source: { id: value.source.id, label: value.source.label, duration: value.source.duration },
      window: { start: value.window.start, end: value.window.end }, analysis: normalizeOwnAnalysis(value.analysis, value.window),
      localId: typeof value.localId === 'string' ? value.localId : null })
  }
  let active = true, unsubscribe, access
  function available() {
    if (!active) return false
    try { if (getScope() === scope) return true } catch { /* revoke permanently */ }
    dispose(); return false
  }
  function guard(signal) {
    if (!available() || signal?.aborted) throw Error('Afsendelsen er stoppet. Åbn analysen igen.')
  }
  function conversationState(op) {
    const state = conversation?.snapshot()
    const ownError = op?.message && state?.operation?.row.id === op.message && state.operation.status === 'error'
    if (!state?.available || !state.loaded || state.loading || state.busy || state.error && !ownError || state.role !== 'athlete')
      throw Error('Opdatér den eksisterende samtale og prøv igen.')
    return state
  }
  const canSend = () => typeof callbacks.prepare === 'function' && typeof callbacks.upload === 'function'
    && typeof conversation?.submission === 'function' && typeof conversation?.shareSet === 'function'
  function snapshot() {
    if (!available()) return { enabled: false }
    return structuredClone({ enabled: true, canSend: canSend(), records: [...rows.values()].map(row => {
      const op = operations.get(row.clientAnalysisId)
      return { ...row, phase: op?.phase === 'sent' ? 'sent' : row.deliveryPhase === 'preparing' ? 'preparing' : op?.phase ?? row.deliveryPhase ?? 'idle',
        error: op?.error || row.deliveryError || '', analysisId: op?.analysisId ?? null }
    }).sort((a, b) => b.choice.session_date.localeCompare(a.choice.session_date)) })
  }
  const emit = () => { for (const fn of listeners) fn(snapshot()) }
  function update(op, phase, error = '') { op.phase = phase; op.error = error; emit() }

  async function upload(request) {
    guard(request.signal)
    const row = rows.get(request.clientAnalysisId)
    if (!row || !canSend()) throw Error('Analysen er ikke klar til afsendelse i samtalen.')
    const op = operations.get(row.clientAnalysisId) ?? { phase: 'idle', receipt: null, registered: false, message: null }
    if (op.running) throw Error('Analysen er allerede ved at blive sendt.')
    if (op.phase === 'sent') return op.receipt
    operations.set(row.clientAnalysisId, op); op.running = true
    try {
      if (op.referenceError) {
        if (await conversation.refresh() !== true) throw Error('Samtalen kunne ikke opdateres. Prøv igen.')
        guard(request.signal); op.referenceError = false
      }
      // Do not upload over a conversation draft or an unrelated unresolved send.
      let state = conversationState(op)
      if ((state.draft.trim() || state.operation?.status === 'error') && !op.message)
        throw Error('Afslut den ventende besked i samtalen først.')
      update(op, 'sending')
      if (!op.receipt) {
        const receipt = await callbacks.upload({ ...request, choice: structuredClone(row.choice), analysis: structuredClone(row.analysis) })
        guard(request.signal)
        if (receipt?.ok !== true || receipt.clientAnalysisId !== row.clientAnalysisId)
          throw Error('Videoens afsendelse er ikke bekræftet. Prøv igen med samme analyse.')
        op.receipt = structuredClone(receipt)
      }
      if (!op.registered) {
        guard(request.signal)
        if (await conversation.submission(row.clientAnalysisId) !== true) {
          op.referenceError = true
          throw Error('Videoen kunne ikke bekræftes i samtalen. Prøv igen.')
        }
        guard(request.signal)
        state = conversationState(op)
        const video = state.thread.find(item => item.kind === 'video' && item.value.client_analysis_id === row.clientAnalysisId)?.value
        if (!validId(video?.id)) throw Error('Samtalen mangler den valgte videoreference.')
        op.analysisId = video.id; op.registered = true
      }
      guard(request.signal)
      state = conversationState(op)
      const label = `${row.choice.session_date} · ${row.choice.exercise_name.trim()} · sæt ${row.choice.set_number}`
      const note = `Videoanalyse: ${row.analysis.reps} registrerede gentagelser. Kontrollér resultatet i videoen.\nVideo-id: ${op.analysisId}`
      const content = `Fra passet · ${label}\n${note}`
      const confirmed = state.thread.find(item => item.kind === 'message' && item.value.sender_role === 'athlete'
        && item.value.content === content)?.value
      if (confirmed) { op.message = confirmed.id; update(op, 'sent'); return op.receipt }
      let sent
      if (op.message) {
        // Retry only our exact operation. Never send or clear another message.
        if (state.operation?.row.id !== op.message || state.operation.row.content !== content)
          throw Error('Den ventende besked er ændret. Kontrollér samtalen.')
        sent = state.operation.status === 'sent' || await conversation.retry()
      } else {
        if (state.draft.trim() || state.operation?.status === 'error') throw Error('Afslut den ventende besked i samtalen først.')
        sent = await conversation.shareSet(label, note)
        const saved = conversation.snapshot().operation
        if (saved?.row.content === content) op.message = saved.row.id
      }
      guard(request.signal)
      if (sent !== true || !op.message) throw Error('Analysebeskeden er ikke bekræftet. Prøv igen med samme analyse.')
      update(op, 'sent'); return op.receipt
    } catch (error) {
      if (available()) update(op, 'error', error?.message || 'Afsendelsen kunne ikke bekræftes. Prøv igen.')
      throw error
    } finally { op.running = false }
  }
  const hostCallbacks = { upload }
  for (const name of ['chooseSource', 'analyze', 'saveLocal', 'prepare']) {
    if (typeof callbacks[name] === 'function') hostCallbacks[name] = request => callbacks[name](request)
  }
  if (!canSend()) delete hostCallbacks.upload
  access = createAthleteAccessController({ ...config, requireAnalysis: true, options: choices, callbacks: hostCallbacks })
  unsubscribe = access.subscribe(state => {
    if (!available() || !state.enabled || !state.analysis || !state.choice) return
    const choice = context(state.choice)
    if (!validId(state.clientAnalysisId) || !validWindow(state.window, state.source?.duration)) return
    const old = rows.get(state.clientAnalysisId)
    rows.set(state.clientAnalysisId, { clientAnalysisId: state.clientAnalysisId, choice,
      source: structuredClone(state.source), window: structuredClone(state.window),
      deliveryPhase: state.delivery?.phase, deliveryError: state.delivery?.error,
      analysis: normalizeOwnAnalysis(state.analysis, state.window), localId: state.localId ?? old?.localId ?? null })
    emit()
  })
  async function send(id) {
    if (!available() || !canSend() || !rows.has(id)) return false
    const row = rows.get(id)
    let op = operations.get(id)
    if (op?.running || op?.phase === 'sent') return false
    // Reuse the access panel's pending operation if it already owns this record.
    const draft = access.snapshot()
    if (draft.clientAnalysisId === id && (draft.open || draft.locked)) return draft.locked ? access.retrySend() : access.send()
    op ??= { phase: 'idle', receipt: null, registered: false, message: null }
    operations.set(id, op)
    if (!op.transport) {
      op.transport = createUploadController({ ...config, enabled: true, options: [row.choice], uuid: () => id,
        callbacks: { prepare: request => callbacks.prepare(request), upload } })
      op.transport.subscribe(delivery => {
        if (available() && ['preparing', 'error', 'cancelled'].includes(delivery.phase)) update(op, delivery.phase, delivery.error)
      })
      op.transport.choose(row.choice.key); op.transport.next(); op.transport.select(row.source)
      op.transport.selectWindow(row.window); op.transport.next()
    }
    const result = await (op.transport.snapshot().operationId ? op.transport.retry() : op.transport.send())
    if (available() && !result && op.phase !== 'error') update(op, 'error', op.transport.snapshot().error)
    return result
  }
  function dispose() {
    active = false; unsubscribe?.(); access?.dispose()
    for (const op of operations.values()) op.transport?.dispose()
    rows.clear(); operations.clear(); listeners.clear()
  }
  return { access, snapshot, send, retry: send,
    subscribe(fn) { if (!available()) { fn({ enabled: false }); return () => {} }; listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn) },
    cancel(id) {
      if (!available()) return false
      const transport = operations.get(id)?.transport
      return transport ? transport.cancel() : access.snapshot().clientAnalysisId === id ? access.cancel() : false
    }, dispose }
}
