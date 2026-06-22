import { useState, useEffect, useRef, Fragment } from 'react'
import { supabase, withRetry } from './supabase'

const BLOCK_PALETTE = ['#4e8fcf','#c8923a','#6cba6c','#9b6bd4','#cf6b4e','#4ec8b4']
function blockColor(name) {
  if (!name) return '#4a4844'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return BLOCK_PALETTE[h % BLOCK_PALETTE.length]
}
function computePhases(weeks) {
  if (!weeks.length) return []
  const phases = []
  let cur = { name: weeks[0].block_name || null, weeks: [weeks[0]] }
  for (let i = 1; i < weeks.length; i++) {
    const n = weeks[i].block_name || null
    if (n === cur.name) cur.weeks.push(weeks[i])
    else { phases.push(cur); cur = { name: n, weeks: [weeks[i]] } }
  }
  phases.push(cur)
  return phases
}

// Den "aktive" uge atleten lander på.
// 1) Foretræk en dateret uge hvis 7-dages-spænd indeholder i dag (den uge man
//    reelt træner i nu) — så man ikke hopper forbi til et højere ugenummer uden dato.
// 2) Ellers: seneste ikke-fremtidige uge (uger uden start_date tæller som tilgængelige,
//    fremtidige datoer udelukkes, så man ikke lander på en tom planlagt uge).
function computeActiveWeekIdx(weeks) {
  if (!weeks || !weeks.length) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dayMs = 86400000
  let containing = -1
  weeks.forEach((w, i) => {
    if (!w.start_date) return
    const d = new Date(w.start_date)
    d.setHours(0, 0, 0, 0)
    if (d <= today && today < new Date(d.getTime() + 7 * dayMs)) containing = i
  })
  if (containing >= 0) return containing
  let active = -1
  weeks.forEach((w, i) => {
    let isFuture = false
    if (w.start_date) {
      const d = new Date(w.start_date)
      d.setHours(0, 0, 0, 0)
      isFuture = d > today
    }
    if (!isFuture) active = i
  })
  return active >= 0 ? active : 0
}

// Udled en uges startdato fra den tidligste daterede uge (anker + 7 dage pr.
// uge), så selv delvist daterede atleter får et datointerval på hver uge —
// samme princip som coach-kalenderen, så datoerne er konsistente på tværs af
// appen. Returnerer null hvis ingen uge har en dato.
function weekStartDate(weeks, weekNumber) {
  if (!weeks?.length) return null
  const anchor = [...weeks].sort((a, b) => a.week_number - b.week_number).find(w => w.start_date)
  if (!anchor) return null
  return new Date(new Date(anchor.start_date + 'T12:00:00').getTime() + (weekNumber - anchor.week_number) * 7 * 86400000)
}
function fmtWeekRange(start) {
  if (!start) return null
  const end = new Date(start.getTime() + 6 * 86400000)
  const f = (d) => d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
  return `${f(start)} – ${f(end)}`
}
// Valgfri fast ugedag pr. session (0=mandag .. 6=søndag). null = ingen fast dag.
const WEEKDAYS_LONG = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

