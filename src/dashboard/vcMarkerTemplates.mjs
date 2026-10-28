// Local text/time notes only. No media, backend or automatic sharing.
export const MARKER_TEMPLATE_SCHEMA = 'vc-marker-templates/v1'
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value)
const need = (ok, message) => { if (!ok) throw new TypeError(message) }
const LIMIT = 50
function coachKey(coachId) {
  need(validId(coachId), 'Vælg en coachkonto først.')
  return `entropi_vc_marker_templates_v1:${coachId}`
}
export function markerCopy(value, duration = 7200) {
  need(typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= 7200,
    'Angiv klippets varighed, højst 7200 sekunder.')
  need(value && typeof value.start === 'number' && Number.isFinite(value.start) &&
    typeof value.end === 'number' && Number.isFinite(value.end) &&
    value.start >= 0 && value.end > value.start && value.end <= duration,
  'Markeringens sluttid skal være efter start og inden for klippet.')
  need(typeof value.text === 'string' && value.text.trim().length > 0 && value.text.length <= 2000,
    'Skriv en markering på højst 2000 tegn.')
  // Deliberately excludes source athlete, analysis, clip identity and strokes.
  return { start: value.start, end: value.end, text: value.text.trim() }
}
export function readMarkerTemplates(storage, coachId) {
  const raw = storage.getItem(coachKey(coachId))
  if (raw === null) return []
  need(typeof raw === 'string' && raw.length <= 250000, 'Skabelonlageret er for stort.')
  const data = JSON.parse(raw)
  need(data?.schema === MARKER_TEMPLATE_SCHEMA && data.coachId === coachId &&
    Array.isArray(data.rows) && data.rows.length <= LIMIT, 'Skabelonlageret har et ugyldigt format.')
  return data.rows.map(row => markerCopy(row))
}
function write(storage, coachId, rows) {
  const raw = JSON.stringify({ schema: MARKER_TEMPLATE_SCHEMA, coachId, rows })
  need(raw.length <= 250000, 'Skabelonlageret er for stort.')
  storage.setItem(coachKey(coachId), raw)
  return rows.map(row => markerCopy(row))
}
const same = (a, b) => a.start === b.start && a.end === b.end && a.text === b.text
export function saveMarkerTemplate(storage, coachId, marker) {
  const row = markerCopy(marker), rows = readMarkerTemplates(storage, coachId)
  if (rows.some(item => same(item, row))) return rows
  need(rows.length < LIMIT, 'Du kan gemme højst 50 markeringsskabeloner. Slet en først.')
  return write(storage, coachId, [...rows, row])
}
export function deleteMarkerTemplate(storage, coachId, marker) {
  const row = markerCopy(marker), rows = readMarkerTemplates(storage, coachId)
  return write(storage, coachId, rows.filter(item => !same(item, row)))
}
function noteKey(scope) {
  need(validId(scope?.coachId) && validId(scope?.athleteId) && validId(scope?.analysisId), 'Vælg den rigtige video og atlet først.')
  return `entropi_vc_marker_notes_v1:${JSON.stringify([scope.coachId, scope.athleteId, scope.analysisId])}`
}
export function readMarkerNotes(storage, scope) {
  const raw = storage.getItem(noteKey(scope))
  if (raw === null) return []
  need(typeof raw === 'string' && raw.length <= 450000, 'Markeringslageret er for stort.')
  const data = JSON.parse(raw)
  need(data?.schema === 'vc-marker-notes/v1' && data.coachId === scope.coachId &&
    data.athleteId === scope.athleteId && data.analysisId === scope.analysisId &&
    Array.isArray(data.rows) && data.rows.length <= 200, 'Markeringslageret har et ugyldigt format.')
  return data.rows.map(row => ({ duration: row?.duration, ...markerCopy(row, row?.duration ?? NaN) }))
}
export function saveMarkerNote(storage, scope, marker, duration) {
  const row = { duration, ...markerCopy(marker, duration ?? NaN) }, rows = readMarkerNotes(storage, scope)
  need(rows.length < 200, 'Du kan gemme højst 200 lokale markeringer pr. video.')
  const next = [...rows, row]
  const raw = JSON.stringify({ schema: 'vc-marker-notes/v1', coachId: scope.coachId,
    athleteId: scope.athleteId, analysisId: scope.analysisId, rows: next })
  need(raw.length <= 450000, 'Markeringslageret er for stort.')
  storage.setItem(noteKey(scope), raw)
  return next.map(item => ({ ...item }))
}
