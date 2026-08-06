import { useEffect, useState } from 'react'
import { color, font, s } from './theme.js'
import { Button, Label, Meta } from './ui.jsx'
import { EMAIL_RATE_LIMITED_MESSAGE, MIN_PASSWORD_LENGTH, RESET_SENT_MESSAGE, SIGN_UP_SENT_MESSAGE, initialLoginMode, isEmailRateLimited, isRecoveryEvent, isStandaloneApp, signUpOutcome, signUpRevealsExistingAccount, validateNewPassword } from './authFlow.js'

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

const inputStyle = { width: '100%', boxSizing: 'border-box', minHeight: '52px', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.text, fontFamily: font.sans, fontSize: '1rem', padding: '0.7rem 0.9rem', outline: 'none', marginBottom: '0.8rem' }

function ModeTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minHeight: '44px',
        border: `1px solid ${active ? color.accent : color.lineStrong}`,
        background: active ? color.panel : 'transparent',
        color: active ? color.text : color.muted,
        fontFamily: font.mono,
        fontSize: '0.68rem',
        letterSpacing: '0.04em',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Login({ client, handoffError = false, standalone = false }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState(() => initialLoginMode())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const switchMode = next => {
    setMode(next)
    setError('')
    setSent(false)
    setResetSent(false)
  }

  const redirectTarget = () => `${window.location.origin}${window.location.pathname}`

  const signIn = async event => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setSent(false)
    setResetSent(false)
    const normalizedEmail = email.trim()
    try {
      const result = mode === 'magic-link'
        ? await client.auth.signInWithOtp({
            email: normalizedEmail,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: redirectTarget(),
            },
          })
        : await client.auth.signInWithPassword({ email: normalizedEmail, password })

      if (result.error) {
        setError(isEmailRateLimited(result.error)
          ? EMAIL_RATE_LIMITED_MESSAGE
          : mode === 'magic-link'
            ? 'Login-linket kunne ikke sendes. Prøv igen om lidt.'
            : 'Login mislykkedes. Kontrollér mail og adgangskode.')
      } else if (mode === 'magic-link') {
        setSent(true)
      }
    } catch {
      setError(mode === 'magic-link'
        ? 'Der er ikke forbindelse til mail-login lige nu. Prøv igen, eller brug dit personlige link fra Marc.'
        : 'Login mislykkedes. Kontrollér forbindelsen og prøv igen.')
    } finally {
      setBusy(false)
    }
  }

  // Nulstilling er den eneste selvbetjente vej til en adgangskode i piloten.
  // Den kan kun ramme en konto der allerede findes, og opretter derfor ingen.
  const requestReset = async () => {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError('Skriv din e-mail først, så sender vi linket dertil.')
      return
    }
    setBusy(true)
    setError('')
    setSent(false)
    setResetSent(false)
    try {
      // Fejlen SKAL aflæses. Uden dette svarede skærmen "linket er sendt", også
      // når serveren afviste med 429 og intet blev sendt — brugeren stod og
      // ventede på en mail der aldrig kom.
      const { error: resetError } = await client.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: redirectTarget() })
      if (isEmailRateLimited(resetError)) { setError(EMAIL_RATE_LIMITED_MESSAGE); return }
      // Alle andre udfald giver samme kvittering. Om mailen findes eller ej må
      // ikke kunne aflæses af svaret.
      setResetSent(true)
    } catch {
      setError('Linket kunne ikke sendes lige nu. Prøv igen, når du er online.')
    } finally {
      setBusy(false)
    }
  }

  // Oprettelse er egen skærm, ikke en fane ved siden af login. En bruger der
  // ikke har en konto skal ikke først gætte hvilken login-metode han mangler.
  const createAccount = async event => {
    event.preventDefault()
    const check = validateNewPassword(password, password)
    if (!check.ok) { setError(check.reason); return }
    setBusy(true)
    setError('')
    setSent(false)
    try {
      const { data, error: signUpError } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: redirectTarget() },
      })
      if (signUpError) {
        setError(isEmailRateLimited(signUpError) ? EMAIL_RATE_LIMITED_MESSAGE : 'Kontoen kunne ikke oprettes. Prøv igen om lidt.')
        return
      }
      // Findes mailen allerede, svarer Supabase med en bruger uden identiteter.
      // Vi viser samme kvittering som ved en ny konto - ellers bliver skærmen
      // en måde at afprøve mailadresser på.
      if (signUpRevealsExistingAccount(data) || signUpOutcome(data) === 'confirm-email') setSent(true)
      else if (signUpOutcome(data) === 'logged-in') return
      else setSent(true)
    } catch {
      setError('Der er ikke forbindelse lige nu. Prøv igen, når du er online.')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'opret') {
    return (
      <Shell>
        <Label>Ny konto</Label><h1 style={s.h1}>Kom i gang gratis.</h1>
        <p style={{ ...s.body, marginBottom: '1.5rem' }}>Du får et startprogram og din egen træningslog. Ingen betaling, intet kort.</p>
        <form onSubmit={createAccount}>
          <input data-entropi-focus aria-label="E-mail" type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} required />
          <input aria-label="Adgangskode" type="password" autoComplete="new-password" placeholder={`Adgangskode (mindst ${MIN_PASSWORD_LENGTH} tegn)`} value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} required />
          {error && <p role="alert" style={{ ...s.body, color: '#d78b7d' }}>{error}</p>}
          {sent && <p role="status" style={{ ...s.body, color: color.accent }}>{SIGN_UP_SENT_MESSAGE}</p>}
          <Button type="submit" disabled={busy}>{busy ? 'Opretter…' : 'Opret konto'}</Button>
        </form>
        <button type="button" onClick={() => switchMode(initialLoginMode())} style={{ display: 'block', margin: '0.8rem auto 0', border: 0, background: 'none', color: color.muted, fontFamily: font.mono, fontSize: '0.68rem', cursor: 'pointer', padding: '0.45rem', minHeight: '44px' }}>
          Har du allerede en konto? Log ind
        </button>
      </Shell>
    )
  }

  return (
    <Shell>
      <Label>Medlemslogin</Label><h1 style={s.h1}>Åbn din træning.</h1>
      {standalone
        ? <p style={{ ...s.body, marginBottom: '1.5rem' }}>Log ind med din adgangskode. Login-links fra mail kan ikke åbne appen her — de åbner altid i browseren.</p>
        : <p style={{ ...s.body, marginBottom: '1.5rem' }}>Indtast din e-mail. Vi sender et login-link, som åbner din træning på denne enhed.</p>}
      {handoffError && <p role="alert" style={{ ...s.body, color: '#d78b7d' }}>Det personlige link kunne ikke åbnes sikkert. Bed Marc om et nyt link.</p>}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <ModeTab active={mode === 'password'} onClick={() => switchMode('password')}>ADGANGSKODE</ModeTab>
        <ModeTab active={mode === 'magic-link'} onClick={() => switchMode('magic-link')}>LINK PÅ MAIL</ModeTab>
      </div>
      <form onSubmit={signIn}>
        <input data-entropi-focus aria-label="E-mail" type="email" autoComplete="email" placeholder="E-mail" value={email} onChange={event => setEmail(event.target.value)} style={inputStyle} required />
        {mode === 'password' && <input data-entropi-focus aria-label="Adgangskode" type="password" autoComplete="current-password" placeholder="Adgangskode" value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} required />}
        {error && <p role="alert" style={{ ...s.body, color: '#d78b7d' }}>{error}</p>}
        {sent && <p role="status" style={{ ...s.body, color: color.accent }}>Linket er sendt. Åbn mailen på denne enhed; linket fører dig direkte tilbage til din træning.</p>}
        {resetSent && <p role="status" style={{ ...s.body, color: color.accent }}>{RESET_SENT_MESSAGE}</p>}
        <Button type="submit" disabled={busy}>{busy ? (mode === 'magic-link' ? 'Sender link…' : 'Logger ind…') : (mode === 'magic-link' ? 'Send login-link' : 'Log ind')}</Button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={requestReset}
        style={{ display: 'block', margin: '0.8rem auto 0', border: 0, background: 'none', color: color.muted, fontFamily: font.mono, fontSize: '0.68rem', cursor: 'pointer', padding: '0.45rem', minHeight: '44px' }}
      >
        Vælg eller nulstil din adgangskode
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => switchMode('opret')}
        style={{ display: 'block', margin: '0.2rem auto 0', border: 0, background: 'none', color: color.accent, fontFamily: font.mono, fontSize: '0.68rem', cursor: 'pointer', padding: '0.45rem', minHeight: '44px' }}
      >
        Ny her? Opret en gratis konto
      </button>
    </Shell>
  )
}

