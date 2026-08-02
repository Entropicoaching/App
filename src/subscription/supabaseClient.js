import { createClient } from '@supabase/supabase-js'
import { validatePilotConfig } from './pilotConfig.js'

export function createSubscriptionClient(env = import.meta.env) {
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
