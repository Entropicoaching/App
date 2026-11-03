import { calculatePlates } from './plateCalculator.mjs'

const kg = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 10 }).format(value)

// Explicit mount only. Owns one subtree, no host wiring, storage or global events.
export function mountPlateCalculator(root, { weight = '', barWeightKg = 20 } = {}) {
  const doc = root.ownerDocument
  const el = (tag, text, attrs = {}) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
    return node
  }
  const section = el('section', null, { 'aria-label': 'Skiveberegner', 'data-e2-plader': '' })
  const input = el('input', null, { type: 'text', inputmode: 'decimal', autocomplete: 'off' })
  input.value = String(weight)
  const weightLabel = el('label', 'Ønsket samlet vægt i kg ')
  weightLabel.append(input)
  const barLabel = el('label', 'Stangvægt ')
  const select = el('select')
  for (const bar of [20, 15]) select.append(el('option', `${bar} kg`, { value: bar }))
  select.value = String(barWeightKg)
  barLabel.append(select)
  const status = el('p', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' })
  const list = el('ul', null, { 'aria-label': 'Skiver pr. side' })
  section.append(el('h2', 'Skiveberegner'), weightLabel, barLabel,
    el('p', 'Samme skiver på begge sider. Beregningen forudsætter nok skiver af hver størrelse.'), status, list)
  root.append(section)
  function render() {
    const result = calculatePlates(input.value, Number(select.value))
    list.replaceChildren()
    input.setAttribute('aria-invalid', String(result.status === 'invalid'))
    if (result.status === 'invalid') {
      status.textContent = 'Angiv en gyldig, ikke-negativ vægt og vælg en stang på 20 eller 15 kg.'
      return
    }
    status.textContent = result.status === 'below-bar'
      ? `Vægten er under stangens ${result.barWeightKg} kg og kan ikke lægges. Nærmeste mulige vægt: ${kg(result.nearestWeightKg)} kg.`
      : result.status === 'exact' ? `Samlet vægt: ${kg(result.nearestWeightKg)} kg.`
        : `${kg(result.requestedWeightKg)} kg kan ikke lægges. Nærmeste mulige vægt: ${kg(result.nearestWeightKg)} kg.`
    if (!result.platesPerSide.length) list.append(el('li', 'Kun stangen – ingen skiver.'))
    for (const plate of result.platesPerSide) list.append(el('li', `${plate.count} × ${kg(plate.weightKg)} kg pr. side`))
  }
  input.addEventListener('input', render)
  select.addEventListener('change', render)
  render()
  return () => {
    input.removeEventListener('input', render)
    select.removeEventListener('change', render)
    section.remove()
  }
}
