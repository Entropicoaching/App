// Ordre 2033f (Marc 23. nov.: "nogle atleter der efter spørger om timeren kan tilvælges skjult da det stresser dem").
// Valget staar under Mig som TemaValg og huskes pr. atlet paa telefonen (restTimerVisning.js).
// Pausen registreres stadig, kun uret i dagens pas skjules. Standard: timeren vises.
import { createElement as h, useState } from 'react'
import { isRestTimerHidden, setRestTimerHidden } from '../../restTimerVisning.js'

export function PausetimerValg({ athleteId, storage, style } = {}) {
  const [hidden, setHidden] = useState(() => isRestTimerHidden(athleteId, storage))
  const toggle = () => {
    const next = !hidden
    setRestTimerHidden(athleteId, next, storage)
    setHidden(next)
  }
  return h('div', { role: 'group', 'aria-label': 'Pausetimer', 'data-pausetimer-valg': '', style: { marginTop: 12, ...style } },
    h('p', { style: { margin: '0 0 6px', fontSize: 13, color: 'var(--e-tekst2)' } }, 'Pausetimer i dagens pas'),
    h('label', { style: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, cursor: 'pointer', fontSize: 15 } },
      h('input', { type: 'checkbox', checked: !hidden, onChange: toggle, 'data-pausetimer-vis': '',
        style: { width: 22, height: 22, margin: 0, accentColor: 'var(--e-amber)' } }),
      'Vis pausetimeren mellem sæt'),
    h('p', { style: { margin: '4px 0 0', fontSize: 13, color: 'var(--e-tekst2)' } },
      hidden ? 'Pausen registreres stadig, men uret vises ikke i passet.' : 'Slå fra, hvis uret stresser dig. Pausen registreres stadig.'))
}
