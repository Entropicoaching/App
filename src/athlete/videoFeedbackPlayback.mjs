// VC-EPIK2 local playback contract. No backend fields or persistence writes.
export const DEFAULT_VIDEO_FEEDBACK_PLAYBACK = false
export const PLAYBACK_FLAG = 'vc-epik2-playback'
export function videoFeedbackPlaybackEnabled(storage, search = typeof window === 'undefined' ? '' : window.location.search) {
  const release = new URLSearchParams(search).getAll('rel1030')
  if ((release.length === 1 && release[0] === '1')) return true
  try { return (storage === undefined ? globalThis.localStorage : storage)?.getItem(PLAYBACK_FLAG) === '1' } catch { return false }
}
const number = x => typeof x === 'number' && Number.isFinite(x)
const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(x)
const need = x => { if (!x) throw new TypeError('Ugyldige lokale markeringer') }
export function parsePlaybackDocument(value, scope) {
  need(value && value.schema === 'vc-epik2-playback/v1' && value.status === 'ready')
  need(id(scope?.athleteId) && id(scope?.analysisId))
  need(value.athleteId === scope.athleteId && value.analysisId === scope.analysisId)
  const c = value.clip
  need(c && typeof c.name === 'string' && c.name.length > 0 && c.name.length <= 255)
  need(Number.isInteger(c.size) && c.size > 0 && c.size <= 268435456)
  need(['video/mp4', 'video/webm', 'video/quicktime'].includes(c.type))
  need(typeof c.sha256 === 'string' && /^[a-f0-9]{64}$/.test(c.sha256))
  need(number(c.duration) && c.duration > 0 && c.duration <= 7200)
  need(Number.isInteger(c.width) && c.width > 0 && c.width <= 16384)
  need(Number.isInteger(c.height) && c.height > 0 && c.height <= 16384)
  need(Array.isArray(value.markers) && value.markers.length > 0 && value.markers.length <= 200)
  const seen = new Set()
  const markers = value.markers.map(m => {
    need(m && id(m.id) && !seen.has(m.id)); seen.add(m.id)
    need(number(m.start) && number(m.end) && m.start >= 0 && m.end > m.start && m.end <= c.duration)
    need(typeof m.text === 'string' && m.text.length <= 2000)
    need(Array.isArray(m.strokes) && m.strokes.length <= 20)
    const strokes = m.strokes.map(stroke => {
      need(stroke && ['#ffcc00', '#ffffff', '#ff4444', '#00ccff'].includes(stroke.color))
      need(Array.isArray(stroke.points) && stroke.points.length >= 2 && stroke.points.length <= 200)
      return { color: stroke.color, points: stroke.points.map(point => {
        need(Array.isArray(point) && point.length === 2 && point.every(n => number(n) && n >= 0 && n <= 1))
        return [...point]
      }) }
    })
    need(m.text.trim().length > 0 || strokes.length > 0)
    return { id: m.id, start: m.start, end: m.end, text: m.text, strokes }
  }).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id, 'en'))
  return { schema: value.schema, status: 'ready', athleteId: value.athleteId,
    analysisId: value.analysisId, clip: { name: c.name, size: c.size, type: c.type,
      sha256: c.sha256, duration: c.duration, width: c.width, height: c.height }, markers }
}
export function activeMarkers(markers, time) {
  return number(time) ? markers.filter(m => m.start <= time && time < m.end) : []
}
export function adjacentMarker(markers, time, direction) {
  if (!number(time)) return null
  return direction === -1 ? [...markers].reverse().find(m => m.start < time) || null
    : direction === 1 ? markers.find(m => m.start > time) || null : null
}
export async function sha256File(file) {
  const bytes = await file.arrayBuffer()
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')
}

