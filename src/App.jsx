import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import Dashboard from './Dashboard'
import AthleteView from './AthleteView'

function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else { setRole(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
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

  const [previewMode, setPreviewMode] = useState(false)

  if (!session) return <Auth />
  if (role === 'coach') {
    if (previewMode) return <AthleteView session={session} onExitPreview={() => setPreviewMode(false)} />
    return <Dashboard session={session} onPreviewAthlete={() => setPreviewMode(true)} />
  }
  return <AthleteView session={session} />
}

export default App
