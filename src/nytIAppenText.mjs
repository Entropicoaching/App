// APP-NYT1: tekst i Marcs stemme.
export const nytIAppenText = Object.freeze({
  title: 'Nyt i appen',
  source: 'Kort om det nyeste i appen.',
  close: 'Luk Nyt i appen',
  choose: 'Vælg atlet',
  empty: 'Ingen atleter at vælge endnu.',
  items: Object.freeze([
    { id: 'mobilitet', label: 'Mobilitet: find øvelser til dit hovedløft og se dine hjemmeøvelser', roles: ['athlete'] },
    { id: 'analyse', label: 'Analyse: åbn en atlets analyse', roles: ['coach'] },
    { id: 'tidsmarkeringer', label: 'Tidsmarkeringer: find dem under teknik og analyse', roles: ['athlete', 'coach'] },
    { id: 'oprydning', label: 'Coachens oprydning: få styr på indbakken', roles: ['coach'] },
    { id: 'fremgang', label: 'Fremgang: se udviklingen, ikke kun nye rekorder', roles: ['athlete', 'coach'] },
  ]),
})
