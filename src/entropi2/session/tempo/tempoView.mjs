import { parseTempo, parsePlannedRest } from './tempoParser.mjs'

// Unwired, read-only adapter. Each mount owns only its section. OFF is inert.
export function mountTempoView(root, initial = {}) {
  let section = null, disposed = false
  function update({ enabled = false, tempo, restSeconds, compact = false } = {}) {
    if (disposed) return
    if (enabled !== true) { section?.remove(); section = null; return }
    const parsed = parseTempo(tempo), rest = parsePlannedRest(restSeconds)
    if (parsed.status === 'missing' && rest.status === 'missing') { section?.remove(); section = null; return }
    const doc = root.ownerDocument
    const el = (tag, text) => {
      const node = doc.createElement(tag)
      if (text != null) node.textContent = text
      return node
    }
    if (!section) {
      section = el('section')
      section.setAttribute('data-e2-tempo', '')
      section.setAttribute('aria-label', 'Tempo og planlagt pause')
      root.append(section)
    }
    const content = [el('h3', 'Tempo og pause')]
    if (parsed.status === 'valid') {
      content.push(el('p', `Tempo: ${parsed.notation}`))
      const list = el('ol')
      list.setAttribute('aria-label', 'Tempoets fire faser i rækkefølge')
      for (const phase of parsed.phases) list.append(el('li', `${phase.label}: ${phase.explosive ? 'eksplosivt' : `${phase.seconds} sek.`}`))
      if (compact) {
        const phases = el('details')
        phases.setAttribute('data-detail', 'tempo-phases')
        phases.append(el('summary', 'Tempoets faser'), list); content.push(phases)
      } else content.push(list)
    } else if (parsed.status === 'invalid') content.push(el('p',
      'Tempo kan ikke vises. Brug fire faser, fx 3-1-1-0. X betyder eksplosivt.'))
    if (rest.status !== 'missing') content.push(el('p', rest.status === 'valid' ? `Planlagt pause mellem sæt: ${rest.label}`
      : 'Planlagt pause kan ikke vises. Brug sekunder, min:sek eller minutter med min.'))
    section.replaceChildren(...content)
  }
  update(initial)
  return { update, dispose() { disposed = true; section?.remove(); section = null } }
}
