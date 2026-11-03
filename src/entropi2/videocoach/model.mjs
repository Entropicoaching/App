export const DEFAULT_VIDEOCOACH = false
export const MAX_SECONDS = 15
export const finite = value => typeof value === 'number' && Number.isFinite(value)
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export function validWindow(window, duration) {
  return finite(duration) && duration > 0 && finite(window?.start) && finite(window?.end)
    && window.start >= 0 && window.end <= duration && window.end > window.start
    && window.end - window.start <= MAX_SECONDS
}
export function initialWindow(duration) {
  if (!finite(duration) || duration <= 0) throw Error('Videoens længde mangler.')
  return { start: Math.max(0, duration - MAX_SECONDS), end: duration }
}
export function moveWindow(window, start, duration) {
  if (!validWindow(window, duration) || !finite(start)) throw Error('Ugyldigt interval.')
  const length = window.end - window.start
  const next = clamp(start, 0, duration - length)
  return { start: next, end: next + length }
}
export function resizeWindow(window, edge, value, duration) {
  if (!validWindow(window, duration) || !finite(value)) throw Error('Ugyldigt interval.')
  const minimum = Math.min(0.1, duration)
  if (edge === 'start') return { start: clamp(value, Math.max(0, window.end - MAX_SECONDS), window.end - minimum), end: window.end }
  if (edge === 'end') return { start: window.start, end: clamp(value, window.start + minimum, Math.min(duration, window.start + MAX_SECONDS)) }
  throw Error('Ukendt kant.')
}
export function seconds(value) {
  return finite(value) ? `${value.toLocaleString('da-DK', { maximumFractionDigits: 2 })} s` : 'Ukendt tidspunkt'
}
export function markerAt(marker, time) {
  return finite(time) && marker.start <= time && time < marker.end
}
export function normalizeMarker(marker, duration) {
  if (!finite(duration) || duration <= 0 || !finite(marker?.start) || !finite(marker?.end)
    || marker.start < 0 || marker.end <= marker.start || marker.end > duration
    || typeof marker.text !== 'string' || marker.text.length > 2000
    || !Array.isArray(marker.strokes) || marker.strokes.length > 20) throw Error('Vælg et gyldigt tidspunkt og en kommentar eller tegning.')
  const strokes = marker.strokes.map(stroke => {
    if (!['#ffcc00', '#ffffff', '#ff4444', '#00ccff'].includes(stroke.color)
      || !Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > 200
      || stroke.points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !finite(n) || n < 0 || n > 1))) throw Error('Ugyldig tegning.')
    return { color: stroke.color, points: stroke.points.map(p => [...p]) }
  })
  if (!marker.text.trim() && !strokes.length) throw Error('Tilføj en kommentar eller tegning.')
  return { start: marker.start, end: marker.end, text: marker.text.trim(), strokes }
}
