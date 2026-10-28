// APP-NYT1: tekst fra Marc. Claude erstatter disse pladsholdere.
export const nytIAppenText = Object.freeze({
  title: 'Nyt i appen',
  source: 'tekst fra Marc',
  close: 'Luk Nyt i appen',
  choose: 'Vælg atlet',
  empty: 'Ingen atleter at vælge endnu.',
  items: Object.freeze([
    { id: 'mobilitet', label: 'Mobilitet: tekst fra Marc', roles: ['athlete'] },
    { id: 'analyse', label: 'Analyse: tekst fra Marc', roles: ['coach'] },
    { id: 'tidsmarkeringer', label: 'Tidsmarkeringer: tekst fra Marc', roles: ['athlete', 'coach'] },
    { id: 'oprydning', label: 'Coachens oprydning: tekst fra Marc', roles: ['coach'] },
    { id: 'fremgang', label: 'Fremgang: tekst fra Marc', roles: ['athlete', 'coach'] },
  ]),
})
