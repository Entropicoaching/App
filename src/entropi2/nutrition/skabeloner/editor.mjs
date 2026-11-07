// Owned DOM editor inside the existing nutrition screen. Drafts stay local until
// the user explicitly saves through the existing template storage writer.
export function templateIngredientEditor(doc, item, draft, { disabled = false, onSave, focusKey } = {}) {
  const make = (parent, tag, text) => {
    const node = doc.createElement(tag)
    if (text !== undefined) node.textContent = text
    parent?.append(node); return node
  }
  const details = make(null, 'details')
  details.setAttribute('data-focus', focusKey)
  make(details, 'summary', `Ingredienser: ${item.name}${item.ingredients?.length ? '' : ' · mangler'}`).setAttribute('data-focus', focusKey + '-summary')
  make(details, 'p', 'Mængder pr. én portion. Angiv kun kendte ingredienser. Navn og makroer bruges ikke til at gætte. Manglende id, kilde og tilberedning forbliver ukendte.')
  if (!item.ingredients?.length) make(details, 'p', 'Ingredienser mangler. Ugens indkøbsliste er ufuldstændig for denne skabelon.')
  const rows = make(details, 'div')
  const button = (parent, text, action) => {
    const node = make(parent, 'button', text); node.type = 'button'; node.disabled = disabled
    node.addEventListener('click', action); return node
  }
  const draw = () => {
    rows.replaceChildren()
    for (const [index, ingredient] of draft.ingredients.entries()) {
      const row = make(rows, 'fieldset')
      make(row, 'legend', `Ingrediens ${index + 1}`)
      const field = (label, key, value, update) => {
        const input = make(make(row, 'label', label), 'input')
        input.value = value ?? ''; input.disabled = disabled
        input.setAttribute('data-focus', `${focusKey}-${index}-${key}`)
        if (key === 'quantity') input.inputMode = 'decimal'
        input.addEventListener('input', event => update(event.target.value))
      }
      for (const [label, key] of [['Navn', 'name'], ['Mængde', 'quantity'], ['Enhed (g, kg, ml, styk …)', 'unit'],
        ['Fødevare-id (valgfrit)', 'foodId'], ['Tilberedning (valgfrit, fx tør eller kogt)', 'preparation']]) {
        field(label, key, ingredient[key], value => {
          if (value === '' && ['foodId', 'preparation'].includes(key)) delete ingredient[key]
          else ingredient[key] = value
        })
      }
      const objectSource = ingredient.source && typeof ingredient.source === 'object'
      field('Kilde (valgfrit)', 'source', objectSource ? ingredient.source.citation : ingredient.source, value => {
        if (objectSource) ingredient.source = { ...ingredient.source, citation: value }
        else if (value) ingredient.source = value
        else delete ingredient.source
      })
      if (objectSource) field('Kildens verifikationsstatus', 'verification', ingredient.source.verification,
        value => { ingredient.source.verification = value })
      button(row, 'Fjern ingrediens', () => { draft.ingredients.splice(index, 1); draw() })
    }
  }
  draw()
  button(details, 'Tilføj ingrediens', () => {
    if (draft.ingredients.length >= 100) return
    draft.ingredients.push({ name: '', quantity: '', unit: '' }); draw()
  })
  button(details, 'Gem ingredienser', () => onSave?.(structuredClone(draft.ingredients)))
  return details
}
