import * as React from 'react'
import { homeStyles as s } from '../home/homeStyles.mjs'
import { DEFAULT_TIME, TIMES, danishTime, openRoute, pushCardState, pushSupport, shortTime } from './pushModel.mjs'
import { disablePush, enablePush, readPushSetup, saveTime } from './pushData.mjs'

// U8 del 2: påmindelse og coachsvar som push. Atleten vælger tidspunkt og slår til med ét tryk.
// Kortet vises kun, når pakke D og nøglen findes; ellers returnerer det null, og forsiden er som i U7.
// Hooks hentes via navnerummet som i U3, U5 og U7: lukkede prøveharnesser kan erstatte 'react'.
const h = React.createElement
const appClient = async () => (await import('../../supabase.js')).supabase
const hint = { ...s.text, fontSize: 14, margin: '6px 0 0' }
const field = { ...s.secondary, marginTop: 6, boxSizing: 'border-box', padding: '0 12px', background: '#171814' }
const LATER = 'entropi-u8-push-senere:'
// Hvem slog sidst påmindelser til på denne telefon (én telefon kan have flere brugere).
const OWNER = 'entropi-u8-push-ejer'

export function browserEnv() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {}
  return { navigator, notification: typeof Notification === 'undefined' ? null : Notification,
    hasPushManager: typeof window.PushManager !== 'undefined',
    standalone: window.matchMedia?.('(display-mode: standalone)')?.matches === true,
    location: window.location, history: window.history }
}

const within = (promise, ms) => Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))])
const registrationOf = env => env.registration ? Promise.resolve(env.registration)
  : within(env.navigator?.serviceWorker?.ready ?? Promise.resolve(null), 4000)

const readLater = (storage, id) => { try { return storage?.getItem(LATER + id) === '1' } catch { return false } }
const writeLater = (storage, id) => { try { storage?.setItem(LATER + id, '1') } catch { /* kun denne visning */ } }
const readOwner = storage => { try { return storage?.getItem(OWNER) ?? null } catch { return null } }
const writeOwner = (storage, id) => { try { if (id) storage?.setItem(OWNER, id); else storage?.removeItem(OWNER) } catch { /* kun denne visning */ } }

