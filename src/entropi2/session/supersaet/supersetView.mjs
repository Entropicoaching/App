import { sessionGroupsForDisplay } from './supersetModel.mjs'

// Explicit mount only. OFF never touches root; each instance owns its section.
export function mountSupersetView(root, initial = {}) {
  let section = null, disposed = false
  function update({ enabled = false, exercises = [], compact = false, currentExerciseId } = {}) {
    if (disposed) return
    if (enabled !== true) { section?.remove(); section = null; return }
    const el = (tag, text) => {
      const node = root.ownerDocument.createElement(tag)
      if (text != null) node.textContent = text
      return node
    }
    const model = sessionGroupsForDisplay(exercises)
    // Today's set keeps its existing logging order. Show membership only here,
    // never round/pause instructions that the host controller does not execute.
    const active = compact ? model.groups.filter(group => group.kind !== 'single' &&
      group.members.some(member => member.exerciseId === currentExerciseId)) : []
    if (!(compact ? active.length : model.groups.length) && !model.message) { section?.remove(); section = null; return }
    if (!section) {
      section = el('section')
      section.setAttribute('data-e2-supersaet', '')
      section.setAttribute('aria-label', 'Øvelsesgrupper og rækkefølge')
      root.append(section)
    }
    if (compact) {
      section.setAttribute('aria-label', 'Øvelsesgruppe')
      section.replaceChildren(...active.map(group => el('p',
        `${group.label}: ${group.members.map(member => member.name).join(' + ')}`)),
      ...(model.message ? [el('p', model.message)] : []))
      return
    }
    section.setAttribute('aria-label', 'Øvelsesgrupper og rækkefølge')
    const content = [el('h3', 'Øvelser i rækkefølge')]
    if (model.message) content.push(el('p', model.message))
    for (const group of model.groups) {
      const block = el('section')
      block.append(el('h4', group.label))
      for (const member of group.members) block.append(el('p', `${member.name}: ${member.sets} sæt`))
      if (group.kind !== 'single') block.append(el('p', 'Skift øvelse uden planlagt pause. Hold pause efter hver runde.'))
      if (group.restSeconds != null) block.append(el('p', `Pause: ${group.restSeconds} sek.`))
      const list = el('ol')
      list.setAttribute('aria-label', `${group.label}: sæt i rækkefølge`)
      for (const step of group.steps) list.append(el('li',
        `Runde ${step.round}: ${step.name}, sæt ${step.setNumber}. ` +
        (step.roundEnd ? step.restAfterSeconds == null ? '' : `Pause ${step.restAfterSeconds} sek.` : 'Fortsæt til næste øvelse.')))
      block.append(list); content.push(block)
    }
    section.replaceChildren(...content)
  }
  update(initial)
  return { update, dispose() { disposed = true; section?.remove(); section = null } }
}
