// Lazy React island. The screen opens it explicitly; no globals or mount writes.
// The loader seam permits owned lifecycle fixtures without a replacement React.
export function mountUgeplan(host, props = {}, options = {}) {
  if (props.enabled !== true) return () => {}
  const { load = () => import('./reactMount.mjs') } = options
  let disposed = false, disposeReact = () => {}, removeRetry = () => {}
  const message = (text, role) => {
    const p = host.ownerDocument.createElement('p')
    p.textContent = text
    p.setAttribute('role', role)
    host.replaceChildren(p)
  }
  const open = async () => {
    removeRetry()
    message('Åbner ugeplan…', 'status')
    try {
      const module = await load()
      if (!disposed) disposeReact = module.mountUgeplanReact(host, props)
    } catch {
      if (disposed) return
      message('Ugeplanen kunne ikke åbnes. Prøv igen.', 'alert')
      const retry = host.ownerDocument.createElement('button')
      retry.type = 'button'; retry.className = 'cta'; retry.textContent = 'Åbn ugeplan igen'
      retry.addEventListener('click', open)
      removeRetry = () => retry.removeEventListener('click', open)
      host.append(retry)
    }
  }
  open()
  return () => {
    if (disposed) return
    disposed = true; removeRetry(); disposeReact(); host.replaceChildren()
  }
}
