import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import AthleteView from './AthleteView'

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

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#141410', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem',
      letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4a4844',
    }}>
      Indlæser...
    </div>
  )

  if (!session) return <Auth />
  if (role === 'coach') {
    if (previewMode) return <AthleteView session={session} role={role} coachAthleteId={coachAthleteId} onExitPreview={() => { setPreviewMode(false); setCoachAthleteId(null) }} />
    return <Dashboard session={session} onPreviewAthlete={(athleteId) => { setCoachAthleteId(athleteId || null); setPreviewMode(true) }} />
  }
  return <AthleteView session={session} role={role} />
}

export default App
