// Kildebelagte intervaller til styrkeløftere i samme format som
// ../anbefalinger.mjs, så de kan bruges af vaeskeForslag og proteinForslag.
// Det videnskabelige kostbilag har forrang, når det kommer; indtil da er
// status 'kilder-uden-bilag'. Ingen tal uden kilde. Hvor kilden kun er set i
// abstract eller i en sekundær kilde, står det i kilden.
const JAEGER_2017 = 'Jäger R m.fl. ISSN Position Stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20. doi:10.1186/s12970-017-0177-8'
const MORTON_2018 = 'Morton RW m.fl. Protein supplementation and resistance training: meta-analysis. Br J Sports Med 2018;52(6):376-384. doi:10.1136/bjsports-2017-097608'
const SCHOENFELD_2018 = 'Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? J Int Soc Sports Nutr 2018;15:10. doi:10.1186/s12970-018-0215-1'
const IRAKI_2019 = 'Iraki J, Fitschen P, Espinar S, Helms E. Nutrition Recommendations for Bodybuilders in the Off-Season: A Narrative Review. Sports 2019;7(7):154. doi:10.3390/sports7070154'
const THOMAS_2016 = 'Thomas DT, Erdman KA, Burke LM. ACSM/AND/DC position: Nutrition and Athletic Performance. Med Sci Sports Exerc 2016;48(3):543-568. doi:10.1249/MSS.0000000000000852'
const KERKSICK_2017 = 'Kerksick CM m.fl. ISSN position stand: nutrient timing. J Int Soc Sports Nutr 2017;14:33. doi:10.1186/s12970-017-0189-4'
const EFSA_2010 = 'EFSA NDA Panel. Scientific Opinion on Dietary Reference Values for water. EFSA Journal 2010;8(3):1459. doi:10.2903/j.efsa.2010.1459'

export const KILDER = Object.freeze({ JAEGER_2017, MORTON_2018, SCHOENFELD_2018, IRAKI_2019, THOMAS_2016, KERKSICK_2017, EFSA_2010 })

export const STYRKE_ANBEFALINGER = Object.freeze({
  status: 'kilder-uden-bilag',
  protein: Object.freeze({
    gPrKgMin: 1.6, gPrKgMax: 2.2,
    kilde: `${MORTON_2018} (plateau ca. 1,62 g/kg, 95 % CI op til 2,2); ${IRAKI_2019} (1,6 til 2,2 g/kg i overskud)`,
  }),
  proteinPrMaaltid: Object.freeze({
    gPrKgMin: 0.4, gPrKgMax: 0.55, maaltiderMin: 4,
    kilde: `${SCHOENFELD_2018}; ${IRAKI_2019} (0,40 til 0,55 g/kg pr. måltid, 3 til 6 måltider)`,
  }),
  proteinFoerSoevn: Object.freeze({ gMin: 30, gMax: 40, kilde: `${JAEGER_2017}; ${KERKSICK_2017} (30 til 40 g kasein før søvn)` }),
  energi: Object.freeze({
    // Overskud i procent af vedligehold. Iraki: cirka 10 til 20 % og en
    // vægtøgning på cirka 0,25 til 0,5 % af kropsvægten om ugen for novice og
    // mellemniveau; erfarne løftere bør være mere forsigtige.
    bulk: Object.freeze({ procentMin: 10, procentMax: 20, vaegtProcentPrUgeMin: 0.25, vaegtProcentPrUgeMax: 0.5, kilde: IRAKI_2019 }),
    vedligehold: Object.freeze({ procentMin: 0, procentMax: 0, kilde: 'Definition: energiindtag lig med forbrug; justeres efter 7-dages vægtsnit' }),
    cut: Object.freeze({ procentMin: null, procentMax: null, kilde: null }),
  }),
  fedt: Object.freeze({ gPrKgMin: 0.5, gPrKgMax: 1.5, energiProcentMin: 20, energiProcentMax: 35,
    kilde: `${IRAKI_2019} (0,5 til 1,5 g/kg); ${THOMAS_2016} (20 til 35 % af energien)` }),
  kulhydrat: Object.freeze({ gPrKgMin: 3, gPrKgMax: 5,
    kilde: `${IRAKI_2019} (mindst 3 til 5 g/kg som resten af energien); ${THOMAS_2016} (3 til 5 g/kg ved let aktivitet, 5 til 7 ved cirka 1 times træning om dagen)` }),
  efterTraening: Object.freeze({ kilde: `${KERKSICK_2017} (protein af høj kvalitet fra lige efter til 2 timer efter træning; dagligt total og jævn fordeling vigtigst)` }),
  vaeske: Object.freeze({
    mlPrKg: null,
    // EFSA er samlet vand fra drikke og mad. Cirka 20 til 30 % kommer fra mad
    // (sekundær kilde, ikke bekræftet i selve EFSA-teksten).
    mlSamletMand: 2500, mlSamletKvinde: 2000,
    mlPrTraeningstime: 500, mlPrTraeningstimeMin: 400, mlPrTraeningstimeMax: 800,
    mlPrKgFoerTraeningMin: 5, mlPrKgFoerTraeningMax: 10,
    kilde: `${EFSA_2010} (2,5 L mænd, 2,0 L kvinder, samlet); ${THOMAS_2016} (0,4 til 0,8 L i timen under træning; 5 til 10 ml/kg 2 til 4 timer før)`,
  }),
})

const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0

// Drikkemål: EFSA-totalen minus cirka 20 % fra mad, plus træningstimer.
export function drikkeForslag({ koen, traeningstimer = 0 } = {}, a = STYRKE_ANBEFALINGER) {
  const samlet = koen === 'mand' ? a.vaeske.mlSamletMand : koen === 'kvinde' ? a.vaeske.mlSamletKvinde : null
  if (!positive(samlet)) return null
  const ekstra = positive(traeningstimer) ? a.vaeske.mlPrTraeningstime * traeningstimer : 0
  return { ml: Math.round((samlet * 0.8 + ekstra) / 100) * 100, kilde: a.vaeske.kilde }
}
