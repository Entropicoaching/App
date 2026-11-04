import { EATING_OUT_DISHES, EATING_OUT_PORTIONS, ESTIMATE_NOTICE, estimateEatingOut } from './eatingOut.mjs'

// Opt-in mount only. Assembly loads eatingOut.css; nothing auto-mounts or saves.
export function mountEatingOut(host, { enabled = false } = {}) {
  if (enabled !== true) return () => {}
  const doc = host.ownerDocument
  const el = (tag, text) => {
    const node = doc.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }
  const section = el('section')
  section.className = 'e2-eating-out'
  section.setAttribute('aria-label', 'Skøn for mad spist ude')
  section.append(el('h2', 'Spist ude'), el('p', 'Vælg en ret og den portion, der ligner dit måltid. Tallene er kun et udgangspunkt.'), el('p', ESTIMATE_NOTICE))
  const dishLabel = el('label', 'Ret')
  const dishSelect = el('select')
  const placeholder = el('option', 'Vælg en ret')
  placeholder.value = ''
  dishSelect.append(placeholder)
  for (const dish of EATING_OUT_DISHES) {
    const option = el('option', dish.label)
    option.value = dish.id
    dishSelect.append(option)
  }
  dishSelect.value = ''
  dishLabel.append(dishSelect)
  const portionLabel = el('label', 'Portion')
  const portionSelect = el('select')
  for (const portion of EATING_OUT_PORTIONS) {
    const option = el('option', portion.label)
    option.value = portion.id
    portionSelect.append(option)
  }
  portionSelect.value = 'medium'
  portionLabel.append(portionSelect)
  const output = el('div')
  output.setAttribute('role', 'status')
  output.setAttribute('aria-live', 'polite')
  output.setAttribute('aria-atomic', 'true')
  section.append(dishLabel, portionLabel, output,
    el('p', 'Drikkevarer, dessert og ekstra tilbehør er ikke med. Intet bliver gemt her.'))
  function render() {
    output.replaceChildren()
    const result = estimateEatingOut(dishSelect.value, portionSelect.value)
    if (!result) {
      output.append(el('p', 'Vælg en ret og en portion for at se et skøn.'))
      return
    }
    output.append(el('h3', `${result.dish} · ${result.portion.toLowerCase()} portion · skøn`),
      el('p', `Mellem portion svarer her til: ${result.mediumPortion}. Lille er ca. 70 % og stor ca. 140 % af mellem.`),
      el('p', `Ca. ${result.kcal} kcal og ${result.protein} g protein.`),
      el('p', `Groft interval: ${result.kcalRange.join('–')} kcal og ${result.proteinRange.join('–')} g protein. Intervallet er vejledende.`))
  }
  dishSelect.addEventListener('change', render)
  portionSelect.addEventListener('change', render)
  render()
  host.append(section)
  return () => {
    dishSelect.removeEventListener('change', render)
    portionSelect.removeEventListener('change', render)
    section.remove()
  }
}