const LOCAL_FOODS = [
  // Mejeri
  { name: 'Mælk minimælk', kcal100: 42, protein100: 3, carb100: 5, fat100: 1 },
  { name: 'Mælk letmælk', kcal100: 47, protein100: 3, carb100: 5, fat100: 2 },
  { name: 'Mælk sødmælk', kcal100: 61, protein100: 3, carb100: 5, fat100: 4 },
  { name: 'Havremælk', kcal100: 45, protein100: 1, carb100: 7, fat100: 2 },
  { name: 'Sojamælk', kcal100: 33, protein100: 3, carb100: 1, fat100: 2 },
  { name: 'Skyr naturel', kcal100: 63, protein100: 11, carb100: 4, fat100: 0 },
  { name: 'Skyr vanilje', kcal100: 75, protein100: 8, carb100: 10, fat100: 0 },
  { name: 'Græsk yoghurt 0%', kcal100: 57, protein100: 10, carb100: 4, fat100: 0 },
  { name: 'Græsk yoghurt 2%', kcal100: 73, protein100: 10, carb100: 4, fat100: 2 },
  { name: 'Yoghurt naturel', kcal100: 61, protein100: 4, carb100: 5, fat100: 3 },
  { name: 'A38', kcal100: 45, protein100: 4, carb100: 5, fat100: 1 },
  { name: 'Kvark naturel', kcal100: 67, protein100: 12, carb100: 4, fat100: 1 },
  { name: 'Cottage cheese', kcal100: 98, protein100: 11, carb100: 3, fat100: 4 },
  { name: 'Hytteost', kcal100: 98, protein100: 11, carb100: 3, fat100: 4 },
  { name: 'Ost 45+', kcal100: 358, protein100: 26, carb100: 0, fat100: 28 },
  { name: 'Ost 30+', kcal100: 295, protein100: 28, carb100: 0, fat100: 20 },
  { name: 'Mozzarella', kcal100: 280, protein100: 18, carb100: 2, fat100: 22 },
  { name: 'Feta', kcal100: 264, protein100: 14, carb100: 4, fat100: 22 },
  { name: 'Parmesan', kcal100: 431, protein100: 38, carb100: 3, fat100: 29 },
  { name: 'Flødeost', kcal100: 250, protein100: 7, carb100: 3, fat100: 24 },
  { name: 'Cremefraiche 9%', kcal100: 118, protein100: 3, carb100: 4, fat100: 9 },
  { name: 'Cremefraiche 18%', kcal100: 180, protein100: 3, carb100: 4, fat100: 18 },
  { name: 'Piskefløde', kcal100: 357, protein100: 2, carb100: 3, fat100: 38 },
  { name: 'Smør', kcal100: 717, protein100: 1, carb100: 1, fat100: 81 },
  { name: 'Kakaomælk', kcal100: 70, protein100: 3, carb100: 12, fat100: 1 },
  // Æg
  { name: 'Æg helt', kcal100: 143, protein100: 13, carb100: 1, fat100: 10 },
  { name: 'Æggehvide', kcal100: 52, protein100: 11, carb100: 1, fat100: 0 },
  { name: 'Æggeblomme', kcal100: 322, protein100: 16, carb100: 1, fat100: 28 },
  // Kød
  { name: 'Kyllingebryst', kcal100: 110, protein100: 23, carb100: 0, fat100: 2 },
  { name: 'Kyllingelår u/skind', kcal100: 150, protein100: 19, carb100: 0, fat100: 8 },
  { name: 'Kyllingelår m/skind', kcal100: 177, protein100: 18, carb100: 0, fat100: 12 },
  { name: 'Kylling hel', kcal100: 155, protein100: 18, carb100: 0, fat100: 9 },
  { name: 'Kalkun', kcal100: 135, protein100: 22, carb100: 0, fat100: 5 },
  { name: 'Hakket oksekød 8%', kcal100: 172, protein100: 20, carb100: 0, fat100: 10 },
  { name: 'Hakket oksekød 15%', kcal100: 215, protein100: 18, carb100: 0, fat100: 16 },
  { name: 'Hakket oksekød 20%', kcal100: 250, protein100: 17, carb100: 0, fat100: 20 },
  { name: 'Bøf/oksefilet', kcal100: 150, protein100: 22, carb100: 0, fat100: 7 },
  { name: 'Oksemørbrad', kcal100: 158, protein100: 26, carb100: 0, fat100: 6 },
  { name: 'Hakket svinekød', kcal100: 195, protein100: 17, carb100: 0, fat100: 14 },
  { name: 'Svinekam', kcal100: 135, protein100: 22, carb100: 0, fat100: 5 },
  { name: 'Nakkefilet svin', kcal100: 220, protein100: 18, carb100: 0, fat100: 16 },
  { name: 'Svinekød mørbrad', kcal100: 121, protein100: 22, carb100: 0, fat100: 4 },
  { name: 'Lammekød', kcal100: 212, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Bacon', kcal100: 417, protein100: 13, carb100: 1, fat100: 42 },
  { name: 'Skinke mager', kcal100: 107, protein100: 18, carb100: 1, fat100: 3 },
  { name: 'Leverpostej', kcal100: 281, protein100: 10, carb100: 5, fat100: 25 },
  { name: 'Medisterpølse', kcal100: 336, protein100: 13, carb100: 3, fat100: 30 },
  { name: 'Pølse grillpølse', kcal100: 290, protein100: 11, carb100: 3, fat100: 26 },
  { name: 'Pølse wienerpølse', kcal100: 270, protein100: 11, carb100: 2, fat100: 24 },
  // Fisk og skaldyr
  { name: 'Laks fersk', kcal100: 206, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Laks røget', kcal100: 185, protein100: 23, carb100: 0, fat100: 10 },
  { name: 'Tun i vand', kcal100: 103, protein100: 23, carb100: 0, fat100: 1 },
  { name: 'Tun i olie', kcal100: 185, protein100: 22, carb100: 0, fat100: 10 },
  { name: 'Torsk', kcal100: 82, protein100: 18, carb100: 0, fat100: 1 },
  { name: 'Tilapia', kcal100: 96, protein100: 20, carb100: 0, fat100: 2 },
  { name: 'Rødspætte', kcal100: 91, protein100: 18, carb100: 0, fat100: 2 },
  { name: 'Hellefisk', kcal100: 116, protein100: 21, carb100: 0, fat100: 3 },
  { name: 'Makrel i tomat', kcal100: 170, protein100: 14, carb100: 4, fat100: 11 },
  { name: 'Makrel røget', kcal100: 305, protein100: 19, carb100: 0, fat100: 25 },
  { name: 'Sild marineret', kcal100: 190, protein100: 12, carb100: 5, fat100: 14 },
  { name: 'Sardiner i olie', kcal100: 208, protein100: 20, carb100: 0, fat100: 14 },
  { name: 'Rejer', kcal100: 85, protein100: 18, carb100: 1, fat100: 1 },
  { name: 'Blæksprutte', kcal100: 82, protein100: 15, carb100: 3, fat100: 1 },
  // Korn og brød
  { name: 'Havregryn', kcal100: 370, protein100: 13, carb100: 58, fat100: 7 },
  { name: 'Havregrød kogt', kcal100: 68, protein100: 2, carb100: 12, fat100: 1 },
  { name: 'Rugbrød', kcal100: 220, protein100: 8, carb100: 40, fat100: 3 },
  { name: 'Franskbrød', kcal100: 265, protein100: 9, carb100: 50, fat100: 3 },
  { name: 'Grovbrød', kcal100: 230, protein100: 9, carb100: 42, fat100: 3 },
  { name: 'Knækbrød', kcal100: 330, protein100: 10, carb100: 65, fat100: 4 },
  { name: 'Tortilla wrap', kcal100: 290, protein100: 8, carb100: 50, fat100: 6 },
  { name: 'Pasta tør', kcal100: 352, protein100: 13, carb100: 70, fat100: 2 },
  { name: 'Pasta kogt', kcal100: 131, protein100: 5, carb100: 25, fat100: 1 },
  { name: 'Fuldkornspasta kogt', kcal100: 124, protein100: 5, carb100: 25, fat100: 1 },
  { name: 'Ris tør', kcal100: 361, protein100: 7, carb100: 79, fat100: 1 },
  { name: 'Ris kogt', kcal100: 130, protein100: 3, carb100: 28, fat100: 0 },
  { name: 'Fuldkornsris kogt', kcal100: 140, protein100: 3, carb100: 29, fat100: 1 },
  { name: 'Brune ris kogte', kcal100: 111, protein100: 3, carb100: 23, fat100: 1 },
  { name: 'Quinoa kogt', kcal100: 120, protein100: 4, carb100: 21, fat100: 2 },
  { name: 'Bulgur kogt', kcal100: 83, protein100: 3, carb100: 19, fat100: 0 },
  { name: 'Couscous kogt', kcal100: 112, protein100: 4, carb100: 23, fat100: 0 },
  { name: 'Boghvede kogt', kcal100: 92, protein100: 3, carb100: 20, fat100: 1 },
  { name: 'Cornflakes', kcal100: 357, protein100: 7, carb100: 84, fat100: 1 },
  { name: 'Müsli uden sukker', kcal100: 350, protein100: 10, carb100: 58, fat100: 7 },
  { name: 'Müsli med sukker', kcal100: 380, protein100: 9, carb100: 68, fat100: 7 },
  { name: 'Hvedemel', kcal100: 341, protein100: 11, carb100: 72, fat100: 1 },
  { name: 'Speltmel', kcal100: 338, protein100: 14, carb100: 68, fat100: 2 },
  // Grøntsager
  { name: 'Kartofler kogte', kcal100: 87, protein100: 2, carb100: 19, fat100: 0 },
  { name: 'Søde kartofler', kcal100: 86, protein100: 2, carb100: 20, fat100: 0 },
  { name: 'Broccoli', kcal100: 34, protein100: 3, carb100: 7, fat100: 0 },
  { name: 'Blomkål', kcal100: 25, protein100: 2, carb100: 5, fat100: 0 },
  { name: 'Rosenkål', kcal100: 43, protein100: 3, carb100: 9, fat100: 0 },
  { name: 'Grønkål', kcal100: 49, protein100: 4, carb100: 9, fat100: 1 },
  { name: 'Spinat', kcal100: 23, protein100: 3, carb100: 4, fat100: 0 },
  { name: 'Rucola', kcal100: 25, protein100: 3, carb100: 4, fat100: 0 },
  { name: 'Salat iceberg', kcal100: 14, protein100: 1, carb100: 2, fat100: 0 },
  { name: 'Gulerod', kcal100: 41, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Tomat', kcal100: 18, protein100: 1, carb100: 4, fat100: 0 },
  { name: 'Agurk', kcal100: 12, protein100: 1, carb100: 2, fat100: 0 },
  { name: 'Peberfrugt rød', kcal100: 31, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Peberfrugt gul', kcal100: 27, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Løg', kcal100: 40, protein100: 1, carb100: 9, fat100: 0 },
  { name: 'Hvidløg', kcal100: 149, protein100: 6, carb100: 33, fat100: 0 },
  { name: 'Champignon', kcal100: 22, protein100: 3, carb100: 3, fat100: 0 },
  { name: 'Grønne bønner', kcal100: 31, protein100: 2, carb100: 7, fat100: 0 },
  { name: 'Ærter frosne', kcal100: 81, protein100: 5, carb100: 14, fat100: 0 },
  { name: 'Majs kogt', kcal100: 86, protein100: 3, carb100: 19, fat100: 1 },
  { name: 'Hvidkål', kcal100: 25, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Asparges', kcal100: 20, protein100: 2, carb100: 4, fat100: 0 },
  { name: 'Rødbede kogte', kcal100: 44, protein100: 2, carb100: 10, fat100: 0 },
  { name: 'Squash', kcal100: 17, protein100: 1, carb100: 3, fat100: 0 },
  { name: 'Aubergine', kcal100: 25, protein100: 1, carb100: 6, fat100: 0 },
  { name: 'Selleri', kcal100: 16, protein100: 1, carb100: 3, fat100: 0 },
  { name: 'Porre', kcal100: 31, protein100: 2, carb100: 7, fat100: 0 },
  { name: 'Avokado', kcal100: 160, protein100: 2, carb100: 9, fat100: 15 },
  { name: 'Kikærter kogte', kcal100: 164, protein100: 9, carb100: 27, fat100: 3 },
  { name: 'Linser kogte', kcal100: 116, protein100: 9, carb100: 20, fat100: 0 },
  { name: 'Bønner kidney', kcal100: 127, protein100: 9, carb100: 23, fat100: 0 },
  { name: 'Sorte bønner kogte', kcal100: 132, protein100: 9, carb100: 24, fat100: 0 },
  // Frugt
  { name: 'Banan', kcal100: 89, protein100: 1, carb100: 23, fat100: 0 },
  { name: 'Æble', kcal100: 52, protein100: 0, carb100: 14, fat100: 0 },
  { name: 'Appelsin', kcal100: 47, protein100: 1, carb100: 12, fat100: 0 },
  { name: 'Pære', kcal100: 57, protein100: 0, carb100: 15, fat100: 0 },
  { name: 'Drue', kcal100: 69, protein100: 1, carb100: 18, fat100: 0 },
  { name: 'Jordbær', kcal100: 32, protein100: 1, carb100: 8, fat100: 0 },
  { name: 'Blåbær', kcal100: 57, protein100: 1, carb100: 14, fat100: 0 },
  { name: 'Hindbær', kcal100: 52, protein100: 1, carb100: 12, fat100: 1 },
  { name: 'Kirsebær', kcal100: 63, protein100: 1, carb100: 16, fat100: 0 },
  { name: 'Mango', kcal100: 60, protein100: 1, carb100: 15, fat100: 0 },
  { name: 'Ananas', kcal100: 50, protein100: 1, carb100: 13, fat100: 0 },
  { name: 'Vandmelon', kcal100: 30, protein100: 1, carb100: 8, fat100: 0 },
  { name: 'Melon', kcal100: 36, protein100: 1, carb100: 9, fat100: 0 },
  { name: 'Kiwi', kcal100: 61, protein100: 1, carb100: 15, fat100: 1 },
  { name: 'Grapefrugt', kcal100: 42, protein100: 1, carb100: 11, fat100: 0 },
  { name: 'Fersken', kcal100: 39, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Blommer', kcal100: 46, protein100: 1, carb100: 11, fat100: 0 },
  // Nødder og frø
  { name: 'Mandler', kcal100: 579, protein100: 21, carb100: 22, fat100: 50 },
  { name: 'Valnødder', kcal100: 654, protein100: 15, carb100: 14, fat100: 65 },
  { name: 'Cashewnødder', kcal100: 553, protein100: 18, carb100: 30, fat100: 44 },
  { name: 'Pistacienødder', kcal100: 562, protein100: 20, carb100: 28, fat100: 45 },
  { name: 'Hasselnødder', kcal100: 628, protein100: 15, carb100: 17, fat100: 61 },
  { name: 'Peanuts', kcal100: 567, protein100: 26, carb100: 16, fat100: 49 },
  { name: 'Peanutbutter', kcal100: 588, protein100: 25, carb100: 20, fat100: 50 },
  { name: 'Mandelsmør', kcal100: 614, protein100: 21, carb100: 19, fat100: 56 },
  { name: 'Solsikkekerner', kcal100: 584, protein100: 21, carb100: 20, fat100: 51 },
  { name: 'Græskarkerner', kcal100: 559, protein100: 30, carb100: 11, fat100: 49 },
  { name: 'Chiafrø', kcal100: 486, protein100: 17, carb100: 42, fat100: 31 },
  { name: 'Hørfrø', kcal100: 534, protein100: 18, carb100: 29, fat100: 42 },
  { name: 'Sesamfrø', kcal100: 573, protein100: 17, carb100: 23, fat100: 50 },
  // Fedt og olier
  { name: 'Olivenolie', kcal100: 884, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Rapsolie', kcal100: 884, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Kokosolie', kcal100: 862, protein100: 0, carb100: 0, fat100: 100 },
  { name: 'Kokosmælk', kcal100: 230, protein100: 2, carb100: 6, fat100: 24 },
  // Protein og kosttilskud
  { name: 'Proteinpulver whey', kcal100: 380, protein100: 75, carb100: 8, fat100: 5 },
  { name: 'Proteinpulver kasein', kcal100: 370, protein100: 78, carb100: 6, fat100: 4 },
  { name: 'Planteprotein', kcal100: 370, protein100: 70, carb100: 10, fat100: 5 },
  { name: 'Proteinbar', kcal100: 350, protein100: 30, carb100: 35, fat100: 10 },
  { name: 'Proteinshake færdig', kcal100: 50, protein100: 6, carb100: 4, fat100: 1 },
  // Drikkevarer
  { name: 'Appelsinjuice', kcal100: 45, protein100: 1, carb100: 10, fat100: 0 },
  { name: 'Smoothie frugt', kcal100: 55, protein100: 1, carb100: 13, fat100: 0 },
  { name: 'Sportsdrik', kcal100: 25, protein100: 0, carb100: 6, fat100: 0 },
  // Saucer og tilbehør
  { name: 'Hummus', kcal100: 166, protein100: 8, carb100: 14, fat100: 10 },
  { name: 'Mayo', kcal100: 680, protein100: 1, carb100: 2, fat100: 75 },
  { name: 'Soja sauce', kcal100: 53, protein100: 8, carb100: 5, fat100: 0 },
  { name: 'Ketchup', kcal100: 100, protein100: 1, carb100: 24, fat100: 0 },
  { name: 'Honning', kcal100: 304, protein100: 0, carb100: 82, fat100: 0 },
  { name: 'Syltetøj', kcal100: 250, protein100: 0, carb100: 65, fat100: 0 },
  // Snacks og sødt
  { name: 'Havrebar', kcal100: 380, protein100: 8, carb100: 62, fat100: 12 },
  { name: 'Mørk chokolade 70%', kcal100: 546, protein100: 5, carb100: 46, fat100: 38 },
  { name: 'Mælkechokolade', kcal100: 535, protein100: 8, carb100: 57, fat100: 30 },
  { name: 'Hvid chokolade', kcal100: 539, protein100: 6, carb100: 60, fat100: 30 },
  { name: 'Nøddecreme (nutella)', kcal100: 539, protein100: 6, carb100: 58, fat100: 31 },
  { name: 'Riskager naturel', kcal100: 385, protein100: 8, carb100: 82, fat100: 3 },
  { name: 'Popcorn luftpoppet', kcal100: 375, protein100: 11, carb100: 74, fat100: 4 },
  { name: 'Chips', kcal100: 536, protein100: 7, carb100: 53, fat100: 34 },
  { name: 'Kiks/digestive', kcal100: 480, protein100: 7, carb100: 65, fat100: 21 },
  { name: 'Sukker', kcal100: 400, protein100: 0, carb100: 100, fat100: 0 },
  { name: 'Ahornsirup', kcal100: 260, protein100: 0, carb100: 67, fat100: 0 },
  // Planteprodukter
  { name: 'Tofu fast', kcal100: 76, protein100: 8, carb100: 2, fat100: 4 },
  { name: 'Tofu silke', kcal100: 55, protein100: 5, carb100: 2, fat100: 3 },
  { name: 'Edamame bønner', kcal100: 121, protein100: 11, carb100: 9, fat100: 5 },
  { name: 'Seitan', kcal100: 120, protein100: 25, carb100: 4, fat100: 2 },
  { name: 'Tempeh', kcal100: 193, protein100: 19, carb100: 9, fat100: 11 },
  // Færdigretter og street food
  { name: 'Kebabkød', kcal100: 220, protein100: 18, carb100: 2, fat100: 16 },
  { name: 'Falafel', kcal100: 333, protein100: 13, carb100: 32, fat100: 18 },
  { name: 'Pizza (gennemsnit)', kcal100: 266, protein100: 11, carb100: 33, fat100: 10 },
  // Tilbehør og krydderier
  { name: 'Sennep', kcal100: 60, protein100: 4, carb100: 6, fat100: 3 },
  { name: 'Remoulade', kcal100: 328, protein100: 1, carb100: 13, fat100: 30 },
  { name: 'Dressing let', kcal100: 90, protein100: 1, carb100: 12, fat100: 4 },
  { name: 'Dressing normal', kcal100: 330, protein100: 1, carb100: 8, fat100: 32 },
  { name: 'Pesto', kcal100: 430, protein100: 6, carb100: 7, fat100: 43 },
  { name: 'Tomatpuré', kcal100: 82, protein100: 4, carb100: 16, fat100: 0 },
  { name: 'Salsa', kcal100: 36, protein100: 2, carb100: 7, fat100: 0 },
  // Dansk klassisk tilbehør
  { name: 'Rødkål', kcal100: 92, protein100: 1, carb100: 22, fat100: 0 },
  { name: 'Agurkesalat', kcal100: 20, protein100: 1, carb100: 4, fat100: 0 },
  { name: 'Kartoffelmos', kcal100: 95, protein100: 2, carb100: 17, fat100: 3 },
  // Drikkevarer udvidet
  { name: 'Proteinmælk', kcal100: 42, protein100: 6, carb100: 3, fat100: 1 },
  { name: 'Kaffe sort', kcal100: 2, protein100: 0, carb100: 0, fat100: 0 },
  { name: 'Te uden sukker', kcal100: 1, protein100: 0, carb100: 0, fat100: 0 },
  { name: 'Cola', kcal100: 42, protein100: 0, carb100: 11, fat100: 0 },
  { name: 'Cola zero', kcal100: 0, protein100: 0, carb100: 0, fat100: 0 },
]

// Alternative portionsenheder for udvalgte fødevarer (ud over gram).
// grams = gennemsnitlig vægt af én enhed. Gør logging hurtigere — fx "2 stk" i
// stedet for at skulle gætte gram. Nøgle = fødevarens navn i LOCAL_FOODS.
const PORTION_UNITS = {
  'Æg helt': [{ label: 'stk', grams: 60 }],
  'Æggehvide': [{ label: 'stk', grams: 33 }],
  'Æggeblomme': [{ label: 'stk', grams: 17 }],
  'Kyllingebryst': [{ label: 'stk', grams: 150 }],
  'Banan': [{ label: 'stk', grams: 120 }],
  'Æble': [{ label: 'stk', grams: 180 }],
  'Appelsin': [{ label: 'stk', grams: 150 }],
  'Pære': [{ label: 'stk', grams: 170 }],
  'Rugbrød': [{ label: 'skive', grams: 35 }],
  'Knækbrød': [{ label: 'stk', grams: 10 }],
  'Gulerod': [{ label: 'stk', grams: 70 }],
  'Tomat': [{ label: 'stk', grams: 90 }],
  'Proteinbar': [{ label: 'stk', grams: 60 }],
  'Havregryn': [{ label: 'dl', grams: 35 }],
}

// Returnerer tilgængelige enheder for en fødevare. Gram er altid først (standard).
// Indbyggede fødevarer slår op i PORTION_UNITS; egne fødevarer kan have én
// brugerdefineret enhed via unit_label/unit_grams.
function unitsForFood(food) {
  const units = [{ label: 'g', grams: 1 }]
  if (!food) return units
  if (food.isCustom && food.unit_label && food.unit_grams > 0) {
    units.push({ label: food.unit_label, grams: Number(food.unit_grams) })
  } else if (PORTION_UNITS[food.name]) {
    units.push(...PORTION_UNITS[food.name])
  }
  return units
}

const WARMUP_BASE = {
  'Squat': [
    {
      slot: 'Hofte- og ankelmobilitet',
      options: [
        {
          id: 'sq-mob-1',
          name: 'Hoftecirkler',
          desc: 'Stå på ét ben og løft det andet knæ til hoftehøjde. Lav store, langsomme cirkler med hoften — udad og bagud. Åbner hofteleddet i alle retninger og forbereder den dybe squat.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-mob-2',
          name: 'Ankel-vægstræk',
          desc: 'Stå med tåen ca. 10 cm fra en væg og bøj knæet fremad, til det rører væggen — hælen skal blive i gulvet. Flyt tåen gradvist længere væk. Lader anklen bøje nok til at knæet kan vandre frem over tæerne — afgørende for din squat-dybde.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-mob-3',
          name: '90/90 hofterotation',
          desc: 'Sid på gulvet med det ene ben bøjet foran dig (90°) og det andet ud til siden (90°). Skub forsigtigt hoften frem mod det forreste ben og hold. Rammer både udad- og indadrotation i hoften — vigtigt for at komme dybt i squatten.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'sq-mob-4',
          name: 'Hoftebøjer-stræk mod væg',
          desc: 'Sæt det ene knæ mod en væg med skinnebenet op ad væggen, og sæt den anden fod fladt foran dig i et stort udfald. Hold ryggen rank og skub hoften frem, til du mærker stræk foran i hoften og låret. Løsner hoftebøjeren, der spænder op og trækker dig fremover under squat.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
      ],
    },
    {
      slot: 'Balle- og låraktivering',
      options: [
        {
          id: 'sq-akt-1',
          name: 'Hofteløft',
          desc: 'Lig på ryggen med bøjede knæ og fødderne fladt i gulvet. Skub hofterne op og klem ballerne hårdt i toppen — hold et sekund og sænk roligt. Aktiverer ballerne, der er den primære motor i squatten.',
          label: '15 reps',
          type: 'reps',
        },
        {
          id: 'sq-akt-2',
          name: 'Muslingen med elastik',
          desc: 'Lig på siden med et elastik om knæene, knæene bøjet ca. 45° og hælene samlet. Løft det øverste knæ som en musling der åbner sig — hold et sekund øverst. Aktiverer den mellemste ballemuskel, der holder knæene ude i squat.',
          label: '12 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-akt-3',
          name: 'Hofteløft på ét ben',
          desc: 'Lig på ryggen med det ene ben strakt og det andet bøjet med foden i gulvet. Skub hoften op og hold ryggen rank — undgå at dreje. Styrker ballerne ét ben ad gangen og afslører forskelle fra side til side.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'sq-akt-4',
          name: 'Knæpres udad mod væg',
          desc: 'Stå i en let squat med ryggen mod en væg. Pres begge knæ aktivt udad — som om du vil sprede gulvet under fødderne — og hold. Indøver det udadpres i knæene, der er afgørende i hele squatten.',
          label: '20 sek',
          type: 'timer',
          duration: 20,
        },
      ],
    },
    {
      slot: 'Squat-mønster',
      options: [
        {
          id: 'sq-mov-1',
          name: 'Squat uden vægt med pause',
          desc: 'Stå i skulderbredde. Sæt dig så dybt ned som muligt og hold 2-3 sekunder forneden — hælene skal blive i gulvet. Fokus på at åbne hofterne og holde brystet oppe.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'sq-mov-2',
          name: 'Squat til bænk',
          desc: 'Sæt en bænk bag dig i squathøjde. Sæt dig roligt ned, til du rører bænken let — hold et sekund og rejs dig. Hjælper dig med at ramme dybde og position uden at tænke over det.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'sq-mov-3',
          name: 'Squat med hælhøjning',
          desc: 'Sæt hælene på en vægtskive eller et sammenrullet håndklæde. Sæt dig dybt ned med rank ryg og knæene pegende over tæerne. Tager anklen ud af ligningen og giver dig adgang til dybde og position med det samme.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'sq-mov-4',
          name: 'Tempo-squat (3-0-1)',
          desc: 'Sæt dig ned over 3 sekunder, ingen pause forneden, rejs dig normalt. Hold fuldt styr på vej ned — undgå at "falde" de sidste centimeter. Bygger kontrol og kropsbevidsthed i hele bevægelsen.',
          label: '6 reps',
          type: 'reps',
        },
      ],
    },
  ],

  'Bænkpres': [
    {
      slot: 'Skulder- og brystmobilitet',
      options: [
        {
          id: 'bp-mob-1',
          name: 'Brystryg over skumrulle',
          desc: 'Læg en skumrulle på tværs under øvre ryg mellem skulderbladene. Læn forsigtigt bagover med hænderne bag nakken og åbn brystet mod loftet — flyt rullen et par centimeter op og gentag. Giver bagoverbøjning i brystryggen, der giver bedre bue og skulderposition i bænk.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'bp-mob-2',
          name: 'Bryststræk mod væg',
          desc: 'Sæt underarmen lodret op ad en væg med albuen i skulderhøjde. Drej langsomt overkroppen væk fra væggen, til du mærker stræk i brystet. Hold og træk vejret dybt. Åbner brystmusklen, der strammer op ved hyppig bænk.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'bp-mob-3',
          name: 'Skulderrotation med håndklæde',
          desc: 'Hold et håndklæde bredt foran dig med strakte arme. Før det langsomt over hovedet og ned bag ryggen i en rolig bue — start så bredt at det er behageligt, og gør grebet smallere lidt efter lidt. Mobiliserer skulderen i hele dens bevægelse.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'bp-mob-4',
          name: 'Skuldercirkler',
          desc: 'Stå oprejst med armene langs siden. Lav store, langsomme cirkler med skuldrene — frem, op, bagud og ned. Løsner skulderen og øger blodgennemstrømningen i de små skuldermuskler inden bænk.',
          label: '10 reps pr. retning',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Skulderblad- og rotatoraktivering',
      options: [
        {
          id: 'bp-akt-1',
          name: 'Skulderblads-push-up',
          desc: 'Stå i push-up-position med strakte arme, og lad skulderbladene synke passivt sammen. Pres dem derefter aktivt fra hinanden og rund øvre ryg. Hold armene strakte hele vejen. Træner kontrol over skulderbladene — afgørende for en stabil og sikker bænk.',
          label: '12 reps',
          type: 'reps',
        },
        {
          id: 'bp-akt-2',
          name: 'Elastik-træk fra hinanden',
          desc: 'Hold et elastik foran dig i skulderbredde med strakte arme. Træk det fra hinanden og før hænderne ud til siden, så skulderbladene trækkes sammen. Aktiverer øvre ryg og de små skuldermuskler, der holder skulderen stabil under pres.',
          label: '15 reps',
          type: 'reps',
        },
        {
          id: 'bp-akt-3',
          name: 'Udadrotation med elastik',
          desc: 'Fastgør et elastik i hoftehøjde og stå med siden til. Hold overarmen tæt mod kroppen med albuen bøjet 90° og drej underarmen udad mod modstanden — hold et sekund. Aktiverer de små skuldermuskler, der ofte er svage og skadestruede hos bænkpressere.',
          label: '12 reps pr. side',
          type: 'reps',
        },
        {
          id: 'bp-akt-4',
          name: 'YWT-løft på maven',
          desc: 'Lig på maven og løft armene i Y-, W- og T-form ved at klemme skulderbladene sammen — hold 2 sekunder i hver. Aktiverer hele øvre rygs stabilisatorer i én øvelse.',
          label: '8 reps pr. position',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Pres- og bænkmønster',
      options: [
        {
          id: 'bp-mov-1',
          name: 'Push-up med pause',
          desc: 'Sænk dig ned, til brystet næsten rører gulvet, og hold 2 sekunder — albuerne tæt mod kroppen som i bænk. Pres dig op med fuldt styr. Bygger den samme spænding og tempo-kontrol du skal bruge under bænk.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'bp-mov-2',
          name: 'Tom stang-bænk med fokus på opsætning',
          desc: 'Brug den tomme stang til at øve bue, ben-drive og at trække skulderbladene sammen. Tag 2-3 sæt med fuldt fokus på opsætningen — ikke på at løfte tungt. Mærk alt falde på plads, inden du lægger vægt på.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'bp-mov-3',
          name: 'Pike push-up',
          desc: 'Start i push-up-position og gå med hænderne tæt mod fødderne, så hoften er høj. Bøj albuerne og sænk issen mod gulvet — pres tilbage op. Træner skulderen fra en anden vinkel og forbedrer stabiliteten i pres-øvelser.',
          label: '8 reps',
          type: 'reps',
        },
      ],
    },
  ],

  'Dødløft — Konventionel': [
    {
      slot: 'Ryg- og hoftemobilitet',
      options: [
        {
          id: 'dk-mob-1',
          name: 'Katte-kamel',
          desc: 'Kom på alle fire med håndleddene under skuldrene og knæene under hofterne. Synk maven mod gulvet og løft brystet (kamel) — afrund derefter ryggen helt og pres lænden mod loftet (kat). Varmer rygsøjlen op i hele bevægelsen.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'dk-mob-2',
          name: 'Stående baglårsstræk med sving',
          desc: 'Stå med let bøjede knæ og lad overkroppen hænge afslappet ned mod gulvet. Sving langsomt overkroppen fra side til side og mærk stræk langs baglårene. Forbereder baglår og lænd dynamisk til hoftebøjningen.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'dk-mob-3',
          name: 'Hoftebøjer-stræk i udfald',
          desc: 'Tag et langt skridt frem og sænk det bageste knæ mod gulvet. Hold overkroppen oprejst og skub hoften frem, til du mærker stræk foran i det bageste lår og hofte. Åbner hoftebøjeren, der ellers hæmmer fuldt hoftestræk i toppen af dødløft.',
          label: '30 sek pr. side',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'dk-mob-4',
          name: 'Jefferson curl',
          desc: 'Stå oprejst og rul langsomt ned fra nakken — hagen mod brystet, ryggen rundes, fingrene hænger mod gulvet. Rejs dig igen i omvendt rækkefølge. Hold det roligt og kontrolleret; mobiliserer hele rygsøjlen og baglårene samlet.',
          label: '6 reps',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Balle- og baglåraktivering',
      options: [
        {
          id: 'dk-akt-1',
          name: 'Hofteløft',
          desc: 'Lig på ryggen med bøjede knæ og fødderne fladt i gulvet. Skub hofterne op og klem ballerne hårdt i toppen — hold et sekund. Aktiverer ballerne, der driver hoftestrækket i toppen af dødløft.',
          label: '15 reps',
          type: 'reps',
        },
        {
          id: 'dk-akt-2',
          name: 'Benløft på maven',
          desc: 'Lig på maven med strakte ben. Spænd ballerne og løft ét ben fra gulvet med strakt knæ — hold 2 sekunder. Skift ben. Aktiverer ballemusklen og baglåret isoleret uden at belaste lænden.',
          label: '10 reps pr. side',
          type: 'reps',
        },
        {
          id: 'dk-akt-3',
          name: 'Hoftebøjning på ét ben',
          desc: 'Stå på ét ben og fold dig forover fra hoften med neutral ryg — stræk det frie ben bagud som modvægt. Kom op igen ved at klemme ballemusklen. Aktiverer og koordinerer balle, baglår og core ét ben ad gangen.',
          label: '8 reps pr. side',
          type: 'reps',
        },
        {
          id: 'dk-akt-4',
          name: 'Nordic curl (let)',
          desc: 'Sæt fødderne fast under en stang eller en tung bænk. Sænk dig langsomt fremad fra knæene med rank krop og brug hænderne til at bremse faldet — kom aktivt tilbage. Træner baglårene på vej ned i netop den vinkel de arbejder i under dødløft.',
          label: '5 reps',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Hoftebøjnings-mønster',
      options: [
        {
          id: 'dk-mov-1',
          name: 'Hoftebøjning mod væg',
          desc: 'Stå ca. 30 cm fra en væg. Pres bagdelen bagud og rør væggen let, hold ryggen neutral og knæene let bøjede. Lær at bøje fra hoften — ikke fra lænden — inden du lægger vægt på stangen.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'dk-mov-2',
          name: 'Good morning uden vægt',
          desc: 'Stå oprejst med hænderne bag nakken. Fold langsomt overkroppen forover fra hoften med let bøjede knæ og neutral ryg — stop når du mærker stræk i baglårene. Rejs dig ved at spænde ballerne. Indøver hoftebøjningen med fuld kropsbevidsthed.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'dk-mov-3',
          name: 'RDL med tom stang',
          desc: 'Hold stangen foran lårene med skulderbredt greb. Skub hofterne bagud og sænk stangen langs lårene med neutral ryg — stop ved et moderat stræk i baglårene. Rejs dig og pres hofterne frem i toppen. Opvarmning og indstilling af bevægelsen i ét.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'dk-mov-4',
          name: 'Dødløft med tom stang',
          desc: 'Sæt stangen på gulvet og tag fat med dit normale greb. Sæt dig ned i startposition, spænd core og de brede rygmuskler — "bøj stangen" mentalt — og rejs dig langsomt over 3 sekunder. Mærk positionen og spændingen inden du lægger vægt på.',
          label: '5 reps',
          type: 'reps',
        },
      ],
    },
  ],

  'Dødløft — Sumo': [
    {
      slot: 'Hofte- og lyskemobilitet',
      options: [
        {
          id: 'ds-mob-1',
          name: 'Sumo squat med pause',
          desc: 'Stå bredt med tæerne pegende udad — samme bredde som din sumo-stance. Sæt dig roligt ned og hold 3 sekunder fornede. Aktiverer lysken og åbner hofteleddet til din stance.',
          label: '10 reps',
          type: 'reps',
        },
        {
          id: 'ds-mob-2',
          name: 'Frøstræk',
          desc: 'Kom ned på alle fire og glid begge knæ bredt ud til siden med tæerne pegende udad. Skub forsigtigt hoften bagud og ned, og lad lysken strække. Hold og træk vejret dybt ind i det stramme område.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'ds-mob-3',
          name: 'Inderlårsstræk siddende',
          desc: 'Sid på gulvet med benene spredt bredt ud til siderne. Læn dig langsomt forover fra hoften med rank ryg og hold. Mærk strækket i inderlårene — afgørende for sumo-stance.',
          label: '30 sek',
          type: 'timer',
          duration: 30,
        },
        {
          id: 'ds-mob-4',
          name: 'Sideudfald',
          desc: 'Stå med benene i skulderbredde. Tag et langt skridt til siden og sænk dig ned over det ene bøjede ben, mens det andet er strakt. Skub tilbage til midten. Strækker inderlårene dynamisk og forbereder hoften til at åbne udad i sumo.',
          label: '8 reps pr. side',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Balle- og hofteaktivering',
      options: [
        {
          id: 'ds-akt-1',
          name: 'Muslingen med elastik',
          desc: 'Lig på siden med et elastik om knæene, knæene bøjet ca. 45° og hælene samlet. Løft det øverste knæ som en musling der åbner sig — hold et sekund. Aktiverer den mellemste ballemuskel, der trækker knæene ud i sumo-stance.',
          label: '15 reps pr. side',
          type: 'reps',
        },
        {
          id: 'ds-akt-2',
          name: 'Knæ til siden på alle fire',
          desc: 'Kom på alle fire med håndleddene under skuldrene. Løft det ene knæ ud til siden til ca. 90° med hoften stabil — hold et sekund og sænk roligt. Rammer hoftens udadføring og udadrotation direkte i det mønster sumo kræver.',
          label: '12 reps pr. side',
          type: 'reps',
        },
        {
          id: 'ds-akt-3',
          name: 'Sidegang med elastik',
          desc: 'Læg et elastik om knæene. Sæt dig i en let sumo-squat og tag korte skridt til siden med konstant spænding i elastikken — knæene peger ud hele vejen. Aktiverer den mellemste ballemuskel og sætter mønstret for udadpres i sumo.',
          label: '10 skridt pr. side',
          type: 'reps',
        },
        {
          id: 'ds-akt-4',
          name: 'Benløft til siden med elastik',
          desc: 'Læg et elastik om knæene og hold fast i en væg for balance. Løft det ene ben ud til siden mod modstanden — hold et sekund og sænk kontrolleret. Isoleret træning af hoftens udadføring, der forbereder dig til at presse knæene ud i sumo.',
          label: '12 reps pr. side',
          type: 'reps',
        },
      ],
    },
    {
      slot: 'Sumo-stance-mønster',
      options: [
        {
          id: 'ds-mov-1',
          name: 'Sumo dødløft med tom stang',
          desc: 'Tag din normale sumo-stance med tæerne udad og grebet smalt inden for benene. Sæt dig ned i startposition og mærk at knæene peger over tæerne — spænd ydersiden af hofterne. Rejs dig langsomt og pres hoften frem i toppen.',
          label: '6 reps',
          type: 'reps',
        },
        {
          id: 'ds-mov-2',
          name: 'Sumo RDL med tom stang',
          desc: 'Stå i din sumo-stance med tæerne udad. Skub hofterne bagud og sænk overkroppen forover med neutral ryg — knæene forbliver let bøjede. Mærk baglår og inderlår strække. Kombinerer hoftebøjning med den brede stance.',
          label: '8 reps',
          type: 'reps',
        },
        {
          id: 'ds-mov-3',
          name: 'Sumo squat fra side til side',
          desc: 'Stå i sumo-stance og sæt dig ned til parallel. Gynge forsigtigt fra side til side og skift vægten fra det ene ben til det andet. Mærk lysken åbne og find din optimale knæ-over-tå-linje i stancen.',
          label: '10 reps (5 pr. side)',
          type: 'reps',
        },
      ],
    },
  ],
};

const WARMUP_ADDONS = {
  'Hofte / baller': {
    slot: 'Hofte / baller',
    options: [
      {
        id: 'add-hofte-1',
        name: '90/90 hofterotation',
        desc: 'Sid på gulvet med det ene ben bøjet foran dig (90°) og det andet ud til siden (90°). Skub forsigtigt hoften frem mod det forreste ben og hold — skift side. Rammer både udad- og indadrotation i hoften samlet.',
        label: '30 sek pr. side',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-hofte-2',
        name: 'Due-stræk',
        desc: 'Fra alle fire, før det ene knæ frem og læg skinnebenet skråt foran dig på gulvet. Sænk hofterne og læn overkroppen frem — undgå at dreje ryggen. Dybt stræk af den dybe ballemuskel og hoften, der rammer det ingen andre stræk når.',
        label: '30 sek pr. side',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-hofte-3',
        name: 'Hoftecirkler',
        desc: 'Stå på ét ben, løft det andet knæ og lav store, langsomme cirkler med hoften — udad og bagud. Åbner hofteleddet dynamisk i alle retninger og smører leddet.',
        label: '10 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-hofte-4',
        name: 'Hofteløft med pause',
        desc: 'Lig på ryggen med bøjede knæ. Skub hofterne op og klem ballerne hårdt — hold 5 sekunder i toppen og sænk roligt. Kombinerer stræk af hoftebøjeren med direkte, bevidst balleaktivering.',
        label: '8 reps',
        type: 'reps',
      },
    ],
  },

  'Lyske / inderlår': {
    slot: 'Lyske / inderlår',
    options: [
      {
        id: 'add-lyske-1',
        name: 'Frøstræk',
        desc: 'Kom ned på alle fire og glid begge knæ bredt ud til siden med tæerne udad. Skub forsigtigt hoften bagud og ned og lad lysken strække. Hold og vejrtræk dybt ind i det stramme område.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-lyske-2',
        name: 'Sideudfald',
        desc: 'Stå med benene i skulderbredde. Tag et langt skridt til siden og sænk dig ned over det ene bøjede ben, mens det andet er strakt. Skub tilbage til midten. Strækker inderlårene dynamisk og mærker dem arbejde i bevægelse.',
        label: '8 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-lyske-3',
        name: 'Inderlårsstræk siddende',
        desc: 'Sid på gulvet med benene spredt bredt ud til siderne. Læn dig langsomt forover fra hoften med rank ryg og hold. Mærk strækket i inderlårene — hold positionen og træk vejret roligt.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-lyske-4',
        name: 'Sumo squat fra side til side',
        desc: 'Stå bredt med tæerne udad og sæt dig ned i sumo-squat. Gynge forsigtigt fra side til side og lad inderlårene åbne dynamisk. God til akut stramhed, der giver sig med bevægelse.',
        label: '10 reps',
        type: 'reps',
      },
    ],
  },

  'Lænde': {
    slot: 'Lænde',
    options: [
      {
        id: 'add-laende-1',
        name: 'Katte-kamel',
        desc: 'Kom på alle fire. Synk maven mod gulvet og løft brystet (kamel) — afrund derefter ryggen helt og pres lænden mod loftet (kat). Mobiliserer hele rygsøjlen og løsner stivhed i lænden.',
        label: '10 reps',
        type: 'reps',
      },
      {
        id: 'add-laende-2',
        name: 'Liggende knæ-til-bryst',
        desc: 'Lig på ryggen. Træk det ene knæ op mod brystet og hold det med begge hænder — det andet ben bliver strakt i gulvet. Hold og skift. Let aflastnings-øvelse for lænd og bækken.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-laende-3',
        name: 'Liggende rygrotation',
        desc: 'Lig på ryggen med bøjede knæ. Lad begge knæ falde langsomt til den ene side, mens skuldrene bliver i gulvet — kom roligt tilbage og fald til den anden side. Roterer og løsner lænden.',
        label: '8 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-laende-4',
        name: 'Barnets stilling',
        desc: 'Sæt dig tilbage på hælene med knæene spredt og stræk armene frem på gulvet. Lad panden hvile i gulvet og træk vejret dybt — mærk lænden åbne for hver udånding. Passiv aflastning der virker godt ved akut stivhed.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
    ],
  },

  'Øvre ryg': {
    slot: 'Øvre ryg',
    options: [
      {
        id: 'add-oevreR-1',
        name: 'Brystryg over skumrulle',
        desc: 'Læg en skumrulle på tværs under øvre ryg. Læn forsigtigt bagover med hænderne bag nakken og åbn brystet mod loftet — flyt rullen op ad ryggen og gentag. Giver bagoverbøjning i brystryggen, som er afgørende for bænk og opsætning i dødløft.',
        label: '30 sek',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-oevreR-2',
        name: 'Brystryg-rotation siddende',
        desc: 'Sid på gulvet og hold en stang eller et håndklæde vandret bag nakken. Drej langsomt overkroppen til den ene side og hold — undgå at dreje fra lænden. Forbedrer rotationen i brystryggen, som er vigtig for bænk-opsætning og for at få fat med de brede rygmuskler i dødløft.',
        label: '8 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-oevreR-3',
        name: 'Elastik-træk fra hinanden',
        desc: 'Hold et elastik foran dig i skulderbredde med strakte arme. Træk det fra hinanden og hold 2 sekunder med skulderbladene trukket sammen. Aktiverer musklerne mellem skulderbladene, der holder øvre ryg stabil under alle tunge løft.',
        label: '15 reps',
        type: 'reps',
      },
      {
        id: 'add-oevreR-4',
        name: 'YWT-løft på maven',
        desc: 'Lig på maven og løft armene i Y-, W- og T-form ved at klemme skulderbladene sammen — hold 2 sekunder i hver. Aktiverer hele øvre rygs stabilisatorer og de små skuldermuskler på én gang.',
        label: '8 reps pr. position',
        type: 'reps',
      },
    ],
  },

  'Ankel': {
    slot: 'Ankel',
    options: [
      {
        id: 'add-ankel-1',
        name: 'Ankelcirkler',
        desc: 'Sid på en bænk eller stå på ét ben. Løft foden let og lav store, langsomme cirkler med anklen — begge retninger. Løsner ledbåndet og øger ledvæsken i anklen inden belastning.',
        label: '10 reps pr. retning pr. side',
        type: 'reps',
      },
      {
        id: 'add-ankel-2',
        name: 'Ankel-vægstræk',
        desc: 'Stå med tåen ca. 10 cm fra en væg og bøj knæet fremad, til det rører væggen — hælen skal blive i gulvet. Flyt tåen gradvist længere væk. Lader anklen bøje nok til knæ-over-tå, som er afgørende for squat-dybde.',
        label: '10 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-ankel-3',
        name: 'Langsom hælsænkning',
        desc: 'Stå med forfoden på en vægtskive eller en lav forhøjning. Rejs dig på tå og sænk derefter hælen langsomt ned under skiven over 3 sekunder. Strækker akillessenen og anklen på vej ned — effektiv ved stive ankler.',
        label: '10 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-ankel-4',
        name: 'Ankel-glid med elastik',
        desc: 'Bind et elastik fast i lav højde og læg løkken stramt om anklens forside. Træd fremad, så elastikken trækker anklen bagud, og bøj knæet frem over tåen gentagne gange. Elastikken løsner anklen mere end et stræk alene.',
        label: '10 reps pr. side',
        type: 'reps',
      },
    ],
  },

  'Knæ': {
    slot: 'Knæ',
    options: [
      {
        id: 'add-knae-1',
        name: 'Lårstræk stående',
        desc: 'Stå på ét ben, hold om anklen på det bøjede ben og træk hælen mod sædet — hold knæene samlet. Rør en væg med en finger for balance. Strækker forlåret, der belastes hårdt i squat og påvirker knæets bevægelighed.',
        label: '30 sek pr. side',
        type: 'timer',
        duration: 30,
      },
      {
        id: 'add-knae-2',
        name: 'Bensving',
        desc: 'Stå ved en væg og sving det ene ben frem og tilbage som et pendul — afslappet, roligt og med stigende udslag. Løsner hoften og knæet dynamisk og øger blodgennemstrømning i knæleddet inden belastning.',
        label: '15 reps pr. side',
        type: 'reps',
      },
      {
        id: 'add-knae-3',
        name: 'Vægstøttet squat med knæ-styring',
        desc: 'Stå med ryggen mod en væg og glid langsomt ned i en halv squat. Pres bevidst knæene udad over den 2. tå og hold 3 sekunder — rejs dig. Træner korrekt knæ-styring og aflaster knæets inderside.',
        label: '8 reps',
        type: 'reps',
      },
      {
        id: 'add-knae-4',
        name: 'Knæstræk med elastik',
        desc: 'Fastgør et elastik bag om knæet og træd fremad, så det trækker. Stå på ét ben med let bøjet knæ og stræk det helt ud — spænd låret. Aktiverer den indre lårmuskel, der stabiliserer knæet under løft.',
        label: '15 reps pr. side',
        type: 'reps',
      },
    ],
  },

  'Skulder': {
    slot: 'Skulder',
    options: [
      {
        id: 'add-skulder-1',
        name: 'Skuldercirkler',
        desc: 'Stå oprejst med armene langs siden. Lav store, langsomme cirkler med skuldrene fremad og bagud. Løsner skulderen og øger blodgennemstrømningen i de små skuldermuskler inden bænk eller tunge dødløft.',
        label: '10 reps pr. retning',
        type: 'reps',
      },
      {
        id: 'add-skulder-2',
        name: 'Skulderrotation med håndklæde',
        desc: 'Hold et håndklæde bredt foran dig med strakte arme. Før det langsomt over hovedet og ned bag ryggen i en rolig bue — gør grebet smallere lidt efter lidt. Mobiliserer skulderen i hele dens bevægelse.',
        label: '10 reps',
        type: 'reps',
      },
      {
        id: 'add-skulder-3',
        name: 'Skulderstræk over kroppen',
        desc: 'Træk den ene arm vandret hen foran brystet med den modsatte hånd og pres let. Mærk stræk i den bageste del af skulderen. Bagsiden af skulderen er ofte stram hos bænkpressere og dødløftere.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-skulder-4',
        name: 'Udadrotation med elastik',
        desc: 'Fastgør et elastik i hoftehøjde. Hold overarmen tæt mod kroppen med albuen bøjet 90° og drej underarmen udad mod modstanden — hold et sekund. Aktiverer de små skuldermuskler, der beskytter skulderen under både pres og træk.',
        label: '12 reps pr. side',
        type: 'reps',
      },
    ],
  },

  'Nakke / trapez': {
    slot: 'Nakke / trapez',
    options: [
      {
        id: 'add-nakke-1',
        name: 'Nakkestræk til siden',
        desc: 'Sid eller stå oprejst. Lad øret falde roligt mod skulderen — uden at tvinge. Hold og mærk stræk langs siden af nakken og ned i øvre trapez. Løsner de muskler, der strammer op af stangbæring og tunge dødløft.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-nakke-2',
        name: 'Hage tilbage',
        desc: 'Sid oprejst og træk hagen lige bagud — som om du laver en "dobbelthage". Hold 5 sekunder og slip. Retter en fremskudt hovedstilling og aktiverer de dybe nakkemuskler, som aflaster de stramme øvre trapezmuskler.',
        label: '10 reps',
        type: 'reps',
      },
      {
        id: 'add-nakke-3',
        name: 'Øvre trapez-stræk med bænk',
        desc: 'Sid på en bænk og hold fast i kanten med den ene hånd. Læn nakken til den modsatte side og brug den fri hånd til at trække hovedet let videre. Direkte stræk i øvre trapez, der spænder under stangbæring og tunge løft.',
        label: '20 sek pr. side',
        type: 'timer',
        duration: 20,
      },
      {
        id: 'add-nakke-4',
        name: 'Halve nakke-cirkler',
        desc: 'Lad hagen falde mod brystet og rul langsomt hovedet til den ene skulder, videre bagover og til den anden skulder — undgå hele runder med kold nakke. Hold det roligt og kontrolleret. Løsner nakken og øvre trapez.',
        label: '5 reps pr. retning',
        type: 'reps',
      },
    ],
  },
};

// ── DAGLIG MOBILISERING ──────────────────────────────────────────────────────
// Evidens-målrettede områder: leddene med stærkest dokumentation for styrkeløft-
// positioner (ankel/hofte → squat-dybde, t-ryg → bænk-bue, hofteekstension →
// dødløft/lænde) + modvirkning af stillesidning (hoftefleksor, t-ryg, baller).
// Gjort VÆK fra træning → længere hold er fint (modsat pre-lift-opvarmning, hvor
// lange statiske stræk koster styrke). Format = samme som WARMUP_BASE-options.
const MOBILITY_AREAS = [
  { id: 'ankel', label: 'Ankel-bevægelighed' },
  { id: 'hofte', label: 'Hofteåbning' },
  { id: 'hoftefleksor', label: 'Hoftebøjere' },
  { id: 'baller', label: 'Balleaktivering' },
  { id: 'tryg', label: 'Brystryg' },
  { id: 'skulder', label: 'Skulder / lat' },
  { id: 'lyske', label: 'Lyske / inderlår' },
  { id: 'laend', label: 'Lænde-aflastning' },
]

const MOBILITY_LIBRARY = {
  ankel: [
    { id: 'mob-ankel-1', name: 'Ankel-vægstræk', desc: 'Stå med tåen ca. 10 cm fra en væg og pres knæet fremad, til det rører væggen — hælen skal blive i gulvet. Flyt tåen længere væk, når det bliver let. Det vigtigste for squat-dybde er, at anklen kan bøje nok til at knæet kan vandre frem over tæerne — så kan du sidde lavt med oprejst overkrop.', label: '8 reps pr. side', type: 'reps' },
    { id: 'mob-ankel-2', name: 'Knælende lægstræk', desc: 'Sæt det ene knæ i gulvet og den anden fod fladt foran dig. Skub knæet ud over tæerne og hold, mens du presser hælen ned. Strækker læggen og akillessenen — hold roligt og træk vejret ind i strækket.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-ankel-3', name: 'Ankel-glid med elastik', desc: 'Bind et elastik fast i lav højde og læg løkken om anklen forfra, så det trækker anklen bagud. Pres knæet frem over tæerne i rolige, gentagne glid. Elastikken giver leddet plads og løsner anklen mere end et stræk alene.', label: '12 reps pr. side', type: 'reps' },
    { id: 'mob-ankel-4', name: 'Lægstræk på trappekant', desc: 'Stil forfoden på kanten af et trin og lad hælen synke ned under trinnet med strakt knæ. Hold roligt og skift ben. Strækker læggen i fuld længde — en stram læg begrænser hvor langt knæet kan vandre frem, og dermed hvor dybt du kan sidde.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-ankel-5', name: 'Ankel-cirkler', desc: 'Løft den ene fod og tegn store, langsomme cirkler i luften med tæerne — begge veje. Smører ankelleddet hele vejen rundt og er en nem måde at vække anklerne på, før de skal arbejde i bunden af et løft.', label: '10 cirkler pr. vej', type: 'reps' },
  ],
  hofte: [
    { id: 'mob-hofte-1', name: '90/90 hofterotation', desc: 'Sid på gulvet med det ene ben bøjet foran dig (90°) og det andet ud til siden (90°). Skub forsigtigt hoften frem mod det forreste ben, hold, og skift side. Rammer både udad- og indadrotation i hoften — afgørende for at komme dybt i squat uden at lænden runder.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hofte-2', name: 'Dyb squat-hold', desc: 'Sæt dig ned i bunden af en squat med fødderne fladt, og hold dig nede ved at skubbe knæene ud med albuerne. Flyt vægten lidt rundt og find de stramme punkter. Lærer hofte, ankel og lænd at falde til ro i den dybe position.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-hofte-3', name: 'Due-stræk', desc: 'Fra alle fire, før det ene knæ frem og læg skinnebenet skråt foran dig. Sænk hofterne og læn overkroppen frem med rank ryg. Dybt stræk af den dybe ballemuskel og bagsiden af hoften — det område der ofte spænder og blokerer dybden.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hofte-4', name: 'Hofte-cirkler på alle fire', desc: 'Stå på alle fire og løft det ene knæ ud til siden, før det i en stor cirkel frem og tilbage uden at vride i ryggen. Aktiv, kontrolleret bevægelse helt ud i hoftens yderpositioner — bygger bevægelighed du faktisk kan bruge under stangen.', label: '8 cirkler pr. side', type: 'reps' },
    { id: 'mob-hofte-5', name: 'Dybt squat-hold med rotation', desc: 'Sid i bunden af en dyb squat med fødderne fladt, og drej skiftevis det ene knæ ind mod gulvet. Kombinerer den dybe position med rotation i hoften, så du både åbner og styrer leddet dér hvor squatten er sværest.', label: '6 reps pr. side', type: 'reps' },
  ],
  hoftefleksor: [
    { id: 'mob-hfx-1', name: 'Hoftebøjer-stræk mod væg', desc: 'Knæl foran en væg og sæt det bageste skinneben lodret op ad væggen, så hælen peger op. Sæt den anden fod fladt foran dig i et stort skridt. Klem ballen på det bageste ben og skub hoften frem med rank ryg, til du mærker stræk foran i hoften og låret. Den mest direkte modgift mod stillesidning, hvor hoftebøjerne bliver korte og trækker bækkenet i svaj.', label: '45 sek pr. side', type: 'timer', duration: 45 },
    { id: 'mob-hfx-2', name: 'Knælende hoftebøjer-stræk', desc: 'Knæl på det ene knæ med den anden fod fladt foran dig. Klem ballen på det knælende ben og skub hoften langsomt frem, til du mærker stræk foran i hoften. Undgå at svaje i lænden — bevægelsen skal komme fra hoften, ikke fra ryggen.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hfx-3', name: 'Udfald med rotation', desc: 'Tag et stort skridt frem til et udfald, sæt hånden i gulvet inden for den forreste fod, og drej den anden arm op mod loftet med blikket efter hånden. Åbner hoftebøjer, lyske og brystryg i én bevægelse — en effektiv reset for hele kroppen efter en dag på stolen.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-hfx-4', name: 'Stående hoftebøjer-stræk', desc: 'Stå i et stort skridt, bøj det forreste knæ og klem ballen på det bageste ben, mens du skubber hoften frem. Samme stræk som den knælende, men stående — nemt at tage hvor som helst, fx i en pause fra skrivebordet.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-hfx-5', name: 'Edderkop-udfald med rok', desc: 'Tag et stort skridt frem til et dybt udfald og sæt begge hænder i gulvet inden for foden. Rok blødt frem og tilbage i positionen. Åbner hoftebøjer og lyske på én gang og gør stive hofter klar til at arbejde.', label: '6 reps pr. side', type: 'reps' },
  ],
  baller: [
    { id: 'mob-baller-1', name: 'Hofteløft med pause', desc: 'Lig på ryggen med bøjede knæ. Skub hofterne op og klem ballerne hårdt — hold 5 sekunder i toppen og sænk roligt. Vækker de baller som stillesidning sætter i dvale, så de tager belastningen i stedet for lænden.', label: '10 reps', type: 'reps' },
    { id: 'mob-baller-2', name: 'Sidegang med elastik', desc: 'Læg et elastik om knæ eller ankler, gå i halv squat og tag kontrollerede skridt til siden uden at lade knæene falde ind. Aktiverer den mellemste ballemuskel — stabilisatoren der holder knæene ude under squat og dødløft.', label: '10 skridt pr. side', type: 'reps' },
    { id: 'mob-baller-3', name: 'Hofteløft på ét ben', desc: 'Lav et hofteløft med det ene ben strakt lige ud. Skub op gennem hælen på det bøjede ben og klem ballen i toppen. Afslører og retter forskelle i ballestyrke fra side til side, som ofte stammer fra at sidde skævt.', label: '8 reps pr. side', type: 'reps' },
    { id: 'mob-baller-4', name: 'Muslingen', desc: 'Lig på siden med bøjede knæ samlet og åbn det øverste knæ opad uden at vippe bækkenet bagud — gerne med et elastik om knæene. Vækker den mellemste ballemuskel, der holder knæet ude og bækkenet stabilt under squat og dødløft.', label: '12 reps pr. side', type: 'reps' },
    { id: 'mob-baller-5', name: 'Diagonalløft på alle fire', desc: 'Stå på alle fire og stræk modsat arm og ben ud i en lige linje, hold et øjeblik, og skift side. Træner balle og dybe rygmuskler til at holde kroppen stiv — netop den kontrol du bruger til at holde ryggen neutral i dødløft.', label: '8 reps pr. side', type: 'reps' },
  ],
  tryg: [
    { id: 'mob-tryg-1', name: 'Brystryg over skumrulle', desc: 'Læg en skumrulle på tværs under den øverste del af brystryggen, støt nakken med hænderne og bøj forsigtigt bagover hen over rullen. Flyt rullen lidt op og ned. Genvinder den bagoverbøjning som foroverbøjet siddning tager fra dig — en direkte forudsætning for en stabil bænk-bue.', label: '8 reps', type: 'reps' },
    { id: 'mob-tryg-2', name: 'Bogåbning', desc: 'Lig på siden med knæene bøjet op og armene strakt ud foran dig. Åbn den øverste arm i en stor bue over til den anden side og følg hånden med blikket, mens knæene bliver i gulvet. Genskaber rotation i brystryggen og åbner brystet efter mange timer foroverbøjet.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-tryg-3', name: 'Katte-kamel', desc: 'På alle fire, skift langsomt mellem at runde ryggen op mod loftet (kat) og synke ned i et svaj (kamel). Bevæg rygsøjlen led for led. Smører hele ryggen og bryder den krumme holdning en stol presser dig ind i.', label: '8 reps', type: 'reps' },
    { id: 'mob-tryg-4', name: 'Tråd nålen', desc: 'Stå på alle fire, før den ene arm ind under kroppen og drej overkroppen med, og åbn så samme arm op mod loftet og følg hånden med blikket. Genvinder rotationen i brystryggen, som en foroverbøjet kontordag gradvist stjæler.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-tryg-5', name: 'Væg-engle', desc: 'Stå med ryggen mod en væg og pres lænd, skuldre og håndrygge mod væggen. Glid armene langsomt op og ned som en sne-engel uden at miste kontakten. Lærer brystryggen at strække sig og skuldrene at arbejde frit — nyttigt for både bænk og løft over hovedet.', label: '8 reps', type: 'reps' },
  ],
  skulder: [
    { id: 'mob-skulder-1', name: 'Lat-stræk i dørkarm', desc: 'Tag fat om en dørkarm eller stang, sæt hoften bagud og lad overkroppen hænge, så siden af ryggen og skulderen strækkes. Stramme lats begrænser både armene over hovedet og en god bænk-bue — slip dem løs her.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-skulder-2', name: 'Skulder-rotation med pind', desc: 'Hold en pind eller et elastik med bredt greb og før den langsomt fra forsiden af hofterne op over hovedet og ned bag ryggen — kun så smalt som du kan med strakte arme. Åbner brystet og forbedrer skuldrenes bevægelighed lidt efter lidt.', label: '8 reps', type: 'reps' },
    { id: 'mob-skulder-3', name: 'Bryststræk i døråbning', desc: 'Stil dig i en døråbning og læg underarmen op ad karmen i en ret vinkel. Træd forsigtigt frem, til du mærker stræk over brystet. Modvirker de fremrullede skuldre fra tastatur og telefon — vigtigt for et sundt bænkpres.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-skulder-4', name: 'Passiv stanghæng', desc: 'Tag fat i en bom med strakt greb og lad kroppen hænge afslappet, så skuldrene strækkes ud. Aflaster og åbner skulderleddet og strækker hele siden af ryggen — en behagelig modvægt til timer med foroverbøjede skuldre.', label: '30 sek', type: 'timer', duration: 30 },
    { id: 'mob-skulder-5', name: 'Lat-stræk på bænk', desc: 'Knæl foran en bænk, læg albuerne på kanten og sænk brystet ned mod gulvet med strakte arme. Strækker siden af ryggen og brystryggen på én gang — godt for både armene over hovedet og en stabil bænk-bue.', label: '40 sek', type: 'timer', duration: 40 },
  ],
  lyske: [
    { id: 'mob-lyske-1', name: 'Frøstræk', desc: 'På alle fire, glid knæene bredt ud til siden med tæerne udad. Skub hoften langsomt bagud og ned, og lad inderlårene strække. Træk vejret dybt ind i det stramme område — bedre bevægelighed i inderlårene giver en bredere, mere stabil squat-stilling.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-lyske-2', name: 'Cossack-squat', desc: 'Stå bredt og skift vægten ned over det ene bøjede ben, mens det andet er strakt med tåen op. Skift roligt fra side til side. Dynamisk bevægelighed i inderlårene under let belastning — bygger styrke yderst i bevægelsen, ikke bare passivt stræk.', label: '6 reps pr. side', type: 'reps' },
    { id: 'mob-lyske-3', name: 'Knælende inderlår-stræk', desc: 'På alle fire, stræk det ene ben ud til siden med foden fladt i gulvet. Gynge hoften langsomt bagud mod hælen og frem igen. Kontrolleret, gentaget stræk af inderlåret, der føles bedre end et langt passivt hold.', label: '10 reps pr. side', type: 'reps' },
    { id: 'mob-lyske-4', name: 'Sommerfugl-stræk', desc: 'Sid med fodsålerne mod hinanden og lad knæene synke mod gulvet, mens du sidder rank. Pres eventuelt blidt på knæene med albuerne. Roligt stræk af inderlårene, der giver mere plads til en bred squat-stilling.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-lyske-5', name: 'Bredbenet foroverbøjning', desc: 'Stå bredt med strakte ben og tæerne lidt udad, og fold langsomt forover med rank ryg, til du mærker stræk i inderlår og baglår. Hold og træk vejret ned i strækket. Åbner inderlårene i en stilling tæt på sumo-træk og bred squat.', label: '40 sek', type: 'timer', duration: 40 },
  ],
  laend: [
    { id: 'mob-laend-1', name: 'Knæ-til-bryst', desc: 'Lig på ryggen og træk begge knæ blødt op mod brystet. Gynge let fra side til side. Aflaster lænden og giver de små rygmuskler en pause efter en dag i sammenpresset stilling — rart, ikke et præstationsstræk.', label: '40 sek', type: 'timer', duration: 40 },
    { id: 'mob-laend-2', name: 'Liggende rygrotation', desc: 'Lig på ryggen og før det ene knæ over til den modsatte side, mens skuldrene bliver i gulvet og blikket går den anden vej. Blød rotation der løsner lænd og hofte på én gang. Hold og træk vejret roligt.', label: '40 sek pr. side', type: 'timer', duration: 40 },
    { id: 'mob-laend-3', name: 'Barnets stilling', desc: 'Sæt dig tilbage på hælene med armene strakt frem og panden mod gulvet. Træk vejret ned i lænden og lad ryggen runde blødt. En enkel aflastning der afslutter rutinen og skifter kroppen over i ro.', label: '45 sek', type: 'timer', duration: 45 },
    { id: 'mob-laend-4', name: 'Bækken-vip på ryggen', desc: 'Lig på ryggen med bøjede knæ og vip bækkenet blidt, så lænden skiftevis presses ned i gulvet og løftes til et lille svaj. Små, rolige bevægelser. Lærer dig at styre bækkenet og løsner en stiv lænd uden belastning.', label: '12 reps', type: 'reps' },
    { id: 'mob-laend-5', name: 'Vinduesviskere', desc: 'Lig på ryggen med bøjede knæ samlet og lad dem falde langsomt fra side til side som viskere, mens skuldrene bliver i gulvet. Blød rotation der løsner lænd og hofte og afslutter rutinen roligt.', label: '8 reps pr. side', type: 'reps' },
  ],
}

// Map fra opvarmningens problem-chips til mobiliserings-områder (genbrug af de chips
// atleten allerede kender). Bruges når intaken vægter områder efter "hvad er stramt".
const MOBILITY_PROBLEM_MAP = {
  'Hofte / baller': ['hofte', 'baller'],
  'Lyske / inderlår': ['lyske'],
  'Lænde': ['hoftefleksor', 'laend'],
  'Øvre ryg': ['tryg'],
  'Ankel': ['ankel'],
  'Knæ': ['hofte', 'ankel'],
  'Skulder': ['skulder'],
  'Nakke / trapez': ['tryg', 'skulder'],
}

// Genererer en anbefalet rutine (ordnet liste af område-id'er) ud fra intake-svarene.
// Vægter områderne efter løft, stillesidning og problemzoner, vælger top-N (N styres af
// tilgængelig tid) og sorterer dem i en logisk rækkefølge (nedefra-og-op + afslut roligt).
function buildMobilityRoutine(intake) {
  const n = intake.time === 5 ? 4 : intake.time === 15 ? 8 : 6
  const score = {}
  for (const a of MOBILITY_AREAS) score[a.id] = 0.1 // svag baseline så alle kan vælges
  const bump = (id, w) => { if (id in score) score[id] += w }
  // Løft → relevante led
  const lifts = new Set(intake.lifts || [])
  if (lifts.has('squat')) { bump('ankel', 2); bump('hofte', 2); bump('lyske', 1) }
  if (lifts.has('bench')) { bump('tryg', 2); bump('skulder', 2) }
  if (lifts.has('deadlift')) { bump('hoftefleksor', 2); bump('baller', 1.5); bump('tryg', 1) }
  // Stillesidning → modvirk forkortede hoftefleksorer, stiv t-ryg, døde baller
  if (intake.sitting === 'high') { bump('hoftefleksor', 2); bump('tryg', 1.5); bump('baller', 1.5); bump('laend', 1) }
  else if (intake.sitting === 'med') { bump('hoftefleksor', 1); bump('tryg', 0.75); bump('baller', 0.75) }
  // Problemzoner vægter tungest (akut oplevet stivhed)
  for (const p of (intake.problems || [])) for (const id of (MOBILITY_PROBLEM_MAP[p] || [])) bump(id, 2.5)
  // Vælg top-N, behold den kanoniske MOBILITY_AREAS-rækkefølge for et roligt flow
  const ranked = [...MOBILITY_AREAS].map(a => a.id).sort((x, y) => score[y] - score[x])
  const chosen = new Set(ranked.slice(0, n))
  return MOBILITY_AREAS.map(a => a.id).filter(id => chosen.has(id))
}

// Hvilke hovedløft træner atleten i den aktuelle uge? Bruges til at forudvælge løft
// i mobilitets-intaken, så forslaget rammer det de faktisk laver (samme detektion
// som opvarmningen). Returnerer ['squat'|'bench'|'deadlift'].
function liftsFromWeek(week) {
  const found = new Set()
  for (const sess of week?.sessions || []) {
    for (const ex of sess.exercises || []) {
      const n = (ex.name || '').toLowerCase()
      if (n.includes('squat')) found.add('squat')
      if (n.includes('bænk') || n.includes('bench')) found.add('bench')
      if (n.includes('dødl') || n.includes('deadlift') || n.includes('sumo')) found.add('deadlift')
    }
  }
  return [...found]
}

const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300 },
  topbar: { height: '52px', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', background: '#1c1c18', position: 'sticky', top: 0, zIndex: 50 },
  logo: { fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' },
  page: { maxWidth: '680px', margin: '0 auto', padding: '1.5rem 1rem 6rem' },
  card: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.25rem', marginBottom: '1.5rem' },
  cardLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' },
  fieldLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.3rem' },
  fieldInput: { width: '100%', background: '#141410', border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300, padding: '0.55rem 0.75rem', outline: 'none' },
  btnPrimary: { background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.13)', padding: '0.5rem 1rem', cursor: 'pointer' },
}

// Cirkulær nedtællings-ring til guide-timere (opvarmning + mobilisering). Ringen
// tømmes som tiden løber; bliver grøn med flueben når sættet er færdigt.
function CountdownRing({ total, remaining, done }) {
  const r = 52, C = 2 * Math.PI * r
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  return (
    <div style={{ position: 'relative', width: 128, height: 128 }}>
      <svg width="128" height="128" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(237,234,226,0.08)" strokeWidth="6" />
        {done
          ? <circle cx="64" cy="64" r={r} fill="none" stroke="#6cba6c" strokeWidth="6" />
          : <circle cx="64" cy="64" r={r} fill="none" stroke="#c8923a" strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear' }} />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {done
          ? <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.6rem', color: '#6cba6c', lineHeight: 1 }}>✓</span>
          : <>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', color: '#edeae2', lineHeight: 1 }}>{remaining}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.12em', color: '#7a7770', textTransform: 'uppercase', marginTop: '0.2rem' }}>sek</span>
            </>}
      </div>
    </div>
  )
}

// Ét guide-trin i mobiliserings-sessionen (samme look som opvarmningens guide +
// CountdownRing). Timer-state ejes af forælderen og sendes ind.
function MobilityGuideStep({ heading, step, total, onExit, areaLabel, ex, opts, choiceIdx, onChoose, timerSeconds, timerActive, timerDone, setTimerSeconds, setTimerActive, setTimerDone, onPrev, onNext, isLast }) {
  const hasChoices = opts.length > 1
  const pct = Math.round((step / total) * 100)
  return (
    <>
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.08em' }}>{heading} · Øvelse {step + 1} af {total}</div>
          <button style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem' }} onClick={onExit}>✕ Afslut</button>
        </div>
        <div style={{ height: '2px', background: 'rgba(237,234,226,0.07)', borderRadius: '1px' }}>
          <div style={{ height: '100%', background: '#c8923a', width: `${pct}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>
      {hasChoices && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Vælg øvelse · {areaLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {opts.map((opt, i) => <button key={opt.id} onClick={() => onChoose(i)} style={{ background: i === choiceIdx ? 'rgba(200,146,58,0.15)' : '#1c1c18', border: `1px solid ${i === choiceIdx ? '#c8923a' : 'rgba(237,234,226,0.1)'}`, color: i === choiceIdx ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, padding: '0.45rem 0.7rem', cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}>{opt.name}</button>)}
          </div>
        </div>
      )}
      <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.75rem', marginBottom: '1.25rem', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '1rem', lineHeight: 1.2 }}>{ex.name}</h2>
          {ex.desc && <p style={{ fontSize: '0.9rem', color: '#b8b4a8', lineHeight: 1.75, margin: 0 }}>{ex.desc}</p>}
        </div>
        <div style={{ marginTop: '1.5rem' }}>
          {ex.type === 'timer' ? (
            <div>
              <div style={{ marginBottom: '0.85rem' }}>
                <CountdownRing total={ex.duration} remaining={timerSeconds > 0 ? timerSeconds : ex.duration} done={timerDone} />
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{ex.label}</div>
              {!timerDone ? (
                <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { if (!timerActive && timerSeconds === 0) setTimerSeconds(ex.duration); setTimerActive(a => !a) }}>
                  {timerActive ? '⏸ Pause' : timerSeconds > 0 ? '▶ Fortsæt' : '▶ Start timer'}
                </button>
              ) : (
                <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { setTimerSeconds(ex.duration); setTimerDone(false); setTimerActive(false) }}>↺ Gentag (anden side)</button>
              )}
            </div>
          ) : (
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#c8923a' }}>{ex.label}</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        {onPrev && <button style={{ ...s.btnGhost, padding: '0.75rem 1rem' }} onClick={onPrev}>←</button>}
        <button style={{ ...s.btnPrimary, flex: 1, padding: '0.85rem', fontSize: '0.62rem' }} onClick={onNext}>{isLast ? 'Afslut ✓' : 'Næste øvelse →'}</button>
      </div>
    </>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Forskyd en yyyy-mm-dd-streng med et antal dage (UTC, så det matcher today()).
function shiftDate(str, days) {
  const d = new Date(str + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Pæn dansk etiket for en kost-dato relativt til i dag.
function dateLabel(str) {
  if (str === today()) return 'I dag'
  if (str === shiftDate(today(), -1)) return 'I går'
  const d = new Date(str + 'T12:00:00Z')
  return d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short' })
}

const NAV_ITEMS = [
  {
    key: 'hjem',
    label: 'Hjem',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 2l9 7.5V21H15v-7H9v7H3V9.5z" />
      </svg>
    ),
  },
  {
    key: 'program',
    label: 'Program',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <line x1="6" y1="12" x2="18" y2="12" />
        <rect x="3" y="8.5" width="3" height="7" rx="1" />
        <rect x="18" y="8.5" width="3" height="7" rx="1" />
        <line x1="1" y1="10" x2="1" y2="14" />
        <line x1="23" y1="10" x2="23" y2="14" />
      </svg>
    ),
  },
  {
    key: 'kost',
    label: 'Kost',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
        <path d="M3 2v5a3 3 0 0 0 6 0V2" />
        <line x1="6" y1="7" x2="6" y2="22" />
        <line x1="21" y1="2" x2="21" y2="22" />
        <path d="M17 2a4 4 0 0 1 4 4" />
      </svg>
    ),
  },
  {
    key: 'mobilisering',
    label: 'Mobilitet',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 3 21 9 15 9" />
      </svg>
    ),
  },
  {
    key: 'beskeder',
    label: 'Beskeder',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    key: 'stævnedag',
    label: 'Stævne',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
]

const RPE_VALUES = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]

function parsePlannedRpe(intensity) {
  if (!intensity) return null
  const m = intensity.match(/RPE\s*(\d+(?:[.,]\d+)?)/i)
  return m ? parseFloat(m[1].replace(',', '.')) : null
}

export default function AthleteView({ session, onExitPreview, role, coachAthleteId }) {
  const [tab, setTab] = useState('hjem')
  const [athlete, setAthlete] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  // Rå streng (ikke number) så feltet kan ryddes/skrives frit — fx "0" eller
  // midlertidigt tomt — uden at snappe tilbage til 0. Parses hvor der regnes.
  const [amount, setAmount] = useState('100')
  const [unitIdx, setUnitIdx] = useState(0)
  const [customFoods, setCustomFoods] = useState([])
  const [showCreateFood, setShowCreateFood] = useState(false)
  const [createFood, setCreateFood] = useState({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
  const [shareFood, setShareFood] = useState(true)
  const [mealTemplates, setMealTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateNameInput, setTemplateNameInput] = useState('')
  const [historicalMealLogs, setHistoricalMealLogs] = useState([])
  const [frequentFoods, setFrequentFoods] = useState([])
  const [kostDate, setKostDate] = useState(today())
  const [showTdee, setShowTdee] = useState(false)
  const [editingLogId, setEditingLogId] = useState(null)
  const [editGrams, setEditGrams] = useState('')
  const [editMacros, setEditMacros] = useState({ kcal: '', protein: '', carb: '', fat: '' })

  // Messages state
  const [messages, setMessages] = useState([])
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [messageInput, setMessageInput] = useState('')

  // Program state
  const [currentWeek, setCurrentWeek] = useState(null)
  const [allWeeks, setAllWeeks] = useState([])
  const [viewingWeekIdx, setViewingWeekIdx] = useState(0)
  const [pastLogs, setPastLogs] = useState([])
  const [progOpenSession, setProgOpenSession] = useState(null)
  const [exerciseLogs, setExerciseLogs] = useState([])
  const [logInputs, setLogInputs] = useState({})
  const [lastLogByExerciseName, setLastLogByExerciseName] = useState({})
  const [exerciseHistory, setExerciseHistory] = useState({})
  const [weightLogs, setWeightLogs] = useState([])
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  // PR toast state
  const [prToast, setPrToast] = useState(null)
  const [prToastFading, setPrToastFading] = useState(false)
  const [setConfirm, setSetConfirm] = useState({})
  // Fortryd-toast (sletning) + beskeder auto-scroll
  const [undoToast, setUndoToast] = useState(null)
  const undoTimerRef = useRef(null)
  const messagesEndRef = useRef(null)
  // Session-kort refs, så vi kan scrolle en nyåbnet session op i toppen
  // (accordion: når en session over kollapser, hopper layoutet ellers så man
  // lander midt/nederst i den nye session i stedet for ved første øvelse).
  const sessionRefs = useRef({})
  // In-app toast + bekræftelses-modal (erstatter native alert/confirm)
  const [flash, setFlash] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const flashTimerRef = useRef(null)
  const [skipConfirmEx, setSkipConfirmEx] = useState(null)
  const [openRpePicker, setOpenRpePicker] = useState(null)

  // Session feedback state
  const [dismissedFeedback, setDismissedFeedback] = useState(new Set())
  const [feedbackInputs, setFeedbackInputs] = useState({})

  const [showRpeGuide, setShowRpeGuide] = useState(false)

  // Warmup state
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [warmupChecked, setWarmupChecked] = useState({})
  const [exWarmupExpanded, setExWarmupExpanded] = useState(new Set())
  const [exWarmupWeightOverride, setExWarmupWeightOverride] = useState({})
  const [exWarmupWeightEditing, setExWarmupWeightEditing] = useState(null)
  const [warmupPhase, setWarmupPhase] = useState('focus')
  const [warmupFocus, setWarmupFocus] = useState(null)
  const [warmupSubtype, setWarmupSubtype] = useState(null)
  const [warmupProblems, setWarmupProblems] = useState(new Set())
  const [warmupExercises, setWarmupExercises] = useState([])
  const [warmupStep, setWarmupStep] = useState(0)
  // Valgt øvelses-option pr. slot i opvarmnings-guiden (slot-index → option-index).
  // Nulstilles ved hver guide-start, så default altid er den første variant.
  const [warmupChoice, setWarmupChoice] = useState({})
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  const timerRef = useRef(null)

  // Mobilitet-hub state — fanen er en intent-landing (null) med tre døre
  const [mobilityMode, setMobilityMode] = useState(null) // null=landing | 'opvarmning' | 'mobilitet'

  // Mobilitets-session (on-demand: byg en session nu, ingen persistens/streak)
  const [mobilityPhase, setMobilityPhase] = useState('intake')  // 'intake' | 'design' | 'guide' | 'done'
  const [mobilityIntake, setMobilityIntake] = useState({ time: 10, sitting: 'med', lifts: [], problems: [] })
  const [mobilitySlots, setMobilitySlots] = useState([])        // valgte øvelser: [{ area, choiceIdx }]
  const [mobilityStep, setMobilityStep] = useState(0)

  // Stævnedag state
  const [hasMeetPlan, setHasMeetPlan] = useState(false)
  const [meetType, setMeetType] = useState('sbd')
  const [meetPlanNotes, setMeetPlanNotes] = useState('')
  const [meetWarmupEditing, setMeetWarmupEditing] = useState(null)
  const [meetWarmupDraft, setMeetWarmupDraft] = useState([])
  const [meetWarmupOverrides, setMeetWarmupOverrides] = useState({})
  const [meetResults, setMeetResults] = useState([])
  const [meetAttempts, setMeetAttempts] = useState({
    squat:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
    bench:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
    deadlift: [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
  })

  // Onboarding
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem('entropi_onboarded'))

  // Readiness state
  const [readinessLog, setReadinessLog] = useState(null)
  const [readinessInput, setReadinessInput] = useState({ sleep: '', energy: null, motivation: null, stress: null, soreness: null, soreZones: [] })
  const [savingReadiness, setSavingReadiness] = useState(false)
  const [readinessError, setReadinessError] = useState(null)

  useEffect(() => { fetchAthlete() }, [])
  useEffect(() => { if (athlete) fetchLogs(athlete.id, kostDate) }, [kostDate, athlete?.id])
  useEffect(() => { if (tab === 'beskeder' && athlete) { fetchAthleteMessages(); markMessagesAsRead() } }, [tab, athlete?.id])
  useEffect(() => { if (tab === 'beskeder') messagesEndRef.current?.scrollIntoView({ block: 'end' }) }, [messages, tab])
  useEffect(() => { if (tab === 'stævnedag' && athlete) { fetchMeetPlan(athlete.id); fetchMeetResults(athlete.id) } }, [tab, athlete?.id])

  /* eslint-disable react-hooks/set-state-in-effect -- bevidst: seeder initial opvarmnings-fokus fra programmet + driver nedtællings-timeren */
  useEffect(() => {
    if (tab === 'mobilisering' && mobilityMode === 'opvarmning' && currentWeek && warmupPhase === 'focus' && !warmupFocus) {
      for (const session of currentWeek.sessions || []) {
        for (const ex of session.exercises || []) {
          const n = (ex.name || '').toLowerCase()
          if (n.includes('squat')) { setWarmupFocus('Squat'); return }
          if (n.includes('bænk') || n.includes('bench')) { setWarmupFocus('Bænkpres'); return }
          if (n.includes('sumo')) { setWarmupFocus('Dødløft'); setWarmupSubtype('Sumo'); return }
          if (n.includes('dødl') || n.includes('deadlift')) { setWarmupFocus('Dødløft'); return }
        }
      }
    }
  }, [tab, currentWeek, mobilityMode])

  useEffect(() => {
    if (!timerActive) return
    if (timerSeconds <= 0) { setTimerActive(false); setTimerDone(true); return }
    timerRef.current = setTimeout(() => setTimerSeconds(s => s - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timerActive, timerSeconds])

  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoadError(true), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  async function fetchAthlete() {
    if (!coachAthleteId && role !== 'athlete') { setLoading(false); return }
    const { data, error } = await withRetry(() =>
      (coachAthleteId
        ? supabase.from('athletes').select('*').eq('id', coachAthleteId)
        : supabase.from('athletes').select('*').eq('email', session.user.email)
      ).maybeSingle()
    )
    // Reel fejl: vis fejl/retry-skærmen i stedet for misvisende "ikke tilknyttet".
    // (Bliver i loading-tilstanden, som renderer loadError-grenen med "Prøv igen".)
    if (error) { setLoadError(true); return }
    if (data) {
      if (!coachAthleteId && !data.user_id) {
        await supabase.rpc('claim_athlete_profile')
      }
      if (!coachAthleteId) {
        supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', session.user.id)
      }
      setAthlete(data)
      fetchLogs(data.id)
      fetchCustomFoods(data.id)
      fetchMealTemplates(data.id)
      fetchHistoricalMealLogs(data.id)
      fetchFrequentFoods(data.id)
      fetchProgram(data.id)
      fetchAthleteMessages(data.id)
      fetchWeightLogs(data.id)
      fetchReadiness(data.id)
      fetchWarmupTemplates(data.id)
      fetchMeetPlan(data.id)
      fetchMeetResults(data.id)
    }
    setLoading(false)
  }

  async function fetchMeetPlan(athleteId) {
    const { data } = await supabase.from('meet_plans').select('*').eq('athlete_id', athleteId).maybeSingle()
    setHasMeetPlan(!!data)
    if (data) {
      setMeetType(data.meet_type || 'sbd')
      setMeetPlanNotes(data.notes || '')
      setMeetAttempts({
        squat:    [{ w: data.squat1 ?? '', r: null }, { w: data.squat2 ?? '', r: null }, { w: data.squat3 ?? '', r: null }],
        bench:    [{ w: data.bench1 ?? '', r: null }, { w: data.bench2 ?? '', r: null }, { w: data.bench3 ?? '', r: null }],
        deadlift: [{ w: data.dead1  ?? '', r: null }, { w: data.dead2  ?? '', r: null }, { w: data.dead3  ?? '', r: null }],
      })
    }
  }

  async function fetchMeetResults(athleteId) {
    const { data } = await supabase
      .from('meet_results')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('meet_date', { ascending: false })
    setMeetResults(data || [])
  }

  async function fetchWarmupTemplates(athleteId) {
    const { data } = await supabase
      .from('warmup_templates')
      .select('*')
      .eq('athlete_id', athleteId)
    setWarmupTemplates(data || [])
  }

  function isMainLift(name) {
    const n = (name || '').toLowerCase()
    // Variationer der trænes som accessory (lettere ramp). Bemærk: 'sumo' er IKKE
    // her — sumo dødløft er et primært konkurrenceløft og skal have fuld
    // opvarmnings-ramp (ellers ender et tungt topsæt med kun ét spring op).
    if (n.includes('romanian') || n.includes('rumæn') || n.includes('rdl') || n.includes('stiff') || n.includes('front squat') || n.includes('hack') || n.includes('goblet')) return false
    return n.includes('squat') || n.includes('bænk') || n.includes('bench') || n.includes('dødl') || n.includes('deadlift')
  }

  function calcWarmupSets(workingWeight, plannedReps = 1, exName = '') {
    if (!workingWeight || workingWeight <= 20) return []
    const round = w => {
      const pct = w / workingWeight
      if (pct < 0.60) return Math.round(w / 10) * 10
      if (pct < 0.85) return Math.round(w / 5) * 5
      return Math.round(w / 2.5) * 2.5
    }
    const n = parseInt(plannedReps) || 1

    // Accessory work: 1 set at 60%, or 2 sets for high-load machines (benpress/leg press)
    if (!isMainLift(exName)) {
      const nm = (exName || '').toLowerCase()
      const isHighLoad = nm.includes('benpress') || nm.includes('leg press') || nm.includes('benpres')
      if (isHighLoad) {
        const sets = []
        const w1 = round(workingWeight * 0.50), w2 = round(workingWeight * 0.75)
        if (w1 > 20 && workingWeight - w1 >= 20) sets.push({ weight: w1, reps: 5, pct: '50%' })
        if (w2 > 20 && workingWeight - w2 >= 15 && (!sets.length || w2 - sets[sets.length - 1].weight >= 10)) sets.push({ weight: w2, reps: 3, pct: '75%' })
        return sets
      }
      const w = round(workingWeight * 0.60)
      if (w <= 20 || workingWeight - w < 15) return []
      return [{ weight: w, reps: 6, pct: '60%' }]
    }

    // Last warmup always close to working weight so the body feels the load before the work set.
    let targets
    if (n <= 2) {
      targets = [
        { pct: 0.47, reps: 3 },
        { pct: 0.73, reps: 2 },
        { pct: 0.87, reps: 1 },
        { pct: 0.95, reps: 1 },
      ]
    } else if (n <= 4) {
      targets = [
        { pct: 0.40, reps: n },
        { pct: 0.57, reps: n },
        { pct: 0.73, reps: n },
        { pct: 0.87, reps: 2 },
        { pct: 0.95, reps: 1 },
      ]
    } else if (n <= 6) {
      targets = [
        { pct: 0.55, reps: n },
        { pct: 0.73, reps: Math.ceil(n * 0.7) },
        { pct: 0.90, reps: 2 },
      ]
    } else if (n <= 9) {
      targets = [
        { pct: 0.60, reps: Math.min(n, 6) },
        { pct: 0.80, reps: 4 },
        { pct: 0.90, reps: 2 },
      ]
    } else {
      targets = [
        { pct: 0.60, reps: 6 },
        { pct: 0.80, reps: 4 },
      ]
    }

    // Limit number of loaded sets based on working weight
    const maxSets = workingWeight < 60 ? 2 : workingWeight < 100 ? 3 : workingWeight < 200 ? 4 : 5

    // Minimum jump scales with working weight — 8% floor at 5kg so light benchers don't lose top sets
    const minJump = Math.max(5, workingWeight * 0.08)

    const raw = []
    for (const { pct, reps } of targets) {
      const w = round(workingWeight * pct)
      if (w <= 20) continue
      if (raw.length && w - raw[raw.length - 1].weight < minJump) continue
      if (w >= workingWeight) continue
      raw.push({ weight: w, reps, pct: `${Math.round(pct * 100)}%` })
    }

    return [
      { weight: 20, reps: 5, pct: 'Stang' },
      ...raw.slice(-maxSets),
    ]
  }

  async function fetchReadiness(athleteId) {
    const { data } = await supabase
      .from('readiness_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('logged_date', today())
      .maybeSingle()
    setReadinessLog(data || null)
  }

  function suggestNextWeight(exName, intensity) {
    const targetRpe = parsePlannedRpe(intensity)
    if (!targetRpe) return null
    const hist = exerciseHistory[exName?.toLowerCase()] || []
    if (!hist.length) return null
    const lastSession = hist[0]
    if (lastSession.date === today()) return null // currently logging this session
    const setsWithRpe = lastSession.sets.filter(s => s.rpe != null && s.weight > 0)
    if (!setsWithRpe.length) return null
    const ref = setsWithRpe[setsWithRpe.length - 1]
    const roundTo25 = w => Math.round(w / 2.5) * 2.5
    const suggested = roundTo25(ref.weight * (1 + (targetRpe - ref.rpe) * 0.03))
    if (suggested <= 0) return null
    return { weight: suggested, fromRpe: ref.rpe, baseWeight: ref.weight }
  }

  function calcReadinessScore({ sleep, energy, motivation, stress, soreness }) {
    // Vægtet model: hvert element scores 0-100 og vægtes til samlet parathed.
    // Neutrale svar (3/5 + 7-9t søvn) → ~63; kun friske svar nærmer sig 100.
    const sub = [] // [delscore, vægt]
    const h = parseFloat(sleep) || 0
    if (h > 0) {
      let sleepScore
      if (h >= 7 && h <= 9) sleepScore = 100
      else if (h > 9 && h <= 10) sleepScore = 85
      else if (h >= 6 && h < 7) sleepScore = 80
      else if (h >= 5 && h < 6) sleepScore = 55
      else if (h > 10) sleepScore = 70
      else sleepScore = 30 // < 5t
      sub.push([sleepScore, 0.25])
    }
    const lin = v => ((v - 1) / 4) * 100 // 1→0, 3→50, 5→100 (højere = bedre)
    const inv = v => ((5 - v) / 4) * 100 // 1→100, 3→50, 5→0 (lavere = bedre)
    if (energy) sub.push([lin(energy), 0.25])
    if (motivation) sub.push([lin(motivation), 0.15])
    if (stress) sub.push([inv(stress), 0.15])
    if (soreness) sub.push([inv(soreness), 0.20])
    if (!sub.length) return null
    const totalW = sub.reduce((a, [, w]) => a + w, 0)
    const score = sub.reduce((a, [s, w]) => a + s * w, 0) / totalW
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async function saveReadiness() {
    if (!athlete) return
    const missing = []
    if (!readinessInput.energy) missing.push('energi')
    if (!readinessInput.motivation) missing.push('motivation')
    if (!readinessInput.stress) missing.push('stress')
    if (!readinessInput.soreness) missing.push('ømhed')
    if (missing.length) { setReadinessError('Mangler: ' + missing.join(', ')); return }
    setSavingReadiness(true)
    setReadinessError(null)
    const score = calcReadinessScore(readinessInput)
    const payload = {
      athlete_id: athlete.id,
      logged_date: today(),
      sleep_hours: parseFloat(readinessInput.sleep) || null,
      energy: readinessInput.energy,
      motivation: readinessInput.motivation,
      stress: readinessInput.stress,
      soreness_level: readinessInput.soreness,
      sore_zones: readinessInput.soreZones.length > 0 ? readinessInput.soreZones : null,
      readiness_score: score,
    }
    const { error } = await supabase.from('readiness_logs').insert(payload)
    setSavingReadiness(false)
    if (error) {
      setReadinessError(error.message)
    } else {
      setReadinessLog({ ...payload })
    }
  }

  async function fetchProgram(athleteId) {
    const { data } = await supabase
      .from('weeks')
      .select('*, sessions(*, exercises(*))')
      .eq('athlete_id', athleteId)
      .order('week_number', { ascending: true })
    if (!data || data.length === 0) return
    const weeks = data.map(w => ({
      ...w,
      sessions: (w.sessions || [])
        .sort((a, b) => a.session_order - b.session_order)
        .map(s => ({ ...s, exercises: (s.exercises || []).sort((a, b) => a.exercise_order - b.exercise_order) }))
    }))
    setAllWeeks(weeks)
    const activeIdx = computeActiveWeekIdx(weeks)
    setViewingWeekIdx(activeIdx)
    const activeWeek = weeks[activeIdx]
    setCurrentWeek(activeWeek)
    fetchExerciseLogs(athleteId, activeWeek)
    fetchLastLogs(athleteId, activeWeek)
    fetchExerciseHistory(athleteId)
  }

  // Åbn/luk en session i programmet. Ved åbning scrolles dens header op i
  // toppen (efter accordion'en har foldet/foldet ud), så man altid lander ved
  // første øvelse — ikke midt/nederst i sessionen.
  function openSession(sessionId) {
    setProgOpenSession(sessionId)
    if (sessionId) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        sessionRefs.current[sessionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }))
    }
  }


  async function fetchPastLogs(week, athleteId) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setPastLogs([]); return }
    const { data } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .in('exercise_id', exerciseIds)
    setPastLogs(data || [])
  }

  async function fetchExerciseLogs(athleteId, week) {
    const exerciseIds = (week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id))
    if (exerciseIds.length === 0) { setExerciseLogs([]); return }
    const { data } = await supabase
      .from('exercise_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .in('exercise_id', exerciseIds)
    setExerciseLogs(data || [])
    const inputs = {}
    for (const log of (data || [])) {
      inputs[`${log.exercise_id}_${log.set_number}`] = {
        weight: log.weight?.toString() || '',
        note: log.note || '',
        rpe: log.rpe_actual?.toString() || '',
      }
    }
    setLogInputs(prev => ({ ...prev, ...inputs }))
  }

  async function fetchLastLogs(athleteId, week) {
    const exerciseNames = [...new Set((week?.sessions || []).flatMap(s => (s.exercises || []).map(e => e.name)))]
    if (exerciseNames.length === 0) return
    const { data } = await supabase
      .from('exercise_logs')
      .select('weight, reps_completed, logged_at, exercises(name)')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(500)
    if (!data) return
    const map = {}
    for (const log of data) {
      const name = log.exercises?.name
      if (name && !map[name.toLowerCase()] && (log.weight > 0 || log.reps_completed > 0)) {
        map[name.toLowerCase()] = { weight: log.weight, reps_completed: log.reps_completed }
      }
    }
    setLastLogByExerciseName(map)
  }

  async function fetchExerciseHistory(athleteId) {
    const { data } = await supabase
      .from('exercise_logs')
      .select('weight, reps_completed, rpe_actual, logged_at, set_number, exercises(name)')
      .eq('athlete_id', athleteId)
      .eq('skipped', false)
      .gt('weight', 0)
      .order('logged_at', { ascending: false })
      .limit(1500)
    if (!data) return
    const byName = {}
    for (const log of data) {
      const name = log.exercises?.name?.toLowerCase()
      if (!name) continue
      const date = log.logged_at.slice(0, 10)
      if (!byName[name]) byName[name] = {}
      if (!byName[name][date]) byName[name][date] = []
      byName[name][date].push({ weight: log.weight, reps: log.reps_completed, rpe: log.rpe_actual, set: log.set_number })
    }
    const history = {}
    for (const [name, dateMap] of Object.entries(byName)) {
      const dates = Object.keys(dateMap).sort().reverse().slice(0, 3)
      history[name] = dates.map(date => ({ date, sets: dateMap[date].sort((a, b) => a.set - b.set) }))
    }
    setExerciseHistory(history)
  }

  async function logSet(exerciseId, setNumber, totalSets, repsCompleted, plannedRpe) {
    const key = `${exerciseId}_${setNumber}`
    const input = logInputs[key] || {}
    setSetConfirm(p => { const n = { ...p }; delete n[key]; return n })
    const payload = {
      weight: parseFloat(input.weight) || 0,
      reps_completed: parseInt(repsCompleted) || 0,
      note: input.note || null,
      // Ingen egen RPE valgt → gem den planlagte RPE, så vi altid har data at
      // autoregulere på. Rører atleten vælgeren, gemmes deres værdi i stedet.
      rpe_actual: input.rpe ? parseFloat(input.rpe) : (plannedRpe ?? null),
      rpe_planned: plannedRpe ?? null,
      skipped: false,
    }
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    let error
    if (existing) {
      ;({ error } = await supabase.from('exercise_logs').update(payload).eq('id', existing.id))
    } else {
      ;({ error } = await supabase.from('exercise_logs').insert({
        exercise_id: exerciseId,
        athlete_id: athlete.id,
        set_number: setNumber,
        ...payload,
      }))
    }
    if (error) {
      setSetConfirm(p => ({ ...p, [key]: 'error' }))
      return
    }
    setSetConfirm(p => ({ ...p, [key]: 'saved' }))
    setTimeout(() => {
      setSetConfirm(p => ({ ...p, [key]: 'fading' }))
      setTimeout(() => setSetConfirm(p => { const n = { ...p }; delete n[key]; return n }), 300)
    }, 1700)
    // Auto-fill next set weight if empty
    if (setNumber < totalSets) {
      const nextKey = `${exerciseId}_${setNumber + 1}`
      setLogInputs(p => ({
        ...p,
        [nextKey]: { weight: p[nextKey]?.weight || input.weight, note: p[nextKey]?.note || '' },
      }))
    }
    fetchExerciseLogs(athlete.id, currentWeek)

    // PR-detektion (est. 1RM-baseret, Epley) — skelner vægt/rep/styrke-PR
    const newReps = parseInt(repsCompleted) || 0
    if (payload.weight > 0 && newReps > 0) {
      const exerciseName = allWeeks
        .flatMap(w => w.sessions || [])
        .flatMap(s => s.exercises || [])
        .find(e => e.id === exerciseId)?.name
      if (exerciseName) {
        const e1rm = r => (r.weight || 0) * (1 + (r.reps || 1) / 30)
        const newSet = { weight: payload.weight, reps: newReps }
        const { data: prData } = await supabase
          .from('personal_records')
          .select('weight, reps')
          .eq('athlete_id', athlete.id)
          .eq('exercise_name', exerciseName)
        const rows = prData || []
        const savePR = () => supabase.from('personal_records').insert({
          athlete_id: athlete.id,
          exercise_name: exerciseName,
          weight: newSet.weight,
          reps: newSet.reps,
        })
        if (rows.length === 0) {
          // Allerførste registrering på øvelsen → gem baseline uden notifikation
          await savePR()
        } else {
          const bestWeight = Math.max(...rows.map(r => r.weight || 0))
          const bestE1rm = Math.max(...rows.map(e1rm))
          // Flest reps tidligere på en vægt mindst lige så tung som det nye sæt
          const repsAtWeight = rows.filter(r => (r.weight || 0) >= newSet.weight).map(r => r.reps || 0)
          const bestRepsAtWeight = repsAtWeight.length ? Math.max(...repsAtWeight) : 0
          let prType = null
          if (newSet.weight > bestWeight) prType = 'vægt'
          else if (bestRepsAtWeight > 0 && newSet.reps > bestRepsAtWeight) prType = 'rep'
          else if (e1rm(newSet) > bestE1rm * 1.001) prType = 'styrke'
          if (prType) {
            await savePR()
            setPrToast({ name: exerciseName, type: prType })
            setPrToastFading(false)
            setTimeout(() => setPrToastFading(true), 2400)
            setTimeout(() => setPrToast(null), 3000)
          }
        }
      }
    }
  }

  async function skipSet(exerciseId, setNumber, plannedRpe) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    const payload = { skipped: true, weight: 0, reps_completed: 0, note: null, rpe_actual: null, rpe_planned: plannedRpe ?? null }
    if (existing) {
      await supabase.from('exercise_logs').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('exercise_logs').insert({ exercise_id: exerciseId, athlete_id: athlete.id, set_number: setNumber, ...payload })
    }
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function skipExercise(ex) {
    const plannedRpe = parsePlannedRpe(ex.intensity)
    const toSkip = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).filter(setNum =>
      !exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum)
    )
    if (toSkip.length === 0) return
    await supabase.from('exercise_logs').insert(
      toSkip.map(setNum => ({ exercise_id: ex.id, athlete_id: athlete.id, set_number: setNum, skipped: true, weight: 0, reps_completed: 0, rpe_planned: plannedRpe ?? null }))
    )
    fetchExerciseLogs(athlete.id, currentWeek)
  }

  async function unskipSet(exerciseId, setNumber) {
    const existing = exerciseLogs.find(l => l.exercise_id === exerciseId && l.set_number === setNumber)
    if (existing) {
      await supabase.from('exercise_logs').delete().eq('id', existing.id)
      fetchExerciseLogs(athlete.id, currentWeek)
    }
  }

  async function saveFeedback(sessionId) {
    const input = feedbackInputs[sessionId] || {}
    if (!input.rating) return
    await supabase.from('sessions').update({
      athlete_rating: input.rating,
      athlete_comment: input.comment || null,
    }).eq('id', sessionId)
    setAllWeeks(prev => prev.map(w => ({
      ...w,
      sessions: (w.sessions || []).map(s => s.id === sessionId ? { ...s, athlete_rating: input.rating, athlete_comment: input.comment || null } : s),
    })))
  }

  async function fetchWeightLogs(athleteId) {
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('logged_at', { ascending: false })
      .limit(30)
    setWeightLogs(data || [])
  }

  async function logWeight() {
    if (!weightInput || !athlete) return
    setSavingWeight(true)
    const todayStr = today()
    const existing = weightLogs.find(l => l.logged_at === todayStr)
    if (existing) {
      await supabase.from('weight_logs').update({ weight: parseFloat(weightInput) }).eq('id', existing.id)
    } else {
      await supabase.from('weight_logs').insert({ athlete_id: athlete.id, weight: parseFloat(weightInput), logged_at: todayStr })
    }
    setSavingWeight(false)
    setWeightInput('')
    fetchWeightLogs(athlete.id)
  }

  async function fetchAthleteMessages(id) {
    const athleteId = id || athlete?.id
    if (!athleteId) return
    const { data } = await supabase.from('messages').select('*').eq('athlete_id', athleteId).order('created_at')
    const msgs = data || []
    setMessages(msgs)
    const unread = msgs.filter(m => m.sender_role === 'coach' && !m.read_at).length
    setUnreadMsgCount(unread)
  }

  async function markMessagesAsRead() {
    if (!athlete) return
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('athlete_id', athlete.id)
      .eq('sender_role', 'coach')
      .is('read_at', null)
    setUnreadMsgCount(0)
  }

  async function sendAthleteMessage() {
    if (!messageInput.trim() || !athlete) return
    await supabase.from('messages').insert({ athlete_id: athlete.id, sender_role: 'athlete', content: messageInput.trim() })
    setMessageInput('')
    fetchAthleteMessages(athlete.id)
  }

  function formatMsgTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const dayDiff = Math.floor((today - msgDay) / 86400000)
    const time = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
    if (dayDiff === 0) return time
    if (dayDiff === 1) return `I går ${time}`
    if (dayDiff < 7) return d.toLocaleDateString('da-DK', { weekday: 'long' }) + ' ' + time
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' }) + ' ' + time
  }

  async function fetchLogs(athleteId, date = kostDate) {
    const { data } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('date', date)
      .order('created_at')
    setLogs(data || [])
  }

  async function fetchHistoricalMealLogs(athleteId) {
    const from = new Date()
    from.setDate(from.getDate() - 28)
    const { data } = await supabase
      .from('meal_logs')
      .select('date, kcal')
      .eq('athlete_id', athleteId)
      .gte('date', from.toISOString().slice(0, 10))
      .order('date')
    setHistoricalMealLogs(data || [])
  }

  // Find de fødevarer atleten oftest logger (sidste 30 dage) til hurtig gen-log.
  async function fetchFrequentFoods(athleteId) {
    const from = new Date()
    from.setDate(from.getDate() - 30)
    const { data } = await supabase
      .from('meal_logs')
      .select('meal, kcal, protein, carb, fat, date')
      .eq('athlete_id', athleteId)
      .gte('date', from.toISOString().slice(0, 10))
      .order('date', { ascending: false })
    const map = new Map()
    for (const l of data || []) {
      if (!map.has(l.meal)) map.set(l.meal, { meal: l.meal, kcal: l.kcal, protein: l.protein, carb: l.carb, fat: l.fat, count: 0 })
      map.get(l.meal).count++
    }
    const list = [...map.values()].filter(f => f.count >= 2).sort((a, b) => b.count - a.count).slice(0, 8)
    setFrequentFoods(list)
  }

  async function quickLogFood(f) {
    if (!athlete) return
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id, date: kostDate,
      meal: f.meal, kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat,
    })
    fetchLogs(athlete.id)
  }

  async function fetchMealTemplates(athleteId) {
    const { data } = await supabase
      .from('meal_templates')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
    setMealTemplates(data || [])
  }

  async function copyYesterday() {
    const yStr = shiftDate(kostDate, -1) // dagen før den viste dag
    const { data } = await supabase
      .from('meal_logs')
      .select('meal, kcal, protein, carb, fat')
      .eq('athlete_id', athlete.id)
      .eq('date', yStr)
    if (!data || data.length === 0) return
    await supabase.from('meal_logs').insert(
      data.map(item => ({ ...item, athlete_id: athlete.id, date: kostDate }))
    )
    fetchLogs(athlete.id)
  }

  async function saveTemplate() {
    if (!templateNameInput.trim() || !logs.length || !athlete) return
    const items = logs.map(({ meal, kcal, protein, carb, fat }) => ({ meal, kcal, protein, carb, fat }))
    await supabase.from('meal_templates').insert({ athlete_id: athlete.id, name: templateNameInput.trim(), items })
    fetchMealTemplates(athlete.id)
    setShowSaveTemplate(false)
    setTemplateNameInput('')
  }

  async function logTemplate(template) {
    if (!athlete) return
    await supabase.from('meal_logs').insert(
      template.items.map(item => ({ ...item, athlete_id: athlete.id, date: kostDate }))
    )
    fetchLogs(athlete.id)
    setShowTemplates(false)
  }

  async function deleteTemplate(id) {
    await supabase.from('meal_templates').delete().eq('id', id)
    setMealTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function fetchCustomFoods(athleteId) {
    // RLS returnerer delte fødevarer (is_shared) + egne. Tag 'mine' til badges/sletning.
    const { data } = await supabase
      .from('custom_foods')
      .select('*')
      .order('name', { ascending: true })
    setCustomFoods((data || []).map(f => ({ ...f, mine: f.athlete_id === athleteId })))
  }

  function onSearchInput(e) {
    const q = e.target.value
    setSearchQuery(q)
    setSelectedFood(null)
    if (q.length < 2) { setSearchResults([]); return }
    const ql = q.toLowerCase()
    const custom = customFoods
      .filter(f => f.name.toLowerCase().includes(ql))
      .map(f => ({ ...f, isCustom: f.mine, isShared: !f.mine }))
    const builtin = LOCAL_FOODS.filter(f => f.name.toLowerCase().includes(ql))
    setSearchResults([...custom, ...builtin])
  }

  function selectFood(f) {
    setSelectedFood(f)
    setSearchQuery(f.name)
    setSearchResults([])
    // Hvis fødevaren har en stk-enhed, default til 1 af den (hurtigere); ellers 100 g.
    const units = unitsForFood(f)
    if (units.length > 1) { setUnitIdx(1); setAmount('1') }
    else { setUnitIdx(0); setAmount('100') }
  }

  async function addFromSearch() {
    if (!selectedFood || !athlete) return
    const units = unitsForFood(selectedFood)
    const unit = units[unitIdx] || units[0]
    const amt = parseFloat(amount) || 0
    const grams = amt * unit.grams
    const ratio = grams / 100
    // Beskriv portionen i navnet når enheden ikke er gram, så loggen er læsbar.
    const label = unit.label === 'g'
      ? `${selectedFood.name} · ${Math.round(grams)} g`
      : `${selectedFood.name} · ${amt} ${unit.label} (${Math.round(grams)} g)`
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id,
      date: kostDate,
      meal: label,
      kcal: Math.round(selectedFood.kcal100 * ratio),
      protein: Math.round(selectedFood.protein100 * ratio),
      carb: Math.round(selectedFood.carb100 * ratio),
      fat: Math.round(selectedFood.fat100 * ratio),
    })
    setSelectedFood(null)
    setSearchQuery('')
    fetchLogs(athlete.id)
  }

  // Hurtig-tilføj direkte fra søgeresultatet: 1 stk-enhed hvis den findes, ellers 100 g.
  // Rydder IKKE søgningen, så man kan trykke + på flere varer i træk (multi-add).
  async function quickAddSearchFood(f) {
    if (!athlete) return
    const units = unitsForFood(f)
    const unit = units.length > 1 ? units[1] : units[0]
    const amt = unit.label === 'g' ? 100 : 1
    const grams = amt * unit.grams
    const ratio = grams / 100
    const label = unit.label === 'g'
      ? `${f.name} · ${Math.round(grams)} g`
      : `${f.name} · ${amt} ${unit.label} (${Math.round(grams)} g)`
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id,
      date: kostDate,
      meal: label,
      kcal: Math.round(f.kcal100 * ratio),
      protein: Math.round(f.protein100 * ratio),
      carb: Math.round(f.carb100 * ratio),
      fat: Math.round(f.fat100 * ratio),
    })
    fetchLogs(athlete.id)
    showFlash(`${f.name} tilføjet`)
  }

  async function saveCustomFood() {
    if (!createFood.name.trim() || !athlete) return
    const food = {
      athlete_id: athlete.id,
      name: createFood.name.trim(),
      kcal100: parseFloat(createFood.kcal100) || 0,
      protein100: parseFloat(createFood.protein100) || 0,
      carb100: parseFloat(createFood.carb100) || 0,
      fat100: parseFloat(createFood.fat100) || 0,
      unit_label: createFood.unit_label.trim() || null,
      unit_grams: parseFloat(createFood.unit_grams) || null,
      is_shared: shareFood,
    }
    const { data } = await supabase.from('custom_foods').insert(food).select().maybeSingle()
    if (data) {
      const saved = { ...data, isCustom: true, mine: true }
      setCustomFoods(prev => [saved, ...prev])
      selectFood(saved)
      setShowCreateFood(false)
      setCreateFood({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
    }
  }

  async function autoCompleteSession(session) {
    const exerciseIds = (session.exercises || []).map(e => e.id)
    if (exerciseIds.length === 0) { showFlash('Ingen øvelser fundet i sessionen.', 'error'); return }

    const { data: existing, error: fetchErr } = await supabase
      .from('exercise_logs')
      .select('exercise_id, set_number')
      .eq('athlete_id', athlete.id)
      .in('exercise_id', exerciseIds)
    if (fetchErr) { showFlash('Fejl ved hentning: ' + fetchErr.message, 'error'); return }

    const logged = new Set((existing || []).map(l => `${l.exercise_id}_${l.set_number}`))
    const rows = []
    for (const ex of (session.exercises || [])) {
      const last = lastLogByExerciseName[ex.name?.toLowerCase()]
      const weight = last?.weight ?? parseFloat(ex.recommended_weight) ?? 0
      const reps = last?.reps_completed ?? parseInt(ex.reps) ?? 0
      // Ikke-skippede sæt får planlagt RPE som faktisk RPE (samme logik som logSet).
      const plannedRpe = parsePlannedRpe(ex.intensity)
      for (let n = 1; n <= (parseInt(ex.sets) || 0); n++) {
        if (logged.has(`${ex.id}_${n}`)) continue
        rows.push({ exercise_id: ex.id, athlete_id: athlete.id, set_number: n, weight, reps_completed: reps, note: null, rpe_actual: plannedRpe ?? null, rpe_planned: plannedRpe ?? null, skipped: false })
      }
    }

    if (rows.length === 0) {
      showFlash('Alle sæt er allerede logget.')
      return
    }

    const { error: insertErr } = await supabase.from('exercise_logs').insert(rows)
    if (insertErr) { showFlash('Fejl ved indsætning: ' + insertErr.message, 'error'); return }

    showFlash(`${rows.length} sæt udfyldt.`)
    await fetchExerciseLogs(athlete.id, currentWeek)
    await fetchPastLogs(allWeeks[viewingWeekIdx], athlete.id)
  }

  async function deleteLog(l) {
    await supabase.from('meal_logs').delete().eq('id', l.id)
    fetchLogs(athlete.id)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast({
      label: 'Måltid slettet',
      restore: { athlete_id: athlete.id, date: l.date, meal: l.meal, kcal: l.kcal, protein: l.protein, carb: l.carb, fat: l.fat },
    })
    undoTimerRef.current = setTimeout(() => setUndoToast(null), 5000)
  }

  function showFlash(message, kind = 'info') {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash({ message, kind })
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000)
  }

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm })
  }

  async function undoDelete() {
    const t = undoToast
    if (!t) return
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoToast(null)
    await supabase.from('meal_logs').insert(t.restore)
    fetchLogs(athlete.id)
  }

  // Find gram-mængden i et logget måltidsnavn, fx "Kyllingebryst · 250 g" eller
  // "... (300 g)". Returnerer { base, grams } eller null hvis den ikke kan læses.
  function parseLoggedGrams(meal) {
    const m = String(meal).match(/(\d+)\s*g\)?\s*$/)
    if (!m) return null
    const grams = parseInt(m[1])
    if (!grams) return null
    return { base: String(meal).split(' · ')[0], grams }
  }

  function startEditLog(l) {
    setEditingLogId(l.id)
    const parsed = parseLoggedGrams(l.meal)
    if (parsed) setEditGrams(String(parsed.grams))
    else setEditGrams('')
    setEditMacros({ kcal: String(l.kcal ?? ''), protein: String(l.protein ?? ''), carb: String(l.carb ?? ''), fat: String(l.fat ?? '') })
  }

  async function saveEditLog(l) {
    const parsed = parseLoggedGrams(l.meal)
    let update
    if (parsed) {
      // Gram-skalering: vægt op/ned proportionalt og opdater gram i navnet.
      const newGrams = parseFloat(editGrams) || 0
      if (newGrams <= 0) return
      const factor = newGrams / parsed.grams
      update = {
        meal: `${parsed.base} · ${Math.round(newGrams)} g`,
        kcal: Math.round((l.kcal || 0) * factor),
        protein: Math.round((l.protein || 0) * factor),
        carb: Math.round((l.carb || 0) * factor),
        fat: Math.round((l.fat || 0) * factor),
      }
    } else {
      // Fallback: rediger makroerne direkte.
      update = {
        kcal: parseInt(editMacros.kcal) || 0,
        protein: parseInt(editMacros.protein) || 0,
        carb: parseInt(editMacros.carb) || 0,
        fat: parseInt(editMacros.fat) || 0,
      }
    }
    await supabase.from('meal_logs').update(update).eq('id', l.id)
    setEditingLogId(null)
    fetchLogs(athlete.id)
  }

  const totKcal = logs.reduce((a, l) => a + (l.kcal || 0), 0)
  const totProtein = logs.reduce((a, l) => a + (l.protein || 0), 0)
  const totCarb = logs.reduce((a, l) => a + (l.carb || 0), 0)
  const totFat = logs.reduce((a, l) => a + (l.fat || 0), 0)
  const kcalPct = athlete?.kcal_target ? Math.min(100, Math.round(totKcal / athlete.kcal_target * 100)) : 0
  const proteinPct = athlete?.protein_target ? Math.min(100, Math.round(totProtein / athlete.protein_target * 100)) : 0

  const pKcal = totProtein * 4
  const cKcal = totCarb * 4
  const fKcal = totFat * 9
  const macroTotal = pKcal + cKcal + fKcal || 1
  const circ = 2 * Math.PI * 48
  const pLen = (pKcal / macroTotal) * circ
  const cLen = (cKcal / macroTotal) * circ
  const fLen = (fKcal / macroTotal) * circ

  const tdeeEstimate = (() => {
    const kcalByDate = {}
    for (const log of historicalMealLogs) {
      kcalByDate[log.date] = (kcalByDate[log.date] || 0) + (log.kcal || 0)
    }
    const kcalDays = Object.values(kcalByDate)
    if (kcalDays.length < 7) return { ready: false, missingKcalDays: Math.max(0, 7 - kcalDays.length) }
    const wLogs = [...weightLogs].sort((a, b) => a.logged_at > b.logged_at ? 1 : -1)
    if (wLogs.length < 2) return { ready: false, missingWeight: true }
    const oldest = wLogs[0]
    const newest = wLogs[wLogs.length - 1]
    const daySpan = (new Date(newest.logged_at) - new Date(oldest.logged_at)) / 86400000
    if (daySpan < 7) return { ready: false, missingWeight: true }
    const avgKcal = kcalDays.reduce((a, b) => a + b, 0) / kcalDays.length
    const weightChangePrDay = (newest.weight - oldest.weight) / daySpan
    const tdee = Math.round(avgKcal - weightChangePrDay * 7700)
    const confidence = kcalDays.length >= 14 && daySpan >= 21 ? 'høj' : kcalDays.length >= 10 && daySpan >= 14 ? 'moderat' : 'lav'
    return { ready: true, tdee, avgKcal: Math.round(avgKcal), kcalDays: kcalDays.length, daySpan: Math.round(daySpan), confidence }
  })()

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 10 ? 'morgen' : hour < 12 ? 'formiddag' : hour < 17 ? 'eftermiddag' : 'aften'
  const days = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
  const months = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december']

  // Ferie: atleten er sat på ferie (ingen slutdato, eller slutdato i dag/fremtid).
  const onHoliday = athlete?.status === 'ferie' && (!athlete.vacation_until || athlete.vacation_until >= today())
  const holidayReturn = athlete?.vacation_until
    ? (() => { const d = new Date(athlete.vacation_until + 'T12:00:00'); return `${d.getDate()}. ${months[d.getMonth()]}` })()
    : null

  const backBtn = onExitPreview && (
    <button
      onClick={onExitPreview}
      style={{ background: 'rgba(200,146,58,0.12)', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(200,146,58,0.35)', padding: '0.35rem 0.85rem', cursor: 'pointer' }}
    >← Coach view</button>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', color: '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
      {loadError ? (
        <>
          <div style={{ color: '#7a7770' }}>Kunne ikke indlæse data.</div>
          {backBtn || <button style={s.btnGhost} onClick={() => window.location.reload()}>Prøv igen</button>}
        </>
      ) : 'Indlæser...'}
      {!loadError && backBtn}
    </div>
  )

  if (!athlete) return (
    <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Din konto er ikke tilknyttet en coach endnu.</div>
      <div style={{ color: '#4a4844', fontSize: '0.82rem' }}>Kontakt din coach — din e-mail skal registreres.</div>
      {backBtn || <button style={s.btnGhost} onClick={() => supabase.auth.signOut()}>Log ud</button>}
    </div>
  )

  const progressBars = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {[
        { label: 'Kalorier', val: totKcal, target: athlete.kcal_target, unit: 'kcal', pct: kcalPct, color: '#c8923a' },
        { label: 'Protein', val: totProtein, target: athlete.protein_target, unit: 'g', pct: proteinPct, color: '#6cba6c' },
      ].map(({ label, val, target, unit, pct, color }) => (
        <div key={label} style={s.card}>
          <div style={s.cardLabel}>{label}</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1, marginBottom: '0.6rem' }}>
            {val} <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.8rem', color: '#7a7770', fontWeight: 300 }}>/ {target || '?'} {unit}</span>
          </div>
          <div style={{ height: '3px', background: '#242420', borderRadius: '2px' }}>
            <div style={{ height: '3px', width: pct + '%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.35rem' }}>{pct}%</div>
        </div>
      ))}
    </div>
  )

  if (!onboarded && !coachAthleteId) {
    return (
      <div style={{ minHeight: '100vh', background: '#141410', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: '460px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', marginBottom: '2.75rem', letterSpacing: '0.02em' }}>
            Entropi<span style={{ color: '#c8923a' }}>.</span>
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.1rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.15, marginBottom: '1rem' }}>
            Velkommen, <em style={{ fontStyle: 'italic', color: '#c8923a' }}>{athlete.name.split(' ')[0]}</em>.
          </h1>
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, fontSize: '0.92rem', color: '#7a7770', lineHeight: 1.75, marginBottom: '2.5rem' }}>
            Her finder du dit træningsprogram, logger dine løft og holder styr på din udvikling.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2.5rem' }}>
            {[
              {
                label: 'Program',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="12" x2="18" y2="12" /><rect x="2" y="9.5" width="4" height="5" rx="1" /><rect x="18" y="9.5" width="4" height="5" rx="1" /><line x1="4" y1="9.5" x2="4" y2="14.5" /><line x1="20" y1="9.5" x2="20" y2="14.5" />
                  </svg>
                ),
              },
              {
                label: 'Kostlog',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><line x1="7" y1="2" x2="7" y2="22" /><path d="M21 15V2a5 5 0 0 0-5 5v6h3v7a1 1 0 0 0 2 0V15z" />
                  </svg>
                ),
              },
              {
                label: 'Readiness',
                icon: (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                ),
              },
            ].map(({ label, icon }) => (
              <div key={label} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ color: '#c8923a' }}>{icon}</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7a7770' }}>{label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { localStorage.setItem('entropi_onboarded', 'true'); setOnboarded(true) }}
            style={{ ...s.btnPrimary, fontSize: '0.7rem', padding: '0.85rem 2.75rem', letterSpacing: '0.14em' }}
          >
            Kom i gang →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      {openRpePicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setOpenRpePicker(null)} />
      )}
      {showRpeGuide && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setShowRpeGuide(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', borderRadius: '12px 12px 0 0', width: '100%', maxWidth: '480px', padding: '1.5rem 1.25rem 2rem', fontFamily: "'IBM Plex Mono', monospace" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: '#c8923a', textTransform: 'uppercase' }}>RPE-skala (RTS)</span>
              <button onClick={() => setShowRpeGuide(false)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
            </div>
            {[
              { rpe: '10',  label: 'Ingen gentagelser tilbage' },
              { rpe: '9.5', label: 'Muligvis 1 tilbage' },
              { rpe: '9',   label: '1 tilbage' },
              { rpe: '8.5', label: '1–2 tilbage' },
              { rpe: '8',   label: '2 tilbage' },
              { rpe: '7.5', label: '2–3 tilbage' },
              { rpe: '7',   label: '3 tilbage' },
              { rpe: '6.5', label: '3–4 tilbage' },
              { rpe: '6',   label: '4 tilbage' },
              { rpe: '5.5', label: '4–5 tilbage' },
            ].map(({ rpe, label }) => (
              <div key={rpe} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.45rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                <span style={{ fontSize: '0.82rem', color: '#c8923a', minWidth: '36px', textAlign: 'right' }}>{rpe}</span>
                <span style={{ fontSize: '0.72rem', color: '#edeae2', letterSpacing: '0.02em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* PR toast */}
      {prToast && (
        <div style={{
          position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: '1px solid rgba(200,146,58,0.55)',
          padding: '0.65rem 1.4rem', zIndex: 9999, whiteSpace: 'nowrap',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem',
          color: '#c8923a', letterSpacing: '0.08em',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
          opacity: prToastFading ? 0 : 1, transition: 'opacity 0.6s ease',
        }}>
          {prToast.type === 'vægt' ? '🏆 Ny vægt-PR' : prToast.type === 'rep' ? '🔥 Ny rep-PR' : '⚡ Stærkeste sæt'} på {prToast.name}!
        </div>
      )}
      {/* Fortryd-toast */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: '1px solid rgba(237,234,226,0.18)',
          padding: '0.6rem 0.75rem 0.6rem 1.1rem', zIndex: 9999, whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: '0.9rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#b8b4a8', letterSpacing: '0.06em' }}>{undoToast.label}</span>
          <button onClick={undoDelete} style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.3rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.45)' }}>Fortryd</button>
        </div>
      )}
      {/* Toast */}
      {flash && (
        <div style={{
          position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1c1c18', border: `1px solid ${flash.kind === 'error' ? 'rgba(224,85,85,0.55)' : 'rgba(200,146,58,0.55)'}`,
          padding: '0.65rem 1.4rem', zIndex: 10000, maxWidth: '90vw',
          fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em',
          color: flash.kind === 'error' ? '#e05555' : '#c8923a', boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>{flash.message}</div>
      )}
      {/* Bekræftelses-modal */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.6)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.13)', padding: '1.5rem', maxWidth: '360px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: '0.95rem', color: '#edeae2', lineHeight: 1.5, marginBottom: '1.25rem' }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button style={s.btnGhost} onClick={() => setConfirmDialog(null)}>Annuller</button>
              <button style={s.btnPrimary} onClick={() => { const fn = confirmDialog.onConfirm; setConfirmDialog(null); fn && fn() }}>Bekræft</button>
            </div>
          </div>
        </div>
      )}
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.logo}>Entropi<span style={{ color: '#c8923a' }}>.</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {backBtn}
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>{today()}</div>
        </div>
      </div>

      {/* Page content */}
      <div style={s.page}>

        {/* HJEM */}
        {tab === 'hjem' && onHoliday && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 1.25rem', minHeight: '60vh', justifyContent: 'center' }}>
            <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: '1.25rem' }}>🌴</div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 400, color: '#edeae2', margin: 0 }}>
              Du er på <em style={{ fontStyle: 'italic', color: '#5b9bb5' }}>ferie</em>
            </h1>
            <div style={{ fontSize: '0.95rem', color: '#7a7770', marginTop: '0.85rem', maxWidth: '320px', lineHeight: 1.5 }}>
              Nyd pausen — lad kroppen restituere. Din træning venter, når du er tilbage.
            </div>
            {holidayReturn && (
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5b9bb5', marginTop: '1.5rem', padding: '0.5rem 1rem', border: '1px solid rgba(91,155,181,0.3)', borderRadius: 4 }}>
                Tilbage d. {holidayReturn}
              </div>
            )}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.06em', color: '#4a4844', marginTop: '1.75rem' }}>
              Vil du alligevel træne? Åbn Program-fanen nedenfor.
            </div>
          </div>
        )}
        {tab === 'hjem' && !onHoliday && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                God <em style={{ fontStyle: 'italic', color: '#7a7770' }}>{greeting}</em>.
              </h1>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.25rem' }}>
                {days[now.getDay()]} d. {now.getDate()}. {months[now.getMonth()]} {now.getFullYear()}
              </div>
            </div>

            {!readinessLog && logs.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.13)', marginBottom: '1.25rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Start din dag — log din readiness
                </div>
              </div>
            )}

            <div style={s.card}>
              <div style={s.cardLabel}>Mit program</div>
              {!currentWeek ? (
                <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Intet program tilknyttet endnu.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>
                      Uge {currentWeek.week_number}{(() => { const r = fmtWeekRange(weekStartDate(allWeeks, currentWeek.week_number)); return r ? ` · ${r}` : '' })()}
                    </span>
                    {currentWeek.block_name && (
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>
                        {currentWeek.block_name}
                      </span>
                    )}
                  </div>
                  {(currentWeek.sessions || []).length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {(currentWeek.sessions || []).map(sess => (
                        <button
                          key={sess.id}
                          onClick={() => { setTab('program'); openSession(sess.id) }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(237,234,226,0.03)',
                            border: '1px solid rgba(237,234,226,0.07)',
                            color: '#edeae2',
                            padding: '0.6rem 0.75rem',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                            fontFamily: "'IBM Plex Sans', sans-serif",
                            fontWeight: 300,
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.35)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
                        >
                          <span style={{ fontSize: '0.88rem' }}>{sess.title}</span>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', flexShrink: 0, marginLeft: '0.75rem' }}>
                            {(sess.exercises || []).length} øvelser →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Readiness check */}
            {!readinessLog ? (
              <div style={s.card}>
                <div style={s.cardLabel}>Dagens parathed</div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={s.fieldLabel}>Søvn</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number" min="0" max="24" step="0.5" placeholder="timer"
                      value={readinessInput.sleep}
                      onChange={e => setReadinessInput(p => ({ ...p, sleep: e.target.value }))}
                      style={{ ...s.fieldInput, maxWidth: '90px', fontSize: '1.1rem', padding: '0.5rem 0.6rem', textAlign: 'center' }}
                    />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#7a7770', letterSpacing: '0.06em' }}>timer</span>
                  </div>
                </div>

                {[
                  ['energy', 'Energiniveau', '1 = ingen energi  ·  5 = fuld energi'],
                  ['motivation', 'Motivation', '1 = ingen lyst  ·  5 = klar til at løfte'],
                  ['stress', 'Stress', '1 = helt rolig  ·  5 = meget stresset'],
                  ['soreness', 'Muskelømhed', '1 = ingen ømhed  ·  5 = meget øm'],
                ].map(([key, label, hint]) => (
                  <div key={key} style={{ marginBottom: '1rem' }}>
                    <div style={s.fieldLabel}>{label}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{hint}</div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {[1, 2, 3, 4, 5].map(v => (
                        <button key={v}
                          onClick={() => setReadinessInput(p => ({ ...p, [key]: v }))}
                          style={{ flex: 1, padding: '0.9rem 0', fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', fontWeight: 500, border: `1px solid ${readinessInput[key] === v ? '#c8923a' : 'rgba(237,234,226,0.13)'}`, background: readinessInput[key] === v ? 'rgba(200,146,58,0.15)' : '#141410', color: readinessInput[key] === v ? '#c8923a' : '#7a7770', cursor: 'pointer' }}
                        >{v}</button>
                      ))}
                    </div>
                  </div>
                ))}

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={s.fieldLabel}>Lokal ømhed <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.04em', textTransform: 'none', fontWeight: 400 }}>(valgfrit)</span></div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {['Ben', 'Ryg', 'Skuldre/Arme', 'Core'].map(zone => {
                      const sel = readinessInput.soreZones.includes(zone)
                      return (
                        <button key={zone}
                          onClick={() => setReadinessInput(p => ({ ...p, soreZones: sel ? p.soreZones.filter(z => z !== zone) : [...p.soreZones, zone] }))}
                          style={{ padding: '0.5rem 0.9rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: `1px solid ${sel ? '#c8923a' : 'rgba(237,234,226,0.13)'}`, background: sel ? 'rgba(200,146,58,0.15)' : '#141410', color: sel ? '#c8923a' : '#7a7770', cursor: 'pointer' }}
                        >{zone}</button>
                      )
                    })}
                  </div>
                </div>

                {readinessError && (
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#e05555', marginBottom: '0.75rem', letterSpacing: '0.06em' }}>
                    {readinessError}
                  </div>
                )}
                {(() => {
                  const missing = []
                  if (!readinessInput.energy) missing.push('energi')
                  if (!readinessInput.motivation) missing.push('motivation')
                  if (!readinessInput.stress) missing.push('stress')
                  if (!readinessInput.soreness) missing.push('ømhed')
                  if (!missing.length) return null
                  return (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>
                      Udfyld {missing.join(', ')} for at logge
                    </div>
                  )
                })()}
                <button
                  style={{ ...s.btnPrimary, width: '100%', opacity: (!readinessInput.energy || !readinessInput.motivation || !readinessInput.stress || !readinessInput.soreness) ? 0.45 : 1 }}
                  onClick={saveReadiness}
                  disabled={savingReadiness}
                >{savingReadiness ? 'Gemmer...' : 'Log parathed'}</button>
              </div>
            ) : (() => {
              const sc = readinessLog.readiness_score
              const sig = sc >= 75 ? { color: '#6cba6c', text: 'Kroppen er klar 💪', bg: 'rgba(108,186,108,0.07)' }
                : sc >= 50 ? { color: '#c8923a', text: 'Tag det lidt roligt i dag', bg: 'rgba(200,146,58,0.07)' }
                : { color: '#e05555', text: 'Overvej en let session i dag', bg: 'rgba(224,85,85,0.07)' }
              return (
                <div style={{ ...s.card, background: sig.bg }}>
                  <div style={s.cardLabel}>Dagens parathed</div>
                  <div style={{ fontSize: '1.05rem', color: sig.color, marginBottom: '0.75rem' }}>{sig.text}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.6rem', fontWeight: 500, color: sig.color, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                    {readinessLog.readiness_score}
                    <span style={{ fontSize: '0.6rem', color: '#4a4844', fontWeight: 400, marginLeft: '0.3rem' }}>/ 100</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {readinessLog.sleep_hours != null && <div><div style={s.fieldLabel}>Søvn</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.sleep_hours}t</div></div>}
                    {readinessLog.energy != null && <div><div style={s.fieldLabel}>Energi</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.energy}/5</div></div>}
                    {readinessLog.motivation != null && <div><div style={s.fieldLabel}>Motivation</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.motivation}/5</div></div>}
                    {readinessLog.stress != null && <div><div style={s.fieldLabel}>Stress</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.stress}/5</div></div>}
                    {readinessLog.soreness_level != null && <div><div style={s.fieldLabel}>Ømhed</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{readinessLog.soreness_level}/5</div></div>}
                    {readinessLog.sore_zones?.length > 0 && <div><div style={s.fieldLabel}>Lokalt</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#7a7770' }}>{readinessLog.sore_zones.join(', ')}</div></div>}
                  </div>
                </div>
              )
            })()}

            <div style={{ ...s.card, cursor: 'pointer' }} onClick={() => setTab('beskeder')}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(200,146,58,0.25)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(237,234,226,0.07)'}
            >
              <div style={s.cardLabel}>Seneste besked fra coach</div>
              {(() => {
                const lastCoach = [...messages].reverse().find(m => m.sender_role === 'coach')
                if (!lastCoach) return <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen beskeder endnu.</div>
                return (
                  <>
                    <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.6, marginBottom: '0.4rem' }}>{lastCoach.content}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{formatMsgTime(lastCoach.created_at)}</div>
                  </>
                )
              })()}
            </div>

            {(() => {
              const sorted = [...weightLogs].sort((a, b) => a.logged_at > b.logged_at ? 1 : -1)
              const todayStr = today()
              const todayLog = weightLogs.find(l => l.logged_at === todayStr)
              const showInput = !todayLog || weightInput !== ''
              const chartEntries = sorted.slice(-30)
              const hasChart = chartEntries.length >= 2

              // Median of last 5 as current weight
              const last5 = sorted.slice(-5).map(l => l.weight).sort((a, b) => a - b)
              const currentWeight = last5.length > 0 ? last5[Math.floor(last5.length / 2)] : null

              // Trend: avg of last 7 vs avg of prior 7
              let trendText = null
              if (sorted.length >= 4) {
                const r = sorted.slice(-7).map(l => l.weight)
                const p = sorted.slice(Math.max(0, sorted.length - 14), sorted.length - 7).map(l => l.weight)
                if (r.length >= 2 && p.length >= 1) {
                  const rAvg = r.reduce((s, v) => s + v, 0) / r.length
                  const pAvg = p.reduce((s, v) => s + v, 0) / p.length
                  const diff = rAvg - pAvg
                  if (Math.abs(diff) < 0.3) trendText = '= stabil'
                  else if (diff > 0) trendText = `↑ +${diff.toFixed(1)}kg siden forrige uge`
                  else trendText = `↓ ${Math.abs(diff).toFixed(1)}kg siden forrige uge`
                }
              }

              // SVG line chart
              let chartEl = null
              if (hasChart) {
                const W = 400, H = 100, PL = 30, PR = 4, PT = 8, PB = 18
                const ws = chartEntries.map(l => l.weight)
                const minW = Math.min(...ws) - 0.5
                const maxW = Math.max(...ws) + 0.5
                const range = maxW - minW
                const cx = i => PL + (i / (chartEntries.length - 1)) * (W - PL - PR)
                const cy = w => PT + (1 - (w - minW) / range) * (H - PT - PB)
                const pts = chartEntries.map((l, i) => `${cx(i).toFixed(1)},${cy(l.weight).toFixed(1)}`).join(' ')
                const labelIs = chartEntries.length > 2
                  ? [0, Math.floor((chartEntries.length - 1) / 2), chartEntries.length - 1]
                  : [0, chartEntries.length - 1]

                chartEl = (
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', margin: '0.25rem 0' }}>
                    <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="rgba(237,234,226,0.06)" strokeWidth="1" />
                    <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(237,234,226,0.06)" strokeWidth="1" />
                    <text x={PL - 3} y={PT + 5} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily="IBM Plex Mono,monospace">{Math.max(...ws).toFixed(1)}</text>
                    <text x={PL - 3} y={H - PB} textAnchor="end" fontSize="7" fill="#4a4844" fontFamily="IBM Plex Mono,monospace">{Math.min(...ws).toFixed(1)}</text>
                    <polyline points={pts} fill="none" stroke="#c8923a" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                    {chartEntries.map((l, i) => (
                      <circle key={i} cx={cx(i)} cy={cy(l.weight)} r={i === chartEntries.length - 1 ? 3.5 : 2} fill={i === chartEntries.length - 1 ? '#edeae2' : '#c8923a'} />
                    ))}
                    {labelIs.map(i => (
                      <text key={i} x={cx(i)} y={H - 2} textAnchor={i === 0 ? 'start' : i === chartEntries.length - 1 ? 'end' : 'middle'} fontSize="7" fill="#4a4844" fontFamily="IBM Plex Mono,monospace">
                        {chartEntries[i].logged_at.slice(5).replace('-', '/')}
                      </text>
                    ))}
                  </svg>
                )
              }

              return (
                <div style={s.card}>
                  <div style={s.cardLabel}>Kropsvægt</div>

                  {currentWeight != null && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: '#edeae2', lineHeight: 1 }}>{currentWeight}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770' }}>kg</span>
                      {trendText && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.04em' }}>{trendText}</span>
                      )}
                    </div>
                  )}

                  {hasChart ? chartEl : (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', margin: '0.5rem 0 0.75rem', letterSpacing: '0.04em' }}>
                      Log din vægt for at se udviklingen
                    </div>
                  )}

                  {showInput ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                      <input
                        style={{ ...s.fieldInput, maxWidth: '90px', fontSize: '1rem', padding: '0.5rem 0.6rem' }}
                        type="number" step="0.1" placeholder="kg"
                        value={weightInput}
                        onChange={e => setWeightInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && logWeight()}
                      />
                      <button style={s.btnPrimary} onClick={logWeight} disabled={savingWeight || !weightInput}>
                        {savingWeight ? '...' : 'Log'}
                      </button>
                      {todayLog && <button style={s.btnGhost} onClick={() => setWeightInput('')}>Annuller</button>}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844', letterSpacing: '0.06em' }}>Logget i dag · {todayLog.weight} kg</span>
                      <button style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.2rem 0.5rem' }} onClick={() => setWeightInput(todayLog.weight.toString())}>Ret</button>
                    </div>
                  )}
                </div>
              )
            })()}

            {progressBars}
          </>
        )}

        {/* PROGRAM */}
        {tab === 'program' && (() => {
          const activeWeekIdx = computeActiveWeekIdx(allWeeks)
          const viewedWeek = allWeeks[viewingWeekIdx] || null
          const viewedRange = viewedWeek ? fmtWeekRange(weekStartDate(allWeeks, viewedWeek.week_number)) : null
          const isCurrentWeek = viewingWeekIdx === activeWeekIdx
          const isFutureWeek = viewingWeekIdx > activeWeekIdx
          const logsForView = isCurrentWeek ? exerciseLogs : pastLogs

          return (
            <>
              {allWeeks.length === 0 ? (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Program</div>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Dit program.</h1>
                  </div>
                  <div style={{ ...s.card, textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#c8923a', marginBottom: '1rem', letterSpacing: '0.02em' }}>Entropi.</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.75rem' }}>Dit program er på vej.</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', letterSpacing: '0.08em', lineHeight: 1.7 }}>
                      Din coach sætter det op inden din næste træning.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Periodisering — uge-stepper */}
                  {allWeeks.length > 0 && (() => {
                    const compDate = athlete?.competition_date
                    const compMs = compDate ? new Date(compDate + 'T12:00:00') - new Date() : null
                    const weeksToComp = compMs != null ? Math.ceil(compMs / (7 * 24 * 3600 * 1000)) : null

                    const phases = computePhases(allWeeks)
                    const totalWeeks = allWeeks.length

                    // Globalt start-index pr. fase
                    const phaseStart = []
                    { let acc = 0; for (const p of phases) { phaseStart.push(acc); acc += p.weeks.length } }

                    // Fasen for den uge man KIGGER på (så navigation føles sammenhængende)
                    let viewedPhaseIdx = 0
                    for (let i = 0; i < phases.length; i++) {
                      if (phaseStart[i] + phases[i].weeks.length > viewingWeekIdx) { viewedPhaseIdx = i; break }
                    }
                    const phase = phases[viewedPhaseIdx]
                    const startGlobal = phaseStart[viewedPhaseIdx]
                    const color = phase.name ? blockColor(phase.name) : '#7a7770'

                    const fmt = ds => new Date(ds + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
                    const firstDate = phase.weeks[0]?.start_date
                    const lastStart = phase.weeks[phase.weeks.length - 1]?.start_date
                    const dateRange = firstDate && lastStart
                      ? `${fmt(firstDate)} – ${fmt(new Date(new Date(lastStart + 'T12:00:00').getTime() + 6 * 86400000).toISOString().slice(0, 10))}`
                      : null

                    const goToWeek = (gi) => {
                      setViewingWeekIdx(gi)
                      setProgOpenSession(null)
                      if (gi < activeWeekIdx) fetchPastLogs(allWeeks[gi], athlete.id)
                      else setPastLogs([])
                    }

                    const prevPhase = viewedPhaseIdx > 0 ? phases[viewedPhaseIdx - 1] : null
                    const nextPhase = viewedPhaseIdx < phases.length - 1 ? phases[viewedPhaseIdx + 1] : null
                    const viewedInPhase = viewingWeekIdx - startGlobal + 1

                    const chipStyle = {
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.06em',
                      color: '#7a7770', whiteSpace: 'nowrap', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis',
                    }

                    return (
                      <div style={{ marginBottom: '1.5rem' }}>
                        {weeksToComp != null && weeksToComp > 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#c8923a', letterSpacing: '0.1em', marginBottom: '0.7rem' }}>
                            🏆 {weeksToComp} uger til stævne
                          </div>
                        )}
                        {weeksToComp != null && weeksToComp <= 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.7rem' }}>
                            🏆 Stævne passeret
                          </div>
                        )}

                        {/* Blok-skift */}
                        {(prevPhase || nextPhase) && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                            {prevPhase
                              ? <button style={chipStyle} onClick={() => goToWeek(phaseStart[viewedPhaseIdx - 1])}>‹ {prevPhase.name || 'Tidligere'}</button>
                              : <span />}
                            {nextPhase
                              ? <button style={{ ...chipStyle, textAlign: 'right' }} onClick={() => goToWeek(phaseStart[viewedPhaseIdx + 1])}>{nextPhase.name || 'Næste blok'} ›</button>
                              : <span />}
                          </div>
                        )}

                        {/* Blok-header */}
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {phase.name || 'Ingen blok'}
                            </span>
                          </div>
                          {dateRange && (
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{dateRange}</span>
                          )}
                        </div>

                        {/* Uge-prikker */}
                        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                          {phase.weeks.map((w, j) => {
                            const gi = startGlobal + j
                            const isViewed = gi === viewingWeekIdx
                            const isActive = gi === activeWeekIdx
                            const isDone = gi < activeWeekIdx
                            return (
                              <div key={w.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, position: 'relative' }}>
                                {j > 0 && (
                                  <div style={{ position: 'absolute', top: '10px', right: '50%', left: '-50%', height: '2px', background: gi <= activeWeekIdx ? color + 'aa' : 'rgba(237,234,226,0.12)' }} />
                                )}
                                <button
                                  onClick={() => goToWeek(gi)}
                                  style={{
                                    position: 'relative', zIndex: 1,
                                    width: isViewed ? '22px' : '20px', height: isViewed ? '22px' : '20px', borderRadius: '50%',
                                    background: isViewed ? color : isDone ? color + 'cc' : isActive ? color + '33' : 'transparent',
                                    border: `2px solid ${isViewed || isActive ? color : isDone ? color + 'cc' : 'rgba(237,234,226,0.22)'}`,
                                    boxShadow: isViewed ? `0 0 0 4px ${color}22` : 'none',
                                    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  {isDone && !isViewed && <span style={{ color: '#141410', fontSize: '0.62rem', lineHeight: 1 }}>✓</span>}
                                </button>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: isViewed ? color : isDone ? '#7a7770' : '#4a4844', marginTop: '0.45rem' }}>
                                  {w.week_number}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Caption */}
                        <div style={{ marginTop: '0.9rem', textAlign: 'center', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          {viewingWeekIdx === activeWeekIdx
                            ? <span style={{ color }}>● Du er her · uge {viewedInPhase} af {phase.weeks.length}</span>
                            : viewingWeekIdx > activeWeekIdx
                              ? <span style={{ color: '#7a7770' }}>Planlagt · uge {viewedInPhase} af {phase.weeks.length}</span>
                              : <span style={{ color: '#7a7770' }}>Historisk · uge {viewedInPhase} af {phase.weeks.length}</span>}
                          {viewedRange && <span style={{ color: '#4a4844' }}> · {viewedRange}</span>}
                          <span style={{ color: '#4a4844' }}> · total {activeWeekIdx + 1}/{totalWeeks}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Week header — navigation only shown when multiple weeks exist */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    {allWeeks.length > 1 ? (
                      <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: viewingWeekIdx === 0 ? 0.25 : 1 }}
                          disabled={viewingWeekIdx === 0}
                          onClick={() => {
                            const ni = viewingWeekIdx - 1
                            setViewingWeekIdx(ni)
                            setProgOpenSession(null)
                            fetchPastLogs(allWeeks[ni], athlete.id)
                          }}
                        >← Forrige uge</button>
                        <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>
                            Uge {viewedWeek.week_number}{viewedRange ? ` · ${viewedRange}` : ''}
                            {isFutureWeek && <span style={{ color: '#4a4844', marginLeft: '0.5em' }}>· planlagt</span>}
                            {!isCurrentWeek && !isFutureWeek && <span style={{ color: '#4a4844', marginLeft: '0.5em' }}>· historisk</span>}
                          </div>
                          {viewedWeek.block_name && (
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2', marginTop: '0.1rem' }}>{viewedWeek.block_name}</div>
                          )}
                        </div>
                        <button
                          style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: viewingWeekIdx >= allWeeks.length - 1 ? 0.25 : 1 }}
                          disabled={viewingWeekIdx >= allWeeks.length - 1}
                          onClick={() => {
                            const ni = viewingWeekIdx + 1
                            setViewingWeekIdx(ni)
                            setProgOpenSession(null)
                            if (ni < activeWeekIdx) {
                              fetchPastLogs(allWeeks[ni], athlete.id)
                            } else {
                              setPastLogs([])
                            }
                          }}
                        >Næste uge →</button>
                      </div>
                      {!isCurrentWeek && (
                        <div style={{ textAlign: 'center', marginTop: '0.6rem' }}>
                          <button
                            style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.3rem 0.7rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)' }}
                            onClick={() => {
                              setViewingWeekIdx(activeWeekIdx)
                              setProgOpenSession(null)
                              setPastLogs([])
                            }}
                          >↩ Tilbage til denne uge</button>
                        </div>
                      )}
                      </>
                    ) : (
                      <div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.4rem' }}>
                          Uge {viewedWeek.week_number}
                        </div>
                        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                          {viewedWeek.block_name || 'Dit program'}.
                        </h1>
                      </div>
                    )}
                  </div>

                  {viewedWeek.coach_note && (
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem', color: '#7a7770', marginBottom: '1rem', letterSpacing: '0.04em' }}>
                      {viewedWeek.coach_note}
                    </div>
                  )}

                  {viewedWeek.block_description && (
                    <div style={{ borderLeft: '2px solid rgba(200,146,58,0.3)', paddingLeft: '0.75rem', marginBottom: '1rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.3rem' }}>Fra din coach</div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.85rem', fontWeight: 300, color: '#7a7770', fontStyle: 'italic', lineHeight: 1.6 }}>{viewedWeek.block_description}</div>
                    </div>
                  )}

                  {(viewedWeek.sessions || []).map(session => {
                    const isOpen = progOpenSession === session.id
                    const sessionExIds = (session.exercises || []).map(e => e.id)
                    const sessionLogs = logsForView.filter(l => sessionExIds.includes(l.exercise_id))
                    const totalSets = (session.exercises || []).reduce((acc, e) => acc + (e.sets || 0), 0)
                    const loggedSets = sessionLogs.filter(l => !l.skipped).length
                    const isDone = totalSets > 0 && sessionLogs.length >= totalSets

                    return (
                      <div
                        key={session.id}
                        ref={el => { sessionRefs.current[session.id] = el }}
                        style={{ marginBottom: '0.75rem', scrollMarginTop: '64px' }}
                      >
                        <div
                          style={{ ...s.card, marginBottom: 0, cursor: 'pointer', borderLeft: isDone ? '3px solid #6cba6c' : isOpen ? '3px solid #c8923a' : '3px solid transparent' }}
                          onClick={() => openSession(isOpen ? null : session.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ ...s.cardLabel, marginBottom: '0.3rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {session.title}
                                {session.weekday != null && WEEKDAYS_LONG[session.weekday] && (
                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.04em', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.1rem 0.35rem' }}>{WEEKDAYS_LONG[session.weekday]}</span>
                                )}
                              </div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {(session.exercises || []).length} øvelser · {loggedSets}/{totalSets} sæt logget{sessionLogs.filter(l => l.skipped).length > 0 ? ` · ${sessionLogs.filter(l => l.skipped).length} skippet` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isDone && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6cba6c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Færdig ✓</span>}
                              {!isDone && totalSets > 0 && (
                                <button
                                  style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.3rem 0.6rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)' }}
                                  onClick={e => { e.stopPropagation(); askConfirm('Udfyld manglende sæt med sidst loggede vægt og reps?', () => autoCompleteSession(session)) }}
                                >Auto-udfyld</button>
                              )}
                              <span style={{ color: '#4a4844', fontSize: '0.65rem' }}>{isOpen ? '▲' : '▼'}</span>
                            </div>
                          </div>
                        </div>

                        {isOpen && (
                          <div style={{ background: '#181816', border: '1px solid rgba(237,234,226,0.07)', borderTop: 'none', padding: '1rem' }}>


                            {(session.exercises || []).map((ex, exIdx) => {
                              const isLast = exIdx === session.exercises.length - 1
                              return (
                                <div key={ex.id} style={{ marginBottom: isLast ? 0 : '1.25rem', paddingBottom: isLast ? 0 : '1.25rem', borderBottom: isLast ? 'none' : '1px solid rgba(237,234,226,0.06)' }}>
                                  <div style={{ marginBottom: '0.6rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.1rem' }}>
                                      <div style={{ fontSize: '1.05rem', color: '#edeae2' }}>{ex.name}</div>
                                      {isCurrentWeek && (() => {
                                        const allSetsLogged = Array.from({ length: ex.sets || 0 }, (_, i) => i + 1)
                                          .every(setNum => exerciseLogs.find(l => l.exercise_id === ex.id && l.set_number === setNum))
                                        if (allSetsLogged) return null
                                        if (skipConfirmEx === ex.id) return (
                                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', letterSpacing: '0.06em' }}>Er du sikker?</span>
                                            <button
                                              style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', color: '#e05555', borderColor: 'rgba(224,85,85,0.3)' }}
                                              onClick={() => { skipExercise(ex); setSkipConfirmEx(null) }}
                                            >Ja</button>
                                            <button
                                              style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }}
                                              onClick={() => setSkipConfirmEx(null)}
                                            >Annuller</button>
                                          </div>
                                        )
                                        return (
                                          <button
                                            style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.2rem 0.5rem', flexShrink: 0, color: '#4a4844', borderColor: 'rgba(237,234,226,0.08)' }}
                                            onClick={() => setSkipConfirmEx(ex.id)}
                                          >Spring øvelse over</button>
                                        )
                                      })()}
                                    </div>
                                    {isCurrentWeek && (
                                      <>
                                        {ex.recommended_weight != null ? (
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                            Anbefalet: {ex.recommended_weight}kg
                                          </div>
                                        ) : (() => {
                                          const s = suggestNextWeight(ex.name, ex.intensity)
                                          if (!s) return null
                                          const diff = s.weight - s.baseWeight
                                          const diffStr = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '='
                                          return (
                                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#c8923a', marginBottom: '0.2rem' }}>
                                              Forslag: {s.weight} kg <span style={{ color: '#7a7770' }}>({diffStr} kg · RPE {s.fromRpe})</span>
                                            </div>
                                          )
                                        })()}
                                        {(exerciseHistory[ex.name?.toLowerCase()] || []).map(({ date, sets }) => {
                                          const d = new Date(date + 'T12:00:00')
                                          const label = `${d.getDate()}/${d.getMonth() + 1}`
                                          const setsStr = sets.map(s => `${s.weight}×${s.reps}${s.rpe ? ` @${s.rpe}` : ''}`).join('  ')
                                          return (
                                            <div key={date} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#4a4844', marginBottom: '0.1rem' }}>
                                              <span style={{ color: '#7a7770', marginRight: '0.5rem' }}>{label}</span>{setsStr}
                                            </div>
                                          )
                                        })}
                                      </>
                                    )}
                                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1rem' }}>
                                      {[ex.sets && `${ex.sets} sæt`, ex.reps && `× ${ex.reps}`, ex.intensity && ex.intensity].filter(Boolean).join(' · ')}
                                    </div>
                                    {ex.note && (
                                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770', marginTop: '0.1rem', fontStyle: 'italic' }}>{ex.note}</div>
                                    )}
                                  </div>

                                  {/* Per-øvelse opvarmningssæt */}
                                  {isCurrentWeek && (() => {
                                    const baseW = ex.recommended_weight || lastLogByExerciseName[ex.name?.toLowerCase()]?.weight
                                    const exKey = ex.id
                                    const w = exWarmupWeightOverride[exKey] ?? baseW
                                    if (!w || w < 20) return null
                                    const sets = calcWarmupSets(w, ex.reps, ex.name)
                                    const isOpen = exWarmupExpanded.has(exKey)
                                    const exChecked = warmupChecked[exKey] || {}
                                    const doneCnt = Object.values(exChecked).filter(Boolean).length
                                    const isEditingWeight = exWarmupWeightEditing === exKey
                                    return (
                                      <div style={{ marginBottom: '0.75rem', border: '1px solid rgba(237,234,226,0.07)', borderLeft: '2px solid rgba(200,146,58,0.3)' }}>
                                        <div
                                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', cursor: 'pointer' }}
                                          onClick={() => setExWarmupExpanded(prev => {
                                            const next = new Set(prev)
                                            next.has(exKey) ? next.delete(exKey) : next.add(exKey)
                                            return next
                                          })}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>Opvarmningssæt —</span>
                                            {isEditingWeight ? (
                                              <input
                                                autoFocus
                                                type="number"
                                                defaultValue={w}
                                                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', width: '52px', background: 'rgba(200,146,58,0.1)', border: '1px solid rgba(200,146,58,0.5)', color: '#c8923a', padding: '0 4px', textAlign: 'center' }}
                                                onClick={e => e.stopPropagation()}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    const val = parseFloat(e.target.value)
                                                    if (val >= 20) setExWarmupWeightOverride(prev => ({ ...prev, [exKey]: val }))
                                                    setExWarmupWeightEditing(null)
                                                  }
                                                  if (e.key === 'Escape') setExWarmupWeightEditing(null)
                                                }}
                                                onBlur={e => {
                                                  const val = parseFloat(e.target.value)
                                                  if (val >= 20) setExWarmupWeightOverride(prev => ({ ...prev, [exKey]: val }))
                                                  setExWarmupWeightEditing(null)
                                                }}
                                              />
                                            ) : (
                                              <span
                                                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: exWarmupWeightOverride[exKey] ? '#c8923a' : '#7a7770', textDecoration: 'underline dotted', cursor: 'text' }}
                                                onClick={e => { e.stopPropagation(); setExWarmupWeightEditing(exKey) }}
                                              >{w}kg</span>
                                            )}
                                            {doneCnt > 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#6cba6c' }}>{doneCnt}/{sets.length}</span>}
                                          </div>
                                          <span style={{ color: '#4a4844', fontSize: '0.55rem' }}>{isOpen ? '▲' : '▼'}</span>
                                        </div>
                                        {isOpen && (
                                          <div style={{ padding: '0 0.75rem 0.6rem' }}>
                                            {sets.map((ws, i) => {
                                              const k = `ws_${i}`
                                              const done = exChecked[k]
                                              return (
                                                <div
                                                  key={i}
                                                  style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', cursor: 'pointer' }}
                                                  onClick={() => setWarmupChecked(prev => ({
                                                    ...prev,
                                                    [exKey]: { ...(prev[exKey] || {}), [k]: !done }
                                                  }))}
                                                >
                                                  <div style={{ width: '14px', height: '14px', border: `1px solid ${done ? '#6cba6c' : 'rgba(237,234,226,0.2)'}`, background: done ? 'rgba(108,186,108,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {done && <span style={{ color: '#6cba6c', fontSize: '0.55rem', lineHeight: 1 }}>✓</span>}
                                                  </div>
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: done ? '#4a4844' : '#c8923a', minWidth: '28px' }}>{ws.pct}</span>
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.82rem', color: done ? '#4a4844' : '#edeae2', textDecoration: done ? 'line-through' : 'none' }}>{ws.weight}kg</span>
                                                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#7a7770' }}>× {ws.reps}</span>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}

                                  {Array.from({ length: ex.sets || 0 }, (_, i) => i + 1).map(setNum => {
                                    const key = `${ex.id}_${setNum}`
                                    const logged = logsForView.find(l => l.exercise_id === ex.id && l.set_number === setNum)

                                    if (!isCurrentWeek) {
                                      return (
                                        <div key={setNum} style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>Sæt {setNum}</div>
                                          {logged?.skipped ? (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#4a4844' }}>✕ Sprunget over</span>
                                          ) : logged ? (
                                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                                              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem', color: '#edeae2' }}>{logged.weight}kg × {logged.reps_completed}</span>
                                              {logged.rpe_actual != null && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', color: '#7a7770' }}>RPE {logged.rpe_actual}</span>}
                                              {logged.note && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', color: '#4a4844', fontStyle: 'italic' }}>{logged.note}</span>}
                                            </div>
                                          ) : (
                                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#4a4844' }}>—</span>
                                          )}
                                        </div>
                                      )
                                    }

                                    const input = logInputs[key] || { weight: '', note: '', rpe: '' }
                                    const plannedRpe = parsePlannedRpe(ex.intensity)

                                    if (logged?.skipped) return (
                                      <div key={setNum} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>Sæt {setNum}</div>
                                        <span style={{ color: '#4a4844', fontSize: '1rem' }}>✕</span>
                                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.55rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sprunget over</span>
                                        <button
                                          style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem', color: '#7a7770' }}
                                          onClick={() => unskipSet(ex.id, setNum)}
                                        >Fortryd</button>
                                      </div>
                                    )

                                    return (
                                      <div key={setNum} style={{ marginBottom: '0.75rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '52px' }}>
                                            Sæt {setNum}
                                          </div>
                                          <input
                                            style={{ ...s.fieldInput, width: '80px', minWidth: '80px', flexShrink: 0, padding: '0.65rem 0.5rem', fontSize: '1.1rem', textAlign: 'center' }}
                                            type="text" inputMode="decimal" placeholder="kg" value={input.weight}
                                            onChange={e => {
                                              // type=text + inputMode=decimal: numerisk tastatur, men fuld
                                              // kontrol — så feltet kan ryddes helt og "0" kan skrives.
                                              // Dansk komma → punktum; kun cifre + ét decimaltegn.
                                              const v = e.target.value.replace(',', '.')
                                              if (v === '' || /^\d*\.?\d*$/.test(v)) {
                                                setLogInputs(p => ({ ...p, [key]: { ...p[key], weight: v } }))
                                              }
                                            }}
                                          />
                                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.88rem', color: '#c8923a', whiteSpace: 'nowrap' }}>× {ex.reps || '—'}</span>
                                          <button
                                            style={{ ...s.btnPrimary, padding: '0.65rem 1rem', fontSize: '0.65rem', background: logged ? '#6cba6c' : '#c8923a' }}
                                            onClick={() => logSet(ex.id, setNum, ex.sets, ex.reps, plannedRpe)}
                                          >{logged ? '✓' : 'Log'}</button>
                                          <button
                                            style={{ ...s.btnGhost, padding: '0.65rem 0.75rem', fontSize: '0.55rem', color: '#4a4844', borderColor: 'rgba(237,234,226,0.08)' }}
                                            onClick={() => skipSet(ex.id, setNum, plannedRpe)}
                                          >Spring over</button>
                                        </div>
                                        <div style={{ paddingLeft: 'calc(52px + 0.5rem)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                          <div style={{ position: 'relative' }}>
                                            <button
                                              onClick={() => setOpenRpePicker(openRpePicker === key ? null : key)}
                                              style={{
                                                background: input.rpe ? 'rgba(200,146,58,0.15)' : 'rgba(237,234,226,0.04)',
                                                border: `1px solid ${input.rpe ? 'rgba(200,146,58,0.4)' : 'rgba(237,234,226,0.13)'}`,
                                                color: input.rpe ? '#c8923a' : '#7a7770',
                                                fontFamily: "'IBM Plex Mono', monospace",
                                                fontSize: '0.6rem',
                                                letterSpacing: '0.08em',
                                                padding: '0.3rem 0.6rem',
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                              }}
                                            >RPE {input.rpe || (plannedRpe != null ? plannedRpe : 8)}</button>
                                            {openRpePicker === key && (
                                              <div
                                                ref={node => { if (node) { const sel = node.querySelector('[data-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest', behavior: 'instant' }) } }}
                                                style={{
                                                  position: 'absolute',
                                                  bottom: '100%',
                                                  left: 0,
                                                  background: '#1c1c18',
                                                  border: '1px solid rgba(237,234,226,0.13)',
                                                  zIndex: 200,
                                                  maxHeight: '200px',
                                                  overflowY: 'auto',
                                                  minWidth: '80px',
                                                  marginBottom: '2px',
                                                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                                }}
                                              >
                                                {RPE_VALUES.map(v => {
                                                  const cur = parseFloat(input.rpe !== '' ? input.rpe : (plannedRpe != null ? plannedRpe : 8))
                                                  const isSelected = cur === v
                                                  return (
                                                    <button
                                                      key={v}
                                                      data-selected={isSelected ? 'true' : 'false'}
                                                      onClick={() => {
                                                        setLogInputs(p => ({ ...p, [key]: { ...p[key], rpe: v.toString() } }))
                                                        setOpenRpePicker(null)
                                                      }}
                                                      style={{
                                                        display: 'block',
                                                        width: '100%',
                                                        background: isSelected ? 'rgba(200,146,58,0.15)' : 'transparent',
                                                        color: isSelected ? '#c8923a' : '#edeae2',
                                                        border: 'none',
                                                        borderBottom: '1px solid rgba(237,234,226,0.07)',
                                                        fontFamily: "'IBM Plex Mono', monospace",
                                                        fontSize: '0.72rem',
                                                        padding: '0.5rem 0.75rem',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        letterSpacing: '0.04em',
                                                      }}
                                                    >{v}</button>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                          <button
                                            onClick={() => setShowRpeGuide(true)}
                                            style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.75rem', padding: '0.3rem 0.2rem', lineHeight: 1, flexShrink: 0 }}
                                          >ℹ</button>
                                          <input
                                            style={{ ...s.fieldInput, flex: 1, fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: '#7a7770', fontStyle: 'italic' }}
                                            type="text" placeholder="Tilføj note..." value={input.note}
                                            onChange={e => setLogInputs(p => ({ ...p, [key]: { ...p[key], note: e.target.value } }))}
                                          />
                                        </div>
                                        {setConfirm[key] && (
                                          <div style={{
                                            paddingLeft: 'calc(52px + 0.5rem)',
                                            fontFamily: "'IBM Plex Mono', monospace",
                                            fontSize: '0.52rem',
                                            letterSpacing: '0.08em',
                                            color: setConfirm[key] === 'error' ? '#e05555' : '#6cba6c',
                                            marginTop: '0.2rem',
                                            opacity: setConfirm[key] === 'fading' ? 0 : 1,
                                            transition: 'opacity 0.3s ease',
                                          }}>
                                            {setConfirm[key] === 'error' ? 'Fejl — prøv igen' : 'Gemt ✓'}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )
                            })}
                            {(session.exercises || []).length === 0 && (
                              <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen øvelser i denne træning endnu.</div>
                            )}
                            {isDone && isCurrentWeek && !session.athlete_rating && !dismissedFeedback.has(session.id) && (
                              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(200,146,58,0.05)', border: '1px solid rgba(200,146,58,0.15)' }}>
                                <div style={{ ...s.cardLabel, marginBottom: '0.75rem' }}>Træningsfeedback</div>
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <div style={s.fieldLabel}>Hvordan gik træningen?</div>
                                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                    {[1, 2, 3, 4, 5].map(n => {
                                      const fi = feedbackInputs[session.id] || {}
                                      return (
                                        <button key={n}
                                          onClick={() => setFeedbackInputs(p => ({ ...p, [session.id]: { ...(p[session.id] || {}), rating: n } }))}
                                          style={{ width: '40px', height: '40px', border: fi.rating === n ? '2px solid #c8923a' : '1px solid rgba(237,234,226,0.13)', background: fi.rating === n ? 'rgba(200,146,58,0.15)' : 'transparent', color: fi.rating === n ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.95rem', cursor: 'pointer' }}
                                        >{n}</button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <textarea
                                  style={{ ...s.fieldInput, minHeight: '60px', resize: 'vertical', fontSize: '0.82rem', lineHeight: 1.6, boxSizing: 'border-box' }}
                                  placeholder="Tilføj en kommentar..."
                                  maxLength={200}
                                  value={(feedbackInputs[session.id] || {}).comment || ''}
                                  onChange={e => setFeedbackInputs(p => ({ ...p, [session.id]: { ...(p[session.id] || {}), comment: e.target.value } }))}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                  <button style={s.btnGhost} onClick={() => setDismissedFeedback(p => new Set([...p, session.id]))}>Spring over</button>
                                  <button
                                    style={{ ...s.btnPrimary, opacity: !(feedbackInputs[session.id]?.rating) ? 0.4 : 1 }}
                                    onClick={() => saveFeedback(session.id)}
                                    disabled={!feedbackInputs[session.id]?.rating}
                                  >Gem feedback</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {(viewedWeek.sessions || []).length === 0 && (
                    <div style={s.card}>
                      <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen træninger i denne uge endnu.</div>
                    </div>
                  )}
                </>
              )}
            </>
          )
        })()}

        {/* KOST */}
        {tab === 'kost' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Kost</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Kostlog.</h1>
            </div>

            {/* Dato-navigator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '0.4rem 0.5rem' }}>
              <button onClick={() => setKostDate(d => shiftDate(d, -1))} style={{ ...s.btnGhost, fontSize: '0.7rem', padding: '0.35rem 0.8rem' }}>←</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a' }}>{dateLabel(kostDate)}</div>
                {kostDate !== today() && (
                  <button onClick={() => setKostDate(today())} style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4844', cursor: 'pointer', padding: '0.1rem 0' }}>↺ tilbage til i dag</button>
                )}
              </div>
              <button
                onClick={() => kostDate < today() && setKostDate(d => shiftDate(d, 1))}
                disabled={kostDate >= today()}
                style={{ ...s.btnGhost, fontSize: '0.7rem', padding: '0.35rem 0.8rem', opacity: kostDate >= today() ? 0.25 : 1 }}
              >→</button>
            </div>

            {progressBars}

            {/* TDEE estimate — kompakt, foldes ud */}
            <div style={{ ...s.card, marginBottom: '1.5rem' }}>
              {!tdeeEstimate.ready ? (
                <>
                  <div style={s.cardLabel}>Estimeret TDEE</div>
                  <div style={{ fontSize: '0.82rem', color: '#4a4844' }}>
                    {tdeeEstimate.missingWeight
                      ? 'Vej dig mindst 2 gange med 7 dages mellemrum for at aktivere dette estimat.'
                      : `Log kalorier i mindst ${tdeeEstimate.missingKcalDays} dage mere for at aktivere dette estimat.`}
                  </div>
                </>
              ) : (
                <>
                  <div onClick={() => setShowTdee(v => !v)} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', cursor: 'pointer' }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>Estimeret TDEE</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.3rem', color: '#edeae2', lineHeight: 1 }}>{tdeeEstimate.tdee}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770' }}>kcal/dag</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tdeeEstimate.confidence === 'høj' ? '#6cba6c' : tdeeEstimate.confidence === 'moderat' ? '#c8923a' : '#7a7770', border: `1px solid ${tdeeEstimate.confidence === 'høj' ? 'rgba(108,186,108,0.4)' : tdeeEstimate.confidence === 'moderat' ? 'rgba(200,146,58,0.4)' : 'rgba(122,119,112,0.3)'}`, padding: '0.15rem 0.4rem' }}>{tdeeEstimate.confidence}</span>
                      <span style={{ color: '#4a4844', fontSize: '0.7rem' }}>{showTdee ? '⌃' : '⌄'}</span>
                    </span>
                  </div>
                  {showTdee && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {athlete.kcal_target && (() => {
                        const diff = athlete.kcal_target - tdeeEstimate.tdee
                        const absDiff = Math.abs(diff)
                        if (absDiff < 100) return (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.5rem' }}>
                            Dit mål matcher vedligeholdelse <span style={{ color: '#6cba6c' }}>≈</span>
                          </div>
                        )
                        return (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.5rem' }}>
                            Dit mål er <span style={{ color: diff > 0 ? '#6cba6c' : '#c8923a' }}>{diff > 0 ? '+' : ''}{diff} kcal</span> ift. vedligeholdelse — {diff > 0 ? 'overskud (bulk)' : 'underskud (cut)'}
                          </div>
                        )
                      })()}
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844', letterSpacing: '0.06em' }}>
                        Baseret på {tdeeEstimate.kcalDays} dages kalorielogging · {tdeeEstimate.daySpan} dages vægtdata · gns. {tdeeEstimate.avgKcal} kcal/dag
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Search */}
            <div style={s.card}>
              <div style={s.cardLabel}>Tilføj fødevare</div>

              {frequentFoods.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.4rem' }}>Ofte brugt — tryk for at logge</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {frequentFoods.map((f, i) => (
                      <button
                        key={i}
                        onClick={() => quickLogFood(f)}
                        title={`${f.meal} · ${f.kcal} kcal · P ${f.protein}g`}
                        style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.35rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem', maxWidth: '100%' }}
                      >
                        <span style={{ color: '#c8923a' }}>+</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', color: '#b8b4a8' }}>{f.meal}</span>
                        <span style={{ color: '#4a4844' }}>{f.kcal}kcal</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <button
                  style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.4rem 0.75rem', flex: 1 }}
                  onClick={copyYesterday}
                >Kopier i går</button>
                <button
                  style={{ ...s.btnGhost, fontSize: '0.52rem', padding: '0.4rem 0.75rem', flex: 1, color: showTemplates ? '#c8923a' : '#7a7770', borderColor: showTemplates ? 'rgba(200,146,58,0.4)' : undefined }}
                  onClick={() => setShowTemplates(!showTemplates)}
                >Skabeloner{mealTemplates.length > 0 ? ` (${mealTemplates.length})` : ''}</button>
              </div>

              {showTemplates && (
                <div style={{ marginBottom: '0.75rem', background: '#141410', border: '1px solid rgba(237,234,226,0.07)' }}>
                  {mealTemplates.length === 0 ? (
                    <div style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#4a4844' }}>Ingen skabeloner endnu — log et måltid og gem det nedenfor.</div>
                  ) : (
                    mealTemplates.map(t => (
                      <div key={t.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.88rem', color: '#edeae2', marginBottom: '0.2rem' }}>{t.name}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770' }}>
                            {t.items.length} madvarer · {t.items.reduce((a, i) => a + (i.kcal || 0), 0)} kcal
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                          <button style={{ ...s.btnPrimary, padding: '0.4rem 0.75rem', fontSize: '0.52rem' }} onClick={() => logTemplate(t)}>Log alt</button>
                          <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0.4rem' }}>✕</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                <input
                  style={s.fieldInput}
                  type="text"
                  placeholder="Søg... (kylling, havregryn, pasta...)"
                  value={searchQuery}
                  onChange={onSearchInput}
                  autoComplete="off"
                />
              </div>

              {searchResults.length > 0 && (
                <>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.35rem' }}>Tryk + for hurtig-log · tryk navnet for at vælge mængde</div>
                <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.13)', marginBottom: '0.75rem', maxHeight: '240px', overflowY: 'auto' }}>
                  {searchResults.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => selectFood(f)}
                      style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,146,58,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.88rem', color: '#edeae2' }}>{f.name}</span>
                        {f.isCustom && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a', border: '1px solid rgba(200,146,58,0.4)', padding: '0.1rem 0.3rem' }}>din</span>}
                        {f.isShared && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6cba6c', border: '1px solid rgba(108,186,108,0.4)', padding: '0.1rem 0.3rem' }}>delt</span>}
                        {(f.isCustom || f.isShared) && f.unit_label && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#7a7770' }}>1 {f.unit_label} = {f.unit_grams}g</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0, marginLeft: '1rem' }}>
                        {(() => {
                          const u = unitsForFood(f).find(x => x.label !== 'g')
                          return (
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', textAlign: 'right' }}>
                              {u ? (
                                <>
                                  {Math.round(f.kcal100 * u.grams / 100)} kcal · P: {Math.round(f.protein100 * u.grams / 100)}g<br />
                                  <span style={{ color: '#4a4844' }}>pr. {u.label} ({u.grams}g)</span>
                                </>
                              ) : (
                                <>
                                  {f.kcal100} kcal · P: {f.protein100}g · K: {f.carb100}g<br />
                                  <span style={{ color: '#4a4844' }}>pr. 100g</span>
                                </>
                              )}
                            </div>
                          )
                        })()}
                        <button
                          onClick={e => { e.stopPropagation(); quickAddSearchFood(f) }}
                          title="Hurtig-tilføj 1 portion — tryk navnet for at vælge mængde"
                          style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', border: '1px solid rgba(200,146,58,0.5)', background: 'rgba(200,146,58,0.1)', color: '#c8923a', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}

              {selectedFood && (() => {
                const units = unitsForFood(selectedFood)
                const unit = units[unitIdx] || units[0]
                const amt = parseFloat(amount) || 0
                const grams = amt * unit.grams
                const ratio = grams / 100
                const quickAmounts = unit.label === 'g' ? [50, 100, 150, 200, 250] : [1, 2, 3, 4]
                return (
                <div style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.2)', padding: '1rem', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.88rem', color: '#edeae2', marginBottom: '0.4rem' }}>{selectedFood.name}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', color: '#7a7770', marginBottom: '0.75rem' }}>
                    {Math.round(selectedFood.kcal100 * ratio)} kcal · P: {Math.round(selectedFood.protein100 * ratio)}g · K: {Math.round(selectedFood.carb100 * ratio)}g · F: {Math.round(selectedFood.fat100 * ratio)}g
                    {unit.label !== 'g' && <span style={{ color: '#4a4844' }}> · {Math.round(grams)} g</span>}
                  </div>

                  {/* Enhedsvælger — kun vist når fødevaren har mere end gram */}
                  {units.length > 1 && (
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
                      {units.map((u, ui) => (
                        <button
                          key={ui}
                          onClick={() => { setUnitIdx(ui); setAmount(u.label === 'g' ? '100' : '1') }}
                          style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.7rem', color: ui === unitIdx ? '#c8923a' : '#7a7770', borderColor: ui === unitIdx ? 'rgba(200,146,58,0.5)' : undefined }}
                        >{u.label === 'g' ? 'Gram' : u.label}</button>
                      ))}
                    </div>
                  )}

                  {/* Hurtig-mængder */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.6rem' }}>
                    {quickAmounts.map(q => (
                      <button
                        key={q}
                        onClick={() => setAmount(String(q))}
                        style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.6rem', color: amt === q ? '#c8923a' : '#7a7770', borderColor: amt === q ? 'rgba(200,146,58,0.5)' : undefined }}
                      >{q}{unit.label === 'g' ? 'g' : ` ${unit.label}`}</button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={s.fieldLabel}>Mængde ({unit.label})</div>
                      <input style={{ ...s.fieldInput, maxWidth: '100px' }} type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    <button style={s.btnPrimary} onClick={addFromSearch}>Tilføj</button>
                    <button style={s.btnGhost} onClick={() => { setSelectedFood(null); setSearchQuery('') }}>Annuller</button>
                  </div>
                </div>
                )
              })()}

              <button
                style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: showCreateFood ? '#c8923a' : '#7a7770', cursor: 'pointer', padding: 0 }}
                onClick={() => setShowCreateFood(!showCreateFood)}
              >
                {showCreateFood ? '− Skjul' : '+ Opret ny fødevare'}
              </button>

              {showCreateFood && (
                <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#141410', border: '1px solid rgba(200,146,58,0.2)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.75rem' }}>
                    Makroer pr. 100g — gemmes til din personlige liste
                  </div>
                  <div style={{ marginBottom: '0.6rem' }}>
                    <div style={s.fieldLabel}>Navn</div>
                    <input style={s.fieldInput} type="text" placeholder="Fx hjemmelavet lasagne" value={createFood.name} onChange={e => setCreateFood(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    {[['Kcal', 'kcal100'], ['Protein (g)', 'protein100'], ['Kulhydrat (g)', 'carb100'], ['Fedt (g)', 'fat100']].map(([label, key]) => (
                      <div key={key}>
                        <div style={s.fieldLabel}>{label}</div>
                        <input style={s.fieldInput} type="number" inputMode="decimal" placeholder="0" value={createFood[key]} onChange={e => setCreateFood(p => ({ ...p, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>
                    Valgfri enhed — gør det muligt at logge i stk/portion i stedet for gram
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={s.fieldLabel}>Enhed (navn)</div>
                      <input style={s.fieldInput} type="text" placeholder="fx stk, portion, skive" value={createFood.unit_label} onChange={e => setCreateFood(p => ({ ...p, unit_label: e.target.value }))} />
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Gram pr. enhed</div>
                      <input style={s.fieldInput} type="number" inputMode="decimal" placeholder="fx 150" value={createFood.unit_grams} onChange={e => setCreateFood(p => ({ ...p, unit_grams: e.target.value }))} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={shareFood} onChange={e => setShareFood(e.target.checked)} style={{ accentColor: '#c8923a', width: '16px', height: '16px' }} />
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#b8b4a8' }}>Del med alle atleter (fælles bibliotek)</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={s.btnPrimary} onClick={saveCustomFood}>Gem og log</button>
                    <button style={s.btnGhost} onClick={() => { setShowCreateFood(false); setCreateFood({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' }) }}>Annuller</button>
                  </div>
                </div>
              )}

            </div>

            {/* Meal log */}
            <div style={s.card}>
              <div style={s.cardLabel}>{kostDate === today() ? 'Dagens måltider' : `Måltider — ${dateLabel(kostDate)}`}</div>

              {logs.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#4a4844', fontStyle: 'italic' }}>Ingen måltider logget endnu i dag.</div>
              ) : (
                <>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                    <thead>
                      <tr style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Måltid</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Kcal</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Protein</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Kulh.</th>
                        <th style={{ textAlign: 'right', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>Fedt</th>
                        <th style={{ borderBottom: '1px solid rgba(237,234,226,0.07)', width: '24px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => {
                        const editing = editingLogId === l.id
                        const parsed = parseLoggedGrams(l.meal)
                        return (
                        <Fragment key={l.id}>
                        <tr style={{ fontSize: '0.85rem', opacity: editing ? 0.5 : 1 }}>
                          <td style={{ padding: '0.45rem 0', color: '#b8b4a8' }}>{l.meal}</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>{l.kcal}</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.protein}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.carb}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.fat}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', whiteSpace: 'nowrap' }}>
                            <button onClick={() => editing ? setEditingLogId(null) : startEditLog(l)} title="Rediger" style={{ background: 'none', border: 'none', color: editing ? '#c8923a' : '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.3rem' }}>✎</button>
                            <button onClick={() => deleteLog(l)} title="Slet" style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✕</button>
                          </td>
                        </tr>
                        {editing && (
                          <tr>
                            <td colSpan={6} style={{ padding: '0.5rem 0 0.75rem' }}>
                              <div style={{ background: '#141410', border: '1px solid rgba(200,146,58,0.2)', padding: '0.75rem', display: 'flex', alignItems: 'flex-end', gap: '0.6rem', flexWrap: 'wrap' }}>
                                {parsed ? (
                                  <div>
                                    <div style={s.fieldLabel}>Ny mængde (g)</div>
                                    <input style={{ ...s.fieldInput, maxWidth: '100px' }} type="number" inputMode="decimal" autoFocus value={editGrams} onChange={e => setEditGrams(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEditLog(l)} />
                                  </div>
                                ) : (
                                  [['Kcal', 'kcal'], ['Protein', 'protein'], ['Kulh.', 'carb'], ['Fedt', 'fat']].map(([label, key]) => (
                                    <div key={key}>
                                      <div style={s.fieldLabel}>{label}</div>
                                      <input style={{ ...s.fieldInput, maxWidth: '70px' }} type="number" inputMode="decimal" value={editMacros[key]} onChange={e => setEditMacros(p => ({ ...p, [key]: e.target.value }))} />
                                    </div>
                                  ))
                                )}
                                <button style={s.btnPrimary} onClick={() => saveEditLog(l)}>Gem</button>
                                <button style={s.btnGhost} onClick={() => setEditingLogId(null)}>Annuller</button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                        )
                      })}
                      <tr style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                        <td style={{ padding: '0.5rem 0', color: '#7a7770', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#c8923a' }}>{totKcal}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totProtein}g</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totCarb}g</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0', color: '#7a7770' }}>{totFat}g</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ marginBottom: '0.75rem' }}>
                    <button
                      style={{ background: 'none', border: 'none', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: showSaveTemplate ? '#c8923a' : '#7a7770', cursor: 'pointer', padding: 0 }}
                      onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                    >{showSaveTemplate ? '− Skjul' : '+ Gem som skabelon'}</button>
                    {showSaveTemplate && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          style={{ ...s.fieldInput, flex: 1 }}
                          type="text"
                          placeholder="Fx Morgenmad, Pre-workout..."
                          value={templateNameInput}
                          onChange={e => setTemplateNameInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveTemplate()}
                        />
                        <button style={{ ...s.btnPrimary, padding: '0.55rem 0.75rem', fontSize: '0.55rem', flexShrink: 0 }} onClick={saveTemplate}>Gem</button>
                      </div>
                    )}
                  </div>

                  {totKcal > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.07)' }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <svg width="100" height="100" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#242420" strokeWidth="14" />
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#6cba6c" strokeWidth="14"
                            strokeDasharray={`${pLen} ${circ - pLen}`} strokeDashoffset="0"
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#c8923a" strokeWidth="14"
                            strokeDasharray={`${cLen} ${circ - cLen}`} strokeDashoffset={-pLen}
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                          <circle cx="60" cy="60" r="48" fill="none" stroke="#7a7770" strokeWidth="14"
                            strokeDasharray={`${fLen} ${circ - fLen}`} strokeDashoffset={-(pLen + cLen)}
                            transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 0.5s' }} />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2', lineHeight: 1 }}>{totKcal}</div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.15rem' }}>kcal</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                        {[
                          { label: 'Protein', val: totProtein, unit: 'g', pct: Math.round(pKcal / macroTotal * 100), color: '#6cba6c' },
                          { label: 'Kulhydrat', val: totCarb, unit: 'g', pct: Math.round(cKcal / macroTotal * 100), color: '#c8923a' },
                          { label: 'Fedt', val: totFat, unit: 'g', pct: Math.round(fKcal / macroTotal * 100), color: '#7a7770' },
                        ].map(({ label, val, unit, pct, color }) => (
                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7a7770', flex: 1 }}>{label}</div>
                            <div style={{ fontSize: '0.85rem', color: '#edeae2' }}>{val}<span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, color: '#7a7770' }}>{unit}</span></div>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#4a4844', minWidth: '30px', textAlign: 'right' }}>{pct}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* BESKEDER */}
        {tab === 'beskeder' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Beskeder</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Din coach.</h1>
            </div>

            <div style={s.card}>
              {/* Pinned messages */}
              {messages.filter(m => m.pinned).length > 0 && (
                <div style={{ marginBottom: '1.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#c8923a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17H19V13L15 9V4H9V9L5 13V17Z"/>
                    </svg>
                    Fastgjorte beskeder
                  </div>
                  {messages.filter(m => m.pinned).map(msg => (
                    <div key={msg.id} style={{ background: 'rgba(200,146,58,0.06)', border: '1px solid rgba(200,146,58,0.18)', padding: '0.65rem 0.75rem', marginBottom: '0.4rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                        {msg.sender_role === 'coach' ? 'Coach' : 'Dig'} · {formatMsgTime(msg.created_at)}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.55 }}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Message thread */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', maxHeight: '460px', overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '0.95rem', color: '#4a4844', marginBottom: '0.4rem' }}>Ingen beskeder endnu.</div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', lineHeight: 1.7 }}>Din coach vil skrive til dig her.</div>
                  </div>
                ) : messages.map(msg => {
                  const isMe = msg.sender_role === 'athlete'
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <div style={{ maxWidth: '78%' }}>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.46rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem', textAlign: isMe ? 'right' : 'left' }}>
                          {formatMsgTime(msg.created_at)}
                        </div>
                        <div style={{
                          background: isMe ? 'rgba(200,146,58,0.11)' : '#141410',
                          border: isMe ? '1px solid rgba(200,146,58,0.22)' : '1px solid rgba(237,234,226,0.07)',
                          padding: '0.6rem 0.8rem',
                          fontSize: '0.88rem',
                          color: '#edeae2',
                          lineHeight: 1.55,
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Send input */}
              <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid rgba(237,234,226,0.07)', paddingTop: '1rem' }}>
                <input
                  style={{ ...s.fieldInput, flex: 1 }}
                  type="text"
                  placeholder="Skriv en besked til din coach..."
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendAthleteMessage()}
                />
                <button style={s.btnPrimary} onClick={sendAthleteMessage}>Send</button>
              </div>
            </div>
          </>
        )}

        {/* MOBILITET-HUB — intent-landing (tre døre) */}
        {tab === 'mobilisering' && mobilityMode === null && (() => {
          const Door = ({ icon, title, sub, subColor, onClick }) => (
            <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.1)', padding: '1.1rem 1.25rem', cursor: 'pointer', textAlign: 'left', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, width: 28, textAlign: 'center' }}>{icon}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', color: '#edeae2', lineHeight: 1.2 }}>{title}</span>
                <span style={{ display: 'block', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.05em', color: subColor || '#7a7770', marginTop: '0.3rem' }}>{sub}</span>
              </span>
              <span style={{ color: '#4a4844', fontSize: '1.1rem', flexShrink: 0 }}>›</span>
            </button>
          )
          return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Mobilitet</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Hvad har du brug for?</h1>
              </div>
              <Door icon="⚡" title="Varm op" sub="Inden du løfter" onClick={() => setMobilityMode('opvarmning')} />
              <Door icon="✦" title="Mobilitet" sub="Byg en session — tag den når du er stram"
                onClick={() => {
                  const lifts = liftsFromWeek(currentWeek)
                  setMobilityIntake(i => ({ ...i, lifts: lifts.length ? lifts : i.lifts }))
                  setMobilitySlots([]); setMobilityStep(0); setMobilityPhase('intake'); setMobilityMode('mobilitet')
                }} />
            </>
          )
        })()}

        {/* Tilbage til landing — vises over enhver valgt mode */}
        {tab === 'mobilisering' && mobilityMode && (
          <button onClick={() => setMobilityMode(null)} style={{ background: 'none', border: 'none', color: '#7a7770', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em', padding: '0 0 1rem 0' }}>‹ Mobilitet</button>
        )}

        {/* OPVARMNING (hub-mode) */}
        {tab === 'mobilisering' && mobilityMode === 'opvarmning' && (() => {
          const FOCUSES = ['Squat', 'Bænkpres', 'Dødløft']
          const PROBLEMS = ['Hofte / baller', 'Lyske / inderlår', 'Lænde', 'Øvre ryg', 'Ankel', 'Knæ', 'Skulder', 'Nakke / trapez']
          const baseKey = warmupFocus === 'Dødløft' ? `Dødløft — ${warmupSubtype}` : warmupFocus
          const focusReady = warmupFocus && (warmupFocus !== 'Dødløft' || warmupSubtype)

          function startGuide() {
            // Hvert slot er { slot, options: [...] }. Atleten vælger én option pr.
            // slot i guiden (default = den første). Coach-trin bliver slots med ét valg.
            const base = WARMUP_BASE[baseKey] || []
            const coachFocusKey = warmupFocus === 'Dødløft' ? 'Dødløft' : warmupFocus
            const coachSteps = (warmupTemplates.find(t => t.exercise_category === coachFocusKey)?.steps || [])
              .map((step, i) => ({ slot: 'Fra din coach', options: [{ id: `coach_${i}`, name: step, desc: '', label: '', type: 'reps' }] }))
            const addons = [...warmupProblems].map(p => WARMUP_ADDONS[p]).filter(Boolean)
            const slots = [...base, ...addons, ...coachSteps]
            setWarmupExercises(slots)
            setWarmupChoice({})   // friskt valg hver gang → default option 0
            setWarmupStep(0)
            setTimerActive(false)
            setTimerSeconds(0)
            setTimerDone(false)
            setWarmupPhase('guide')
          }

          function goToStep(idx) {
            setWarmupStep(idx)
            setTimerActive(false)
            setTimerDone(false)
            const slot = warmupExercises[idx]
            const opt = slot?.options?.[warmupChoice[idx] ?? 0]
            setTimerSeconds(opt?.type === 'timer' ? opt.duration : 0)
          }

          function resetWarmup() {
            setWarmupPhase('focus')
            setWarmupFocus(null)
            setWarmupSubtype(null)
            setWarmupProblems(new Set())
            setWarmupExercises([])
            setWarmupChoice({})
            setWarmupStep(0)
            setTimerActive(false)
            setTimerSeconds(0)
            setTimerDone(false)
          }

          // FASE: FOKUS
          if (warmupPhase === 'focus') return (
            <>
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Opvarmning</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Hvad træner du i dag?</h1>
                {warmupFocus && !warmupSubtype && warmupFocus !== 'Dødløft' && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#c8923a', marginTop: '0.4rem', letterSpacing: '0.06em' }}>Auto-detekteret fra dit program</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                {FOCUSES.map(f => (
                  <button key={f} onClick={() => { setWarmupFocus(f); if (f !== 'Dødløft') setWarmupSubtype(null) }} style={{
                    background: warmupFocus === f ? 'rgba(200,146,58,0.15)' : '#1c1c18',
                    border: `1px solid ${warmupFocus === f ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                    color: warmupFocus === f ? '#c8923a' : '#edeae2',
                    fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', fontWeight: 400,
                    padding: '1rem 1.25rem', cursor: 'pointer', textAlign: 'left',
                  }}>{f}</button>
                ))}
              </div>

              {warmupFocus === 'Dødløft' && (
                <div style={{ marginBottom: '1.25rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(200,146,58,0.3)' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#7a7770', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Variant</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['Konventionel', 'Sumo'].map(st => (
                      <button key={st} onClick={() => setWarmupSubtype(st)} style={{
                        flex: 1, background: warmupSubtype === st ? '#c8923a' : '#1c1c18',
                        border: `1px solid ${warmupSubtype === st ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                        color: warmupSubtype === st ? '#141410' : '#7a7770',
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        padding: '0.65rem', cursor: 'pointer',
                      }}>{st}</button>
                    ))}
                  </div>
                </div>
              )}

              {focusReady && (
                <button style={{ ...s.btnPrimary, width: '100%', padding: '0.85rem', fontSize: '0.62rem' }}
                  onClick={() => setWarmupPhase('problems')}>
                  Næste →
                </button>
              )}
            </>
          )

          // FASE: PROBLEMER
          if (warmupPhase === 'problems') return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>{baseKey}</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Hvad er stramt eller tungt i dag?</h1>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', marginTop: '0.4rem' }}>Valgfrit — vælg op til 2 områder</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {PROBLEMS.map(p => {
                  const on = warmupProblems.has(p)
                  return (
                    <button key={p} onClick={() => setWarmupProblems(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : (n.size < 2 && n.add(p)); return n })} style={{
                      background: on ? 'rgba(200,146,58,0.15)' : '#1c1c18',
                      border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                      color: on ? '#c8923a' : '#7a7770',
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '0.75rem 0.5rem', cursor: 'pointer', textAlign: 'center',
                    }}>{p}</button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button style={{ ...s.btnGhost, flex: 1, padding: '0.75rem' }} onClick={() => setWarmupPhase('focus')}>← Tilbage</button>
                <button style={{ ...s.btnPrimary, flex: 2, padding: '0.75rem', fontSize: '0.62rem' }} onClick={startGuide}>
                  Start opvarmning ({(WARMUP_BASE[baseKey]?.length || 0) + warmupProblems.size} øvelser)
                </button>
              </div>
            </>
          )

          // FASE: GUIDE
          if (warmupPhase === 'guide') {
            const slot = warmupExercises[warmupStep]
            if (!slot) return null
            const choiceIdx = warmupChoice[warmupStep] ?? 0
            const ex = slot.options[choiceIdx] || slot.options[0]
            const hasChoices = slot.options.length > 1
            const isLast = warmupStep === warmupExercises.length - 1
            const pct = Math.round(((warmupStep) / warmupExercises.length) * 100)

            // Skift variant inden for slottet — nulstil timeren (ny varighed kan gælde)
            const chooseVariant = (i) => {
              setWarmupChoice(c => ({ ...c, [warmupStep]: i }))
              setTimerActive(false)
              setTimerDone(false)
              const opt = slot.options[i]
              setTimerSeconds(opt?.type === 'timer' ? opt.duration : 0)
            }

            if (!ex) return null

            return (
              <>
                {/* Progress */}
                <div style={{ marginBottom: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.08em' }}>
                      {warmupFocus} · Øvelse {warmupStep + 1} af {warmupExercises.length}
                    </div>
                    <button style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem' }} onClick={resetWarmup}>✕ Afslut</button>
                  </div>
                  <div style={{ height: '2px', background: 'rgba(237,234,226,0.07)', borderRadius: '1px' }}>
                    <div style={{ height: '100%', background: '#c8923a', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* Variant-vælger — kun når slottet har flere øvelser at vælge imellem */}
                {hasChoices && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>
                      Vælg øvelse · {slot.slot}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {slot.options.map((opt, i) => {
                        const on = i === choiceIdx
                        return (
                          <button
                            key={opt.id}
                            onClick={() => chooseVariant(i)}
                            style={{
                              background: on ? 'rgba(200,146,58,0.15)' : '#1c1c18',
                              border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`,
                              color: on ? '#c8923a' : '#7a7770',
                              fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500,
                              letterSpacing: '0.03em', padding: '0.45rem 0.7rem', cursor: 'pointer',
                              textAlign: 'left', lineHeight: 1.3,
                            }}
                          >{opt.name}</button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Exercise card */}
                <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.75rem', marginBottom: '1.25rem', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '1rem', lineHeight: 1.2 }}>{ex.name}</h2>
                    {ex.desc && <p style={{ fontSize: '0.9rem', color: '#b8b4a8', lineHeight: 1.75, margin: 0 }}>{ex.desc}</p>}
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    {ex.type === 'timer' ? (
                      <div>
                        <div style={{ marginBottom: '0.85rem' }}>
                          <CountdownRing total={ex.duration} remaining={timerSeconds > 0 ? timerSeconds : ex.duration} done={timerDone} />
                        </div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#7a7770', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{ex.label}</div>
                        {!timerDone ? (
                          <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => {
                            if (!timerActive && timerSeconds === 0) setTimerSeconds(ex.duration)
                            setTimerActive(a => !a)
                          }}>
                            {timerActive ? '⏸ Pause' : timerSeconds > 0 ? '▶ Fortsæt' : '▶ Start timer'}
                          </button>
                        ) : (
                          <button style={{ ...s.btnGhost, padding: '0.5rem 1.25rem' }} onClick={() => { setTimerSeconds(ex.duration); setTimerDone(false); setTimerActive(false) }}>
                            ↺ Gentag (anden side)
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.5rem', color: '#c8923a' }}>{ex.label}</div>
                    )}
                  </div>
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  {warmupStep > 0 && (
                    <button style={{ ...s.btnGhost, padding: '0.75rem 1rem' }} onClick={() => goToStep(warmupStep - 1)}>←</button>
                  )}
                  <button
                    style={{ ...s.btnPrimary, flex: 1, padding: '0.85rem', fontSize: '0.62rem' }}
                    onClick={() => isLast ? setWarmupPhase('done') : goToStep(warmupStep + 1)}
                  >
                    {isLast ? 'Afslut opvarmning ✓' : 'Næste øvelse →'}
                  </button>
                </div>
              </>
            )
          }

          // FASE: DONE
          return (
            <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', color: '#6cba6c', marginBottom: '1rem' }}>✓</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.5rem' }}>Opvarmning færdig.</h2>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.08em', marginBottom: '2rem' }}>
                {warmupExercises.length} øvelser gennemført
              </div>
              <button style={{ ...s.btnGhost, padding: '0.75rem 1.5rem' }} onClick={resetWarmup}>Start forfra</button>
            </div>
          )
        })()}

        {/* DAGLIG MOBILISERING (hub-mode) */}
        {tab === 'mobilisering' && mobilityMode === 'mobilitet' && (() => {
          const PROBLEMS = ['Hofte / baller', 'Lyske / inderlår', 'Lænde', 'Øvre ryg', 'Ankel', 'Knæ', 'Skulder', 'Nakke / trapez']
          const LIFTS = [{ k: 'squat', l: 'Squat' }, { k: 'bench', l: 'Bænkpres' }, { k: 'deadlift', l: 'Dødløft' }]
          const SITTING = [{ k: 'low', l: 'Lidt' }, { k: 'med', l: 'En del' }, { k: 'high', l: 'Meget' }]
          const areaLabel = id => MOBILITY_AREAS.find(a => a.id === id)?.label || id
          const exForSlot = slot => { const opts = MOBILITY_LIBRARY[slot.area] || []; return opts[slot.choiceIdx ?? 0] || opts[0] }
          const estMin = mobilitySlots.length <= 4 ? 5 : mobilitySlots.length <= 6 ? 10 : 15

          function buildFromIntake() {
            const ids = buildMobilityRoutine(mobilityIntake)
            // Tilfældig øvelse pr. område → frisk session hver gang (ikke altid samme #0).
            setMobilitySlots(ids.map(area => {
              const count = (MOBILITY_LIBRARY[area] || []).length
              return { area, choiceIdx: count > 1 ? Math.floor(Math.random() * count) : 0 }
            }))
            setMobilityPhase('design')
          }
          function startGuide() {
            setMobilityStep(0); setTimerActive(false); setTimerSeconds(0); setTimerDone(false); setMobilityPhase('guide')
          }
          function goStep(idx) {
            setMobilityStep(idx); setTimerActive(false); setTimerDone(false)
            const ex = exForSlot(mobilitySlots[idx]); setTimerSeconds(ex?.type === 'timer' ? ex.duration : 0)
          }
          const toggleInArray = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]

          // ───── INTAKE: hvad skal sessionen ramme ─────
          if (mobilityPhase === 'intake') {
            const chipBtn = (on) => ({ background: on ? 'rgba(200,146,58,0.15)' : '#1c1c18', border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`, color: on ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.7rem 0.5rem', cursor: 'pointer', textAlign: 'center' })
            const Q = ({ label, children }) => (
              <div style={{ marginBottom: '1.4rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.6rem' }}>{label}</div>
                {children}
              </div>
            )
            return (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Mobilitet</div>
                  <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.7rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Byg en session</h1>
                  <div style={{ fontSize: '0.82rem', color: '#7a7770', marginTop: '0.5rem', lineHeight: 1.6 }}>Vi foreslår en session ud fra dine løft og hvad der er stramt lige nu. Du kan altid bytte øvelser bagefter.</div>
                </div>
                <Q label="Hvor lang tid vil du bruge?">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    {[5, 10, 15].map(t => <button key={t} onClick={() => setMobilityIntake(i => ({ ...i, time: t }))} style={chipBtn(mobilityIntake.time === t)}>{t} min</button>)}
                  </div>
                </Q>
                <Q label="Hvor meget sidder du typisk ned?">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    {SITTING.map(o => <button key={o.k} onClick={() => setMobilityIntake(i => ({ ...i, sitting: o.k }))} style={chipBtn(mobilityIntake.sitting === o.k)}>{o.l}</button>)}
                  </div>
                </Q>
                <Q label="Hvilke løft fokuserer du på? (forudvalgt fra dit program)">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    {LIFTS.map(o => <button key={o.k} onClick={() => setMobilityIntake(i => ({ ...i, lifts: toggleInArray(i.lifts, o.k) }))} style={chipBtn(mobilityIntake.lifts.includes(o.k))}>{o.l}</button>)}
                  </div>
                </Q>
                <Q label="Er noget stramt for tiden? (valgfrit)">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {PROBLEMS.map(p => <button key={p} onClick={() => setMobilityIntake(i => ({ ...i, problems: toggleInArray(i.problems, p) }))} style={chipBtn(mobilityIntake.problems.includes(p))}>{p}</button>)}
                  </div>
                </Q>
                <div style={{ marginTop: '0.5rem' }}>
                  <button style={{ ...s.btnPrimary, width: '100%', padding: '0.85rem', fontSize: '0.62rem' }} onClick={buildFromIntake}>Se mit forslag →</button>
                </div>
              </>
            )
          }

          // ───── DESIGN: finjustér rutinen ─────
          if (mobilityPhase === 'design') {
            const usedAreas = new Set(mobilitySlots.map(sl => sl.area))
            const available = MOBILITY_AREAS.filter(a => !usedAreas.has(a.id))
            const setChoice = (idx, ci) => setMobilitySlots(prev => prev.map((sl, i) => i === idx ? { ...sl, choiceIdx: ci } : sl))
            const removeSlot = idx => setMobilitySlots(prev => prev.filter((_, i) => i !== idx))
            const addArea = id => setMobilitySlots(prev => [...prev, { area: id, choiceIdx: 0 }])
            return (
              <>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Din session · {mobilitySlots.length} øvelser · ~{estMin} min</div>
                  <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Tilpas</h1>
                  <div style={{ fontSize: '0.82rem', color: '#7a7770', marginTop: '0.5rem', lineHeight: 1.6 }}>Skift øvelser, fjern dem du ikke vil have, eller tilføj flere. Start når du er klar.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {mobilitySlots.map((sl, idx) => {
                    const opts = MOBILITY_LIBRARY[sl.area] || []
                    const ex = exForSlot(sl)
                    return (
                      <div key={idx} style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c8923a' }}>{areaLabel(sl.area)}</span>
                          <button onClick={() => removeSlot(idx)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem' }}>✕ fjern</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                          {opts.map((opt, ci) => {
                            const on = (sl.choiceIdx ?? 0) === ci
                            return <button key={opt.id} onClick={() => setChoice(idx, ci)} style={{ background: on ? 'rgba(200,146,58,0.15)' : '#141410', border: `1px solid ${on ? '#c8923a' : 'rgba(237,234,226,0.1)'}`, color: on ? '#c8923a' : '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', padding: '0.4rem 0.6rem', cursor: 'pointer' }}>{opt.name}</button>
                          })}
                        </div>
                        {ex && <div style={{ fontSize: '0.78rem', color: '#7a7770', lineHeight: 1.5 }}>{ex.label}</div>}
                      </div>
                    )
                  })}
                </div>
                {available.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Tilføj område</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {available.map(a => <button key={a.id} onClick={() => addArea(a.id)} style={{ background: '#1c1c18', border: '1px dashed rgba(237,234,226,0.18)', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', padding: '0.45rem 0.7rem', cursor: 'pointer' }}>+ {a.label}</button>)}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button style={{ ...s.btnGhost, flex: 1, padding: '0.8rem' }} onClick={() => setMobilityPhase('intake')}>← Svar igen</button>
                  <button style={{ ...s.btnPrimary, flex: 2, padding: '0.85rem', fontSize: '0.62rem', opacity: mobilitySlots.length ? 1 : 0.5 }} disabled={!mobilitySlots.length} onClick={startGuide}>Start →</button>
                </div>
              </>
            )
          }

          // ───── GUIDE: trin-for-trin (delt komponent) ─────
          if (mobilityPhase === 'guide') {
            const slot = mobilitySlots[mobilityStep]
            if (!slot) return null
            const ex = exForSlot(slot)
            if (!ex) return null
            const opts = MOBILITY_LIBRARY[slot.area] || []
            const isLast = mobilityStep === mobilitySlots.length - 1
            return (
              <MobilityGuideStep
                heading="Mobilitet" step={mobilityStep} total={mobilitySlots.length}
                onExit={() => setMobilityPhase('design')}
                areaLabel={areaLabel(slot.area)} ex={ex} opts={opts} choiceIdx={slot.choiceIdx ?? 0}
                onChoose={ci => { setMobilitySlots(prev => prev.map((sl, i) => i === mobilityStep ? { ...sl, choiceIdx: ci } : sl)); setTimerActive(false); setTimerDone(false); const o = opts[ci]; setTimerSeconds(o?.type === 'timer' ? o.duration : 0) }}
                timerSeconds={timerSeconds} timerActive={timerActive} timerDone={timerDone}
                setTimerSeconds={setTimerSeconds} setTimerActive={setTimerActive} setTimerDone={setTimerDone}
                onPrev={mobilityStep > 0 ? () => goStep(mobilityStep - 1) : null}
                onNext={() => { if (isLast) setMobilityPhase('done'); else goStep(mobilityStep + 1) }}
                isLast={isLast}
              />
            )
          }

          // ───── DONE ─────
          if (mobilityPhase === 'done') {
            return (
              <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', color: '#6cba6c', marginBottom: '1rem' }}>✓</div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '0.5rem' }}>Mobilitet færdig.</h2>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#4a4844', letterSpacing: '0.08em', marginBottom: '2rem' }}>{mobilitySlots.length} øvelser gennemført</div>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                  <button style={{ ...s.btnGhost, padding: '0.75rem 1.25rem' }} onClick={() => { setMobilitySlots([]); setMobilityStep(0); setMobilityPhase('intake') }}>Byg en ny</button>
                  <button style={{ ...s.btnPrimary, padding: '0.75rem 1.25rem' }} onClick={() => setMobilityMode(null)}>Til mobilitet</button>
                </div>
              </div>
            )
          }
          return null
        })()}

        {/* STÆVNEDAG */}
        {tab === 'stævnedag' && (() => {
          const round = w => Math.round(w / 2.5) * 2.5

          function calcCompWarmup(opener) {
            if (!opener || opener <= 20) return []
            return [
              { weight: 20, reps: 5, pct: 'Stang' },
              { weight: round(opener * 0.50), reps: 3, pct: '50%' },
              { weight: round(opener * 0.70), reps: 2, pct: '70%' },
              { weight: round(opener * 0.85), reps: 1, pct: '85%' },
              { weight: round(opener * 0.93), reps: 1, pct: '93%' },
            ].filter((s, i, arr) => i === 0 || s.weight !== arr[i - 1].weight)
          }

          function setAttempt(lift, idx, field, val) {
            setMeetAttempts(prev => {
              const next = { ...prev, [lift]: prev[lift].map((a, i) => i === idx ? { ...a, [field]: val } : a) }
              return next
            })
          }

          function bestLift(lift) {
            const good = meetAttempts[lift].filter(a => a.r === 'good' && parseFloat(a.w) > 0)
            if (!good.length) return null
            return Math.max(...good.map(a => parseFloat(a.w)))
          }

          const lifts = meetType === 'sbd'
            ? [{ key: 'squat', label: 'Squat' }, { key: 'bench', label: 'Bænkpres' }, { key: 'deadlift', label: 'Dødløft' }]
            : [{ key: 'bench', label: 'Bænkpres' }]

          const total = lifts.reduce((sum, l) => sum + (bestLift(l.key) || 0), 0)
          const allHaveBest = lifts.every(l => bestLift(l.key) !== null)

          async function markGoodAndSave(key, i) {
            const current = meetAttempts[key]
            const isAlreadyGood = current[i].r === 'good'
            setAttempt(key, i, 'r', isAlreadyGood ? null : 'good')
            if (!isAlreadyGood && athlete && !coachAthleteId) {
              const updated = current.map((a, j) => j === i ? { ...a, r: 'good' } : a)
              const good = updated.filter(a => a.r === 'good' && parseFloat(a.w) > 0)
              if (!good.length) return
              const best = Math.max(...good.map(a => parseFloat(a.w)))
              const colMap = { squat: 'squat', bench: 'bench', deadlift: 'deadlift' }
              const col = colMap[key]
              if (col) {
                await supabase.rpc('update_competition_max', { p_lift: col, p_weight: best })
                setAthlete(prev => ({ ...prev, [col]: best }))
              }
            }
          }

          const meetHistoryCard = meetResults.length > 0 ? (
            <div style={{ ...s.card, marginTop: '1.5rem' }}>
              <div style={s.cardLabel}>Tidligere stævner</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono', monospace" }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#4a4844', fontSize: '0.46rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.35rem 0.4rem 0.35rem 0', fontWeight: 500 }}>Dato</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500 }}>Stævne</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>S</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>B</th>
                      <th style={{ padding: '0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>D</th>
                      <th style={{ padding: '0.35rem 0 0.35rem 0.4rem', fontWeight: 500, textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetResults.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid rgba(237,234,226,0.06)', fontSize: '0.72rem', color: '#edeae2' }}>
                        <td style={{ padding: '0.5rem 0.4rem 0.5rem 0', whiteSpace: 'nowrap' }}>{new Date(m.meet_date + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                        <td style={{ padding: '0.5rem 0.4rem', color: '#b8b4a8', fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.meet_name || '—'}</td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: m.squat != null ? '#edeae2' : '#3a3a36' }}>{m.squat != null ? m.squat : '–'}</td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: m.bench != null ? '#edeae2' : '#3a3a36' }}>{m.bench != null ? m.bench : '–'}</td>
                        <td style={{ padding: '0.5rem 0.4rem', textAlign: 'right', color: m.deadlift != null ? '#edeae2' : '#3a3a36' }}>{m.deadlift != null ? m.deadlift : '–'}</td>
                        <td style={{ padding: '0.5rem 0 0.5rem 0.4rem', textAlign: 'right', color: '#c8923a' }}>{m.total != null ? m.total : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null

          // STANDBY — ingen stævneplan
          if (!hasMeetPlan) {
            const compDate = athlete.competition_date
            const daysLeft = compDate ? Math.ceil((new Date(compDate + 'T12:00:00') - new Date()) / 86400000) : null
            return (
            <>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Stævne</div>
                {compDate && daysLeft > 0 ? (
                  <>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                      {daysLeft} dage<br />til stævne.
                    </h1>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#c8923a', letterSpacing: '0.08em', marginTop: '0.6rem' }}>
                      {new Date(compDate + 'T12:00:00').toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace', monospace", fontSize: '0.52rem', color: '#4a4844', letterSpacing: '0.06em', marginTop: '0.5rem' }}>
                      Din coach har endnu ikke sat forsøgsplan.
                    </div>
                  </>
                ) : (
                  <>
                    <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Ingen stævne<br />planlagt.</h1>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#4a4844', letterSpacing: '0.06em', lineHeight: 1.7, marginTop: '0.75rem' }}>
                      Din coach har ikke sat en stævneplan endnu.
                    </div>
                  </>
                )}
              </div>

              {(athlete.squat || athlete.bench || athlete.deadlift) && (
                <div style={s.card}>
                  <div style={s.cardLabel}>Konkurrencemaks</div>
                  {[['Squat', athlete.squat], ['Bænkpres', athlete.bench], ['Dødløft', athlete.deadlift]].map(([label, val]) => val ? (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', borderBottom: '1px solid rgba(237,234,226,0.06)' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', color: '#edeae2' }}>{val} <span style={{ fontSize: '0.7rem', color: '#4a4844' }}>kg</span></div>
                    </div>
                  ) : null)}
                  {(athlete.squat && athlete.bench && athlete.deadlift) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.75rem' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#c8923a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', color: '#c8923a' }}>{(athlete.squat || 0) + (athlete.bench || 0) + (athlete.deadlift || 0)} <span style={{ fontSize: '0.8rem', color: '#7a7770' }}>kg</span></div>
                    </div>
                  )}
                </div>
              )}
              {meetHistoryCard}
            </>
          )}

          return (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Stævnedag</div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>
                  {athlete.name?.split(' ')[0] || 'Atlet'}.
                </h1>
              </div>

              {/* Coach note */}
              {meetPlanNotes && (
                <div style={{ ...s.card, borderColor: 'rgba(200,146,58,0.25)', marginBottom: '1.5rem' }}>
                  <div style={s.cardLabel}>Fra din coach</div>
                  <div style={{ fontSize: '0.88rem', color: '#edeae2', lineHeight: 1.7 }}>{meetPlanNotes}</div>
                </div>
              )}

              {/* Type toggle */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.75rem' }}>
                {[['sbd', 'SBD'], ['bench', 'Bænkpres']].map(([key, label]) => (
                  <button key={key} onClick={() => setMeetType(key)} style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500,
                    letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', cursor: 'pointer',
                    padding: '0.5rem 1.1rem',
                    background: meetType === key ? '#c8923a' : 'rgba(237,234,226,0.07)',
                    color: meetType === key ? '#141410' : '#7a7770',
                  }}>{label}</button>
                ))}
              </div>

              {/* Lift sections */}
              {lifts.map(({ key, label }) => {
                const attempts = meetAttempts[key]
                const best = bestLift(key)
                const opener = parseFloat(attempts[0].w) || 0
                const warmup = calcCompWarmup(opener)

                return (
                  <div key={key} style={{ marginBottom: '1.75rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '0.75rem' }}>
                      {label}
                      {best && <span style={{ color: '#6cba6c', marginLeft: '0.75rem' }}>Bedste: {best} kg</span>}
                    </div>

                    {/* Attempt rows */}
                    <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', marginBottom: '0.75rem' }}>
                      {attempts.map((att, i) => {
                        const bg = att.r === 'good' ? 'rgba(108,186,108,0.08)' : att.r === 'fail' ? 'rgba(224,85,85,0.08)' : 'transparent'
                        const border = att.r === 'good' ? 'rgba(108,186,108,0.25)' : att.r === 'fail' ? 'rgba(224,85,85,0.25)' : 'rgba(237,234,226,0.07)'
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: i < 2 ? `1px solid rgba(237,234,226,0.06)` : 'none', background: bg, borderLeft: `3px solid ${border}` }}>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: '24px' }}>{i + 1}.</div>
                            <input
                              type="number"
                              placeholder="kg"
                              value={att.w}
                              onChange={e => setAttempt(key, i, 'w', e.target.value)}
                              style={{ width: '72px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(237,234,226,0.2)', color: '#edeae2', fontFamily: "'Playfair Display', serif", fontSize: '1.4rem', fontWeight: 400, outline: 'none', padding: '0.1rem 0', textAlign: 'center' }}
                            />
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', color: '#4a4844' }}>kg</div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                              <button
                                onClick={() => markGoodAndSave(key, i)}
                                style={{ background: att.r === 'good' ? 'rgba(108,186,108,0.2)' : 'transparent', border: `1px solid ${att.r === 'good' ? '#6cba6c' : 'rgba(237,234,226,0.15)'}`, color: att.r === 'good' ? '#6cba6c' : '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', padding: '0.4rem 0.7rem', cursor: 'pointer', minWidth: '42px' }}
                              >✓</button>
                              <button
                                onClick={() => setAttempt(key, i, 'r', att.r === 'fail' ? null : 'fail')}
                                style={{ background: att.r === 'fail' ? 'rgba(224,85,85,0.2)' : 'transparent', border: `1px solid ${att.r === 'fail' ? '#e05555' : 'rgba(237,234,226,0.15)'}`, color: att.r === 'fail' ? '#e05555' : '#4a4844', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem', padding: '0.4rem 0.7rem', cursor: 'pointer', minWidth: '42px' }}
                              >✕</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Competition warmup */}
                    {warmup.length > 0 && (
                      <div style={{ background: '#141410', border: '1px solid rgba(237,234,226,0.07)', borderLeft: '2px solid rgba(200,146,58,0.3)' }}>
                        <div style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770' }}>
                            Opvarmning til åbner {opener}kg
                          </span>
                          {meetWarmupEditing === key ? (
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button style={{ ...s.btnGhost, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }} onClick={() => setMeetWarmupEditing(null)}>Annuller</button>
                              <button style={{ ...s.btnPrimary, fontSize: '0.48rem', padding: '0.2rem 0.5rem' }} onClick={() => {
                                setMeetWarmupOverrides(prev => ({ ...prev, [key]: meetWarmupDraft }))
                                setMeetWarmupEditing(null)
                              }}>Gem</button>
                            </div>
                          ) : (
                            <button style={{ ...s.btnGhost, fontSize: '0.46rem', padding: '0.15rem 0.45rem' }} onClick={() => {
                              setMeetWarmupEditing(key)
                              setMeetWarmupDraft((meetWarmupOverrides[key] || warmup).map(ws => ({ ...ws })))
                            }}>Rediger</button>
                          )}
                        </div>

                        {meetWarmupEditing === key ? (
                          <div style={{ padding: '0 0.75rem 0.75rem' }}>
                            {meetWarmupDraft.map((ws, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                <input
                                  type="number"
                                  value={ws.weight}
                                  onChange={e => setMeetWarmupDraft(prev => prev.map((s, j) => j === i ? { ...s, weight: parseFloat(e.target.value) || 0 } : s))}
                                  style={{ width: '64px', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.15)', color: '#edeae2', fontFamily: "'Playfair Display', serif", fontSize: '1rem', padding: '0.3rem 0.4rem', outline: 'none', textAlign: 'center' }}
                                />
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>kg ×</span>
                                <input
                                  type="number"
                                  value={ws.reps}
                                  onChange={e => setMeetWarmupDraft(prev => prev.map((s, j) => j === i ? { ...s, reps: parseInt(e.target.value) || 1 } : s))}
                                  style={{ width: '40px', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.15)', color: '#edeae2', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', padding: '0.3rem 0.4rem', outline: 'none', textAlign: 'center' }}
                                />
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', color: '#4a4844' }}>reps</span>
                                <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#e05555', cursor: 'pointer', fontSize: '0.7rem' }} onClick={() => setMeetWarmupDraft(prev => prev.filter((_, j) => j !== i))}>✕</button>
                              </div>
                            ))}
                            <button style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.25rem 0.6rem', marginTop: '0.25rem' }} onClick={() => {
                              const last = meetWarmupDraft[meetWarmupDraft.length - 1]
                              setMeetWarmupDraft(prev => [...prev, { weight: last ? last.weight + 10 : 20, reps: 1, pct: '' }])
                            }}>+ Tilføj sæt</button>
                          </div>
                        ) : (
                          <div style={{ padding: '0 0.75rem 0.6rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {(meetWarmupOverrides[key] || warmup).map((ws, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '0.4rem 0.6rem', minWidth: '52px' }}>
                                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem', color: '#edeae2' }}>{ws.weight}</span>
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.44rem', color: '#4a4844', marginTop: '0.1rem' }}>× {ws.reps}</span>
                                {ws.pct && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.42rem', color: '#c8923a', marginTop: '0.1rem' }}>{ws.pct}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Total */}
              {total > 0 && (
                <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.25rem', marginTop: '0.5rem' }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: allHaveBest ? '#6cba6c' : '#7a7770', marginBottom: '0.35rem' }}>
                    {allHaveBest ? 'Total' : 'Foreløbig total'}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.4rem', fontWeight: 400, color: '#edeae2', lineHeight: 1 }}>
                    {total} <span style={{ fontSize: '1rem', color: '#7a7770' }}>kg</span>
                  </div>
                </div>
              )}

              {/* Reset */}
              {total > 0 && (
                <button
                  style={{ ...s.btnGhost, width: '100%', padding: '0.65rem', textAlign: 'center', marginTop: '1rem' }}
                  onClick={() => setMeetAttempts({
                    squat:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
                    bench:    [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
                    deadlift: [{ w: '', r: null }, { w: '', r: null }, { w: '', r: null }],
                  })}
                >
                  Nulstil
                </button>
              )}
              {meetHistoryCard}
            </>
          )
        })()}
      </div>

      {/* Bottom navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c18', borderTop: '1px solid rgba(237,234,226,0.07)', display: 'flex', zIndex: 100 }}>
        {NAV_ITEMS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              padding: '0.7rem 0',
              color: tab === key ? '#c8923a' : '#4a4844',
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '0.46rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{ position: 'relative' }}>
              {icon}
              {key === 'beskeder' && unreadMsgCount > 0 && (
                <div style={{ position: 'absolute', top: -3, right: -4, width: '8px', height: '8px', borderRadius: '50%', background: '#c8923a', border: '1.5px solid #1c1c18' }} />
              )}
            </div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
