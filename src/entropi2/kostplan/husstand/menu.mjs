// 14-dagesmenu for husstanden. Aftensmaden gentages ikke inden for de 14
// dage og skifter mellem køkkener. Aftensmaden mandag, onsdag og fredag laves
// dobbelt, så tirsdag, torsdag og lørdag har rester som frokost (madpakke).
// Morgenmad, mellemmåltider og madpakker roterer mellem mindst 3 varianter.
export const UGEDAGE = Object.freeze(['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'])
const MAANEDER = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']

const MORGEN = ['hh-havregroed-skyr', 'hh-aeg-rugbroed-skinke', 'hh-skyr-muesli-banan']
const FOER = ['hh-proteinmaelk-banan', 'hh-kakaomaelk-rugbroed', 'hh-skyr-honning-havre', 'hh-franskbroed-syltetoej-kvark']
const SNACK = ['hh-kvark-blaabaer-mandler', 'hh-skyr-muesli-hindbaer', 'hh-hytteost-knaekbroed', 'hh-graesk-yoghurt-valnoed']

export const AFTEN_14 = Object.freeze([
  'hh-bolognese', 'hh-thai-karry-kylling', 'hh-hakkeboef', 'hh-shawarma-bowl', 'hh-fajitas-okse', 'hh-ovnlaks', 'hh-chili-con-carne',
  'hh-moerbrad', 'hh-kylling-tikka', 'hh-pasta-kylling-champignon', 'hh-svinewok', 'hh-koefte-couscous', 'hh-teriyaki-laks', 'hh-torsk-rodfrugter',
])
// null betyder rester af gårsdagens aftensmad.
const FROKOST_UGE = [
  ['hh-wrap-kylling-hummus', null, 'hh-rugbroed-tun-aeg', null, 'hh-rugbroed-makrel-aeg', null, 'hh-pastasalat-kylling'],
  ['hh-pastasalat-kylling', null, 'hh-rugbroed-makrel-aeg', null, 'hh-rugbroed-tun-aeg', null, 'hh-wrap-kylling-hummus'],
]

// start: en mandag som Date (UTC-midnat).
export function lavMenu14(start) {
  if (!(start instanceof Date) || start.getUTCDay() !== 1) throw new TypeError('Menuen starter en mandag')
  return Array.from({ length: 14 }, (_, i) => {
    const dato = new Date(start.getTime() + i * 86400000)
    const uge = i < 7 ? 1 : 2
    const d = i % 7
    const frokostId = FROKOST_UGE[uge - 1][d]
    return Object.freeze({
      nr: i + 1, uge, ugedag: UGEDAGE[d],
      dato: dato.toISOString().slice(0, 10),
      datoTekst: `${UGEDAGE[d]} ${dato.getUTCDate()}. ${MAANEDER[dato.getUTCMonth()]}`,
      rester: frokostId === null,
      dobbelt: [0, 2, 4].includes(d),
      menu: Object.freeze({
        morgenmad: d === 5 ? 'hh-proteinpandekager' : MORGEN[i % 3],
        frokost: frokostId ?? AFTEN_14[i - 1],
        'foer-traening': FOER[i % 4],
        aftensmad: AFTEN_14[i],
        aftensnack: SNACK[(i + 1) % 4],
      }),
    })
  })
}
