import { useState, useEffect, useCallback, useMemo } from 'react'
import { trackingScope, startTrackingRead, selectTrackingResult } from './readOwnTracking.mjs'

export function useOwnTracking(props = {}) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const onRetryTracking = useCallback(() => setAttempt(value => value + 1), [])
  const scope = trackingScope(props)
  const client = scope ? props.client : null
  const day = scope ? props.day : null
  const athleteId = scope?.athleteId, endDate = scope?.endDate
  // Returning to the tab starts a new request, even for the same athlete/day.
  const request = useMemo(() => ({}), [client, athleteId, endDate, day, attempt])
  useEffect(() => {
    if (!athleteId || !endDate) return undefined
    return startTrackingRead({ enabled: true, client, athleteId, day },
      snapshot => setResult({ client, attempt: request, snapshot }))
  }, [client, athleteId, endDate, day, request])
  return { trackingSnapshot: selectTrackingResult(result, client, scope, request), onRetryTracking }
}
