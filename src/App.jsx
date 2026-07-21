import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { supabase, withRetry } from './supabase'
import Auth from './Auth'
import ErrorBoundary from './ErrorBoundary'

// Lazy-load de to store views, så atleter ikke downloader coach-dashboardet (og
// omvendt). Halverer det første bundt der skal hentes på mobil.
//
// lazyWithReload: efter en deploy får JS-filerne nye hash-navne. En bruger med
// en åben/cachet gammel side prøver at hente det GAMLE filnavn → "Failed to
// fetch dynamically imported module" → fejlskærm. Vi fanger det og genindlæser
// siden ÉN gang (så den friske index.html + nye chunks hentes). En sessionStorage-
// nøgle pr. modul forhindrer uendelig reload-løkke hvis fejlen er ægte.
function lazyWithReload(factory, key) {
  const flag = `reloaded_chunk_${key}`
  return lazy(() =>
    factory()
      .then(mod => { sessionStorage.removeItem(flag); return mod })
      .catch(err => {
        // Kun reload på ægte chunk-hentefejl (ikke fx en runtime-fejl i modulet).
        const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(err?.message || '')
        if (isChunkError && !sessionStorage.getItem(flag)) {
          sessionStorage.setItem(flag, '1')
          window.location.reload()
          return new Promise(() => {}) // hæng indtil reload sker
        }
        throw err
      })
  )
}
const Dashboard = lazyWithReload(() => import('./Dashboard'), 'dashboard')
const AthleteView = lazyWithReload(() => import('./AthleteView'), 'athleteview')

const loaderScreen = (
  <div style={{
    minHeight: '100vh', background: '#141410', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4a4844',
  }}>
    Indlæser...
  </div>
)

const errorScreen = (onRetry) => (
  <div style={{
    minHeight: '100vh', background: '#141410', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '1rem',
    fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
    letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770',
  }}>
    <div>Kunne ikke indlæse.</div>
    <button onClick={onRetry} style={{
      background: 'transparent', border: '1px solid #4a4844', color: '#c8923a',
      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '0.6rem 1.2rem', cursor: 'pointer', borderRadius: 2,
    }}>Prøv igen</button>
  </div>
)

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [coachAthleteId, setCoachAthleteId] = useState(null)
  // Hvilken bruger-id vi allerede har slået rollen op for. Bruges til at undgå
  // gentagne opslag ved token-refresh (og dermed unødig flimmer/race).
  const resolvedFor = useRef(null)
  // Holder den seneste resolveRole, så "Prøv igen"-knappen kan kalde den.
  const resolveRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    // Slår brugerens rolle op robust. Degraderer ALDRIG en coach til athlete på
    // en transient fejl, og efterlader aldrig appen hængende i "Indlæser...".
    async function resolveRole(userId, email) {
      setLoadError(false)
      // withRetry venter på at token er hæftet på klienten før kaldet → undgår
      // cold-start hvor RLS svarer som anonym (0 rækker uden fejl).
      const { data, error } = await withRetry(() =>
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      )
      if (cancelled) return
      if (error) {
        // Reel fejl efter retries: vis retry frem for at gætte rollen forkert.
        setLoadError(true)
        setLoading(false)
        return
      }
      if (data) {
        resolvedFor.current = userId
        setRole(data.role || 'athlete')
        setLoading(false)
        return
      }
      // Ingen række OG ingen fejl → genuint ny bruger (DB-triggeren burde have
      // lavet profilen; vær defensiv). Opret som athlete uden at fejle på en
      // eksisterende række, og læs rollen igen frem for at antage 'athlete'.
      await supabase.from('profiles')
        .upsert({ id: userId, role: 'athlete', email }, { onConflict: 'id', ignoreDuplicates: true })
      const { data: after } = await withRetry(() =>
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
      )
      if (cancelled) return
      resolvedFor.current = userId
      setRole(after?.role || 'athlete')
      setLoading(false)
    }
    resolveRef.current = resolveRole

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setSession(session)
      if (session) resolveRole(session.user.id, session.user.email)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setSession(session)
      if (!session) { resolvedFor.current = null; setRole(null); setLoading(false); return }
      // Spring opslag over hvis vi allerede kender rollen for denne bruger
      // (fx ved token-refresh). Udskyd desuden DB-kaldet UD af callbacken med
      // setTimeout(0) — at await'e supabase inde i onAuthStateChange kan låse
      // klientens auth-mutex og give intermitterende stall.
      if (resolvedFor.current === session.user.id) return
      setLoading(true)
      setTimeout(() => { if (!cancelled) resolveRole(session.user.id, session.user.email) }, 0)
    })

    // Sidste sikkerhedsnet: efterlad aldrig brugeren i "Indlæser..." for evigt.
    const safety = setTimeout(() => {
      if (cancelled) return
      setLoading(prev => { if (prev) setLoadError(true); return false })
    }, 12000)

    return () => { cancelled = true; subscription.unsubscribe(); clearTimeout(safety) }
  }, [])

  if (loading) return loaderScreen

  // eslint-disable-next-line react-hooks/refs -- resolveRef læses kun inde i retry-callbacken (event handler), ikke under render
  if (loadError) return errorScreen(() => {
    setLoadError(false)
    setLoading(true)
    if (session) resolveRef.current?.(session.user.id, session.user.email)
    else window.location.reload()
  })

  if (!session) return <Auth />

  let viewEl
  if (role === 'coach') {
    viewEl = previewMode
      ? <AthleteView session={session} role={role} coachAthleteId={coachAthleteId} onExitPreview={() => { setPreviewMode(false); setCoachAthleteId(null) }} />
      : <Dashboard session={session} onPreviewAthlete={(athleteId) => { setCoachAthleteId(athleteId || null); setPreviewMode(true) }} />
  } else {
    viewEl = <AthleteView session={session} role={role} />
  }
  return <ErrorBoundary><Suspense fallback={loaderScreen}>{viewEl}</Suspense></ErrorBoundary>
}

export default App
