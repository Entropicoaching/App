// U2: samtalen holder sig frisk uden realtime og uden ny datamodel.
// Henter igen, når appen kommer tilbage fra baggrunden, når nettet vender
// tilbage, og med et roligt interval, mens siden er synlig. Én hentning ad gangen.
export const LIVE_REFRESH_MS = 30 * 1000

export function startLiveRefresh(refresh, { doc = globalThis.document, win = globalThis.window,
  timers = globalThis, intervalMs = LIVE_REFRESH_MS } = {}) {
  if (typeof refresh !== 'function' || typeof doc?.addEventListener !== 'function') return () => {}
  let stopped = false, running = false
  const visible = () => doc.visibilityState !== 'hidden'
  const run = async () => {
    if (stopped || running || !visible()) return
    running = true
    // En fejlet baggrundshentning venter blot på næste anledning.
    try { await refresh() } catch { /* næste interval eller fokus prøver igen */ } finally { running = false }
  }
  const wake = () => { void run() }
  doc.addEventListener('visibilitychange', wake)
  win?.addEventListener?.('focus', wake)
  win?.addEventListener?.('online', wake)
  const id = timers.setInterval(wake, intervalMs)
  return () => {
    stopped = true
    timers.clearInterval(id)
    doc.removeEventListener?.('visibilitychange', wake)
    win?.removeEventListener?.('focus', wake)
    win?.removeEventListener?.('online', wake)
  }
}
