import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { Ugeplan } from './Ugeplan.mjs'

export function mountUgeplanReact(host, props = {}) {
  if (props.enabled !== true) return () => {}
  const root = createRoot(host)
  root.render(h(Ugeplan, props))
  return () => root.unmount()
}
