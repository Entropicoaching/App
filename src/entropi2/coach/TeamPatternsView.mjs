import { createElement as h, useEffect, useState } from 'react'
import { readTeamPatterns } from './teamPatternsRead.mjs'
import { teamPatterns } from './teamPatterns.mjs'

// "Holdet samlet". Planen kalder filen TeamPatterns.mjs, men på Windows er det
// samme fil som modellen teamPatterns.mjs; derfor TeamPatternsView.mjs.
// Ingen navne, ingen id'er og ingen data-* med atleter i DOM.
import { FocusBox, ShareBar } from '../u3/charts.mjs'

// U3b: kort med margen, én bjælke pr. andel og ét fokuspunkt. Tal fra 1 til 4
// skrives "under 5" og får ingen bjælke, så bjælken aldrig afslører antallet.
export const teamCard = { padding: 16, marginTop: 8, border: '1px solid #414139', borderRadius: 16, background: '#1c1c18', textAlign: 'left', minWidth: 0 }
const line = { paddingBlock: 8, borderTop: '1px solid #2f2f29' }
const small = { fontSize: 13, color: '#c1beb5' }
const exact = part => part && part.total > 0 && !/under 5/.test(part.text)
const share = part => exact(part) ? part.n / part.total : null

// Ét fælles fokus for holdet, kun ud fra tal, der også står i klartekst.
export function teamFocus(result) {
  if (share(result.g2) !== null && share(result.g2) < 0.5) return { key: 'protein', value: `${result.g2.n} af ${result.g2.total}`,
    text: 'rammer protein. Gør protein til holdets fokus i denne uge.' }
  if (share(result.g1) !== null && share(result.g1) < 0.5) return { key: 'kost', value: `${result.g1.n} af ${result.g1.total}`,
    text: 'logger kost. Gør kostlogning til holdets fokus i denne uge.' }
  const lift = (result.g3 ?? []).find(l => l.text && share(l) !== null && share(l) >= 0.5)
  if (lift) return { key: 'loft', value: `${lift.n} af ${lift.total}`, text: `står stille eller falder i ${lift.name}. Se på belastningen i næste blok.` }
  return { key: 'steady', value: null, text: 'Holdet følger planen. Ingen fælles ændring lige nu.' }
}

export function TeamPatternsBody({ result }) {
  if (!result) return h('p', { role: 'status' }, 'Henter holdets mønstre…')
  const lines = [
    result.g1 && ['Kost', result.g1],
    result.g2 && ['Protein', result.g2],
  ].filter(Boolean)
  const lifts = (result.g3 ?? []).filter(l => l.text)
  if (!lines.length && !lifts.length) return h('p', { role: 'status' }, 'For få atleter med data til at vise holdets mønstre.')
  const item = (key, label, part, text, color) => h('div', { key, 'data-u3-team-line': key, style: line },
    h('span', { style: { ...small, display: 'block' } }, label),
    h('span', null, text),
    h(ShareBar, { share: share(part), color, label: `${label}: ${text}` }))
  return h('div', { 'data-u3-team': true, style: teamCard },
    h(FocusBox, { focus: teamFocus(result) }),
    ...lines.map(([label, part]) => item(label, label, part, part.text)),
    ...lifts.map(l => item(l.key, `${l.name} · står stille eller falder (4 uger)`, l, l.text.replace(/ står stille eller falder$/, ''), '#da9d8e')),
    h('p', { style: { ...small, margin: '8px 0 0' } }, 'Under 5 atleter skrives "under 5".'))
}

// Læser L2 første gang folden åbnes. athletes er allerede uden skjulte og ferie.
export default function TeamPatternsView({ client, athletes, targets, day, foldProps, summary }) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState(null)
  const ids = athletes.map(a => a.id).sort()
  const key = JSON.stringify([day, ids])
  useEffect(() => {
    if (!open || !client || !day || !ids.length) return undefined
    let live = true
    setResult(null)
    readTeamPatterns(client, ids, day).then(read => {
      if (live) setResult(teamPatterns({ athletes, meals: read.meals, logs: read.logs, targets, today: day }))
    }, () => { if (live) setResult({ g1: null, g2: null, g3: null }) })
    return () => { live = false }
  }, [open, client, key])
  return h('details', { ...foldProps, onToggle: event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open) } },
    summary, h('p', { style: { ...small, margin: '0 0 4px', textAlign: 'left' } }, 'Hele holdet uden navne. Skjulte og ferie tæller ikke.'),
    open && h(TeamPatternsBody, { result }))
}
