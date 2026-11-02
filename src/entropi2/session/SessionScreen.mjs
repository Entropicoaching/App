import { createElement, useEffect, useRef } from 'react'
import { mountSession } from './sessionView.mjs'

// No flag source, storage, backend or shared entry. Assembly must explicitly opt in.
export default function SessionScreen(props) {
  const root = useRef(null), latest = useRef(props), view = useRef(null)
  latest.current = props
  useEffect(() => {
    view.current = mountSession(root.current, () => latest.current)
    return () => { view.current.dispose(); view.current = null }
  }, [])
  useEffect(() => { view.current?.update() })
  return createElement('section', { ref: root, 'aria-label': 'Dagens pas i fuld skærm' })
}
