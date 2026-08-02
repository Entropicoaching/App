export const SHADOW_PROJECT_REF = 'maxhsefxbrvsgolscqwh'
export const SUBSCRIPTION_AUTH_STORAGE_KEY = 'entropi-sub-auth'

export function isProgramMatchPreviewEnabled(env = {}) {
  return env.VITE_SUB_ENABLE_MATCH_PREVIEW === 'true'
}

function jwtPayload(token) {
  if (!token || token.split('.').length !== 3) return null
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')
    if (typeof atob !== 'function') return null
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function validatePilotConfig(env = {}) {
  const url = String(env.VITE_SUB_SUPABASE_URL || '').trim()
  const key = String(env.VITE_SUB_SUPABASE_ANON_KEY || '').trim()
  const declaredRef = String(env.VITE_SUB_SUPABASE_PROJECT_REF || '').trim()

  if (!url || !key || !declaredRef) {
    return { ok: false, reason: 'Shadow-konfigurationen mangler.' }
  }
  if (declaredRef !== SHADOW_PROJECT_REF) {
    return { ok: false, reason: 'Pilotens projekt-reference er ikke shadow-projektet.' }
  }

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'Shadow-URL er ugyldig.' }
  }

  const expectedHost = `${SHADOW_PROJECT_REF}.supabase.co`
  if (parsed.protocol !== 'https:' || parsed.hostname !== expectedHost || parsed.pathname !== '/') {
    return { ok: false, reason: 'Pilotens URL peger ikke præcist på shadow-projektet.' }
  }

  if (key.startsWith('sb_secret_')) {
    return { ok: false, reason: 'En secret key må aldrig bruges i pilotklienten.' }
  }
  const payload = jwtPayload(key)
  if (payload?.role === 'service_role') {
    return { ok: false, reason: 'Service-role key er blokeret i pilotklienten.' }
  }
  if (payload?.ref && payload.ref !== SHADOW_PROJECT_REF) {
    return { ok: false, reason: 'Anon-key tilhører ikke shadow-projektet.' }
  }
  if (!payload && !key.startsWith('sb_publishable_')) {
    return { ok: false, reason: 'Kun en anon- eller publishable key må bruges.' }
  }

  return {
    ok: true,
    url,
    key,
    projectRef: SHADOW_PROJECT_REF,
    storageKey: SUBSCRIPTION_AUTH_STORAGE_KEY,
  }
}
