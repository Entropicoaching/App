// Ordre 2019 (Marc 20. nov.: "husk jeg er pt den eneste træner"): åbnes Beskeder fra forsidens
// besked-række, rulles svarfeltet ind i synet, når tråden er tegnet. Intet fokus, så intet tastatur springer op.
// Anmodningen bortfalder af sig selv (10 s), så en tråd der aldrig bliver hentet, ikke ruller senere.
// (Oprydning ved afmontering må ikke nulstille: Reacts StrictMode afmonterer og monterer igen.)
// Dashboardets navigation skriver anmodningen under samme Symbol.for-nøgle uden at importere denne fil.
const NOEGLE = Symbol.for('hara.svarfeltRul')
const LEVETID_MS = 10000

export function bedOmSvarfeltRul(athleteId, nu = Date.now()) {
  if (athleteId) globalThis[NOEGLE] = { athleteId, til: nu + LEVETID_MS }; else delete globalThis[NOEGLE]
}
export function nulstilSvarfeltRul() { delete globalThis[NOEGLE] }
export function venterSvarfeltRul(athleteId, nu = Date.now()) {
  const ventende = globalThis[NOEGLE]
  return !!ventende && ventende.athleteId === athleteId && nu <= ventende.til
}

// Kald når fanen er tegnet. Returnerer en oprydning. Rulningen sker højst én gang pr. anmodning.
export function rulSvarfeltNaarKlar({ controller, athleteId, doc = globalThis.document }) {
  if (!venterSvarfeltRul(athleteId) || !controller?.subscribe || !doc) return () => {}
  let faerdig = false, afmeldt = null
  const afslut = () => { faerdig = true; afmeldt?.() }
  afmeldt = controller.subscribe(state => {
    if (faerdig || !state.available || !state.loaded || state.loading) return
    // Visningen abonnerer før os og har derfor allerede tegnet tråden.
    faerdig = true
    if (!venterSvarfeltRul(athleteId)) return
    nulstilSvarfeltRul()
    const felt = doc.querySelector('section[aria-label="Skriv en besked"]')
    felt?.scrollIntoView?.({ block: 'end', behavior: 'instant' })
    Promise.resolve().then(() => afmeldt?.())
  })
  if (faerdig) afmeldt?.()
  return afslut
}
