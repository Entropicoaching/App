// Metadata only. No storage client, media access or automatic execution.
export const VIDEO_SLET = false
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const bucket = 'videocoach-uploads'
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const originalPath = new RegExp(`^${uuid}/${uuid}\\.(mp4|mov|webm|m4v|3gp)$`, 'i')
const timestamp = value => {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const calendar = new Date(0)
  calendar.setUTCFullYear(year, month - 1, day)
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 ||
      calendar.getUTCDate() !== day) return NaN
  return Date.parse(value)
}

// objects: a complete metadata inventory for this athlete, joined by bucket/name.
// session_context.video_retention.still_path names an independently retained still.
// This function never edits analysis records or returns their annotation payloads.
export function planOriginalRetention({ analyses = [], objects, athleteId, now } = {}) {
  const time = timestamp(now)
  const result = { candidates: [], blocked: [], bytes: 0, available: false }
  if (!Array.isArray(analyses) || !Array.isArray(objects) ||
      typeof athleteId !== 'string' || !new RegExp(`^${uuid}$`, 'i').test(athleteId) ||
      !Number.isFinite(time)) return result
  result.available = true
  const stills = new Set(analyses.map(a => a?.session_context?.video_retention?.still_path).filter(Boolean))
  const rows = analyses.filter(a => a?.athlete_id === athleteId && a.video_path)
  for (const row of rows) {
    const path = row.video_path
    const found = objects.filter(o => o?.bucket_id === bucket && o.name === path)
    const still = row.session_context?.video_retention?.still_path
    const stillObjects = objects.filter(o => o?.bucket_id === bucket && o.name === still)
    const object = found[0]
    const age = time - timestamp(object?.created_at)
    const size = object?.metadata?.size
    const valid = typeof path === 'string' && originalPath.test(path) &&
      path.split('/')[0] === athleteId && !stills.has(path) &&
      analyses.filter(a => a?.video_path === path).length === 1 && found.length === 1 &&
      Number.isFinite(age) && age >= 0 && Number.isSafeInteger(size) && size > 0 &&
      row.analysis_state === 'complete' && typeof still === 'string' &&
      still.startsWith(athleteId + '/') && !still.includes('..') &&
      /\.(png|jpg|jpeg|webp)$/i.test(still) && stillObjects.length === 1 &&
      Number.isSafeInteger(stillObjects[0]?.metadata?.size) && stillObjects[0].metadata.size > 0
    if (!valid || !Number.isSafeInteger(result.bytes + size)) {
      result.blocked.push({ id: row.id, reason: 'Metadata eller bevaret still mangler eller er tvetydig' })
    } else if (age > RETENTION_MS) {
      result.candidates.push({ id: row.id, bucket, path, bytes: size, created_at: object.created_at })
      result.bytes += size
    }
  }
  return result
}

// Only a synthetic adapter is supported by this ticket. Recompute, never accept a saved plan.
export async function runOriginalRetention(input, { videoSlet = VIDEO_SLET, dryRun = true, adapter } = {}) {
  const plan = planOriginalRetention(input)
  const removed = [], failed = []
  if (videoSlet !== true || dryRun !== false || !plan.available) return { plan, removed, failed }
  if (adapter?.kind !== 'synthetic' || typeof adapter.deleteOriginal !== 'function')
    throw new TypeError('Kun syntetisk sletteadapter er tilladt')
  for (const item of plan.candidates) {
    try {
      const outcome = await adapter.deleteOriginal({ ...item })
      if (outcome?.ok !== true) throw new Error('Ikke bekraeftet')
      removed.push(item.path)
    } catch { failed.push(item.path) }
  }
  return { plan, removed, failed }
}
