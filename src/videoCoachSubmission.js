const VIDEOCOACH_SAVED_COLUMNS = 'id,client_analysis_id,athlete_id,status,created_at'
const VIDEOCOACH_QUEUE_PREFIX = 'entropi:videocoach:pending:v1'
const VIDEOCOACH_QUEUE_MAX_BYTES = 256_000
const VIDEOCOACH_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function finiteInRange(value, min, max, allowNull = true) {
  if (value == null) return allowNull
  return Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max
}

export function validateVideoCoachPayloadBounds(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row))
    return 'Analysepayloaden har et ugyldigt format'
  let serialized
  try { serialized = JSON.stringify(row) } catch { return 'Analysepayloaden kan ikke serialiseres' }
  if (typeof serialized !== 'string') return 'Analysepayloaden kan ikke serialiseres'
  if (serialized.length > VIDEOCOACH_QUEUE_MAX_BYTES) return 'Analysepayloaden er for stor'
  if (!Number.isInteger(row.reps_count) || row.reps_count < 1 || row.reps_count > 20)
    return 'Analysen skal indeholde mellem 1 og 20 reps'
  if (!finiteInRange(row.load_kg, 0, 1000) || !finiteInRange(row.rpe, 0, 10) ||
      !finiteInRange(row.low_conf_pct, 0, 100) || !finiteInRange(row.position_quality_pct, 0, 100))
    return 'Analysen indeholder en måling uden for det tilladte interval'

  const barPath = row.bar_path
  if (barPath != null) {
    if (!barPath || typeof barPath !== 'object' || Array.isArray(barPath) ||
        !Array.isArray(barPath.dx) || !Array.isArray(barPath.dy) ||
        barPath.dx.length !== barPath.dy.length || barPath.dx.length > 240 ||
        barPath.dx.some(value => !finiteInRange(value, -2000, 2000, false)) ||
        barPath.dy.some(value => !finiteInRange(value, -2000, 2000, false)))
      return 'Stangbanen har et ugyldigt eller for stort format'
  }

  const metrics = row.metrics
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics) ||
      Object.keys(metrics).length > 64) return 'Metricpakken er ugyldig eller for stor'
  for (const metric of Object.values(metrics)) {
    if (!metric || typeof metric !== 'object' || Array.isArray(metric) ||
        (metric.value != null && !Number.isFinite(Number(metric.value))) ||
        typeof metric.method !== 'string' || metric.method.length > 160 ||
        !finiteInRange(metric.confidence, 0, 1)) return 'Metricpakken indeholder ugyldige værdier'
  }

  if (!Array.isArray(row.findings) || row.findings.length > 32 ||
      row.findings.some(item => !item || typeof item !== 'object' ||
        typeof item.summary !== 'string' || item.summary.length > 1000))
    return 'Analysefundene er ugyldige eller for omfattende'
  if (!Array.isArray(row.rep_details) || row.rep_details.length !== row.reps_count ||
      row.rep_details.some(rep => !rep || typeof rep !== 'object' ||
      !finiteInRange(rep.start_s, 0, 3600, false) ||
      !finiteInRange(rep.end_s, 0, 3600, false) ||
      Number(rep.end_s) < Number(rep.start_s) ||
      !finiteInRange(rep.valid_ratio, 0, 1) || !finiteInRange(rep.confidence, 0, 1)))
    return 'Repdetaljerne indeholder ugyldige kvalitetsdata'
  return null
}

export function videoCoachSavedIdentityMatches(saved, requested) {
  return !!saved && saved.client_analysis_id === requested?.client_analysis_id &&
    saved.athlete_id === requested?.athlete_id
}

