import { createElement } from 'react'
import { coachUgeFeedback, ugeFeedbackTree } from './coachUgeFeedback.js'

export default function UgeFeedbackKort({ week, athleteLogs }) {
  const feedback = coachUgeFeedback(week, athleteLogs, new Date())
  return ugeFeedbackTree(createElement, feedback, week.week_number)
}
