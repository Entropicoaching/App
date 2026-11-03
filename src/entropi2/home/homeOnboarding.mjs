import { createOnboarding, ONBOARDING_STORAGE_KEY } from '../onboarding/Onboarding.mjs'
import { homeStyles as s } from './homeStyles.mjs'

export function homeOnboardingKey(athleteId) {
  const valid = (typeof athleteId === 'string' && athleteId.trim() && athleteId.length <= 200) ||
    (Number.isSafeInteger(athleteId) && athleteId > 0)
  if (!valid) return null
  try { return `${ONBOARDING_STORAGE_KEY}:athlete:${encodeURIComponent(athleteId)}` } catch { return null }
}

// Inline DOM styles need CSS units; the shared styles normally go through React.
const unitless = new Set(['lineHeight', 'fontWeight', 'opacity', 'flex', 'flexGrow', 'flexShrink', 'order', 'zIndex'])
function styleNode(node, styles) {
  for (const [key, value] of Object.entries(styles))
    node.style[key] = typeof value === 'number' && value !== 0 && !unitless.has(key) ? `${value}px` : String(value)
}

// Mount only after React commits. Reuse the public introduction unchanged,
// adapting its browser-wide marker to one local marker per athlete.
export function mountHomeOnboarding(host, { enabled, athleteId, storage, focusTarget } = {}) {
  if (enabled !== true || !host) return () => {}
  const key = homeOnboardingKey(athleteId)
  if (!key) return () => {}
  let active = true
  let local = storage
  try { if (local === undefined) local = globalThis.localStorage } catch { local = null }
  const scopedStorage = {
    getItem() { return active ? local?.getItem(key) : null },
    setItem(_key, value) { if (active) local?.setItem(key, value) },
  }
  const root = createOnboarding({ document: host.ownerDocument, storage: scopedStorage,
    onComplete() {
      if (!active) return
      host.hidden = true
      focusTarget?.focus()
    } })
  styleNode(root, s.card)
  for (const node of root.children) {
    styleNode(node, node.tagName.toLowerCase() === 'button'
      ? s.secondary : node.tagName.toLowerCase() === 'h2' ? s.heading : s.text)
  }
  host.hidden = root.hidden
  host.replaceChildren(root)
  return () => { active = false; host.replaceChildren(); host.hidden = true }
}
