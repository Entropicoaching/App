import * as React from 'react'
import { readPlanDayOverview, danishPlanDate } from './planDayOverviewModel.mjs'
import { button } from './formStyles.mjs'

const h = React.createElement
const status = {
  missing: 'Ingen lokal kladde gemt.',
  unreadable: 'Lokal kladde kunne ikke læses. Lagring kan være utilgængelig, eller kladden kan være ugyldig. Prøv at opdatere overblikket.',
  present: 'Lokal kladde gemt.',
  pending: 'Lokal kladde med afventende aktiveringsreservation. Kontrollér aktiveringen på datoen i Kostplan.',
}

// No mount/effect reads: only an explicit open or refresh inspects four known keys.
export default function PlanDayOverview(props = {}) {
  if (props.enabled !== true) return null
  return h(OverviewSession, props)
}

function OverviewSession(props) {
  const [opened, setOpened] = React.useState(false)
  const [rows, setRows] = React.useState(null)
  const current = React.useRef(false)
  const visible = React.useRef(false)
  const id = React.useId()
  const refresh = () => {
    if (!current.current || !visible.current) return
    setRows(readPlanDayOverview(props))
  }
  return React.createElement('section', { ref: node => { current.current = node !== null }, style: { marginTop: 16, textAlign: 'left', overflowWrap: 'anywhere' } },
    React.createElement('button', { type: 'button', style: button, 'aria-expanded': opened, 'aria-controls': id,
      onClick: () => {
        if (!current.current) return
        const next = !visible.current
        visible.current = next
        if (next) refresh()
        setOpened(next)
      } }, opened ? 'Skjul kladdeoverblik' : 'Vis kladder for fire dage'),
    opened && h('div', { id },
      h('h3', null, 'Lokale kladder · fire dage'),
      h('p', null, `Fra i dag, ${danishPlanDate(props.today)}. Valgt plandato: ${danishPlanDate(props.selectedDate)}.`),
      h('p', null, 'Viser senest læste, gemte kladder på denne enhed. Ugemte rettelser er ikke med. En lokal kladde bekræfter ikke en aktiv plan.'),
      React.createElement('button', { type: 'button', style: button, onClick: refresh }, 'Opdatér kladdeoverblik'),
      !rows && h('p', { role: 'alert' }, 'Kladdeoverblikket er ikke tilgængeligt for denne dato.'),
      rows && h('ul', { style: { paddingLeft: 20 } }, ...rows.map(row => h('li', { key: row.date, 'data-plan-day': row.date,
        'aria-current': row.date === props.selectedDate ? 'date' : undefined, style: { marginBottom: 16 } },
        h('strong', null, danishPlanDate(row.date)), row.date === props.selectedDate && ' · Valgt plandato',
        h('p', null, status[row.state]),
        row.mealCount !== undefined && h('p', null, `${row.mealCount} gemte måltider: ${row.mealNames.join(' · ')}`),
        h('p', null, 'Aktiv plan: ikke indlæst i overblikket.')))),
      rows?.every(row => row.state === 'missing') && h('p', { role: 'status' }, 'Ingen gemte lokale kladder i de fire dage. Fortsæt med den valgte dato i Kostplan og gem en kladde.'),
      h('p', null, 'Overblikket skifter ikke dato, så ugemte måltider, råd og afventende aktivering bevares. Brug Plandato i Kostplan, når du er klar til at skifte dato.'),
      React.createElement('button', { type: 'button', style: button, onClick: () => {
        if (current.current && visible.current) props.onContinue?.()
      } }, 'Fortsæt med valgt dato i Kostplan')))
}
