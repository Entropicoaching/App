import { antalOrd } from '../../antalOrd.mjs'
import { warmupSets } from './warmupSets.mjs'

const kg = value => String(value).replace('.', ',')

/** Creates an unattached, read-only DOM section. No mounting or persistence. */
export function createOpvarmning(document, props = {}) {
  // Strict opt-in before reading the work set or touching the document.
  if (props.enabled !== true) return null
  const sets = warmupSets(props.firstWorkSet)
  const el = (tag, text) => {
    const node = document.createElement(tag)
    if (text != null) node.textContent = text
    return node
  }
  const section = el('section')
  section.setAttribute('class', 'e2-opvarmning')
  section.setAttribute('aria-label', 'Forslag til opvarmning')
  section.append(el('h2', 'Opvarmning'))
  if (!sets.length) {
    section.append(el('p', 'Intet beregnet forslag. Angiv første arbejdssæts vægt som et tal på mindst 10 kg.'))
    return section
  }
  section.append(el('p', `Forslag frem mod første arbejdssæt på ${kg(props.firstWorkSet.weight)} kg. Vægte afrundet til 2,5 kg.`))
  const list = el('ol')
  for (const set of sets) {
    list.append(el('li', `${kg(set.weight)} kg × ${set.reps} ${antalOrd(set.reps, 'gentagelse', 'gentagelser')} (${set.percent} % af arbejdsvægten)`))
  }
  section.append(list, el('p', 'Tilpas til dit udstyr og aftalen med din coach. Opvarmningssæt registreres ikke som arbejdssæt.'))
  return section
}
