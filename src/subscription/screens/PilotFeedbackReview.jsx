import { useState } from 'react'
import { color, s } from '../theme.js'
import { Button, Card, Label, Meta } from '../ui.jsx'
import { triagePilotFeedbackExport } from '../pilotFeedbackReview.js'

const example = {
  schemaVersion: 'entropi-pilot-feedback/v1',
  kind: 'subscription-pilot-feedback-export',
  localOnly: true,
  items: [{ step: 'set-logging', severity: 'friction', note: 'Jeg kunne ikke se tydeligt, om mit sidste sæt var gemt.' }],
}

function parse(value) {
  try { return { value: JSON.parse(value) } } catch { return { error: 'JSON-filen kunne ikke læses.' } }
}

export default function PilotFeedbackReview() {
  const [raw, setRaw] = useState('')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const review = () => {
    const parsed = parse(raw)
    if (parsed.error) { setResult(null); setMessage(parsed.error); return }
    const next = triagePilotFeedbackExport(parsed.value)
    setResult(next.ok ? next.value : null)
    setMessage(next.ok ? '' : `Eksporten er ikke gyldig (${next.errors.length} fejl). Brug kun JSON eksporteret fra pilotfeedback.`)
  }
  const loadExample = () => { setRaw(JSON.stringify(example, null, 2)); setResult(null); setMessage('Eksempel indlæst — det sendes ingen steder.') }
  const selectFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setRaw(await file.text())
    setResult(null)
    setMessage(`Indlæste ${file.name}. Vælg “Gennemgå feedback”.`)
  }

  return <main style={s.page}>
    <Label>Pilot · coach review</Label>
    <h1 style={s.h1}>Gør feedback til en klar beslutning.</h1>
    <p style={{ ...s.body, margin: '0 0 1.25rem' }}>Indlæs en lokal feedback-JSON fra en tester. Siden er kun et reviewværktøj: den gemmer, sender eller ændrer intet.</p>
    <Card style={{ borderColor: color.accentBorder }}>
      <Meta style={{ color: color.accent, marginBottom: '0.45rem' }}>PILOTREGEL</Meta>
      <p style={{ ...s.body, color: color.text, margin: 0 }}>En blokering stopper udvidelse. Friktion vurderes før næste lille testgruppe. Idéer tæller ikke som fejl alene.</p>
    </Card>
    <label style={{ display: 'block', margin: '1rem 0' }}><Meta>Indlæs eksporteret JSON</Meta><input aria-label="Indlæs feedbackfil" type="file" accept="application/json,.json" onChange={selectFile} style={{ display: 'block', width: '100%', marginTop: '0.5rem', color: color.text }} /></label>
    <textarea aria-label="Feedback JSON" value={raw} onChange={event => { setRaw(event.target.value); setResult(null) }} placeholder="Indsæt eksporten her eller vælg en .json-fil" style={{ width: '100%', minHeight: '180px', boxSizing: 'border-box', resize: 'vertical', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.text, padding: '0.8rem', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.72rem', lineHeight: 1.45 }} />
    <div style={{ display: 'grid', gap: '0.55rem', marginTop: '0.75rem' }}><Button onClick={review}>Gennemgå feedback</Button><Button variant="ghost" onClick={loadExample}>Indlæs sikkert eksempel</Button></div>
    {message && <p style={{ ...s.body, color: '#d68170', marginTop: '0.9rem' }}>{message}</p>}
    {result && <section aria-live="polite" style={{ marginTop: '2rem' }}>
      <Label>Beslutningsgrundlag</Label><Card style={{ borderColor: result.recommendation.status === 'hold-pilot' ? '#d68170' : color.accentBorder }}><Meta style={{ color: result.recommendation.status === 'hold-pilot' ? '#d68170' : color.accent }}>ANBEFALING</Meta><h2 style={{ ...s.h2, marginTop: '0.35rem' }}>{result.recommendation.label}</h2><p style={{ ...s.body, marginBottom: 0 }}>{result.recommendation.rationale}</p></Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.55rem' }}>{[['Blokeringer', result.blockerCount], ['Friktion', result.frictionCount], ['Idéer', result.ideaCount]].map(([label, count]) => <Card key={label} style={{ padding: '0.75rem', marginBottom: 0 }}><Meta>{label}</Meta><div style={{ fontFamily: 'Georgia, serif', color: color.text, fontSize: '1.7rem', marginTop: '0.2rem' }}>{count}</div></Card>)}</div>
      <Card style={{ marginTop: '1rem' }}><Meta>Hvor rammer det mest?</Meta><p style={{ color: color.text, margin: '0.4rem 0 0' }}>{result.mostAffected.label}: {result.mostAffected.total} observation{result.mostAffected.total === 1 ? '' : 'er'}.</p></Card>
      {result.blockers.length > 0 && <Card><Meta style={{ color: '#d68170' }}>REPRODUCÉR FØRST</Meta>{result.blockers.map((item, index) => <div key={`${item.note}-${index}`} style={{ borderTop: index ? `1px solid ${color.line}` : 'none', padding: '0.65rem 0 0.1rem' }}><Meta>{item.stepLabel}</Meta><p style={{ ...s.body, color: color.text, margin: '0.35rem 0' }}>{item.note}</p></div>)}</Card>}
      <Card><Meta>Fordeling i rejsen</Meta>{result.byStep.map(row => <div key={row.step} style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${color.line}`, padding: '0.55rem 0', color: color.text }}><span>{row.label}</span><Meta>{row.total} · B {row.blockers} · F {row.friction} · I {row.ideas}</Meta></div>)}</Card>
    </section>}
  </main>
}
