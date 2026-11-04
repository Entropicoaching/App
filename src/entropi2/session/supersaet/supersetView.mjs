import { groupSessionExercises } from './supersetModel.mjs'

// Explicit mount only. OFF never touches root; each instance owns its section.
export function mountSupersetView(root, initial = {}) {
  let section = null, disposed = false
  function update({ enabled = false, exercises = [] } = {}) {
    if (disposed) return
    if (enabled !== true) { section?.remove(); section = null; return }
    const el = (tag, text) => {
      const node = root.ownerDocument.createElement(tag)
      if (text != null) node.textContent = text
      return node
    }
    const model = groupSessionExercises(exercises)
    if (!section) {
      section = el('section')
      section.setAttribute('data-e2-supersaet', '')
      section.setAttribute('aria-label', 'Øvelsesgrupper og rækkefølge')
      root.append(section)
    }
    const content = [el('h3', 'Øvelser i rækkefølge')]
    if (!model.groups.length) content.push(el('p', 'Ingen øvelser i dette pas.'))
    for (const warning of model.warnings) content.push(el('p', warning))
    for (const group of model.groups) {
      const block = el('section')
      block.append(el('h4', group.label))
      for (const member of group.members) block.append(el('p', `${member.name}: ${member.sets == null ? 'antal sæt mangler' : `${member.sets} sæt`}`))
      if (group.kind !== 'single') block.append(el('p', 'Skift øvelse uden planlagt pause. Hold pause efter hver runde.'))
      block.append(el('p', group.restSeconds == null ? 'Pause er ikke angivet.' : `Pause: ${group.restSeconds} sek.`))
      const list = el('ol')
      list.setAttribute('aria-label', `${group.label}: sæt i rækkefølge`)
      for (const step of group.steps) list.append(el('li',
        `Runde ${step.round}: ${step.name}, sæt ${step.setNumber}. ` +
        (step.roundEnd ? step.restAfterSeconds == null ? 'Pause er ikke angivet.' : `Pause ${step.restAfterSeconds} sek.` : 'Fortsæt til næste øvelse.')))
      if (!group.steps.length) block.append(el('p', 'Ingen planlagte sæt at vise.'))
      block.append(list); content.push(block)
    }
    section.replaceChildren(...content)
  }
  update(initial)
  return { update, dispose() { disposed = true; section?.remove(); section = null } }
}
