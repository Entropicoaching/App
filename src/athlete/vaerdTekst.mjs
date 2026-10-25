// APP-VAERD2: kun visningstekster, ingen data eller skrivehandlinger.
export const vaerdTekst = Object.freeze({
  coach: 'Fra din coach',
  app: 'Appens forslag',
  note: 'Fx squat, sæt 3: ryggen blev stram på sidste rep',
  foersteSaet: 'Første sæt · se hvad du skal løfte',
  kost: 'Registreret i dag',
})

export function ventendeSaetTekst(count) {
  return `☁ ${count} sæt gemt lokalt på denne telefon. Coachen har ikke modtaget dem endnu. Sendes når forbindelsen er tilbage.`
}
