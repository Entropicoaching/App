import { createElement, useState } from 'react'
import { renderAnalyseSamlet } from './analyseSamlet.mjs'

// Intentionally no athlete props or application handlers.
export default function AnalyseSamletPrototype() {
  const [lift, setLift] = useState('squat')
  const [selectedId, setSelectedId] = useState(null)
  return renderAnalyseSamlet(createElement, {
    lift, selectedId,
    chooseLift(next) { setLift(next); setSelectedId(null) },
    chooseAnalysis: setSelectedId,
  })
}
