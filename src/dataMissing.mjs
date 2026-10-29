import { hasEnoughData, dayNumber } from './dataEnough.mjs'

// Logging requirements, never inferred findings or instructions to report a low score.
// Failed read/plan/provenance gates require verification, not invented athlete data.
export const MISSING_REQUIREMENTS = Object.freeze({
  D02: 'Log fem komplette check-ins på forskellige dage i de foregående 14 dage med samme felter og samme søvngrundlag som dagens komplette check-in.',
  D04: 'Log to daterede check-ins med parathedsscore på forskellige dage med højst syv dage imellem.',
  D06: 'Log check-in på tre sammenhængende dage. En lav serie kræver tre entydige scorer under 50; angiv altid din faktiske parathed.',
  D07: 'Coachen skal dokumentere forbindelsen mellem et bestemt check-in og en bestemt beslutning. Datoernes rækkefølge dokumenterer ingen virkning.',
  D08: 'Log sammenlignelige træningssæt med eget RPE-valg og check-in på mindst 12 matchede dage over mindst 28 dage, med mindst seks forskellige dage i hvert af to parathedsbånd.',
  D09: 'Log søvn og træningsfeedback på mindst 12 parrede dage over mindst 28 dage, med mindst seks forskellige dage i hver af to søvngrupper.',
  D10: 'Angiv selv RPE mellem 0 og 10 for et sæt, så dit eget valg og dets oprindelse gemmes. Planlagt eller ukendt RPE tæller ikke.',
  D11: 'Log tre sammenlignelige tidligere pas inden for 28 dage med mindst to særskilte sæt med eget RPE-valg i hvert pas, samme løft, repzone og mål-RPE. Ved smerte gives intet vægtforslag.',
  D12: 'Log mindst 12 særskilte egne RPE-svar på mindst tre pas inden for 14 dage, med eget svar på mindst 80 procent af alle ikke oversprungne sæt.',
  D13: 'Log mindst fire sammenlignelige pas over mindst 14 dage, med tre særskilte egne RPE-svar i hvert pas og samme dokumenterede plan.',
  D14: 'Log mindst 12 særskilte egne RPE-svar på tre pas inden for 14 dage samt check-in på tre sammenhængende dage i samme periode. Et lavt signal kræver scorer under 60; log altid faktiske scorer.',
  D15: 'Afvent ugens afslutning og log mindst 12 særskilte egne RPE-svar på tre pas inden for syv dage, med eget svar på mindst 80 procent af alle ikke oversprungne sæt.',
  D16: 'Log 20 særskilte sæt med planlagt RPE og eget RPE-valg på tre pas inden for 21 dage, heraf seks sæt på to pas for det valgte løft. Ved modstrid kræves også check-ins på tre forskellige dage.',
  D18: 'Log tunge sæt på fire forskellige sammenlignelige dage over mindst 21 dage med samme løft og repzone, gyldig estimeret 1RM og bekræftet kvalifikation.',
  D19: 'Log træning i fire forskellige afsluttede kalenderuger og få bekræftet fuld læsedækning og kvalificeret løftegrundlag.',
  D21: 'Log tunge sæt på fire forskellige sammenlignelige dage over mindst 21 dage med samme løft og repzone, gyldig estimeret 1RM og bekræftet kvalifikation.',
  D22: 'Log tunge sæt på fire forskellige sammenlignelige dage over mindst 21 dage med samme løft og repzone, gyldig estimeret 1RM og bekræftet kvalifikation.',
  D25: 'Log kvalificerede tunge sæt på tre forskellige dage i de seneste 28 dage og tre forskellige dage i perioden 28 til 84 dage før, med samme løft og repzone.',
  D26: 'Dokumentér kvalificeret træning uden deload i fire trænede uger, heraf tre efter toppen, og en seneste observation højst 14 dage gammel.',
  D27: 'Dokumentér kvalificeret træning uden deload i fire trænede uger, tre uger efter toppen og en observation højst 14 dage gammel. Fald kræver seks sammenhængende observerede uger.',
  D33: 'Log mindst ét pas i hver af fire forskellige afsluttede daterede uger og få bekræftet fuld læsedækning i hver uge.',
  D35: 'Coachen skal bekræfte sammenlignelig plan, kortlægning og fuld logdækning i en afsluttet dateret uge, eller fire uger ved trend. Nul pas må kun bruges ved bekræftet dækning.',
  D37: 'Coachen skal bekræfte mindst ét planlagt sæt, samme planperiode og fuld læsedækning i en afsluttet dateret uge.',
  D38: 'Log alle planlagte sætpositioner i passet. Coachen skal bekræfte mindst ét planlagt sæt, alle øvelser og komplet læsning.',
  D39: 'Coachen skal bekræfte mindst ét planlagt sæt, samme planperiode og fuld læsedækning i en afsluttet dateret uge.',
  D40: 'Coachen skal bekræfte komplet læsning, kendt plan og afsluttet periode. Ved frafald kræves fire historiske uger, 30 komplette nyere dage og kendt kontekst.',
  D41: 'Coachen skal bekræfte en fuld planuge, mindst ét gennemført pas, mindst én atletstemme, ingen åbne punkter og alle kilder.',
  D46: 'Log vejning på tre forskellige dage i hver af de to seneste afsluttede syvdagesperioder, dag 1 til 7 og dag 8 til 14 før i dag. Dagens vejning tæller ikke.',
  D47: 'Log vejning på tre forskellige dage i hver af de to seneste afsluttede syvdagesperioder, dag 1 til 7 og dag 8 til 14 før i dag. Dagens vejning tæller ikke.',
  D48: 'Bekræft mindst 21 komplette kostdage inden for 28 dage. Log mindst seks vejninger over mindst 21 dage på komplette kostdage, heraf tre i første og tre i sidste syvdagesende.',
  D56: 'Upload et målegrundlag med mindst tre gyldige reps. Coachen skal bekræfte kvalitet, kendte faser, kalibrering og målegrundlag; fortolkning kræver Marcs review.',
  D59: 'Gem fem godkendte referenceanalyser med særskilte id på mindst tre dage for samme atlet, variation, måling, metode og version. Den aktuelle analyse tæller ikke som reference.',
  D69: 'Coachen skal dokumentere dateret planreference og beregningsmotorens opfyldte minimum. Historisk retning kræver mindst tre sammenlignelige pas.',
  D76: 'Opdatér alle relevante kilder fejlfrit. Coachen skal bekræfte alle kilder, ingen åbne punkter og en gyldig opdateringsdato.',
})

export function missingRequirement(id, evidence = {}) {
  if (!Object.hasOwn(MISSING_REQUIREMENTS, id) || hasEnoughData(id, evidence)) return ''
  if (['D18', 'D21', 'D22'].includes(id)) {
    const rows = evidence?.rows
    if (Array.isArray(rows) && rows.length && rows.every(r => r?.qualified === true &&
      Number.isFinite(r.e1rm) && r.e1rm > 0 && r.lift && r.repZone != null && dayNumber(r.date ?? r.logged_date ?? r.logged_at ?? r.dag) !== null) &&
      new Set(rows.map(r => r.lift + '|' + r.repZone)).size === 1) {
      const days = new Set(rows.map(r => dayNumber(r.date ?? r.logged_date ?? r.logged_at ?? r.dag))).size
      if (days < 4) return `Der mangler tunge sæt på ${4 - days} forskellige dage mere for ${rows[0].lift}. ${MISSING_REQUIREMENTS[id]}`
    }
  }
  return MISSING_REQUIREMENTS[id]
}
