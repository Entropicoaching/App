import { DEFAULT_VIDEOCOACH, finite, initialWindow } from './model.mjs'
import { createUploadController } from './uploadController.mjs'

// The host owns opaque source handles and the existing tracker/local store.
// This module never opens media, storage, a configured client or a flag source.
export function normalizeOwnAnalysis(value, window) {
  if (!Number.isInteger(value?.reps) || value.reps < 0 || value.reps > 1000
    || !Array.isArray(value.path) || value.path.length < 2 || value.path.length > 500)
    throw Error('Analysen mangler en gyldig bane eller et antal gentagelser.')
  let previous = -Infinity
  const path = value.path.map(point => {
    if (!Array.isArray(point) || point.length !== 3 || point.some(n => !finite(n))
      || point[0] < window.start || point[0] > window.end || point[0] <= previous
      || point[1] < 0 || point[1] > 1 || point[2] < 0 || point[2] > 1)
      throw Error('Analysens bane passer ikke til det valgte klip.')
    previous = point[0]
    return [...point]
  })
  return { reps: value.reps, path }
}

const inactive = () => {
  const snapshot = () => ({ enabled: false })
  const no = () => false, asyncNo = async () => false
  return { snapshot, subscribe(fn) { fn(snapshot()); return () => {} },
    open: no, close: no, chooseSet: no, reset: no, cancel: no, dispose: no,
    chooseSource: asyncNo, analyze: asyncNo, saveLocal: asyncNo, send: asyncNo, retrySend: asyncNo }
}

