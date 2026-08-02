import { useMemo, useState } from 'react'
import { color, s } from '../theme.js'
import { Button, Card, Label, Meta } from '../ui.jsx'

const checks = [
  ['start', 'Jeg kan starte uden at skulle forstå teknikken først.', 'Åbn kunderejsen og se om første handling er tydelig.'],
  ['choices', 'Mine valg føles forståelige og uden skjulte antagelser.', 'Vælg mål og løftvarianter. Programmet må hellere spørge end gætte.'],
  ['loads', 'Jeg forstår, hvilke belastninger jeg skal indtaste.', 'Brug realistiske arbejdsbelastninger — ikke estimerede 1RM-tal.'],
  ['session', 'Det er tydeligt, hvad der er et sæt, en øvelse og et afsluttet pas.', 'Log et par sæt. Prøv kun at springe over, hvis det er bevidst.'],
  ['week-two', 'Uge 2 føles som et synligt valg, ikke noget der ændres bag min ryg.', 'Se forslaget og vælg aktivt forslag eller uændret plan.'],
]

export default function PilotMobileChecklist() {
  const [done, setDone] = useState({})
  const completed = useMemo(() => checks.filter(([key]) => done[key]).length, [done])
  const allDone = completed === checks.length

  return <main style={s.page}>
    <Label>Lokal pilot · mobiltest</Label>
    <h1 style={s.h1}>Test for friktion — ikke for at være sød.</h1>
    <p style={{ ...s.body, margin: '0 0 1.25rem' }}>Brug denne korte liste, mens du gennemfører kunderejsen på telefonen. Den gemmer eller sender intet; fluebenene forsvinder ved genindlæsning.</p>

    <Card style={{ borderColor: color.accentBorder, marginBottom: '1.25rem' }}>
      <Meta style={{ color: color.accent, marginBottom: '0.45rem' }}>SÅDAN TESTER DU</Meta>
      <p style={{ ...s.body, margin: 0 }}>Gennemfør rejsen i dit eget tempo. Sæt kun flueben, når punktet føles klart. Hvis noget bremser dig, så stop og notér det som produktfeedback med det samme.</p>
    </Card>

    <div aria-label="Mobiltestens kontrolpunkter">
      {checks.map(([key, title, detail], index) => <label key={key} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: '0.8rem', alignItems: 'start', padding: '1rem 0', borderBottom: `1px solid ${color.line}` }}>
        <input
          type="checkbox"
          checked={Boolean(done[key])}
          onChange={event => setDone(current => ({ ...current, [key]: event.target.checked }))}
          style={{ width: '22px', height: '22px', margin: '0.15rem 0 0', accentColor: color.accent }}
        />
        <span>
          <strong style={{ display: 'block', color: color.text, fontSize: '1rem', lineHeight: 1.35 }}>{index + 1}. {title}</strong>
          <span style={{ display: 'block', color: color.muted, fontSize: '0.9rem', lineHeight: 1.45, marginTop: '0.25rem' }}>{detail}</span>
        </span>
      </label>)}
    </div>

    <Card style={{ marginTop: '1.5rem', background: allDone ? '#182016' : color.panel }} aria-live="polite">
      <Meta style={{ color: allDone ? '#b4d094' : color.accent, marginBottom: '0.45rem' }}>{completed}/{checks.length} KONTROLPUNKTER</Meta>
      <p style={{ ...s.body, margin: 0 }}>{allDone ? 'Grundforløbet er gennemført. Brug feedbackfladen til de konkrete steder, der stadig føltes uklare eller tunge.' : 'Du behøver ikke gøre alting perfekt. Målet er bare at opdage, hvor produktet beder for meget af brugeren.'}</p>
    </Card>

    <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.5rem' }}>
      <a href="customer-journey.html" style={{ textDecoration: 'none' }}><Button>Åbn kunderejsen</Button></a>
      <a href="pilot-feedback.html" style={{ textDecoration: 'none' }}><Button variant="soft">Notér konkret friktion</Button></a>
    </div>
    <p style={{ ...s.body, marginTop: '1rem', fontSize: '0.8rem' }}>Feedbacken er lokal JSON på din egen enhed. Indtast ikke navn, e-mail, helbredsoplysninger eller træningsdata i feedbackfeltet.</p>
  </main>
}
