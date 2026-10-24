export function coachTekstTree(h, forslag, scope) {
  if (!forslag.length) return null
  return h('section', { 'aria-label': 'Tekstforslag til atleten' },
    h('h4', { 'aria-level': 5 }, 'Kladder til atleten'),
    h('p', null, 'Vælg den relevante tekst og ret den her. Udfyld eventuelle pladsholdere. Intet sendes automatisk, og programmet ændres ikke. Kladderne gemmes ikke og forsvinder, når kortet lukkes.'),
    ...forslag.map(f => h('div', { key: `${scope}:${f.situation}` },
      h('label', null, f.navn,
        h('textarea', {
          'aria-label': `Kladde: ${f.navn}`,
          defaultValue: f.tekst,
          rows: 8,
          style: { display: 'block', width: '100%', boxSizing: 'border-box' },
        })),
      f.mangler.length ? h('p', null, `Skabelonens manglende oplysninger: ${f.mangler.join(', ')}. Ret dem i kladden.`) : null)))
}
