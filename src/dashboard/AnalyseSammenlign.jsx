import { createElement, useEffect, useState } from 'react'
import { comparisonState, comparisonTransition, renderComparison } from './analyseSammenlign.mjs'

// Synthetic transport only. No athlete props, IO or conversion of source formats.
export default function AnalyseSammenlign() {
  const [state, setState] = useState(comparisonState())
  const dispatch = action => setState(previous => comparisonTransition(previous, action))
  useEffect(() => {
    if (!state.playing) return
    let previous = performance.now()
    const timer = setInterval(() => {
      const now = performance.now()
      dispatch({ type: 'tick', seconds: Math.max(0, (now - previous) / 1000) })
      previous = now
    }, 40)
    return () => clearInterval(timer)
  }, [state.playing, state.left, state.right, state.lift])
  return renderComparison(createElement, state, dispatch)
}
