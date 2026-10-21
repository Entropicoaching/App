// Pure element factory: React.createElement in the candidate, tiny DOM fake in tests.
export function renderBlokRoedTraad(h, model) {
  if (!model) return null
  const p = content => h('p', { style: { margin: '0.5rem 0', whiteSpace: 'pre-wrap' } }, content)
  return h('section', {
    'data-blok-roed-traad': '', 'aria-label': 'Blokkens røde tråd',
    style: { borderLeft: '2px solid #c8923a', paddingLeft: '0.75rem', marginBottom: '1.25rem',
      color: '#b8b4a8', fontSize: '0.85rem', lineHeight: 1.6, overflowWrap: 'anywhere', minWidth: 0 },
  },
  h('h2', { style: { fontSize: '1rem', color: '#edeae2', margin: 0 } },
    model.position != null ? `Uge ${model.position} af ${model.count} i blokken` : 'Blokkens røde tråd'),
  p(model.position != null
    ? 'Optalt blandt indlæste programuger. Den fulde bloklængde er ikke bekræftet.'
    : model.status === 'unnamed' ? 'Ugen har ingen angivet blok.'
      : 'Ugens placering i blokken kan ikke bestemmes sikkert.'),
  h('h3', { style: { fontSize: '0.85rem', marginBottom: 0 } }, 'Blokkens mål / gemte beskrivelse'),
  p(model.description ?? 'Der er ikke angivet en blokbeskrivelse for denne uge.'),
  p('Beskrivelsen vises ordret fra programmet.'),
  model.descriptionConflict ? p('Beskrivelsen varierer mellem blokkens uger. Her vises den valgte uges tekst.') : null,
  h('h3', { style: { fontSize: '0.85rem', marginBottom: 0 } }, 'Ugens løft i blokforløbet'),
  p('Planlagte sæt, reps, vægt og intensitet. Planen angiver ikke, hvilke løft der er tunge. Tallene er ikke gennemførte resultater.'),
  model.lifts.length === 0 ? p('Ingen løft er angivet for denne uge.') : null,
  ...model.lifts.map((lift, i) => h('details', { key: i, style: { margin: '0.75rem 0' } },
    h('summary', { style: { cursor: 'pointer', minHeight: '44px' } }, lift.name,
      ...lift.weeks.filter(w => w.selected).flatMap(w => w.entries.map((entry, j) =>
        h('div', { key: j }, `${entry.session ?? 'Pas'}: ${entry.prescription}`)))),
    p('Samme øvelsesnavn i blokkens indlæste uger. Forskelle viser planen; de forklarer ikke coachens hensigt.'),
    h('ul', { style: { paddingLeft: '1.25rem', margin: 0 } },
      ...lift.weeks.map((w, j) => h('li', { key: j, 'data-valgt-uge': w.selected ? 'ja' : undefined },
        `Programuge ${w.number ?? 'ukendt'}${w.selected ? ' (vist)' : ''}: `,
        w.entries.length ? w.entries.map(e => `${e.session ?? 'Pas'}: ${e.prescription}`).join(' / ')
          : 'Løftet er ikke angivet i denne uge.'))))),
  )
}
