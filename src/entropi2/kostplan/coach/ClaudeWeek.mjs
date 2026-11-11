import * as React from 'react'
import { readClaudeWeek, sendClaudeWeek } from './claudeWeekModel.mjs'
import { button, primaryButton } from './formStyles.mjs'

// U10b: "Forslag fra Claude" øverst i coachens kostplan. Ét fokus: ugens 7 dage, ét
// statusmærke og én knap. Læser kun ved visning; kun "Send uge" skriver (godkendelser).
const h = React.createElement
const tal = value => value === null ? '–' : new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value)
const kortDato = date => new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  .format(new Date(`${date}T12:00:00Z`))
const maerke = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, border: '1px solid currentColor', fontSize: 14 }

export function statusText(week) {
  if (week.status === 'sendt') return `Sendt ${kortDato(week.sentOn)}`
  if (week.status === 'aendret') return 'Ændret efter sending'
  return 'Udkast fra Claude'
}

export function claudeWeekView(week, { onSend, onReload, sending = false, error = '' } = {}) {
  if (week.state === 'empty') return h('section', { 'data-claude-week': 'empty', style: { textAlign: 'left' } },
    h('h3', null, 'Forslag fra Claude'), h('p', null, 'Intet forslag endnu.'))
  const { kcal, protein } = week.targets
  return h('section', { 'data-claude-week': week.status, style: { textAlign: 'left', overflowWrap: 'anywhere' } },
    h('h3', { style: { marginBottom: 8 } }, 'Forslag fra Claude'),
    h('p', { style: { margin: '0 0 8px' } }, h('span', { role: 'status', 'data-status': week.status, style: maerke }, statusText(week))),
    week.rationale && h('p', { style: { margin: '0 0 12px' } }, week.rationale),
    h('p', { style: { margin: '0 0 8px', fontSize: 14 } }, `Mål ${tal(kcal)} kcal · ${tal(protein)} g protein · ugen slutter ${kortDato(week.end)}`),
    h('ul', { style: { listStyle: 'none', padding: 0, margin: 0 } }, ...week.days.map(d => h('li', { key: d.date, 'data-day': d.date,
      'data-meals': d.mealCount, style: { borderTop: '1px solid rgba(127,127,127,.3)' } },
      h('details', null,
        h('summary', { style: { minHeight: 44, padding: '10px 0', cursor: 'pointer' } },
          `${d.label} · ${tal(d.kcal)} kcal · ${tal(d.protein)} g protein `,
          h('span', { 'aria-label': d.ok ? 'inden for målet' : 'advarsel' }, d.ok ? '✓' : '⚠')),
        d.mealCount ? h('ul', { style: { paddingLeft: 18, margin: '0 0 10px' } }, ...d.meals.map((meal, i) => h('li', { key: i },
          h('strong', null, meal.name), ': ', meal.portions.map(p => `${p.name} ${tal(p.grams)} g`).join(', '))))
          : h('p', null, d.state === 'mangler' ? 'Ingen plan.' : d.unreadable ? 'Kan ikke læses.' : '0 måltider.'))))),
    week.status !== 'sendt' && h('div', { style: { marginTop: 12 } },
      week.lock && h('p', { 'data-lock': true, style: { margin: '0 0 8px' } }, week.lock),
      h('button', { type: 'button', style: { ...primaryButton, width: '100%' }, disabled: Boolean(week.lock) || sending,
        onClick: onSend }, sending ? 'Sender…' : 'Send uge til atleten')),
    error && h('p', { role: 'alert' }, error, onReload && ' ',
      onReload && h('button', { type: 'button', style: button, onClick: onReload }, 'Hent ugen igen')))
}

// Monteres kun med en eksplicit klient fra værten (coachens egen session).
export default function ClaudeWeek({ client, athlete, today }) {
  const [state, setState] = React.useState({ week: null, error: '', sending: false })
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let current = true
    readClaudeWeek({ client, athlete, today })
      .then(week => { if (current) setState({ week, error: '', sending: false }) },
        () => { if (current) setState({ week: null, error: 'Ugen fra Claude kunne ikke læses.', sending: false }) })
    return () => { current = false }
  }, [client, athlete?.id, athlete?.kcal_target, athlete?.protein_target, today, attempt])
  if (!state.week) return h('section', { 'data-claude-week': 'loading', style: { textAlign: 'left' } },
    h('h3', null, 'Forslag fra Claude'),
    state.error ? h('p', { role: 'alert' }, state.error, ' ',
      h('button', { type: 'button', style: button, onClick: () => setAttempt(n => n + 1) }, 'Prøv igen'))
      : h('p', { role: 'status' }, 'Henter ugen…'))
  return claudeWeekView(state.week, { sending: state.sending, error: state.error, onReload: () => setAttempt(n => n + 1), onSend: async () => {
    if (state.sending || state.week.lock) return
    setState(s => ({ ...s, sending: true, error: '' }))
    try {
      const { sent } = await sendClaudeWeek({ client, athlete, today, shown: state.week })
      setState({ week: sent, error: '', sending: false })
    } catch (error) {
      setState(s => ({ ...s, sending: false, error: error?.message || 'Ugen kunne ikke sendes. Prøv igen.' }))
    }
  } })
}
