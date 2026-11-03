import { buildShoppingList } from './shoppingList.mjs'

// Explicit opt-in; no imports from live controllers, no storage and no auto-mount.
export function mountShoppingList(host, { enabled = false, ownMeals = [] } = {}) {
  if (enabled !== true) return () => {}
  const doc = host.ownerDocument
  const selected = new Set(), listeners = []
  const section = doc.createElement('section')
  section.setAttribute('aria-label', 'Indkøbsliste fra egne måltider')
  function element(parent, tag, value) {
    const node = doc.createElement(tag)
    if (value !== undefined) node.textContent = value
    parent.append(node)
    return node
  }
  function listen(node, event, handler) {
    node.addEventListener(event, handler)
    listeners.push(() => node.removeEventListener(event, handler))
  }
  element(section, 'h2', 'Indkøbsliste')
  element(section, 'p', 'Vælg egne måltider. Hvert måltid tælles én gang. Listen gemmes ikke.')
  const choices = element(section, 'fieldset')
  element(choices, 'legend', 'Egne måltider')
  const output = element(section, 'div')
  output.setAttribute('aria-live', 'polite')
  // Validate IDs before attaching any UI. Ingredient validation happens on selection.
  buildShoppingList(ownMeals, [])
  if (!ownMeals.length) element(choices, 'p', 'Du har ingen egne måltider at vælge fra.')
  for (const meal of ownMeals) {
    const label = element(choices, 'label')
    const input = element(label, 'input')
    input.type = 'checkbox'
    element(label, 'span', typeof meal.meal === 'string' && meal.meal.trim() ? meal.meal : 'Eget måltid')
    listen(input, 'change', () => {
      if (input.checked) selected.add(meal.id)
      else selected.delete(meal.id)
      render()
    })
  }
  function render() {
    output.replaceChildren()
    try {
      const result = buildShoppingList(ownMeals, [...selected])
      if (!result.selectedCount) {
        element(output, 'p', 'Vælg et eller flere måltider for at se din indkøbsliste.')
        return
      }
      if (result.missingMeals.length) {
        const warning = element(output, 'p', 'Listen er ufuldstændig. Ingredienser mangler for: ' + result.missingMeals.map(m => m.meal).join(', ') + '.')
        warning.setAttribute('role', 'status')
      }
      if (result.items.length) {
        const list = element(output, 'ul')
        for (const item of result.items) {
          element(list, 'li', `${item.name}: ${new Intl.NumberFormat('da-DK', { maximumSignificantDigits: 12 }).format(item.quantity)} ${item.unit}`)
        }
      }
    } catch {
      const error = element(output, 'p', 'Listen kunne ikke beregnes. Tjek ingrediensernes navn, mængde og enhed i de valgte måltider.')
      error.setAttribute('role', 'alert')
    }
  }
  render()
  host.append(section)
  return () => {
    for (const remove of listeners) remove()
    selected.clear()
    section.remove()
  }
}
