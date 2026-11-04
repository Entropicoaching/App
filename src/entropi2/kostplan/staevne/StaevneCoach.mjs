import { createElement } from 'react'
import { renderCompetitionPlan } from './view.mjs'

// Intentionally unwired. role is a display guard, not authorization.
export default function StaevneCoach(props = {}) {
  return renderCompetitionPlan(createElement, props)
}
