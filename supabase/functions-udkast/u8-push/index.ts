// u8-push: påmindelser og coachsvar som push (U8, ordre 78). UDKAST, ikke deployet.
// Logikken ligger i handler.mjs, så den kan prøves i Node. Til Supabase-editoren bruges den samlede
// fil u8-push.bundle.js (bygges med: node scripts/u8-push-bundle.mjs), som indeholder alt.
// Deploy: se KLAR-app-u8 i Harā. Slå "Verify JWT" fra; send kræver headeren x-u8-cron.
import { createHandler } from './handler.mjs'

Deno.serve(createHandler({ env: (name: string) => Deno.env.get(name) }))