export default function PushCard({ athleteId, client, storage: givenStorage, setTab, env: given }) {
  // Værten giver ikke altid storage med; telefonens eget localStorage bruges så.
  const storage = givenStorage ?? (typeof localStorage === 'undefined' ? null : localStorage)
  const env = React.useRef(null)
  env.current ??= given ?? browserEnv()
  const support = pushSupport(env.current)
  const [resolved, setResolved] = React.useState(client ?? null)
  const [setup, setSetup] = React.useState({ status: 'loading' })
  const [endpoint, setEndpoint] = React.useState(null)
  const [time, setTime] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [later, setLater] = React.useState(() => readLater(storage, athleteId))
  const [owner, setOwner] = React.useState(() => readOwner(storage))
  // Klik på en notifikation åbner appen med ?u8=beskeder; siden åbnes én gang, og adressen ryddes.
  React.useEffect(() => {
    const { location, history } = env.current
    const route = openRoute(location?.search)
    if (!route) return
    try {
      const url = new URL(location.href)
      url.searchParams.delete('u8')
      history?.replaceState?.(history.state, '', url.pathname + url.search + url.hash)
    } catch { /* adressen bliver stående */ }
    if (route !== 'hjem') setTab?.(route)
  }, [setTab])
  React.useEffect(() => {
    if (support === 'unsupported') return undefined
    if (client) { setResolved(client); return undefined }
    let active = true
    appClient().then(c => { if (active) setResolved(c) }, () => {})
    return () => { active = false }
  }, [client, support])
  React.useEffect(() => {
    if (!resolved || support === 'unsupported') return undefined
    let active = true
    readPushSetup({ client: resolved }).then(result => { if (active) setSetup(result) })
    if (support === 'ok') registrationOf(env.current).then(r => r?.pushManager?.getSubscription())
      .then(sub => { if (active) setEndpoint(sub?.endpoint ?? null) }, () => {})
    return () => { active = false }
  }, [resolved, support])

  const state = pushCardState({ setup, support, endpoint, permission: env.current.notification?.permission, mine: owner === athleteId })
  if (state === 'hidden') return null
  const chosen = time ?? shortTime(setup.prefs?.remind_at) ?? DEFAULT_TIME
  const run = async work => {
    if (busy) return
    setBusy(true)
    try { await work() } finally { setBusy(false) }
  }
  const turnOn = () => run(async () => {
    const registration = await registrationOf(env.current)
    const result = await enablePush({ client: resolved, registration, notification: env.current.notification,
      publicKey: setup.publicKey, time: chosen, userAgent: env.current.navigator?.userAgent })
    if (result === 'on') {
      const sub = await registration.pushManager.getSubscription()
      setSetup(current => ({ ...current, endpoints: [...current.endpoints, sub?.endpoint],
        prefs: { ...(current.prefs ?? {}), remind_at: chosen, reminders_on: true, replies_on: true } }))
      setEndpoint(sub?.endpoint ?? null)
      writeOwner(storage, athleteId)
      setOwner(athleteId)
      setMessage(`Påmindelser er slået til. Du hører fra os kl. ${danishTime(chosen)}, hvis noget mangler.`)
    } else setMessage(result === 'denied'
      ? 'Telefonen sagde nej til påmindelser. Du kan slå dem til for Entropi i telefonens indstillinger.'
      : 'Det lykkedes ikke. Prøv igen.')
  })
  const store = () => run(async () => {
    const result = await saveTime({ client: resolved, time: chosen })
    if (result === 'saved') setSetup(current => ({ ...current, prefs: { ...(current.prefs ?? {}), remind_at: chosen, reminders_on: true } }))
    setMessage(result === 'saved' ? `Gemt. Påmindelsen kommer kl. ${danishTime(chosen)}.` : 'Det blev ikke gemt. Prøv igen.')
  })
  const turnOff = () => run(async () => {
    const result = await disablePush({ client: resolved, registration: await registrationOf(env.current) })
    if (result === 'off') { setEndpoint(null); setTime(null); writeOwner(storage, null); setOwner(null) }
    setMessage(result === 'off' ? 'Påmindelser er slået fra på denne telefon.' : 'Det lykkedes ikke. Prøv igen.')
  })
  const notNow = () => { writeLater(storage, athleteId); setLater(true); setMessage('') }
  const picker = h('label', { style: { ...s.text, display: 'block', marginTop: 12, color: '#edeae2' } }, 'Tidspunkt',
    h('select', { value: chosen, disabled: busy, onChange: event => setTime(event.target.value), style: field,
      'aria-label': 'Tidspunkt for påmindelsen' }, ...TIMES.map(t => h('option', { key: t, value: t }, danishTime(t)))))
  const status = message && h('p', { role: /lykkedes ikke|ikke gemt|sagde nej/.test(message) ? 'alert' : 'status', style: hint }, message)
  const text = (...lines) => lines.map((line, i) => h('p', { key: i, style: { ...s.text, margin: '6px 0 0' } }, line))
  const later_ = h('button', { type: 'button', style: s.secondary, onClick: notNow }, 'Ikke nu')

  // Slået til: én linje, der kan foldes ud. Beskeden står uden for, så den ses, også når linjen er foldet.
  if (state === 'on') return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Påmindelser', 'data-u8-push': 'on' },
    h('details', null,
      h('summary', { style: { ...s.text, minHeight: 44, cursor: 'pointer' } },
        `Påmindelse kl. ${danishTime(shortTime(setup.prefs?.remind_at) ?? DEFAULT_TIME)}, hvis noget mangler. Skift`),
      text('Du får også besked, når din coach har svaret.'), picker,
      h('button', { type: 'button', style: s.primary, disabled: busy, onClick: store }, 'Gem tidspunkt'),
      h('button', { type: 'button', style: s.secondary, disabled: busy, onClick: turnOff }, 'Slå påmindelser fra')), status)

  const body = state === 'ios' ? [
    ...text('På iPhone virker påmindelser kun, når Entropi ligger på hjemmeskærmen.',
      'Tryk på Del nederst i Safari, vælg Føj til hjemmeskærm, og åbn Entropi derfra. Så kan du slå dem til her.'), !later && later_]
    : state === 'denied' ? [...text('Påmindelser er slået fra for Entropi i telefonens indstillinger. Slå dem til der, hvis du vil have dem.'), !later && later_]
      : [...text('Mangler du vægt, dagsform eller mad, minder vi dig om det på dit tidspunkt. Du får også besked, når din coach har svaret.'),
        picker, h('button', { type: 'button', style: s.primary, disabled: busy, onClick: turnOn }, 'Slå påmindelser til'), !later && later_]
  if (later) return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Påmindelser', 'data-u8-push': state },
    h('details', null, h('summary', { style: { ...s.text, minHeight: 44, cursor: 'pointer' } }, 'Påmindelser på telefonen'), ...body), status)
  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'Påmindelser', 'data-u8-push': state },
    h('p', { style: { ...s.eyebrow, margin: 0 } }, 'Påmindelse på telefonen'), ...body, status)
}
