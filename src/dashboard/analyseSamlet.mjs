export const DEFAULT_ANALYSE_SAMLET = false

// Explicit opt-in, no persistence and no athlete data.
export function analyseSamletEnabled(search = '') {
  const values = new URLSearchParams(search).getAll('analyseSamlet')
  return values.length === 1 && values[0] === '1'
}

export const analyseDemo = Object.freeze([
  Object.freeze({ id: 'demo-squat-2', lift: 'squat', label: 'Squat', variation: 'Konkurrence', date: '2026-10-23', status: 'Godkendt', kg: 120, reps: 3, velocity: 0.48, baseline: 0.46, baselineCount: 5, note: 'Sammenlign med sidste squat fra samme vinkel.' }),
  Object.freeze({ id: 'demo-squat-1', lift: 'squat', label: 'Squat', variation: 'Konkurrence', date: '2026-10-16', status: 'Godkendt', kg: 120, reps: 3, velocity: 0.45, baseline: null, baselineCount: 4, note: 'Afvent flere godkendte analyser.' }),
  Object.freeze({ id: 'demo-bench-1', lift: 'bench', label: 'Bænkpres', variation: 'Med pause', date: '2026-10-22', status: 'Kladde', kg: 80, reps: 4, velocity: null, baseline: null, baselineCount: 0, note: 'Kontrollér klippet før godkendelse.' }),
])

export function analyseDemoSelection(lift, selectedId) {
  const history = analyseDemo.filter(row => row.lift === lift)
  return { history, selected: history.find(row => row.id === selectedId) || history[0] || null }
}
const decimal = value => value === null ? 'Ikke målt' : value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// All five sections share a single selected synthetic analysis. No live callbacks.
export function renderAnalyseSamlet(h, { lift, selectedId, chooseLift, chooseAnalysis }) {
  const { history, selected } = analyseDemoSelection(lift, selectedId)
  const buttonStyle = { minHeight: 44, padding: '0.6rem 0.8rem', color: 'inherit', background: '#292923', border: '1px solid #827969', cursor: 'pointer' }
  const section = (title, ...children) => h('section', { 'aria-label': title, style: { minWidth: 0, padding: '1rem', border: '1px solid #645f52', borderRadius: 8 } }, h('h3', null, title), ...children)
  return h('section', { 'aria-label': 'Samlet analyseprototype', style: { padding: '1rem', marginBottom: '1.5rem', background: '#1c1c18', color: '#edeae2', border: '2px solid #c8923a', borderRadius: 8 } },
    h('h2', null, 'Coachens analyse samlet'),
    h('p', { role: 'note' }, 'Prototype med syntetiske data. Eksempelatlet Demo. Ingen rigtig video, AI-kørsel eller gemning.'),
    h('label', null, 'Løft ', h('select', { value: lift, style: { ...buttonStyle, maxWidth: '100%' }, onChange: event => chooseLift(event.target.value) },
      ...[['squat', 'Squat'], ['bench', 'Bænkpres'], ['deadlift', 'Dødløft']].map(([value, label]) => h('option', { key: value, value }, label)))),
    h('p', { role: 'status', 'aria-live': 'polite' }, selected ? `${selected.label} · ${selected.variation} · ${selected.date} · ${selected.kg} kg × ${selected.reps} · ${selected.status}` : 'Ingen analyser for dette løft.'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' } },
      section('Videoanalyse', selected ? h('div', null,
        h('p', null, `Syntetisk klip: ${selected.id}`),
        h('p', null, selected.note),
        h('p', null, 'Plads til klip og coachens gennemgang. Videoafspilning og godkendelse tilsluttes først efter beslutning.')) : h('p', null, 'Intet klip valgt.')),
      section('AI-rapport', selected ? h('div', null,
        h('p', null, 'Syntetisk rapportudkast for den valgte analyse. Ingen automatisk vurdering.'),
        h('p', null, `${selected.label}, ${selected.date}: ${selected.kg} kg, ${selected.reps} gentagelser. Status: ${selected.status}.`),
        h('p', null, selected.note)) : h('p', null, 'Rapport kræver en analyse.')),
      section('Historik', history.length ? h('ul', { style: { paddingLeft: '1.2rem' } }, ...history.map(row => h('li', { key: row.id, style: { marginBottom: 8 } },
        h('button', { type: 'button', style: buttonStyle, 'aria-pressed': selected.id === row.id, onClick: () => chooseAnalysis(row.id) }, `${row.date} · ${row.label} · ${row.status}`)))) : h('p', null, 'Ingen historik endnu.')),
      section('Baseline', selected ? h('div', null,
        h('p', null, `${selected.label} · ${selected.variation}. Syntetisk profil på analysedatoen: ${selected.baselineCount} godkendte analyser.`),
        h('p', null, selected.baselineCount >= 5 && selected.baseline !== null ? `Eksempelbaseline: ${decimal(selected.baseline)} m/s. Kun samme løft og variation.` : 'Utilstrækkeligt grundlag. Ingen sammenligning med baseline.')) : h('p', null, 'Ingen baseline for dette løft.')),
      section('Målinger', selected ? h('div', null,
        h('dl', null, h('dt', null, 'Belastning'), h('dd', null, `${selected.kg} kg`), h('dt', null, 'Gentagelser'), h('dd', null, String(selected.reps)),
          h('dt', null, 'Gennemsnitlig løftehastighed'), h('dd', null, selected.velocity === null ? 'Ikke målt' : `${decimal(selected.velocity)} m/s`)),
        h('p', null, 'Illustrative tal. Målemetode og sikkerhed skal fremgå ved tilslutning af rigtige målinger.')) : h('p', null, 'Ingen målinger endnu.'))))
}
