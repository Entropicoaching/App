import { antalOrd } from '../../antalOrd.mjs'
import { proteinDistribution } from './proteinDistribution.mjs'

const grams = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)

// Explicit opt-in; assembly owns date/athlete selection and remounting on change.
// Load proteinDistribution.css separately. No storage, controller or global DOM.
export function mountProteinDistribution(host, options = {}) {
  if (options.enabled !== true) return () => {}
  const doc = host.ownerDocument
  const el = (tag, text) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    return node
  }
  const model = proteinDistribution(options.meals)
  const section = el('section')
  section.className = 'e2-protein-fordeling'
  section.setAttribute('aria-label', 'Dagens proteinfordeling')
  const { minMeals, maxMeals, minGrams, maxGrams } = model.guidance
  section.append(el('h2', 'Dagens proteinfordeling'),
    el('p', `${minMeals}–${maxMeals} måltider med ${minGrams}–${maxGrams} g protein pr. måltid er vejledning. Tilpas sammen med din coach.`))
  if (model.status === 'unavailable') {
    section.append(el('p', 'Dagens måltider er ikke tilgængelige.'))
  } else if (model.status === 'empty') {
    section.append(el('p', 'Ingen måltider registreret i dag.'))
  } else {
    section.append(el('p', `${model.mealCount} ${antalOrd(model.mealCount, 'registreret måltid', 'registrerede måltider')}. Dagen kan være ufuldstændig.`))
    const list = el('ul')
    for (const meal of model.meals) {
      const item = el('li')
      item.append(el('span', meal.label), el('span', meal.protein === null
        ? 'Protein ikke angivet' : `${grams(meal.protein)} g protein`))
      list.append(item)
    }
    section.append(list)
    section.append(el('p', model.knownProtein === null
      ? 'Proteinmængden kan ikke vises samlet.'
      : `${model.unknownCount ? 'Kendt' : 'Registreret'} protein: ${grams(model.knownProtein)} g.`))
    if (model.unknownCount) section.append(el('p', `${model.unknownCount} ${antalOrd(model.unknownCount, 'måltid', 'måltider')} mangler en kendt proteinmængde.`))
  }
  host.append(section)
  return () => { if (section.parentNode) section.parentNode.removeChild(section) }
}
