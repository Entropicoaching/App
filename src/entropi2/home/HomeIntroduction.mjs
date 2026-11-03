import { createElement as h, useEffect, useRef } from 'react'
import { mountHomeOnboarding } from './homeOnboarding.mjs'

export default function HomeIntroduction({ enabled, athleteId, storage, headingRef }) {
  const host = useRef(null)
  useEffect(() => mountHomeOnboarding(host.current, {
    enabled, athleteId, storage, focusTarget: headingRef?.current,
  }), [enabled, athleteId, storage, headingRef])
  if (enabled !== true || athleteId == null) return null
  return h('div', { ref: host, 'data-home-onboarding': '' })
}
