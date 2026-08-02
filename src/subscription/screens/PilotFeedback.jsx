import { useMemo, useState } from 'react'
import { color, font, s } from '../theme.js'
import { Button, Card, ChoiceList, Label, Meta } from '../ui.jsx'
import { createPilotFeedbackExport, feedbackSeverities, feedbackSteps, validatePilotFeedback } from '../pilotFeedback.js'

const emptyDraft = { step: '', severity: '', note: '' }

function downloadJson(value) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `entropi-pilot-feedback-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export default function PilotFeedback() {
  const [draft, setDraft] = useState(emptyDraft)
  const [items, setItems] = useState([])
  const [attempted, setAttempted] = useState(false)
  const result = useMemo(() => validatePilotFeedback(draft), [draft])
  const errors = attempted && !result.ok ? result.errors : []

  const add = () => {
    setAttempted(true)
    if (!result.ok) return
    setItems(current => [...current, result.value])
    setDraft(emptyDraft)
    setAttempted(false)
  }
  const exportItems = () => {
    const result = createPilotFeedbackExport(items)
    if (result.ok) downloadJson(result.value)
  }

  return <main style={s.page}>
    <Label>Pilot · lokal feedback</Label>
    <h1 style={s.h1}>Hvad stod i vejen for et godt pas?</h1>
    <p style={{ ...s.body, margin: '0 0 1.5rem' }}>Vælg ét konkret sted og beskriv det, mens det stadig er friskt. Feedbacken bliver kun i denne browser, indtil du selv eksporterer en JSON-fil.</p>

    <Card style={{ borderColor: color.accentBorder }}>
      <Meta style={{ color: color.accent, marginBottom: '0.55rem' }}>AFGRÆNSNING</Meta>
      <p style={{ ...s.body, margin: 0 }}>Dette er produktfeedback — ikke medicinsk rådgivning eller træningsfeedback. Ved smerte, skade eller tvivl: stop og kontakt din coach eller sundhedsfaglig person.</p>
    </Card>

    <section aria-labelledby="feedback-step">
      <h2 id="feedback-step" style={{ ...s.h2, marginBottom: '0.8rem' }}>Hvor i forløbet?</h2>
      <ChoiceList options={feedbackSteps} value={draft.step} onChange={step => setDraft(current => ({ ...current, step }))} />
      {errors.some(error => error.field === 'step') && <Error>Vælg et trin.</Error>}
    </section>

    <section style={{ marginTop: '1.5rem' }} aria-labelledby="feedback-severity">
      <h2 id="feedback-severity" style={{ ...s.h2, marginBottom: '0.8rem' }}>Hvor meget fyldte det?</h2>
      <ChoiceList options={feedbackSeverities} value={draft.severity} onChange={severity => setDraft(current => ({ ...current, severity }))} />
      {errors.some(error => error.field === 'severity') && <Error>Vælg alvor.</Error>}
    </section>

    <section style={{ marginTop: '1.5rem' }} aria-labelledby="feedback-note">
      <h2 id="feedback-note" style={{ ...s.h2, marginBottom: '0.5rem' }}>Hvad skete der?</h2>
      <p style={{ ...s.body, marginTop: 0 }}>Beskriv gerne, hvad du forventede, hvad der faktisk skete, og hvad der ville have gjort det lettere.</p>
      <textarea id="feedback-note" value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="Fx: Jeg vidste ikke, om jeg havde gemt det sidste sæt …" maxLength={2000} style={{ width: '100%', minHeight: '130px', boxSizing: 'border-box', resize: 'vertical', background: color.panel, border: `1px solid ${color.lineStrong}`, color: color.text, padding: '0.85rem', fontFamily: font.sans, fontSize: '1rem', lineHeight: 1.5 }} />
      <Meta style={{ textAlign: 'right', marginTop: '0.3rem' }}>{draft.note.length}/2000</Meta>
      {errors.some(error => error.field === 'note') && <Error>Skriv mindst 8 tegn.</Error>}
    </section>

    <div style={{ marginTop: '1.5rem' }}><Button onClick={add}>Tilføj feedback</Button></div>

    {items.length > 0 && <section style={{ marginTop: '2.25rem' }} aria-live="polite">
      <Label>Klar til eksport · {items.length}</Label>
      {items.map((item, index) => <Card key={`${item.createdAt}-${index}`} style={{ padding: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.45rem' }}><Meta>{feedbackSteps.find(x => x.value === item.step)?.label}</Meta><Meta style={{ color: item.severity === 'blocking' ? '#d68170' : color.accent }}>{feedbackSeverities.find(x => x.value === item.severity)?.label}</Meta></div>
        <p style={{ margin: 0, color: color.text, fontSize: '0.9rem', lineHeight: 1.45 }}>{item.note}</p>
      </Card>)}
      <Button variant="soft" onClick={exportItems}>Eksportér valideret JSON</Button>
      <p style={{ ...s.body, marginTop: '0.8rem', fontSize: '0.8rem' }}>Eksporten downloader til din enhed. Den sender ingenting.</p>
    </section>}
  </main>
}

function Error({ children }) { return <p style={{ color: '#d68170', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{children}</p> }
