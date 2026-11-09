import { afdelingFor, AFDELINGER } from '../../kostplan/realisme.mjs'

// Printbar indkøbsliste (U1). Én ren visning: hvid baggrund, sort tekst, varer
// grupperet efter butiksafdeling og et felt til at krydse af med kuglepen.
// Telefonens printdialog kan også gemme den som PDF. Intet gemmes eller sendes.
export const PRINT_CSS = `
.e2-print-sheet { display: none; }
@media print {
  @page { margin: 14mm; }
  body > *:not(.e2-print-sheet) { display: none !important; }
  .e2-print-sheet { display: block !important; background: #fff !important; color: #000 !important;
    font: 12pt/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .e2-print-sheet h1 { font-size: 18pt; margin: 0 0 2mm; }
  .e2-print-sheet h2 { font-size: 13pt; margin: 6mm 0 2mm; border-bottom: 1px solid #000; break-after: avoid; }
  .e2-print-sheet ul { list-style: none; padding: 0; margin: 0; }
  .e2-print-sheet li { display: flex; gap: 3mm; align-items: baseline; padding: 1.2mm 0; break-inside: avoid; }
  .e2-print-sheet .boks { flex: 0 0 4mm; height: 4mm; border: 1px solid #000; }
}`

export function groupForPrint(items) {
  const groups = new Map(AFDELINGER.map(name => [name, []]))
  for (const item of Array.isArray(items) ? items : []) {
    if (typeof item?.text !== 'string' || !item.text.trim()) continue
    groups.get(afdelingFor(item.name)).push(item.text.trim())
  }
  return [...groups].filter(([, lines]) => lines.length).map(([afdeling, lines]) => ({ afdeling, lines }))
}

// Bygger arket i dokumentet og åbner printdialogen. Returnerer false, hvis
// der intet er at printe, eller browseren ikke kan printe.
export function printShoppingList({ title = 'Indkøbsliste', subtitle = '', items = [] } = {}, win = globalThis.window) {
  const doc = win?.document, groups = groupForPrint(items)
  if (!doc?.body || typeof win.print !== 'function' || !groups.length) return false
  for (const node of [...doc.body.querySelectorAll('.e2-print-sheet')]) node.remove()
  const styleHost = doc.head || doc.body
  if (![...styleHost.querySelectorAll('style')].some(node => node.getAttribute('id') === 'e2-print-css')) {
    const style = doc.createElement('style')
    style.setAttribute('id', 'e2-print-css'); style.textContent = PRINT_CSS
    styleHost.append(style)
  }
  const sheet = doc.createElement('section')
  sheet.setAttribute('class', 'e2-print-sheet')
  sheet.setAttribute('aria-hidden', 'true')
  const add = (parent, tag, text, className) => {
    const node = doc.createElement(tag)
    if (text !== undefined) node.textContent = text
    if (className) node.setAttribute('class', className)
    parent.append(node); return node
  }
  add(sheet, 'h1', title)
  if (subtitle) add(sheet, 'p', subtitle)
  for (const group of groups) {
    add(sheet, 'h2', group.afdeling)
    const list = add(sheet, 'ul')
    for (const line of group.lines) {
      const li = add(list, 'li')
      add(li, 'span', undefined, 'boks')
      add(li, 'span', line)
    }
  }
  doc.body.append(sheet)
  const remove = () => { sheet.remove(); win.removeEventListener?.('afterprint', remove) }
  win.addEventListener?.('afterprint', remove)
  try { win.print() } catch { remove(); return false }
  return true
}
