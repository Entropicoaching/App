import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { Ugeplan } from './Ugeplan.mjs'

export function mountUgeplanReact(host, props = {}) {
  if (props.enabled !== true) return () => {}
  // React exclusively owns this island's children, even after its parent leaves.
  const island = host.ownerDocument.createElement('div')
  host.append(island)
  let disposed = false
  const root = createRoot(island)
  root.render(h(Ugeplan, { ...props, isCurrent: () => !disposed }))
  return () => {
    if (disposed) return
    // Revoke retained handlers before deferred effect cleanup, then detach only
    // our island. Never clear React's children or a later mount's container.
    disposed = true
    island.remove()
    // Parent React may be committing its own unmount. Finish outside that commit.
    queueMicrotask(() => root.unmount())
  }
}
