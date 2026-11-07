import { exerciseHelpLookup } from './exerciseHelpLookup.mjs'

// Native disclosure inside the existing session dialog; no modal or global events.
export function createExerciseHelp(doc, name) {
  const item = exerciseHelpLookup(name)
  if (!item) return null
  const el = (tag, text) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    return node
  }
  const fold = el('details'), summary = el('summary', `Teknikhjælp: ${item.name}`)
  fold.setAttribute('data-detail', 'exercise-help')
  fold.setAttribute('data-exercise-help', '')
  fold.open = false
  fold.append(summary, el('h2', 'Udførelse'), el('p', item.udfoerelse))
  for (const [title, points] of [['Tre fokuspunkter', item.fokuspunkter], ['Almindelige fejl', item.almindeligeFejl]]) {
    const list = el('ul')
    for (const point of points) list.append(el('li', point))
    fold.append(el('h2', title), list)
  }
  const dismiss = el('button', 'Luk teknikhjælp')
  dismiss.setAttribute('type', 'button')
  dismiss.setAttribute('data-help-dismiss', '')
  dismiss.addEventListener('click', () => closeExerciseHelp(fold.parentElement))
  fold.append(dismiss)
  return fold
}

export function closeExerciseHelp(root) {
  const fold = root?.querySelector('[data-exercise-help]')
  if (!fold?.open) return false
  fold.open = false
  fold.querySelector('summary')?.focus()
  return true
}
