import { useState } from 'react'
import { supabase } from './supabase'
import { athleteAuthErrorMessage } from './athleteOnboarding'

// Vises når siden åbnes fra et "glemt adgangskode"-link (se
// isPasswordRecoveryUrl/PASSWORD_RECOVERY i supabase.js/App.jsx). Sessionen er
// allerede etableret af recovery-linket — her sætter atleten bare en ny
// adgangskode og fortsætter direkte ind i appen, uden at skulle logge ind igen.
export default function SetNewPassword({ ready, onDone }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Adgangskoden skal være mindst 6 tegn.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(athleteAuthErrorMessage(updateError, 'update-password'))
      return
    }
    onDone()
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
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 1.5rem' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#edeae2', marginBottom: '0.25rem' }}>
          Entropi<span style={{ color: '#c8923a' }}>.</span>
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '2.5rem' }}>
          Ny adgangskode
        </div>

        {!ready ? (
          <div style={{ color: '#7a7770', fontSize: '0.85rem' }}>Bekræfter linket...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.4rem' }}>
                Ny adgangskode
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#1c1c18',
                  border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2',
                  fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.9rem', fontWeight: 300,
                  padding: '0.65rem 0.85rem', outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ fontSize: '0.82rem', color: '#e05555', marginBottom: '1rem', padding: '0.6rem 0.85rem', background: 'rgba(224,85,85,0.08)', border: '1px solid rgba(224,85,85,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', background: '#c8923a', color: '#141410',
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.68rem', fontWeight: 500,
                letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
                padding: '0.85rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Gemmer...' : 'Gem adgangskode'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