// Recovery-linket lander i browseren, ikke i appen. Skærmen skal derfor slutte
// med at pege tilbage til appen — ellers sætter medlemmet en adgangskode og
// fortsætter i browseren uden at opdage at han nu kan komme ind i appen.
function SetPassword({ client, standalone = false }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async event => {
    event.preventDefault()
    const check = validateNewPassword(password, confirmation)
    if (!check.ok) {
      setError(check.reason)
      return
    }
    setBusy(true)
    setError('')
    try {
      const { error: updateError } = await client.auth.updateUser({ password })
      if (updateError) setError('Adgangskoden kunne ikke gemmes. Prøv igen, eller bed Marc om et nyt link.')
      else setDone(true)
    } catch {
      setError('Adgangskoden kunne ikke gemmes lige nu. Prøv igen, når du er online.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <Shell>
      <Label>Adgangskode</Label>
      <h1 style={s.h1}>Din adgangskode er gemt.</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>
        {standalone
          ? 'Du er klar. Fortsæt til din træning herunder.'
          : 'Åbn nu Entropi fra din hjemmeskærm og log ind med din e-mail og den nye adgangskode. Den virker begge steder.'}
      </p>
      <Meta style={{ color: color.dim }}>Adgangskoden ligger på serveren og virker derfor både i appen og i browseren — i modsætning til login-links.</Meta>
    </Shell>
  }

  return (
    <Shell>
      <Label>Adgangskode</Label>
      <h1 style={s.h1}>Vælg din adgangskode.</h1>
      <p style={{ ...s.body, marginBottom: '1.5rem' }}>Mindst {MIN_PASSWORD_LENGTH} tegn. Det er den du bruger til at logge ind i appen på din telefon.</p>
      <form onSubmit={submit}>
        <input data-entropi-focus aria-label="Ny adgangskode" type="password" autoComplete="new-password" placeholder="Ny adgangskode" value={password} onChange={event => setPassword(event.target.value)} style={inputStyle} required />
        <input aria-label="Gentag adgangskode" type="password" autoComplete="new-password" placeholder="Gentag adgangskode" value={confirmation} onChange={event => setConfirmation(event.target.value)} style={inputStyle} required />
        {error && <p role="alert" style={{ ...s.body, color: '#d78b7d' }}>{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Gemmer…' : 'Gem adgangskode'}</Button>
      </form>
    </Shell>
  )
}

function MagicLinkHandoff({ actionLink }) {
  const [opening, setOpening] = useState(false)
  const openTraining = () => {
    if (opening) return
    setOpening(true)
    window.location.assign(actionLink)
  }
  return <Shell>
    <Label>Personligt medlemslink</Label>
    <h1 style={s.h1}>Åbn din træning.</h1>
    <p style={{ ...s.body, marginBottom: '1.5rem' }}>Tryk én gang på knappen. Først derefter bruges dit personlige login-link på denne enhed.</p>
    <Button type="button" disabled={opening} onClick={openTraining}>{opening ? 'Åbner…' : 'Åbn min træning'}</Button>
  </Shell>
}

export default function PilotAuth({ client, children, magicLinkHandoff = null }) {
  const [session, setSession] = useState(undefined)
  const [sessionError, setSessionError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const standalone = isStandaloneApp()

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

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      if (mounted) {
        setSessionError('')
        if (isRecoveryEvent(event)) setRecovery(true)
        setSession(nextSession || null)
      }
    })
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [client, retryKey])

  if (sessionError) return <Shell><Label>Medlemslogin</Label><h1 style={s.h1}>Vi kan ikke åbne din træning endnu.</h1><p style={{ ...s.body, marginBottom: '1.5rem' }}>{sessionError} Prøv igen, når du er online.</p><Button onClick={() => { setSession(undefined); setSessionError(''); setRetryKey(value => value + 1) }}>Prøv igen</Button></Shell>
  if (session === undefined) return <Shell><Label>Medlemskonto</Label><p style={s.body}>Åbner din træning…</p></Shell>
  if (session && recovery) return <SetPassword client={client} standalone={standalone} />
  if (!session && magicLinkHandoff?.actionLink) return <MagicLinkHandoff actionLink={magicLinkHandoff.actionLink} />
  if (!session) return <Login client={client} handoffError={Boolean(magicLinkHandoff?.error)} standalone={standalone} />
  return children({ session, logout: () => client.auth.signOut({ scope: 'local' }) })
}
