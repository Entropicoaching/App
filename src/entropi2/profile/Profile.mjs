import { createElement as h } from 'react'
import { profileModel } from './profileModel.mjs'
import { profileStyles as s } from './profileStyles.mjs'

// Opt-in display only. The host supplies its existing confirmed logout action.
// No client, storage, effects, identity lookup or new write path.
export default function Profile(props = {}) {
  if (props.enabled !== true) return null
  const { athlete, onLogOut, preview = false, loggingOut = false, logoutError = false } = props
  const model = profileModel(athlete)
  const canLogOut = preview !== true && loggingOut !== true && typeof onLogOut === 'function'
  const showLogOut = props.hideLogout !== true && preview !== true && typeof onLogOut === 'function'
  const goal = props.hideGoal !== true ? model.goal : null
  const field = (label, value) => value != null && h('div', { key: label, style: s.field },
    h('dt', { style: s.label }, label), h('dd', { style: s.value }, value))
  return h('section', { 'aria-label': 'Mig', 'data-entropi2-profile': '', style: s.page },
    h('h1', { style: s.title }, 'Mig'),
    (model.name != null || goal != null) && h('dl', { style: s.card }, field('Navn', model.name), field('Mit mål', goal)),
    props.visKost !== false && (model.kcal != null || model.protein != null) && h('section', { 'aria-label': 'Mine kostmål', style: s.card },
      h('h2', { style: s.heading }, 'Mine kostmål'),
      h('p', { style: s.label }, 'Pr. dag'),
      h('dl', { style: s.list }, field('Kalorier', model.kcal), field('Protein', model.protein))),
    props.children,
    showLogOut && h('button', { type: 'button', style: s.button, disabled: !canLogOut,
      onClick: () => { if (canLogOut) return onLogOut() } }, loggingOut === true ? 'Logger ud…' : 'Log ud'),
    logoutError === true && h('p', { role: 'alert', style: s.value }, 'Du kunne ikke logges ud. Prøv igen.'))
}
