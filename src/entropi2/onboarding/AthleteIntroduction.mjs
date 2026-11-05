import { createElement as h, useEffect, useRef, useState } from 'react'
import { homeStyles as s } from '../home/homeStyles.mjs'
import { firstVisitKey, readFirstVisit, rememberFirstVisit, welcomeTitle } from './firstVisitState.mjs'

const FIRST_VISIT_STEPS = [
  { title: 'Velkommen', text: 'Her er en kort tur i appen. Du kan springe over og gå i gang med det samme.' },
  { title: 'Find dit pas', text: 'På Hjem finder du dagens eller næste pas. Tryk på Start dagens pas eller Start næste pas. Se mit program viser hele programmet. Er der intet program endnu, kan du kontakte din coach.' },
  { title: 'Log et sæt', text: 'I passet vælger du et sæt, skriver vægt i kg og gentagelser og trykker Godkendt. Vent på bekræftelsen. Står der en fejl eller afventer synkronisering, er sættet endnu ikke bekræftet gemt.' },
  { title: 'Din dag', text: 'Brug Din coach på Hjem, hvis du har spørgsmål. Du behøver ikke registrere noget for at afslutte introduktionen.' },
]

function dailyStep({ canLogReadiness, canLogWeight, visKost }) {
  const tips = []
  if (canLogReadiness === true) tips.push('Tryk på Dagsform på Hjem, vælg dine svar og tryk Gem.')
  if (canLogWeight === true) tips.push('Tryk på Vægt i dag på Hjem, skriv din vægt og tryk Gem.')
  else if (visKost === true) tips.push('Du finder din vægt under Kost.')
  return tips.length ? { title: canLogReadiness === true && canLogWeight === true ? 'Dagsform og vægt'
    : canLogReadiness === true ? 'Dagsform' : 'Din vægt',
  text: `${tips.join(' ')} Du behøver ikke registrere noget for at afslutte introduktionen.` } : FIRST_VISIT_STEPS[3]
}

// Guard before mounting hooks: OFF and invalid identities do not touch storage.
export default function AthleteIntroduction(props = {}) {
  if (props.enabled !== true) return null
  const scopeKey = firstVisitKey(props.athleteId)
  if (!scopeKey) return null
  return h(ScopedIntroduction, { ...props, scopeKey, key: scopeKey })
}

function ScopedIntroduction({ scopeKey, firstName, storage, headingRef, canLogReadiness, canLogWeight, visKost }) {
  const initial = () => ({ ...readFirstVisit(scopeKey, storage), storage, step: 0 })
  const [state, setState] = useState(initial)
  const live = useRef(state), active = useRef(true), finished = useRef(false), title = useRef(null)
  live.current = state
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])
  // A supplied storage adapter can change without switching athlete. Reset the
  // local view and invalidate retained callbacks from the previous adapter.
  if (state.storage !== storage) {
    finished.current = false
    setState(initial())
    return null
  }
  const current = () => active.current && live.current === state && !finished.current && !state.done
  const finish = () => {
    if (!current()) return
    finished.current = true
    const saved = rememberFirstVisit(scopeKey, storage)
    setState({ ...state, done: true, unavailable: !saved })
    headingRef?.current?.focus()
  }
  if (state.done) return state.unavailable ? h('div', null,
    h('p', { role: 'status', style: s.text }, 'Dit valg kunne ikke gemmes. Introduktionen kan vises igen næste gang.'),
    h('button', { type: 'button', style: s.secondary, onClick: () => {
      if (active.current && live.current === state) setState({ ...state, unavailable: false })
    } }, 'Luk')) : null
  const move = step => {
    if (!current()) return
    setState({ ...state, step })
    title.current?.focus()
  }
  const step = state.step === 3 ? dailyStep({ canLogReadiness, canLogWeight, visKost }) : FIRST_VISIT_STEPS[state.step]
  return h('section', { 'aria-label': 'Introduktion', 'data-home-onboarding': '',
    style: { ...s.card, minWidth: 0, overflowWrap: 'anywhere' } },
    h('p', { style: s.eyebrow, 'aria-live': 'polite', 'aria-atomic': true }, `Trin ${state.step + 1} af ${FIRST_VISIT_STEPS.length}`),
    h('h2', { ref: title, tabIndex: -1, style: s.heading }, state.step === 0 ? welcomeTitle(firstName) : step.title),
    h('p', { style: s.text }, step.text),
    state.unavailable && h('p', { role: 'status', style: s.text },
      'Dit tidligere valg kunne ikke læses på denne enhed. Du kan stadig fortsætte eller springe over.'),
    h('button', { type: 'button', style: s.primary,
      onClick: state.step === FIRST_VISIT_STEPS.length - 1 ? finish : () => move(state.step + 1) },
    state.step === FIRST_VISIT_STEPS.length - 1 ? 'Kom i gang' : 'Næste'),
    state.step > 0 && h('button', { type: 'button', style: s.secondary, onClick: () => move(state.step - 1) }, 'Tilbage'),
    h('button', { type: 'button', style: s.secondary, onClick: finish }, 'Spring over'))
}
