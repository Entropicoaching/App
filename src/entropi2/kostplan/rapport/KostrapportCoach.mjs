import { createElement as h } from 'react'
import { nutritionReportView } from './reportView.mjs'

export default function KostrapportCoach(props = {}) {
  return nutritionReportView(h, props)
}