export function createAthleteAccessController(config = {}) {
  if ((config.enabled ?? DEFAULT_VIDEOCOACH) !== true || config.readOnly === true) return inactive()
  const { callbacks = {}, getScope = () => 'local', uuid = () => globalThis.crypto.randomUUID(),
    clock = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) }, timeoutMs = 120000 } = config
  let scope
  try { scope = getScope() } catch { return inactive() }
  if (typeof scope !== 'string' || !scope) return inactive()
  const options = (config.options ?? []).map(row => {
    if (typeof row?.key !== 'string' || !row.key || typeof row.exercise_name !== 'string'
      || !row.exercise_name.trim() || !Number.isInteger(row.set_number) || row.set_number < 1)
      throw Error('Videogenvejen mangler et gyldigt sæt.')
    return structuredClone(row)
  })
  if (new Set(options.map(o => o.key)).size !== options.length) throw Error('Sættene skal have forskellige nøgler.')
  const listeners = new Set()
  let active = true, generation = 0, abort = null, upload = null, unsubscribe = null
  let state = { open: false, choice: null, source: null, window: null, analysis: null,
    phase: 'idle', error: '', status: '', localId: null, clientAnalysisId: null, delivery: null }
  function disposeUpload() { unsubscribe?.(); unsubscribe = null; upload?.dispose(); upload = null }
  function available() {
    if (!active) return false
    try { if (getScope() === scope) return true } catch { /* fail closed */ }
    active = false; generation++; abort?.abort(); disposeUpload(); listeners.clear()
    return false
  }
  const busy = () => state.phase !== 'idle' || ['preparing', 'sending'].includes(state.delivery?.phase)
  const locked = () => !!state.delivery?.operationId
  const editable = () => available() && state.open && !busy() && !locked()
  const has = name => typeof callbacks[name] === 'function'
  const snapshot = () => available() ? structuredClone({ ...state, enabled: true, options, busy: busy(), locked: locked(),
    canChoose: has('chooseSource'), canAnalyze: has('analyze'), canSaveLocal: has('saveLocal'),
    canSend: has('prepare') && has('upload') && !!state.choice }) : { enabled: false }
  const emit = () => { for (const fn of listeners) fn(snapshot()) }
  const update = patch => { state = { ...state, ...patch }; emit() }
  const payload = () => structuredClone({ clientAnalysisId: state.clientAnalysisId, choice: state.choice,
    source: state.source, window: state.window, analysis: state.analysis })

  async function action(phase, name, request, accept) {
    if (!editable() || !has(name)) return false
    const token = ++generation, controller = new AbortController()
    abort = controller
    update({ phase, error: '', status: '' })
    let timer, onAbort
    try {
      const result = await Promise.race([
        Promise.resolve().then(() => {
          if (!available() || token !== generation || controller.signal.aborted) throw Error('Handlingen er stoppet.')
          return callbacks[name]({ ...request, signal: controller.signal })
        }),
        new Promise((_, reject) => {
          onAbort = () => reject(Error('Handlingen er stoppet.'))
          controller.signal.addEventListener('abort', onAbort, { once: true })
          timer = clock.set(() => { reject(Error('Det tager længere tid end ventet. Prøv igen.')); controller.abort() }, timeoutMs)
        }),
      ])
      if (!available() || token !== generation) return false
      accept(result)
      return true
    } catch (error) {
      if (available() && token === generation) update({ error: error?.message || 'Handlingen kunne ikke gennemføres. Prøv igen.' })
      return false
    } finally {
      clock.clear(timer); controller.signal.removeEventListener('abort', onAbort)
      if (available() && token === generation) { abort = null; update({ phase: 'idle' }) }
    }
  }

  const api = {
    snapshot,
    subscribe(fn) { if (!available()) { fn({ enabled: false }); return () => {} } listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn) },
    open(key) {
      if (!available() || busy()) return false
      const choice = key == null ? null : options.find(o => o.key === key)
      if (key != null && !choice) return false
      // Reopen preserves the current draft. Changing set is explicit in the panel.
      if (state.source) {
        if (key != null && state.choice?.key !== key) {
          update({ open: true, error: 'Afslut det valgte klip, eller vælg et nyt klip, før du skifter sæt.' }); return false
        }
        update({ open: true }); return true
      }
      update({ open: true, choice: choice ? structuredClone(choice) : null, error: '', status: '' }); return true
    },
    chooseSet(key) {
      if (!editable()) return false
      const choice = key === '' ? null : options.find(o => o.key === key)
      if (key !== '' && !choice) return false
      if ((choice?.key ?? null) === (state.choice?.key ?? null)) return true
      const clientAnalysisId = state.source ? uuid() : null
      if (state.source && (typeof clientAnalysisId !== 'string' || !clientAnalysisId)) return false
      update({ choice: choice ? structuredClone(choice) : null, clientAnalysisId,
        analysis: null, localId: null, status: '', error: '' }); return true
    },
    async chooseSource(mode = 'choose') {
      if (!['choose', 'record'].includes(mode)) return false
      const chosen = await action('choosing', 'chooseSource', { mode, choice: structuredClone(state.choice) }, value => {
        if (value == null) return // Native picker cancellation preserves the draft.
        if (typeof value.id !== 'string' || !value.id || typeof value.label !== 'string' || !value.label.trim())
          throw Error('Videoen kunne ikke åbnes. Vælg en anden video.')
        const window = initialWindow(value.duration)
        const clientAnalysisId = uuid()
        if (typeof clientAnalysisId !== 'string' || !clientAnalysisId) throw Error('Klippet mangler en lokal identitet.')
        update({ source: { id: value.id, label: value.label, duration: value.duration }, window,
          clientAnalysisId, analysis: null, localId: null, status: 'Video valgt.' })
      })
      if (chosen && state.source && state.status === 'Video valgt.' && has('analyze')) return api.analyze()
      return chosen
    },
    analyze() {
      if (!state.source) return Promise.resolve(false)
      return action('analyzing', 'analyze', payload(), value => {
        const analysis = normalizeOwnAnalysis(value, state.window)
        update({ analysis, localId: null, status: 'Din analyse er klar.' })
      })
    },
    saveLocal() {
      if (!state.analysis || state.localId) return Promise.resolve(false)
      return action('saving', 'saveLocal', payload(), value => {
        if (value?.ok !== true || typeof value.localId !== 'string' || !value.localId
          || value.clientAnalysisId !== state.clientAnalysisId) throw Error('Lokal gemning er ikke bekræftet. Prøv igen.')
        update({ localId: value.localId, status: 'Gemt lokalt på denne enhed.' })
      })
    },
    async send() {
      if (!editable() || !state.source || !state.choice || !has('prepare') || !has('upload')) return false
      const transport = createUploadController({ enabled: true, options, getScope, uuid: () => state.clientAnalysisId, clock, timeoutMs,
        callbacks: { prepare: request => callbacks.prepare(request), upload: request => callbacks.upload(request) } })
      upload = transport
      transport.choose(state.choice.key); transport.next(); transport.select(state.source); transport.next()
      unsubscribe = transport.subscribe(delivery => { if (available()) update({ delivery }) })
      return transport.send()
    },
    retrySend() { return available() && upload ? upload.retry() : Promise.resolve(false) },
    cancel() {
      if (!available()) return false
      if (upload && ['preparing', 'sending'].includes(state.delivery?.phase)) return upload.cancel()
      if (state.phase === 'idle') return false
      generation++; abort?.abort(); abort = null
      update({ phase: 'idle', status: 'Handlingen er stoppet. Dit valgte klip er bevaret.', error: '' }); return true
    },
    close() {
      if (!available()) return false
      api.cancel(); update({ open: false }); return true
    },
    reset() {
      if (!available() || busy()) return false
      if (locked() && state.delivery.phase !== 'sent') {
        update({ error: 'Prøv den ventende afsendelse igen, før du vælger et nyt klip.' }); return false
      }
      disposeUpload()
      update({ choice: null, source: null, window: null, analysis: null, phase: 'idle',
        error: '', status: '', localId: null, clientAnalysisId: null, delivery: null }); return true
    },
    dispose() { active = false; generation++; abort?.abort(); disposeUpload(); listeners.clear() },
  }
  return api
}
