import { DEFAULT_VIDEOCOACH, finite, initialWindow, validWindow, moveWindow, resizeWindow, clamp } from './model.mjs'

// Metadata and opaque artifact handles only. No media, transport or configured client.
export function createUploadController({ enabled = DEFAULT_VIDEOCOACH, options = [], callbacks = {},
  uuid = () => globalThis.crypto.randomUUID(), getScope = () => 'local',
  clock = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id) }, timeoutMs = 120000 } = {}) {
  const listeners = new Set(), scope = enabled === true ? getScope() : null
  const choices = structuredClone(options)
  let active = true, generation = 0, abort = null, drag = null, operation = null
  let state = { step: 1, choice: null, source: null, window: null, phase: 'idle', progress: null, error: '', background: false }
  const available = () => { try { return active && enabled === true && getScope() === scope } catch { return false } }
  const busy = () => ['preparing', 'sending'].includes(state.phase)
  const snapshot = () => available() ? structuredClone({ ...state, options: choices,
    operationId: operation?.id || null, uploaded: operation?.uploaded || false,
    canSend: typeof callbacks.prepare === 'function' && typeof callbacks.upload === 'function' })
    : { enabled: false, options: [], phase: 'off', error: '' }
  const emit = () => { for (const fn of listeners) fn(snapshot()) }
  const guard = () => { if (!available()) throw Error('Åbn videoen igen for den valgte atlet.') }
  const editable = () => available() && !busy() && !operation
  const update = patch => { state = { ...state, ...patch }; emit() }
  async function stage(fn, request, token) {
    let timer, onAbort
    const signal = abort.signal
    try {
      return await Promise.race([
        Promise.resolve().then(() => { guard(); if (signal.aborted) throw Error('Afbrudt.'); return fn(request) }),
        new Promise((_, reject) => {
          timer = clock.set(() => {
            if (token === generation) abort?.abort()
            reject(Error('Det tager længere tid end ventet. Prøv igen med samme afsendelse.'))
          }, timeoutMs)
          onAbort = () => reject(Error('Afbrudt. Afsendelsens udfald skal kontrolleres ved næste forsøg.'))
          signal.addEventListener('abort', onAbort, { once: true })
        }),
      ])
    } finally { clock.clear(timer); if (onAbort) signal.removeEventListener('abort', onAbort) }
  }
  async function transmit() {
    if (!available() || busy() || !operation || state.phase === 'sent') return false
    const token = ++generation
    abort = new AbortController()
    const current = () => available() && token === generation
    try {
      guard()
      if (!operation.prepared) {
        update({ phase: 'preparing', error: '', progress: null })
        const prepared = await stage(callbacks.prepare, { source: structuredClone(operation.source),
          window: { ...operation.window }, signal: abort.signal,
          onProgress(value) { if (current() && state.phase === 'preparing' && finite(value)) update({ progress: clamp(value, 0, 1) }) } }, token)
        if (!current()) return false
        // The existing media adapter must decode output and run its original validation.
        if (!prepared || prepared.artifact == null || !finite(prepared.duration) || prepared.duration <= 0
          || prepared.duration > 15 || Math.abs(prepared.duration - (operation.window.end - operation.window.start)) > 0.5)
          throw Error('Klargøringen er ikke bekræftet. Dit valgte løft er bevaret.')
        operation.prepared = prepared
      }
      update({ phase: 'sending', progress: null, error: '' })
      const result = await stage(callbacks.upload, { clientAnalysisId: operation.id,
        choice: structuredClone(operation.choice), artifact: operation.prepared.artifact,
        duration: operation.prepared.duration, window: { ...operation.window }, signal: abort.signal,
        onProgress(value) { if (current() && state.phase === 'sending' && finite(value)) update({ progress: clamp(value, 0, 1) }) } }, token)
      if (!current()) return false
      operation.uploaded ||= result?.uploaded === true
      if (result?.ok !== true || result.clientAnalysisId !== operation.id)
        throw Error('Afsendelsen er ikke bekræftet. Prøv igen; dit løft og afsendelses-id er bevaret.')
      update({ phase: 'sent', progress: 1, error: '' })
      return true
    } catch (error) {
      if (current()) update({ phase: 'error', progress: null, error: error.message || 'Prøv igen.' })
      return false
    } finally { if (token === generation) abort = null }
  }
  return {
    snapshot,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn) },
    choose(key) {
      if (!editable()) return false
      const choice = choices.find(row => row.key === key)
      update({ choice: choice ? structuredClone(choice) : null }); return !!choice
    },
    select(source) {
      if (!editable()) return false
      try {
        if (typeof source?.id !== 'string' || !source.id || typeof source.label !== 'string') throw Error('Vælg en video.')
        const window = initialWindow(source.duration)
        update({ source: { id: source.id, label: source.label, duration: source.duration }, window, error: '' }); return true
      } catch (e) { update({ error: e.message }); return false }
    },
    next() {
      if (!editable()) return false
      if (state.step === 1 && state.choice) { update({ step: 2 }); return true }
      if (state.step === 2 && state.source && validWindow(state.window, state.source.duration)) { update({ step: 3 }); return true }
      return false
    },
    back() { if (!editable()) return false; update({ step: Math.max(1, state.step - 1) }); return true },
    move(start) {
      if (!editable() || !state.source || !finite(start)) return false
      update({ window: moveWindow(state.window, start, state.source.duration) }); return true
    },
    resize(edge, value) {
      if (!editable() || !state.source || !finite(value) || !['start', 'end'].includes(edge)) return false
      update({ window: resizeWindow(state.window, edge, value, state.source.duration) }); return true
    },
    dragStart(pointerId, x, width) {
      if (!editable() || !state.source || !finite(x) || !finite(width) || width <= 0) return false
      drag = { pointerId, x, width, start: state.window.start }; return true
    },
    dragMove(pointerId, x) {
      if (!drag || drag.pointerId !== pointerId || !editable() || !finite(x)) return false
      update({ window: moveWindow(state.window, drag.start + (x - drag.x) / drag.width * state.source.duration, state.source.duration) }); return true
    },
    dragEnd() { drag = null },
    send() {
      if (!editable() || state.step !== 3 || !state.choice || !state.source || !validWindow(state.window, state.source.duration)
        || typeof callbacks.prepare !== 'function' || typeof callbacks.upload !== 'function') return Promise.resolve(false)
      operation = { id: uuid(), choice: structuredClone(state.choice), source: { ...state.source }, window: { ...state.window }, prepared: null, uploaded: false }
      return transmit()
    },
    retry() { return ['error', 'cancelled'].includes(state.phase) ? transmit() : Promise.resolve(false) },
    cancel() {
      if (!available() || !busy()) return false
      generation++; abort?.abort(); abort = null
      update({ phase: 'cancelled', progress: null, error: 'Stoppet. Et eventuelt delvist resultat kontrolleres ved Prøv igen.' }); return true
    },
    background() {
      if (!available() || !operation) return false
      update({ background: true }); return true
    },
    foreground() { if (available()) update({ background: false }) },
    dispose() { active = false; generation++; abort?.abort(); listeners.clear() },
  }
}