// Native DOM, mounted only by the opt-in React wrapper. Dependencies injectable for hermetic tests.
export function mountFeedbackPlayback(root, scope, { urlApi = globalThis.URL, digest = sha256File } = {}) {
  const doc = root.ownerDocument
  const listeners = []
  let disposed = false, generation = 0, sourceUrl = null, feedback = null, ready = false
  const el = (tag, text) => { const n = doc.createElement(tag); if (text) n.textContent = text; return n }
  const listen = (node, name, handler) => { node.addEventListener(name, handler); listeners.push([node, name, handler]) }
  const heading = el('h3', 'Afspil coachens markeringer')
  const help = el('p', 'Lokal visning: vælg coachens markeringsfil og det tilhørende videoklip. Filerne uploades ikke.')
  const jsonLabel = el('label', 'Markeringsfil (JSON) '), jsonInput = el('input')
  jsonInput.type = 'file'; jsonInput.accept = 'application/json,.json'; jsonLabel.append(jsonInput)
  const fileLabel = el('label', 'Videoklip '), fileInput = el('input')
  fileInput.type = 'file'; fileInput.accept = 'video/mp4,video/webm,video/quicktime'; fileInput.disabled = true
  fileLabel.append(fileInput)
  const status = el('p', 'Vælg markeringsfilen først.'); status.setAttribute('role', 'status')
  const frame = el('div'); frame.style.position = 'relative'; frame.style.width = '100%'; frame.hidden = true
  const video = el('video'); video.controls = true; video.preload = 'metadata'; video.playsInline = true
  video.setAttribute('aria-label', 'Video med coachens markeringer')
  video.style.width = '100%'; video.style.height = '100%'; video.style.display = 'block'
  // Native fullscreen would separate the video from its SVG sibling.
  video.setAttribute('controlsList', 'nofullscreen'); video.disablePictureInPicture = true
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 1 1'); svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('aria-hidden', 'true')
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' })
  frame.append(video, svg)
  const comments = el('div'); comments.style.overflowWrap = 'anywhere'; comments.setAttribute('aria-label', 'Aktuelle kommentarer')
  const nav = el('div'), previous = el('button', 'Forrige markering'), next = el('button', 'Næste markering')
  Object.assign(nav.style, { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' })
  const list = el('div'); Object.assign(list.style, { display: 'grid', gap: '0.5rem' }); list.setAttribute('aria-label', 'Alle markeringer')
  for (const b of [previous, next]) { b.type = 'button'; b.style.minHeight = '44px' }
  nav.append(previous, next)
  root.replaceChildren(heading, help, jsonLabel, fileLabel, status, frame, comments, nav, list)
  function update() {
    const active = ready ? activeMarkers(feedback.markers, video.currentTime) : []
    comments.replaceChildren(...active.map(m => el('p', m.text || 'Tegning')))
    svg.replaceChildren()
    for (const m of active) for (const stroke of m.strokes) {
      const line = doc.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      line.setAttribute('points', stroke.points.map(p => p.join(',')).join(' '))
      line.setAttribute('stroke', stroke.color); line.setAttribute('fill', 'none')
      line.setAttribute('stroke-width', '3'); line.setAttribute('vector-effect', 'non-scaling-stroke')
      svg.append(line)
    }
    previous.disabled = !ready || !adjacentMarker(feedback.markers, video.currentTime, -1)
    next.disabled = !ready || !adjacentMarker(feedback.markers, video.currentTime, 1)
    for (const button of list.children) {
      button.disabled = !ready
      button.setAttribute('aria-pressed', String(active.some(m => m.id === button.dataset.markerId)))
    }
  }
  function clearVideo() {
    ready = false; frame.hidden = true; video.pause(); video.removeAttribute('src'); video.load()
    if (sourceUrl) urlApi.revokeObjectURL(sourceUrl)
    sourceUrl = null; update()
  }
  function fail(message) { clearVideo(); status.textContent = message }
  function seek(marker) {
    if (!ready || !marker) return
    try { video.currentTime = marker.start; update() } catch { fail('Videoen kunne ikke spoles. Vælg klippet igen.') }
  }
  listen(previous, 'click', () => seek(ready && adjacentMarker(feedback.markers, video.currentTime, -1)))
  listen(next, 'click', () => seek(ready && adjacentMarker(feedback.markers, video.currentTime, 1)))
  // Delegate marker clicks so repeated document loads never accumulate listeners.
  listen(list, 'click', event => seek(feedback?.markers.find(m => m.id === event.target?.dataset?.markerId)))
  listen(jsonInput, 'change', async () => {
    const token = ++generation
    feedback = null; clearVideo(); list.replaceChildren(); fileInput.disabled = true; fileInput.value = ''
    const file = jsonInput.files?.[0]; jsonInput.value = ''
    if (!file) { status.textContent = 'Vælg markeringsfilen først.'; return }
    try {
      need(file.size > 0 && file.size <= 500000)
      const parsed = parsePlaybackDocument(JSON.parse(await file.text()), scope)
      if (disposed || token !== generation) return
      feedback = parsed
      for (const m of feedback.markers) {
        const b = el('button', `${m.start.toFixed(2)} s: ${m.text || 'Tegning'}`)
        b.type = 'button'; b.dataset.markerId = m.id
        Object.assign(b.style, { minHeight: '44px', maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }); list.append(b)
      }
      fileInput.disabled = false; status.textContent = 'Vælg det tilhørende videoklip.'; update()
    } catch { if (!disposed && token === generation) { status.textContent = 'Markeringsfilen passer ikke til denne feedback eller har et ugyldigt format.'; update() } }
  })
  listen(fileInput, 'change', async () => {
    const token = ++generation
    clearVideo()
    const file = fileInput.files?.[0]; fileInput.value = ''
    if (!file || !feedback) { status.textContent = 'Vælg det tilhørende videoklip.'; return }
    const expected = feedback.clip
    status.textContent = 'Kontrollerer videoklippet…'
    try {
      need(file.name === expected.name && file.size === expected.size && file.type === expected.type)
      need(await digest(file) === expected.sha256)
      if (disposed || token !== generation) return
      sourceUrl = urlApi.createObjectURL(file)
      video.src = sourceUrl; video.load()
    } catch { if (!disposed && token === generation) fail('Videoklippet passer ikke til markeringerne. Vælg det oprindelige klip.') }
  })
  listen(video, 'loadedmetadata', () => {
    if (!sourceUrl || disposed || !feedback) return
    const c = feedback.clip
    if (!number(video.duration) || Math.abs(video.duration - c.duration) > 0.05 || video.videoWidth !== c.width || video.videoHeight !== c.height) {
      fail('Videoens varighed eller billedformat passer ikke til markeringerne.'); return
    }
    ready = true; frame.style.aspectRatio = `${c.width} / ${c.height}`; frame.hidden = false
    status.textContent = 'Klar. Afspil videoen eller vælg en markering.'; update()
  })
  for (const event of ['timeupdate', 'seeking', 'seeked', 'ended']) listen(video, event, update)
  listen(video, 'error', () => { if (sourceUrl) fail('Videoen kunne ikke afspilles. Vælg klippet igen.') })
  update()
  return () => {
    disposed = true; ++generation
    for (const [node, name, handler] of listeners) node.removeEventListener(name, handler)
    clearVideo(); root.replaceChildren()
  }
}
