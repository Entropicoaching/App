import { Component } from 'react'
import { supabase } from './supabase'

// Fanger render-fejl i hele appen: viser en venlig fallback i stedet for hvid/
// sort skærm, og logger fejlen til frontend_errors i Supabase (best effort),
// så Marc opdager fejl hos atleterne før de selv skriver.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    try {
      supabase.auth.getUser().then(({ data }) => {
        supabase.from('frontend_errors').insert({
          message: String(error?.message || error).slice(0, 1000),
          stack: String(error?.stack || '').slice(0, 4000),
          component_stack: String(info?.componentStack || '').slice(0, 4000),
          url: window.location.href,
          user_agent: navigator.userAgent,
          user_id: data?.user?.id ?? null,
        }).then(() => {})
      }).catch(() => {})
    } catch { /* logging må aldrig selv vælte appen */ }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', background: '#141410', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem',
        fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center',
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#edeae2' }}>
          Ups — noget gik galt.
        </div>
        <div style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', maxWidth: 360, lineHeight: 1.8 }}>
          Fejlen er registreret og bliver kigget på. Prøv at genindlæse siden.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'transparent', border: '1px solid rgba(200,146,58,0.45)', color: '#c8923a',
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: '0.6rem 1.4rem', cursor: 'pointer', borderRadius: 2,
          }}
        >Genindlæs</button>
      </div>
    )
  }
}
