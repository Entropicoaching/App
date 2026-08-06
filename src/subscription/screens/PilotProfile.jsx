// Profilsiden i pilot-skallen. VISER, retter ikke.
//
// Marc savnede den 6. august mens han stod i appen. Indtil da kunne en bruger
// hverken se eller efterprøve de 1RM-tal som HVER eneste vægt i programmet
// regnes ud fra — de indtastes én gang under setup og forsvinder derefter.
//
// Den skriver intet, og det er ikke en hensigt men en test: profilen læser af
// `sub_members`, den tabel Mitchs kørende pilot henter sit program fra. Et skriv
// herfra ville være en produktionsændring, ikke en UI-ændring.
//
// Kan man ikke rette sine tal, skal siden sige det ærligt frem for at lade som
// om der er en vej. Derfor noten nederst.
import { color, font, s } from '../theme.js'
import { Button, Card, Label, Meta } from '../ui.jsx'
import { BASELINE_LIFTS } from '../baselineLoads.js'
import { LEVELS } from '../programs.js'
import { DAY_LABEL, EQUIPMENT_LABEL, SQUAT_STYLE_LABEL, DEADLIFT_STYLE_LABEL } from '../setupOptions.js'

const label = (kort, værdi, reserve = 'Ikke angivet') => kort[værdi] || reserve

function Række({ navn, værdi, fremhævet = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: '0.75rem', padding: '0.55rem 0', borderBottom: `1px solid ${color.line}` }}>
      <Meta>{navn}</Meta>
      <span style={{ fontSize: fremhævet ? '1.1rem' : '0.9rem', color: color.text,
        fontFamily: fremhævet ? font.display : undefined, textAlign: 'right' }}>{værdi}</span>
    </div>
  )
}

export default function PilotProfile({ member, program, sessions = [], onLogout }) {
  const gennemførte = sessions.filter(item => item.completedAt).length
  const niveau = LEVELS.find(l => l.id === member?.level)
  const baselines = member?.baselines || {}
  const harBaselines = BASELINE_LIFTS.some(lift => baselines[lift.id]?.weightKg)

  return (
    <div style={s.page}>
      <Label>Profil</Label>
      <h1 style={s.h1}>Dine tal</h1>

      <Card>
        <Label tone="muted">Dine løft</Label>
        {harBaselines
          ? BASELINE_LIFTS.map(lift => {
            const post = baselines[lift.id]
            const kg = post?.weightKg
            return <Række key={lift.id} fremhævet navn={lift.label}
              værdi={kg ? `${kg} kg` : 'Ikke angivet'} />
          })
          : <Meta style={{ display: 'block', padding: '0.55rem 0' }}>
            Du har ikke angivet dine løft endnu.
          </Meta>}
        <Meta style={{ display: 'block', marginTop: '0.8rem', color: color.dim }}>
          Vægtene i dine pas regnes ud fra de her tal. Er de sat for højt eller lavt,
          bliver hele programmet det også.
        </Meta>
      </Card>

      <Card>
        <Label tone="muted">Dit setup</Label>
        <Række navn="Niveau" værdi={niveau?.label || 'Ikke angivet'} />
        <Række navn="Træningsdage" værdi={label(DAY_LABEL, member?.days_per_week)} />
        <Række navn="Udstyr" værdi={label(EQUIPMENT_LABEL, member?.equipment)} />
        <Række navn="Squat" værdi={label(SQUAT_STYLE_LABEL, member?.squat_style)} />
        <Række navn="Dødløft" værdi={label(DEADLIFT_STYLE_LABEL, member?.deadlift_style)} />
      </Card>

      <Card>
        <Label tone="muted">Dit program</Label>
        <Række navn="Program" værdi={program?.name || 'Ikke tildelt endnu'} />
        <Række navn="Gennemførte pas" værdi={String(gennemførte)} />
      </Card>

      <Meta style={{ display: 'block', margin: '0.2rem 0 1.2rem', color: color.dim, textAlign: 'center' }}>
        Passer tallene ikke? Skriv til Marc — de kan ikke ændres her endnu.
      </Meta>

      <Button variant="ghost" onClick={onLogout}>Log ud</Button>
    </div>
  )
}
