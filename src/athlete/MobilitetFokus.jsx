import { createElement as h, useState } from 'react'
import MobilitetsBibliotek from './MobilitetsBibliotek.jsx'
import { MobilityHelped } from '../mobilityHelped.mjs'
import { FOCUS_LIFTS, FOCUS_NEEDS, focusPlan } from './mobilityFocus.mjs'

const button = { minHeight: 48, padding: '12px 14px', border: '1px solid #736043', borderRadius: 8, background: '#24231d', color: '#edeae2', font: 'inherit', textAlign: 'left', cursor: 'pointer', whiteSpace: 'normal', overflowWrap: 'anywhere' }
export default function MobilitetFokus({ mobilitetHjalp = false, athleteId, mobilityDate, library, warmupTemplates, onExit }) {
  const [showLibrary, setShowLibrary] = useState(false)
  const [lift, setLift] = useState('Squat')
  const [need, setNeed] = useState('Mere dybde')
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const plan = focusPlan(lift, need, library, warmupTemplates)
  const ex = plan.exercises[step]
  const choose = (label, action, active) => h('button', { key: label, type: 'button', onClick: action, 'aria-pressed': active, style: { ...button, background: active ? '#403522' : button.background, borderColor: active ? '#e0ae5c' : '#736043' } }, label)
  if (showLibrary) return h(MobilitetsBibliotek, { library, onExit: () => setShowLibrary(false) })
  return h('section', { 'aria-label': 'Mobilitet med fokus', style: { width: '100%', minWidth: 0, boxSizing: 'border-box', color: '#edeae2', padding: '16px 0', lineHeight: 1.6 } },
    h('button', { type: 'button', style: button, onClick: onExit }, 'Tilbage til mobilitet'),
    h('button', { type: 'button', style: button, onClick: () => setShowLibrary(true) }, 'Se øvelsesbibliotek'),
    h('p', { style: { color: '#e0ae5c', marginBottom: 4 } }, 'MOBILITET · DIT FOKUS'),
    h('h1', { style: { fontFamily: "'Playfair Display', serif", fontWeight: 400, fontSize: '1.9rem', lineHeight: 1.2 } }, done ? 'Klar til næste skridt' : 'Giv dit løft mere plads'),
    !started ? h('div', null,
      h('h2', { style: { fontSize: '1rem' } }, '1. Hvilket løft?'),
      h('div', { role: 'group', 'aria-label': 'Hovedøvelse', style: { display: 'grid', gap: 8 } }, ...FOCUS_LIFTS.map(name => choose(name, () => { setLift(name); setNeed(FOCUS_NEEDS[name][0]); setStep(0); setDone(false) }, lift === name))),
      h('h2', { style: { fontSize: '1rem' } }, '2. Hvad vil du arbejde med?'),
      h('div', { role: 'group', 'aria-label': 'Dit behov', style: { display: 'grid', gap: 8 } }, ...FOCUS_NEEDS[lift].map(name => choose(name, () => setNeed(name), need === name))),
      h('h2', { style: { fontSize: '1.15rem' } }, `${plan.exercises.length} øvelser til ${lift.toLowerCase()}`),
      h('ol', { style: { paddingLeft: 24 } }, ...plan.exercises.map(item => h('li', { key: item.id, style: { padding: '8px 0' } }, h('strong', null, item.name), h('div', { style: { color: '#d1c9b8' } }, `${item.label} · ${item.source}`)))),
      plan.notes.length ? h('aside', { 'aria-label': 'Besked fra din coach', style: { borderLeft: '3px solid #e0ae5c', paddingLeft: 12, overflowWrap: 'anywhere' } }, h('h2', { style: { fontSize: '1rem' } }, 'Fra din coach'), ...plan.notes.map(note => h('p', { key: note }, note))) : null,
      h('p', null, 'Arbejd roligt og inden for en behagelig bevægelse. Stop, hvis det gør ondt.'),
      h('button', { type: 'button', disabled: !plan.exercises.length, style: { ...button, width: '100%', background: '#e0ae5c', color: '#141410' }, onClick: () => { setStarted(true); setStep(0); setDone(false) } }, 'Start min rutine'))
      : done ? h('div', null, h('p', null, `${lift} · ${need}. Du har gennemgået din rutine.`),
        h(MobilityHelped, { enabled: mobilitetHjalp, athleteId, date: mobilityDate, exercises: plan.exercises }),
        h('button', { type: 'button', style: button, onClick: () => { setStarted(false); setDone(false); setStep(0) } }, 'Vælg nyt fokus'))
      : ex ? h('article', { style: { marginTop: 20, padding: 18, borderRadius: 12, border: '1px solid #736043', background: '#24231d', overflowWrap: 'anywhere' }, 'aria-live': 'polite' },
        h('p', { style: { color: '#e0ae5c' } }, `${lift} · ${need} · ${step + 1} af ${plan.exercises.length}`),
        h('h2', null, ex.name), h('p', null, ex.label), h('p', null, ex.desc),
        h('p', null, ex.source),
        h('div', { style: { display: 'grid', gap: 8 } },
          step > 0 ? h('button', { type: 'button', style: button, onClick: () => setStep(step - 1) }, 'Forrige øvelse') : null,
          h('button', { type: 'button', style: button, onClick: () => step + 1 === plan.exercises.length ? setDone(true) : setStep(step + 1) }, step + 1 === plan.exercises.length ? 'Afslut rutinen' : 'Næste øvelse'),
          h('button', { type: 'button', style: button, onClick: () => { setStarted(false); setStep(0) } }, 'Ret mit fokus')))
      : h('p', null, 'Ingen øvelser til dette fokus. Vælg et nyt fokus.'))
}
