import { createElement, useEffect, useRef } from 'react'
import { mountMobility } from './mobility-screen.mjs'

export default function Entropi2Mobility(props = {}) {
  const root = useRef(null)
  useEffect(() => root.current ? mountMobility(root.current, props) : undefined,
    [props.enabled, props.athlete, props.coach, props.allWeeks, props.currentWeek,
      props.exerciseLogs, props.now, props.homeworkEnabled, props.coachEnabled,
      props.storage, props.clock, props.onProgram, props.isCurrentDay, props.onStaleDay])
  return props.enabled === true && typeof props.athlete?.id === 'string' && props.athlete.id.trim()
    ? createElement('div', { ref: root, 'data-entropi2-mobility': '' }) : null
}
