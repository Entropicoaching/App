import { videoStorageUsage, videoStorageUsageText } from './videoStorageUsage.mjs'

export default function VideoStorageUsage({ items, hiddenAthleteIds, stale = false, now }) {
  const usage = videoStorageUsage(items, hiddenAthleteIds, now)
  return (
    <p data-video-storage-usage role="status" aria-live="polite"
      style={{ color: usage.warning ? '#e6bb76' : '#b3afa4', fontSize: '0.8rem', lineHeight: 1.5, overflowWrap: 'anywhere', maxWidth: '100%' }}>
      {videoStorageUsageText(usage, stale)}
    </p>
  )
}
