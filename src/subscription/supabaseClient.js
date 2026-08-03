import { createClient } from '@supabase/supabase-js'
import { validatePilotConfig } from './pilotConfig.js'

function runtimePilotEnv() {
  // Keep the client bundle allowlisted. Referencing import.meta.env as one
  // object would make Vite serialize unrelated VITE_* values from the portal.
  return {
    VITE_SUB_SUPABASE_URL: import.meta.env.VITE_SUB_SUPABASE_URL,
    VITE_SUB_SUPABASE_ANON_KEY: import.meta.env.VITE_SUB_SUPABASE_ANON_KEY,
    VITE_SUB_SUPABASE_PROJECT_REF: import.meta.env.VITE_SUB_SUPABASE_PROJECT_REF,
  }
}

export function createSubscriptionClient(env = runtimePilotEnv()) {
  const config = validatePilotConfig(env)
  if (!config.ok) return { client: null, config, error: config.reason }

  const client = createClient(config.url, config.key, {
    auth: {
      storageKey: config.storageKey,
      persistSession: true,
      autoRefreshToken: true,
      // Shadow-piloten bruger Supabase magic-links. Klienten skal derfor
      // udveksle den returnerede auth-code ved landing i appen, før den
      // afgør om brugeren skal se login-skærmen.
      detectSessionInUrl: true,
    },
  })
  return { client, config, error: null }
}
