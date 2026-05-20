import { useState } from 'react'
import { supabase } from './supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('login') // 'login' eller 'signup'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    let result
    if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password })
    } else {
      result = await supabase.auth.signUp({ email, password })
    }

    if (result.error) {
      setError(result.error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#141410',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'IBM Plex Sans', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '380px',
        padding: '0 1.5rem',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '1.5rem',
          color: '#edeae2',
          marginBottom: '0.25rem',
        }}>
          Entropi<span style={{ color: '#c8923a' }}>.</span>
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.58rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#4a4844',
          marginBottom: '2.5rem',
        }}>
          Coach Portal
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.56rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#7a7770',
              marginBottom: '0.4rem',
            }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#1c1c18',
                border: '1px solid rgba(237,234,226,0.13)',
                color: '#edeae2',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 300,
                padding: '0.65rem 0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.56rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#7a7770',
              marginBottom: '0.4rem',
            }}>Adgangskode</div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                background: '#1c1c18',
                border: '1px solid rgba(237,234,226,0.13)',
                color: '#edeae2',
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 300,
                padding: '0.65rem 0.85rem',
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: '0.82rem',
              color: '#e05555',
              marginBottom: '1rem',
              padding: '0.6rem 0.85rem',
              background: 'rgba(224,85,85,0.08)',
              border: '1px solid rgba(224,85,85,0.2)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#c8923a',
              color: '#141410',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.68rem',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              border: 'none',
              padding: '0.85rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Vent...' : mode === 'login' ? 'Log ind' : 'Opret konto'}
          </button>
        </form>

        <div style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#4a4844',
        }}>
          {mode === 'login' ? (
            <>Ingen konto? <span
              onClick={() => setMode('signup')}
              style={{ color: '#7a7770', cursor: 'pointer' }}
            >Opret her</span></>
          ) : (
            <>Har du en konto? <span
              onClick={() => setMode('login')}
              style={{ color: '#7a7770', cursor: 'pointer' }}
            >Log ind</span></>
          )}
        </div>
      </div>
    </div>
  )
}
