const HANDOFF_MARKER = 'entropi_magic_link'
const SHADOW_HOST = 'maxhsefxbrvsgolscqwh.supabase.co'
const PUBLIC_SUBSCRIPTION_URL = 'https://app.entropicoaching.dk/subscription.html'
const INVALID_HANDOFF = Object.freeze({ error: 'invalid-personal-link' })

function scrubHandoffFragment(locationLike, historyLike) {
  const cleanUrl = new URL(locationLike.href)
  cleanUrl.hash = ''
  historyLike.replaceState(historyLike.state ?? null, '', cleanUrl.toString())
}

function validateActionLink(value) {
  let actionLink
  try {
    actionLink = new URL(value)
  } catch {
    return null
  }

  if (
    actionLink.protocol !== 'https:'
    || actionLink.hostname !== SHADOW_HOST
    || actionLink.port
    || actionLink.username
    || actionLink.password
    || actionLink.pathname !== '/auth/v1/verify'
    || actionLink.hash
  ) return null

  const keys = [...actionLink.searchParams.keys()].sort()
  if (keys.join(',') !== 'redirect_to,token,type') return null
  if (
    !actionLink.searchParams.get('token')
    || actionLink.searchParams.get('type') !== 'magiclink'
    || actionLink.searchParams.get('redirect_to') !== PUBLIC_SUBSCRIPTION_URL
  ) return null

  return actionLink.toString()
}

export function captureMagicLinkHandoff(locationLike = window.location, historyLike = window.history) {
  const fragment = String(locationLike?.hash || '')
  if (!fragment.startsWith('#')) return null

  const parameters = new URLSearchParams(fragment.slice(1))
  const values = parameters.getAll(HANDOFF_MARKER)
  if (values.length === 0) return null

  // Fjern tokenet fra adresselinjen med det samme. Det gemmes aldrig i storage
  // og returneres kun i hukommelsen til den eksplicitte brugerhandling.
  scrubHandoffFragment(locationLike, historyLike)

  const outerKeys = [...parameters.keys()]
  if (values.length !== 1 || outerKeys.length !== 1 || outerKeys[0] !== HANDOFF_MARKER) {
    return INVALID_HANDOFF
  }

  const actionLink = validateActionLink(values[0])
  return actionLink ? { actionLink } : INVALID_HANDOFF
}

export const magicLinkHandoffContract = Object.freeze({
  marker: HANDOFF_MARKER,
  publicUrl: PUBLIC_SUBSCRIPTION_URL,
  shadowHost: SHADOW_HOST,
})