// ORDRE 57 · commit 2: fuldførelse af en afventende atlet-video må ALDRIG
// indsætte en ny række ved siden af — client_analysis_id er nøglen, og
// updateClientAnalysisId gør gemmet til en ren UPDATE i stedet for en INSERT.
export async function saveVideoCoachDraft(supabase, row,
  { athleteSubmission = false, updateClientAnalysisId = null } = {}) {
  let result = updateClientAnalysisId
    ? await supabase.from('video_analyses').update(row)
      .eq('client_analysis_id', updateClientAnalysisId)
      .select(VIDEOCOACH_SAVED_COLUMNS).single()
    : athleteSubmission
      ? await supabase.from('video_analyses').insert(row)
      : await supabase.from('video_analyses').insert(row)
        .select(VIDEOCOACH_SAVED_COLUMNS).single()
  let duplicate = false

  if (!updateClientAnalysisId && result.error?.code === '23505') {
    duplicate = true
    result = athleteSubmission
      ? await supabase.rpc('get_my_video_analysis_submission_identity_v3', {
        p_client_analysis_id: row.client_analysis_id,
      }).single()
      : await supabase.from('video_analyses')
        .select(VIDEOCOACH_SAVED_COLUMNS)
        .eq('client_analysis_id', row.client_analysis_id).single()
  }

  if (result.error) return { ...result, duplicate }
  if (athleteSubmission && !duplicate && !updateClientAnalysisId) {
    result = { ...result, data: { client_analysis_id: row.client_analysis_id,
      athlete_id: row.athlete_id, status: row.status } }
  }
  if (!videoCoachSavedIdentityMatches(result.data, row)) {
    return {
      data: null,
      duplicate,
      error: { code: 'VC_IDENTITY_MISMATCH',
        message: 'Databasen returnerede analysen på en forkert atlet' },
    }
  }
  return { ...result, duplicate }
}

export function isRetryableVideoCoachError(error) {
  if (!error) return false
  const code = String(error.code || '')
  if (!code) return true
  return /^08/.test(code) || /^5\d\d$/.test(code) ||
    ['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003'].includes(code)
}

function queuedDraftKey(row) {
  return `${VIDEOCOACH_QUEUE_PREFIX}:${row.athlete_id}:${row.client_analysis_id}`
}

export function queueVideoCoachDraft(row, storage = globalThis.localStorage,
  ownerId = row?.athlete_id) {
  try {
    if (!storage || !ownerId || !row?.athlete_id || !row?.client_analysis_id ||
        validateVideoCoachPayloadBounds(row)) return false
    const serialized = JSON.stringify({ queued_at: new Date().toISOString(), owner_id: ownerId, row })
    if (serialized.length > VIDEOCOACH_QUEUE_MAX_BYTES) return false
    storage.setItem(queuedDraftKey(row), serialized)
    return true
  } catch {
    return false
  }
}

export async function flushVideoCoachDraftQueue(supabase, athleteId,
  storage = globalThis.localStorage, ownerId = athleteId) {
  const result = { sent: 0, remaining: 0, expired: 0, invalid: 0 }
  if (!storage || !athleteId) return result
  const prefix = `${VIDEOCOACH_QUEUE_PREFIX}:${athleteId}:`
  const keys = []
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (key?.startsWith(prefix)) keys.push(key)
    }
  } catch {
    return result
  }

  for (const key of keys) {
    let queued
    try { queued = JSON.parse(storage.getItem(key)) } catch { queued = null }
    const row = queued?.row || queued
    const queuedAt = Date.parse(queued?.queued_at || '')
    if (Number.isFinite(queuedAt) && Date.now() - queuedAt > VIDEOCOACH_QUEUE_MAX_AGE_MS) {
      try { storage.removeItem(key); result.expired++ } catch { result.remaining++ }
      continue
    }
    if (!row || queued?.owner_id !== ownerId || row.athlete_id !== athleteId || !row.client_analysis_id ||
        validateVideoCoachPayloadBounds(row)) {
      try { storage.removeItem(key); result.invalid++ } catch { result.remaining++ }
      continue
    }
    let saved
    try { saved = await saveVideoCoachDraft(supabase, row, { athleteSubmission: true }) }
    catch { result.remaining++; continue }
    if (saved.error) { result.remaining++; continue }
    try { storage.removeItem(key); result.sent++ } catch { result.remaining++ }
  }
  return result
}

export function purgeVideoCoachDraftQueues(storage = globalThis.localStorage) {
  if (!storage) return 0
  const keys = []
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (key?.startsWith(`${VIDEOCOACH_QUEUE_PREFIX}:`)) keys.push(key)
    }
    keys.forEach(key => storage.removeItem(key))
    return keys.length
  } catch {
    return 0
  }
}
