// Lazy React island. The screen opens it explicitly; no globals or mount writes.
// The loader seam permits owned lifecycle fixtures without a replacement React.
export function mountUgeplan(host, props = {}, options = {}) {
  if (props.enabled !== true) return () => {}
  const { load = () => import('./reactMount.mjs') } = options
  let disposed = false, disposeReact = () => {}, removeRetry = () => {}, notice
  const clearNotice = () => { notice?.remove(); notice = undefined }
  const message = (text, role) => {
    clearNotice()
    const p = host.ownerDocument.createElement('p')
    p.textContent = text
    p.setAttribute('role', role)
    host.append(p); notice = p
  }
  const open = async () => {
    if (disposed) return
    removeRetry()
    message('Åbner ugeplan…', 'status')
    try {
      const module = await load()
      if (!disposed) {
        clearNotice()
        disposeReact = module.mountUgeplanReact(host, props)
      }
    } catch {
      if (disposed) return
      message('Ugeplanen kunne ikke åbnes. Prøv igen.', 'alert')
      const retry = host.ownerDocument.createElement('button')
      retry.type = 'button'; retry.className = 'cta'; retry.textContent = 'Åbn ugeplan igen'
      retry.addEventListener('click', open)
      removeRetry = () => { retry.removeEventListener('click', open); retry.remove() }
      host.append(retry)
    }
  }
  open()
  return () => {
    if (disposed) return
    disposed = true; removeRetry(); clearNotice(); disposeReact()
  }
}
