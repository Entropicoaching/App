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

// Uge 3 og 4 (ordre 96): 14 nye vinterretter, ingen gentaget fra uge 1 og 2.
// Lørdag og søndag har de retter, der tager længere tid.
export const AFTEN_UGE34 = Object.freeze([
  'hh-kyllingetagine', 'hh-bulgogi', 'hh-boller-i-karry', 'hh-laks-linser', 'hh-tunpasta', 'hh-burger-soede-kartofler', 'hh-gullasch',
  'hh-kalkunkeema', 'hh-fiskegryde', 'hh-svinekam-roedkaal', 'hh-risotto-kylling', 'hh-arroz-con-pollo', 'hh-biksemad', 'hh-groenlangkaal',
])
const FROKOST_UGE34 = [
  ['hh-rugbroed-tun-aeg', null, 'hh-wrap-kylling-hummus', null, 'hh-pastasalat-kylling', null, 'hh-rugbroed-makrel-aeg'],
  ['hh-rugbroed-makrel-aeg', null, 'hh-pastasalat-kylling', null, 'hh-wrap-kylling-hummus', null, 'hh-rugbroed-tun-aeg'],
]

// To uger fra start (en mandag). foerste er planens dagnummer minus 1, så
// morgenmad og mellemmåltider fortsætter rotationen fra de forrige uger.
function lavToUger(start, foerste, aften, frokostUger) {
  if (!(start instanceof Date) || start.getUTCDay() !== 1) throw new TypeError('Menuen starter en mandag')
  return Array.from({ length: 14 }, (_, k) => {
    const i = foerste + k
    const dato = new Date(start.getTime() + k * 86400000)
    const d = k % 7
    const frokostId = frokostUger[Math.floor(k / 7)][d]
    return Object.freeze({
      nr: i + 1, uge: Math.floor(i / 7) + 1, ugedag: UGEDAGE[d],
      dato: dato.toISOString().slice(0, 10),
      datoTekst: `${UGEDAGE[d]} ${dato.getUTCDate()}. ${MAANEDER[dato.getUTCMonth()]}`,
      rester: frokostId === null,
      dobbelt: [0, 2, 4].includes(d),
      menu: Object.freeze({
        morgenmad: d === 5 ? 'hh-proteinpandekager' : MORGEN[i % 3],
        frokost: frokostId ?? aften[k - 1],
        'foer-traening': FOER[i % 4],
        aftensmad: aften[k],
        aftensnack: SNACK[(i + 1) % 4],
      }),
    })
  })
}

// start: en mandag som Date (UTC-midnat).
export const lavMenu14 = start => lavToUger(start, 0, AFTEN_14, FROKOST_UGE)
// start: mandagen i uge 3 (dagen efter de første 14 dage).
export const lavMenuUge34 = start => lavToUger(start, 14, AFTEN_UGE34, FROKOST_UGE34)
