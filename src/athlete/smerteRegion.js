const BEN = /squat|b[øo]j|\bben\b|benpres|lunge|split|\bleg\b|hack|step|calf|l[æa]g|hip ?thrust|bridge/i
const RYG_LOEFT = /d[øo]dl[øo]ft|deadlift|rdl|good ?morning|\brow\b|roning|hyperext|rygstr/i
const OVERKROP = /b[æa]nk|bench|press|pres\b|skulder|shoulder|dips|pull-?up|chin|curl|triceps|fly|lateral|push-?up|face ?pull|pulldown|r[æa]kk|row|roning/i
const GRUPPER = { ben: BEN, ryg: RYG_LOEFT, over: OVERKROP }
const REGION_GRUPPER = {
  'knæet': ['ben'], anklen: ['ben'], hoften: ['ben', 'ryg'], lysken: ['ben', 'ryg'],
  ryggen: ['ben', 'ryg'], skulderen: ['over'], albuen: ['over'], 'håndleddet': ['over'],
}

// Ordre 1509: hvilke loeft en smerte i en kropsdel standser. Delt af appen og coachens briefing.
export const OMFANG_TEKST = { ben: 'squat og benøvelser', ryg: 'dødløft og rygøvelser', over: 'bænk og overkrop' }

/** Hvad stoppet daekker, i klartekst til coachen. Uklar kropsdel: alle loeft. */
export function omfangTekst(kropsdele) {
  const grupper = new Set()
  for (const del of kropsdele || []) {
    const g = REGION_GRUPPER[del]
    if (!g) return 'alle løft'
    g.forEach(x => grupper.add(x))
  }
  return grupper.size ? [...grupper].map(g => OMFANG_TEKST[g]).join(', ') : 'alle løft'
}

/** Rammer en smerte i de naevnte kropsdele dette loeft? Uklar kropsdel eller uklassificeret loeft: ja (sikker side). */
export function ramtAfSmerte(kropsdele, oevelsesnavn) {
  if (!kropsdele?.length) return true
  const navn = String(oevelsesnavn || '')
  const klasse = Object.keys(GRUPPER).filter(g => GRUPPER[g].test(navn))
  if (!klasse.length) return true
  return kropsdele.some(del => {
    const grupper = REGION_GRUPPER[del]
    return !grupper || grupper.some(g => klasse.includes(g)) // nakken m.fl.: alle
  })
}

