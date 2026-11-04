import { createElement as h } from 'react'
import { exerciseHistoryContent } from './exerciseHistoryContent.mjs'

export default function ExerciseHistoryView(props = {}) {
  return exerciseHistoryContent(h, props)
}
