// Shadow-pilot entrypoint. Ingen service worker eller appUpdate. Klienten,
// sessionens storage key og cachen er isoleret fra 1:1-portalen.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PilotAuth, { PilotUnavailable } from './auth.jsx'
import PilotSubscriptionApp from './PilotSubscriptionApp.jsx'
import { createSubscriptionClient } from './supabaseClient.js'

const runtime = createSubscriptionClient()

createRoot(document.getElementById('subscription-root')).render(
  <StrictMode>
    {runtime.error ? <PilotUnavailable reason={runtime.error} /> : (
      <PilotAuth client={runtime.client}>
        {({ session, logout }) => <PilotSubscriptionApp client={runtime.client} session={session} logout={logout} />}
      </PilotAuth>
    )}
  </StrictMode>,
)
