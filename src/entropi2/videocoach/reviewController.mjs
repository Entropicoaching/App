import { DEFAULT_VIDEOCOACH, finite, clamp, normalizeMarker } from './model.mjs'
import { analyzeSyntheticBarPath } from './barPath.mjs'

export function createReviewController({ enabled = DEFAULT_VIDEOCOACH, analysisId, duration,
  conclusion = {}, markers = [], callbacks = {}, conversation, getScope = () => 'local',
  uuid = () => globalThis.crypto.randomUUID() } = {}) {
  const scope = enabled === true ? getScope() : null, listeners = new Set()
  let active = true, generation = 0, drawing = null, busy = false
  const available = () => { try { return active && enabled === true && getScope() === scope } catch { return false } }
  if (enabled === true && (typeof analysisId !== 'string' || !analysisId || !finite(duration) || duration <= 0 || duration > 7200))
    throw Error('Gennemgangen mangler videoidentitet eller varighed.')
  let state = { time: 0, conclusion: { works: conclusion.works || '', focus: conclusion.focus || '', next_set: conclusion.next_set || '' },
    markers: markers.map(m => ({ ...normalizeMarker(m, duration), id: m.id || uuid() })),
    start: 0, end: Math.min(1, duration), text: '', strokes: [], reply: '', error: '', status: '', dirty: false,
    barPath: null, barPathError: '' }
  const snapshot = () => available() ? structuredClone({ ...state, drawing, busy, duration, analysisId,
    canSaveConclusion: typeof callbacks.saveConclusion === 'function', canSaveMarkers: typeof callbacks.saveMarkers === 'function',
    canSend: !!conversation, canSeek: typeof callbacks.seek === 'function' }) : { enabled: false }
  const emit = () => { for (const fn of listeners) fn(snapshot()) }
  const edit = patch => { if (!available() || busy) return false; state = { ...state, status: '', error: '', ...patch }; emit(); return true }
  async function action(fn, success) {
    if (!available() || busy) return false
    const token = ++generation; busy = true; state.error = ''; state.status = ''; emit()
    try {
      if (await fn() !== true) throw Error('Handlingen er ikke bekræftet. Prøv igen.')
      if (!available() || token !== generation) return false
      state.status = success; return true
    } catch (e) { if (available() && token === generation) state.error = e.message || 'Prøv igen.'; return false }
    finally { busy = false; if (available() && token === generation) emit() }
  }
  return {
    snapshot,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn) },
    syntheticBarPath(samples, options = {}) {
      if (!available() || busy) return false
      try { return edit({ barPath: analyzeSyntheticBarPath(samples, options), barPathError: '' }) }
      catch { edit({ barPath: null, barPathError: 'Den syntetiske stangbane er ugyldig. Kontrollér målepunkter og skala.' }); return false }
    },
    conclusion(field, value) {
      if (!['works', 'focus', 'next_set'].includes(field) || typeof value !== 'string' || value.length > 600) return false
      return edit({ conclusion: { ...state.conclusion, [field]: value }, dirty: true })
    },
    time(value) { if (!finite(value) || value < 0 || value >= duration) return false; return edit({ time: value }) },
    seek(value) {
      if (!available() || !finite(value) || value < 0 || value >= duration || typeof callbacks.seek !== 'function') return false
      try { callbacks.seek(value); return edit({ time: value }) }
      catch { return edit({ error: 'Tidspunktet kunne ikke åbnes.' }) }
    },
    marker(field, value) {
      if (!['start', 'end', 'text'].includes(field) || field === 'text' && (typeof value !== 'string' || value.length > 2000)
        || field !== 'text' && !finite(value)) return false
      return edit({ [field]: value })
    },
    drawStart(pointerId, x, y) {
      if (!available() || busy || !finite(x) || !finite(y) || state.strokes.length >= 20) return false
      drawing = { pointerId, color: '#ffcc00', points: [[clamp(x, 0, 1), clamp(y, 0, 1)]] }; emit(); return true
    },
    drawMove(pointerId, x, y) {
      if (!available() || busy || drawing?.pointerId !== pointerId || !finite(x) || !finite(y) || drawing.points.length >= 200) return false
      drawing.points.push([clamp(x, 0, 1), clamp(y, 0, 1)]); emit(); return true
    },
    drawEnd(pointerId) {
      if (!drawing || drawing.pointerId !== pointerId) return false
      const stroke = drawing; drawing = null
      if (stroke.points.length >= 2) return edit({ strokes: [...state.strokes, { color: stroke.color, points: stroke.points }] })
      emit(); return false
    },
    drawCancel() { drawing = null; if (available()) emit() },
    undo() { return edit({ strokes: state.strokes.slice(0, -1) }) },
    addMarker() {
      if (!available() || busy || state.markers.length >= 200) return false
      try {
        const marker = normalizeMarker(state, duration)
        return edit({ markers: [...state.markers, { ...marker, id: uuid() }].sort((a, b) => a.start - b.start), text: '', strokes: [], dirty: true })
      } catch (e) { edit({ error: e.message }); return false }
    },
    removeMarker(id) { return edit({ markers: state.markers.filter(m => m.id !== id), dirty: true }) },
    saveConclusion() {
      if (!Object.values(state.conclusion).some(s => s.trim()) || !callbacks.saveConclusion) return Promise.resolve(false)
      const draft = structuredClone(state.conclusion)
      return action(() => callbacks.saveConclusion(analysisId, draft), 'Konklusion gemt som kladde.')
    },
    saveMarkers() {
      if (!callbacks.saveMarkers) return Promise.resolve(false)
      const draft = structuredClone(state.markers)
      return action(() => callbacks.saveMarkers(analysisId, draft), 'Markeringer gemt.')
    },
    reply(value) { return typeof value === 'string' && value.length <= 600 && edit({ reply: value }) },
    sendFeedback() {
      if (!conversation || !state.reply.trim() || !finite(state.time) || state.time < 0 || state.time >= duration) return Promise.resolve(false)
      return action(async () => {
        const s = conversation.snapshot()
        // Never overwrite a conversation draft or its unresolved send operation.
        if (s.busy || s.operation?.status === 'error' || s.draft && s.draft !== state.reply) throw Error('Afslut den ventende besked i samtalen først.')
        if (conversation.draft(state.reply) !== true) return false
        const sent = await conversation.send({ analysisId, seconds: state.time })
        if (sent === true && available()) state.reply = ''
        return sent
      }, 'Feedback sendt i samtalen.')
    },
    retryFeedback() {
      if (!conversation || conversation.snapshot().operation?.status !== 'error') return Promise.resolve(false)
      return action(async () => { const sent = await conversation.retry(); if (sent === true && available()) state.reply = ''; return sent }, 'Feedback sendt i samtalen.')
    },
    dispose() { active = false; generation++; drawing = null; listeners.clear() },
  }
}
