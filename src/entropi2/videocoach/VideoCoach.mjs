import { createElement as h, useEffect, useState } from 'react'
import { renderUpload, renderReview } from './view.mjs'
import { renderFilmSetEntry, renderAthleteAccess } from './accessView.mjs'
import { renderVideoAnalyses } from './analysisView.mjs'

// The host owns controllers for the full session, including while logging.
// Unmounting a view unsubscribes; logout/scope change must dispose its controllers.
function useController(controller) {
  const [record, setRecord] = useState(() => ({ controller, value: controller.snapshot() }))
  useEffect(() => controller.subscribe(value => setRecord({ controller, value })), [controller])
  // A replaced controller must not render the previous athlete for one frame.
  return record.controller === controller ? record.value : controller.snapshot()
}
export function AthleteVideoCoach(props) {
  const state = useController(props.controller)
  return renderUpload(h, { ...props, state })
}
export function CoachVideoCoach(props) {
  const state = useController(props.controller)
  return renderReview(h, { ...props, state })
}

// Share one session-owned controller between home/set entries and the panel.
// Own coach training uses the same entry; read-only preview must pass an OFF controller.
export function AthleteVideoCoachEntry(props) {
  const state = useController(props.controller)
  return renderFilmSetEntry(h, { ...props, state })
}
export function AthleteVideoCoachAccess(props) {
  const state = useController(props.controller)
  return renderAthleteAccess(h, { ...props, state })
}
export function AthleteVideoAnalyses(props) {
  const state = useController(props.controller)
  return renderVideoAnalyses(h, { ...props, state })
}
