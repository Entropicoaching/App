import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'

// Lazy-load de to store views, så atleter ikke downloader coach-dashboardet (og
// omvendt). Halverer det første bundt der skal hentes på mobil.
const Dashboard = lazy(() => import('./Dashboard'))
const AthleteView = lazy(() => import('./AthleteView'))

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

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)
  const [coachAthleteId, setCoachAthleteId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id, session.user.email)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id, session.user.email)
      else { setRole(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchRole(userId, email) {
    let { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (!data) {
      const { data: created } = await supabase
        .from('profiles')
        .insert({ id: userId, role: 'athlete', email })
        .select('role')
        .maybeSingle()
      data = created
    }

    setRole(data?.role || 'athlete')
    setLoading(false)
  }

  if (loading) return loaderScreen

  if (!session) return <Auth />

  let viewEl
  if (role === 'coach') {
    viewEl = previewMode
      ? <AthleteView session={session} role={role} coachAthleteId={coachAthleteId} onExitPreview={() => { setPreviewMode(false); setCoachAthleteId(null) }} />
      : <Dashboard session={session} onPreviewAthlete={(athleteId) => { setCoachAthleteId(athleteId || null); setPreviewMode(true) }} />
  } else {
    viewEl = <AthleteView session={session} role={role} />
  }
  return <Suspense fallback={loaderScreen}>{viewEl}</Suspense>
}

export default App
