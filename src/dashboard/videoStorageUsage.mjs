// VC-LAGER1. Daterede referencegraenser, ikke en aktuel backendkvote.
// Kilde: VC-OMK1-VIDEOOMKOSTNINGER.md, Supabase pricing laest 2026-10-27 21:55.
export const VIDEO_STORAGE_USAGE_ENABLED = false
export const VIDEO_USAGE_LIMITS = Object.freeze({
  source: 'https://supabase.com/pricing',
  sourceDate: '2026-10-27',
  storageBytes: 1_000_000_000,
  trafficBytes: 5_000_000_000,
  warningRatio: 0.70,
  estimatedViews: 4,
})

// Kun eksplicitte byte-tal accepteres. Fravaer er aldrig nul.
// Det valgfrie JSON-felt er ikke til stede i den pinnede koelaesning.
// Ingen nye laesninger eller skrivninger foretages for at udfylde det.
const validBytes = value => Number.isSafeInteger(value) && value >= 0
const month = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null
  const [year, monthNumber, day] = value.slice(0, 10).split('-').map(Number)
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  if (monthNumber < 1 || monthNumber > 12 || day < 1 || day > days) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 7) : null
}

export function videoStorageUsage(items = [], hiddenAthleteIds = new Set(), now = new Date()) {
  const currentMonth = now.toISOString().slice(0, 7)
  const groups = new Map()
  let unknownDates = 0
  for (const item of items) {
    if (item?.kind !== 'video' || !item.video?.id || !item.athlete?.id || hiddenAthleteIds.has(item.athlete.id)) continue
    const video = item.video
    const createdMonth = month(video.created_at)
    if (!createdMonth) { unknownDates++; continue }
    if (createdMonth !== currentMonth || new Date(video.created_at) > now) continue
    // En lagerfil taelles kun en gang, ogsaa ved dublerede analyser.
    const key = video.video_path || video.id
    const size = video.session_context?.video_size_bytes
    const value = video.video_path && validBytes(size) ? size : null
    if (!groups.has(key)) groups.set(key, value)
    else if (groups.get(key) !== value) groups.set(key, null)
  }
  const sizes = [...groups.values()]
  const known = sizes.filter(value => value !== null)
  const sum = known.reduce((total, value) => total + value, 0)
  const safe = Number.isSafeInteger(sum) && Number.isSafeInteger(sum * VIDEO_USAGE_LIMITS.estimatedViews)
  const knownBytes = safe ? sum : null
  const trafficEstimateBytes = safe ? sum * VIDEO_USAGE_LIMITS.estimatedViews : null
  return {
    month: currentMonth, count: sizes.length, unknownDates,
    knownCount: safe ? known.length : 0,
    missingSizes: safe ? sizes.length - known.length : sizes.length,
    knownBytes, trafficEstimateBytes,
    storageRatio: safe ? sum / VIDEO_USAGE_LIMITS.storageBytes : null,
    trafficRatio: safe ? trafficEstimateBytes / VIDEO_USAGE_LIMITS.trafficBytes : null,
    warning: safe && (sum >= VIDEO_USAGE_LIMITS.storageBytes * VIDEO_USAGE_LIMITS.warningRatio
      || trafficEstimateBytes >= VIDEO_USAGE_LIMITS.trafficBytes * VIDEO_USAGE_LIMITS.warningRatio),
  }
}

const gb = bytes => (bytes / 1_000_000_000).toLocaleString('da-DK', { maximumFractionDigits: 3 })
const percent = ratio => (ratio * 100).toLocaleString('da-DK', { maximumFractionDigits: 1 })
export function videoStorageUsageText(usage, stale = false) {
  const known = usage.knownCount > 0
  const storage = known ? `${gb(usage.knownBytes)} GB af 1 GB (${percent(usage.storageRatio)} %)` : 'ukendt af 1 GB'
  const traffic = known ? `${gb(usage.trafficEstimateBytes)} GB af 5 GB (${percent(usage.trafficRatio)} %)` : 'ukendt af 5 GB'
  return `Videolager tilføjet denne måned (${usage.month}, UTC): ${storage}. Trafikestimat: ${traffic}, antaget 4 fulde visninger pr. video. Målt trafik: ukendt. Kun hentede, synlige videoer i køen, ikke samlet lager eller månedstrafik. ${usage.missingSizes} mangler størrelse. ${usage.unknownDates} mangler gyldig dato. Referencegrænser fra 27.10.2026.${known && (usage.missingSizes || usage.unknownDates) ? ' Beløbene er kun den kendte del.' : ''}${usage.warning ? ' Varsel: mindst 70 % af en referencegrænse i den kendte del.' : ''}${stale ? ' Køen er ved at blive opdateret eller kunne ikke opdateres. Tallene kan være forældede.' : ''}`
}
