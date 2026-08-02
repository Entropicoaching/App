import { useEffect, useState } from 'react'
import { color, font, s } from './theme.js'
import { Button, Label, Meta } from './ui.jsx'

function Shell({ children }) {
  return (
    <div style={s.wrap}>
      <header style={{ ...s.topbar, justifyContent: 'center' }}><span style={s.logo}>Entropi</span></header>
      <div style={{ ...s.page, paddingTop: '2rem' }}>{children}</div>
    </div>
  )
}

export function PilotUnavailable({ reason }) {
  return <Shell><Label>Medlemsadgang</Label><h1 style={s.h1}>Appen kan ikke åbnes her.</h1><p style={s.body}>{reason}</p><Meta style={{ marginTop: '1rem', color: color.dim }}>Ingen træningsdata er sendt.</Meta></Shell>
}

function Login({ client }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('magic-link')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const signIn = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSent(false)
    const normalizedEmail = email.trim()
    const result = mode === 'magic-link'
      ? await client.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
          },
        })
      : await client.auth.signInWithPassword({ email: normalizedEmail, password })

    if (result.error) {
      setError(mode === 'magic-link'
        ? 'Login-linket kunne ikke sendes. Kontrollér mailen og prøv igen.'
        : 'Login mislykkedes. Kontrollér mail og adgangskode.')
    } else if (mode === 'magic-link') {
      setSent(true)
    }
    setBusy(false)
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: '52px', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.text, fontFamily: font.sans, fontSize: '1rem', padding: '0.7rem 0.9rem', outline: 'none', marginBottom: '0.8rem' }
  return (
    <Shell>
      <Label>Medlemslogin</Label><h1 style={s.h1}>Åbn din træning.</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>Indtast din e-mail. Vi sender et login-link, som åbner din træning på denne enhed.</p>
      <form onSubmit={signIn}>
        <input data-entropi-focus aria-label="E-mail" type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} required />
        {mode === 'password' && <input data-entropi-focus aria-label="Adgangskode" type="password" autoComplete="current-password" placeholder="Adgangskode" value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} required />}
        {error && <p role="alert" style={{ ...s.body, color: '#d78b7d' }}>{error}</p>}
        {sent && <p role="status" style={{ ...s.body, color: color.accent }}>Linket er sendt. Åbn mailen på denne enhed; linket fører dig direkte tilbage til din træning.</p>}
        <Button disabled={busy}>{busy ? (mode === 'magic-link' ? 'Sender link…' : 'Logger ind…') : (mode === 'magic-link' ? 'Send login-link' : 'Log ind')}</Button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(current => current === 'magic-link' ? 'password' : 'magic-link')
          setError('')
          setSent(false)
        }}
        style={{ display: 'block', margin: '0.8rem auto 0', border: 0, background: 'none', color: color.muted, fontFamily: font.mono, fontSize: '0.62rem', cursor: 'pointer', padding: '0.45rem' }}
      >
        {mode === 'magic-link' ? 'Brug adgangskode i stedet' : 'Brug login-link i stedet'}
      </button>
    </Shell>
  )
}

export default function PilotAuth({ client, children }) {
  const [session, setSession] = useState(undefined)
  const [sessionError, setSessionError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let mounted = true
    client.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          setSessionError('Dit login kunne ikke åbnes.')
          return
        }
        setSession(data.session || null)
      })
      .catch(() => { if (mounted) setSessionError('Dit login kunne ikke åbnes.') })

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSessionError('')
        setSession(nextSession || null)
      }
    })
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [client, retryKey])

  if (sessionError) return <Shell><Label>Medlemslogin</Label><h1 style={s.h1}>Vi kan ikke åbne din træning endnu.</h1><p style={{ ...s.body, marginBottom: '1.5rem' }}>{sessionError} Prøv igen, når du er online.</p><Button onClick={() => { setSession(undefined); setSessionError(''); setRetryKey(value => value + 1) }}>Prøv igen</Button></Shell>
  if (session === undefined) return <Shell><Label>Medlemskonto</Label><p style={s.body}>Åbner din træning…</p></Shell>
  if (!session) return <Login client={client} />
  return children({ session, logout: () => client.auth.signOut({ scope: 'local' }) })
}
