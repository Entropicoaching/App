import { createElement, useEffect, useRef } from 'react'
import { mountMobility } from './mobility-screen.mjs'

// Ordre 2033f (Marc 23. nov.: "mobilitets fanen kan ikke åbnes på nogle telefoner"): en fejl i monteringen
// maa ikke vaelte hele atletvisningen til "Noget gik galt". Fanen viser i stedet en rolig besked med
// "Prøv igen", der monterer igen med de samme data. Ingen nye imports (lukket graf i mobility-loader.mjs).
export function guardedMount(root, props) {
  let dispose = () => {}
  const attempt = () => {
    try { dispose = mountMobility(root, props) || (() => {}) } catch (error) { dispose = () => {}; failed(error) }
  }
  function failed(error) {
    const doc = root.ownerDocument
    root.replaceChildren()
    const message = doc.createElement('p')
    message.setAttribute('role', 'alert')
    message.textContent = 'Mobilitet kunne ikke vises lige nu.'
    const retry = doc.createElement('button')
    retry.type = 'button'; retry.textContent = 'Prøv igen'; retry.setAttribute('data-e2-mobility-retry', '')
    retry.setAttribute('style', 'min-height:48px;padding:12px 16px;border:1px solid #59564c;border-radius:10px;background:#1c1c18;color:#edeae2;font:inherit')
    retry.addEventListener('click', () => attempt())
    root.appendChild(message); root.appendChild(retry)
    try { console.error('[Mobilitet]', error) } catch { /* ingen konsol */ }
  }
  attempt()
  return () => dispose()
}

export default function Entropi2Mobility(props = {}) {
  const root = useRef(null)
  useEffect(() => root.current ? guardedMount(root.current, props) : undefined,
    [props.enabled, props.athlete, props.coach, props.allWeeks, props.currentWeek,
      props.exerciseLogs, props.now, props.homeworkEnabled, props.coachEnabled,
      props.storage, props.clock, props.onProgram, props.isCurrentDay, props.onStaleDay])
  return props.enabled === true && typeof props.athlete?.id === 'string' && props.athlete.id.trim()
    ? createElement('div', { ref: root, 'data-entropi2-mobility': '' }) : null
}
