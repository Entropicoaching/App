// VC-KOE2: eksplicit kodeflag. Ingen storage eller URL-aktivering.
export const VIDEO_QUEUE_WAIT_ENABLED = false

function submittedAt(item) {
  // Oprettelse har forrang. Analysetid er basens fallback, ikke feedbacktid.
  for (const value of [item?.video?.created_at, item?.video?.analyzed_at, item?.createdAt]) {
    if (typeof value !== 'string' || !value.trim()) continue
    const time = Date.parse(value)
    if (Number.isFinite(time)) return time
  }
  return null
}

export function sortVideoQueueByWait(items = []) {
  return items.filter(item => item?.kind === 'video')
    .map((item, index) => ({ item, index, time: submittedAt(item) }))
    .sort((a, b) => {
      if (a.time === b.time) return a.index - b.index
      if (a.time === null) return 1
      if (b.time === null) return -1
      return a.time - b.time
    }).map(entry => entry.item)
}

export function videoQueueAge(item, now = Date.now()) {
  const time = submittedAt(item)
  if (time === null || !Number.isFinite(now)) return 'Alder ukendt'
  const days = Math.floor(Math.max(0, now - time) / 86400000)
  return days === 0 ? 'Under 1 dag' : days === 1 ? '1 dag' : `${days} dage`
}

const lifts = { squat: 'Squat', bench: 'Bænkpres', deadlift: 'Dødløft' }
const number = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function videoQueueLiftDetail(video = {}) {
  const parts = []
  if (typeof video.lift === 'string' && video.lift.trim()) parts.push(lifts[video.lift] || video.lift.trim())
  const load = number(video.load_kg)
  const reps = number(video.reps_count)
  if (load !== null) parts.push(`${load.toLocaleString('da-DK')} kg`)
  if (reps !== null && Number.isInteger(reps)) parts.push(`${reps} gentagelser`)
  return parts.join(' · ') || 'Løftdata ikke angivet'
}
