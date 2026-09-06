import { useState } from 'react'
import { supabase } from './supabase'
import { athleteAuthErrorMessage, normalizeAthleteLoginEmail } from './athleteOnboarding'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [mode, setMode] = useState('login') // 'login', 'signup' eller 'reset'

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    const normalizedEmail = normalizeAthleteLoginEmail(email)
    if (!normalizedEmail) {
      setError('Skriv en gyldig emailadresse')
      setLoading(false)
      return
    }
    setEmail(normalizedEmail)

    if (mode === 'reset') {
      // Supabase svarer altid uden fejl her, uanset om email findes, for ikke at
      // afsløre hvilke emails der har en konto — så beskeden er neutral med vilje.
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: window.location.origin,
      })
      if (error) setError(athleteAuthErrorMessage(error, 'reset'))
      else setNotice(`Hvis ${normalizedEmail} har en konto, er der sendt en mail med et link til at vælge en ny adgangskode.`)
      setLoading(false)
      return
    }

    let result
    if (mode === 'login') {
      result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    } else {
      result = await supabase.auth.signUp({ email: normalizedEmail, password })
    }

    if (result.error) {
      setError(athleteAuthErrorMessage(result.error, mode))
    } else if (mode === 'signup' && !result.data?.session) {
      setPassword('')
      setMode('login')
      setNotice(`Tjek din email. Vi har sendt et bekræftelseslink til ${normalizedEmail}. Når du har bekræftet, kan du logge ind her.`)
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
          Træning &amp; coaching
        </div>

        {mode === 'signup' && (
          <div style={{
            color: '#9b978f',
            fontSize: '0.8rem',
            lineHeight: 1.55,
            marginBottom: '1.25rem',
            padding: '0.75rem 0.85rem',
            background: 'rgba(200,146,58,0.055)',
            borderLeft: '2px solid rgba(200,146,58,0.65)',
          }}>
            Brug den samme emailadresse, som din coach har registreret. Så bliver din profil koblet sikkert ved første login.
          </div>
        )}

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
              autoComplete="email"
              style={{
                width: '100%',
                boxSizing: 'border-box',
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

          {mode !== 'reset' && (
            <div style={{ marginBottom: '0.6rem' }}>
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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
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
          )}

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
              <span
                onClick={() => { setMode('reset'); setError(null); setNotice(null) }}
                style={{ fontSize: '0.76rem', color: '#7a7770', cursor: 'pointer', padding: '0.4rem 0', minHeight: '44px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}
              >Glemt adgangskode?</span>
            </div>
          )}
          {mode === 'reset' && <div style={{ marginBottom: '1.5rem' }} />}

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

          {notice && (
            <div role="status" style={{
              fontSize: '0.82rem',
              color: '#9fbd9a',
              marginBottom: '1rem',
              padding: '0.7rem 0.85rem',
              lineHeight: 1.5,
              background: 'rgba(108,186,108,0.08)',
              border: '1px solid rgba(108,186,108,0.22)',
            }}>
              {notice}
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
            {loading ? 'Vent...' : mode === 'login' ? 'Log ind' : mode === 'reset' ? 'Send nulstillingslink' : 'Opret konto'}
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
              onClick={() => { setMode('signup'); setError(null); setNotice(null) }}
              style={{ color: '#7a7770', cursor: 'pointer' }}
            >Opret her</span></>
          ) : (
            <>Har du en konto? <span
              onClick={() => { setMode('login'); setError(null); setNotice(null) }}
              style={{ color: '#7a7770', cursor: 'pointer' }}
            >Log ind</span></>
          )}
        </div>
      </div>
    </div>
  )
}
