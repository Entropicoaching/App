import { createElement as h, useEffect, useState } from 'react'
import { readTeamPatterns } from './teamPatternsRead.mjs'
import { teamPatterns } from './teamPatterns.mjs'

// "Holdet samlet". Planen kalder filen TeamPatterns.mjs, men på Windows er det
// samme fil som modellen teamPatterns.mjs; derfor TeamPatternsView.mjs.
// Ingen navne, ingen id'er og ingen data-* med atleter i DOM.
const row = { display: 'grid', gridTemplateColumns: 'minmax(6rem, auto) 1fr', gap: 8, paddingBlock: 4 }

export function TeamPatternsBody({ result }) {
  if (!result) return h('p', { role: 'status' }, 'Henter holdets mønstre…')
  const lines = [
    result.g1 && ['Kost', result.g1.text],
    result.g2 && ['Protein', result.g2.text],
  ].filter(Boolean)
  const lifts = (result.g3 ?? []).filter(l => l.text)
  if (!lines.length && !lifts.length) return h('p', { role: 'status' }, 'For få atleter med data til at vise holdets mønstre.')
  return h('div', { style: { textAlign: 'left' } },
    ...lines.map(([label, text]) => h('div', { key: label, style: row }, h('strong', null, label), h('span', null, text))),
    lifts.length > 0 && h('p', { style: { marginBottom: 4 } }, 'Står stille eller falder (4 uger)'),
    ...lifts.map(l => h('div', { key: l.key, style: row }, h('strong', null, l.name), h('span', null, l.text.replace(/ står stille eller falder$/, '')))),
    h('p', { style: { lineHeight: 1.6, opacity: 0.8, textAlign: 'left' } }, 'Kun hold med mindst 5 atleter vises. Tal mellem 1 og 4 skrives "under 5". Skjulte atleter og atleter på ferie tæller ikke med.'))
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
    summary, h('p', { style: { lineHeight: 1.6, opacity: 0.8, textAlign: 'left' } }, 'Kost, protein og hovedløft for holdet samlet, uden navne.'),
    open && h(TeamPatternsBody, { result }))
}
