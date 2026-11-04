/**
 * Static Danish copy for the pinned tracking models. No signal detection,
 * athlete data, I/O, flag reads or screen integration. A lookup alone does not
 * mean that a signal is present. Callers must establish that separately.
 */
export const SIGNAL_EXPLANATIONS = Object.freeze([
  Object.freeze({
    key: 'belastningsspring',
    title: 'Ændret registreret belastning',
    explanation: 'Den registrerede tonnage afviger fra de seneste ugers niveau. Det kan være en stigning eller et fald.',
    dataBasis: 'Tonnage er kg gange gennemførte gentagelser. Summen for de seneste 7 dage sammenlignes med summen for 28 dage delt med 4. Forholdet er under 0,8 eller over 1,5. Hver af de fire 7-dagesperioder skal have målbare sæt, og sammenligningsgrundlaget skal være over nul.',
    conversation: 'Var ændringen planlagt, og er alle sæt registreret? Tal om, hvordan træningen opleves, før I eventuelt justerer planen.',
    caveat: 'Tonnage beskriver registreret træningsmængde og siger ikke i sig selv noget om skadesrisiko eller behov for en ændring.',
  }),
  Object.freeze({
    key: 'plateau',
    title: 'Ingen ny top i estimeret styrke',
    explanation: 'Der er ikke registreret en ny ugentlig top i e1RM for løftet i de tre uger efter den første sammenligningsuge.',
    dataBasis: 'e1RM er et estimat af vægten til én gentagelse ud fra vægt og gennemførte gentagelser. De bedste estimater for samme løft sammenlignes i de seneste fire afsluttede uger. Alle fire uger skal have data; den igangværende uge indgår ikke i signalet.',
    conversation: 'Var perioden planlagt uden nye toppe? Tal om mål, udførelse og oplevet fremgang, før I vurderer næste skridt.',
    caveat: 'En periode uden ny e1RM-top kan være forventet og udelukker ikke fremgang på andre områder.',
  }),
  Object.freeze({
    key: 'fald i e1RM',
    title: 'Lavere estimeret styrke',
    explanation: 'Det seneste ugentlige e1RM-estimat for løftet ligger mere end 5 % under den højeste ugetop i sammenligningen.',
    dataBasis: 'e1RM beregnes ud fra registreret vægt og gennemførte gentagelser. De seneste fire afsluttede uger for samme løft skal alle have data. Seneste ugetop sammenlignes med den højeste af de fire; den igangværende uge indgår ikke.',
    conversation: 'Var lavere vægte eller en anden udførelse planlagt? Gennemgå registreringerne og atletens oplevelse af perioden sammen.',
    caveat: 'Et lavere estimat er ikke en måling af mistet styrke og fastslår ikke årsagen til ændringen.',
  }),
  Object.freeze({
    key: 'lavt protein',
    title: 'Registreret protein under målet',
    explanation: 'Det registrerede protein ligger under 80 % af det aktuelle proteinmål på mindst fire af de seneste syv registrerede datoer.',
    dataBasis: 'Der kræves syv registrerede datoer med kendte måltidsværdier og et proteinmål over nul. Datoerne kan ligge spredt og før de viste fire uger. Uregistrerede dage tælles ikke som nul; sammenligningen bruger det aktuelle mål.',
    conversation: 'Er måltiderne registreret dækkende, og passer det aktuelle mål stadig til aftalen? Tal om, hvad der fungerer i hverdagen.',
    caveat: 'Registreringerne viser ikke nødvendigvis det samlede indtag og kan ikke fastslå proteinmangel.',
  }),
  Object.freeze({
    key: 'hurtig vægtændring',
    title: 'Vægtgennemsnittet ændrer sig',
    explanation: 'Det registrerede vægtgennemsnit har ændret sig mere end 1 % i samme retning i to på hinanden følgende ugesammenligninger.',
    dataBasis: 'Tre på hinanden følgende 7-dagesperioder sammenlignes. Hvert gennemsnit kræver mindst tre forskellige måledage. Hver ændring beregnes i forhold til den foregående periodes gennemsnit. Manglende dage udfyldes ikke.',
    conversation: 'Er vejningerne taget under sammenlignelige forhold, og var ændringen forventet? Tal om udviklingen i forhold til den aftalte plan.',
    caveat: 'Vægten kan svinge af flere grunde. Signalet beskriver registreret vægt og fastslår hverken årsag eller ændring i kropssammensætning.',
  }),
])

const byKey = new Map(SIGNAL_EXPLANATIONS.map(entry => [entry.key, entry]))

/** Exact keys only; absent, unsupported and non-string keys return null. */
export function getSignalExplanation(key) {
  return typeof key === 'string' ? byKey.get(key) ?? null : null
}
