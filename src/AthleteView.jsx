import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

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

// Den "aktive" uge = den seneste uge der er startet (start_date <= i dag).
// Uger uden start_date regnes som tilgængelige nu. Fremtidige uger (oprettet af
// periodiseringsplanlæggeren) udelukkes, så atleten lander på — og kan logge —
// sin nuværende træningsuge, ikke en tom fremtidig uge.
function computeActiveWeekIdx(weeks) {
  if (!weeks || !weeks.length) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
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
  Squat: [
    { id: 'sq-1', name: 'Bodyweight squat', desc: 'Stå med skulderbredde. Sæt dig så dybt ned som muligt og hold et par sekunder fornede — hælene skal blive i gulvet. Fokus på at åbne hofterne.', label: '10 reps', type: 'reps' },
    { id: 'sq-2', name: 'Hip circles', desc: 'Stå på ét ben, løft det andet knæ til hoftehøjde og lav store, langsomme cirkler med hoften — udad og bagud. Åbner hofteleddet i alle retninger.', label: '10 reps pr. side', type: 'reps' },
    { id: 'sq-3', name: 'Glute bridge', desc: 'Lig på ryggen med bøjede knæ og fødder fladt i gulvet. Skub hofterne op og klem ballerne hårdt i toppen — hold et sekund. Sænk roligt ned.', label: '15 reps', type: 'reps' },
  ],
  Bænkpres: [
    { id: 'bp-1', name: 'Skuldercirkler', desc: 'Lav store, langsomme cirkler med skuldrene — fremad og bagud. Hold armene let løftede. Varm skulderleddene grundigt op inden belastning.', label: '10 reps pr. retning', type: 'reps' },
    { id: 'bp-2', name: 'Bryststretch i dørkarmen', desc: 'Sæt underarmen lodret mod en dørkarme med albuen i 90 grader. Drej kroppen væk fra armen og hold. Mærk strækket tværs over brystet og foran skulderen.', label: '20 sek pr. side', type: 'timer', duration: 20 },
    { id: 'bp-3', name: 'Håndled rotation', desc: 'Hold armene fremad og lav fulde, langsomme rotationer i håndleddene begge veje. Stræk fingrene ud og luk dem igen. Vigtigt for greb og håndledsstabilitet.', label: '10 reps pr. retning', type: 'reps' },
  ],
  'Dødløft — Konventionel': [
    { id: 'dlk-1', name: 'Cat-cow', desc: 'Kom på alle fire. Veksler mellem at runde ryggen helt op (kat) og synke den ned mod gulvet (ko). Hold et sekund i hvert yderpunkt. Mobiliserer hele rygsøjlen.', label: '10 reps', type: 'reps' },
    { id: 'dlk-2', name: 'Hip hinge mod væg', desc: 'Stå en håndbredde fra en væg med let bøjede knæ. Skub hofterne bagud til de rammer væggen mens ryggen holder sig neutral. Dette er præcis konventionel dødløft-bevægelsen.', label: '10 reps', type: 'reps' },
    { id: 'dlk-3', name: 'Glute bridge', desc: 'Lig på ryggen, knæ bøjet, fødder fladt. Skub hofterne op og klem ballerne hårdt i toppen. Aktiverer baglår og baller som primærmotorer i dødløft.', label: '15 reps', type: 'reps' },
  ],
  'Dødløft — Sumo': [
    { id: 'dls-1', name: 'Sumo squat med pause', desc: 'Stå bredt med tæerne pegende udad — samme bredde som din sumo-stance. Sæt dig roligt ned og hold et par sekunder fornede. Aktiverer lysken og åbner hofteleddet til din stance.', label: '10 reps', type: 'reps' },
    { id: 'dls-2', name: 'Adduktor stretch siddende', desc: 'Sid på gulvet med benene spredt bredt ud til siderne. Læn langsomt fremad fra hoften med ret ryg og hold. Mærk strækket i inderlårene — afgørende for sumo-stance.', label: '30 sek', type: 'timer', duration: 30 },
    { id: 'dls-3', name: 'Hip external rotation (liggende)', desc: 'Lig på ryggen. Kryds det ene ben over det andet knæ og træk begge ben mod brystet. Mærk strækket dybt i ballerne og hofteleddet. Åbner den eksterne rotation som sumo kræver.', label: '30 sek pr. side', type: 'timer', duration: 30 },
  ],
}

const WARMUP_ADDONS = {
  'Hofte / baller': { id: 'add-hofte', name: '90/90 hofte stretch', desc: 'Sid på gulvet med ét ben bøjet 90 grader foran dig og ét ben 90 grader ude til siden. Læn langsomt frem over det forreste ben. Mærk strækket i ydersiden af hoften og ballerne.', label: '30 sek pr. side', type: 'timer', duration: 30 },
  'Lyske / inderlår': { id: 'add-lyske', name: 'Cossack squat', desc: 'Stå meget bredt. Skift vægten til ét ben og sæt dig ned i den side mens det andet ben strækkes ud til siden med tåen opad. Mærk strækket dybt i lysken og inderlåret. Skift side.', label: '8 reps pr. side', type: 'reps' },
  'Lænde': { id: 'add-laende', name: 'Child\'s pose', desc: 'Sæt dig på hug og læn overkroppen fremad mod gulvet med armene strakt ud foran dig. Lad lænden synke ned og ånd dybt ind i ryggen. Aflaster og strækker lænden.', label: '30 sek', type: 'timer', duration: 30 },
  'Øvre ryg': { id: 'add-oevreryg', name: 'Thorax extension over rulle', desc: 'Læg en rullet håndklæde eller skumrulle tværs under øvre ryg mellem skulderbladene. Læn forsigtigt bagover med hænderne bag nakken og åbn brystet mod loftet.', label: '30 sek', type: 'timer', duration: 30 },
  'Ankel': { id: 'add-ankel', name: 'Ankelmobilitet mod væg', desc: 'Stå med tåspidsen tæt mod en væg. Skub forsigtigt knæet frem til det rammer væggen — hold hælen i gulvet. Flyt foden gradvist længere væk efterhånden.', label: '10 reps pr. ben', type: 'reps' },
  'Knæ': { id: 'add-knae', name: 'Quadriceps stretch stående', desc: 'Stå på ét ben og træk det andet bens fod op mod ballerne — hold om anklen. Hold knæene samlet og skub hofterne let fremad for at intensivere strækket foran låret.', label: '30 sek pr. side', type: 'timer', duration: 30 },
  'Skulder': { id: 'add-skulder', name: 'Thorax rotation siddende', desc: 'Sid på hug eller på hælene med hænderne bag nakken. Roter overkroppen langsomt til én side og hold et sekund. Hold hofterne stille — kun overkroppen roterer.', label: '10 reps pr. side', type: 'reps' },
  'Nakke / trapez': { id: 'add-nakke', name: 'Nakke side-stretch', desc: 'Sid eller stå opret. Læn langsomt øret mod skulderen til du mærker et stræk i siden af nakken og toppen af trapezius. Hold stille — undgå at trække skulderen op.', label: '20 sek pr. side', type: 'timer', duration: 20 },
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

function today() {
  return new Date().toISOString().slice(0, 10)
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
    key: 'opvarmning',
    label: 'Opvarmning',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
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
  const [amount, setAmount] = useState(100)
  const [unitIdx, setUnitIdx] = useState(0)
  const [showManual, setShowManual] = useState(false)
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', carb: '' })
  const [customFoods, setCustomFoods] = useState([])
  const [showCreateFood, setShowCreateFood] = useState(false)
  const [createFood, setCreateFood] = useState({ name: '', kcal100: '', protein100: '', carb100: '', fat100: '', unit_label: '', unit_grams: '' })
  const [shareFood, setShareFood] = useState(true)
  const [mealTemplates, setMealTemplates] = useState([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  // Stregkode-scanner
  const [showScanner, setShowScanner] = useState(false)
  const [scanStatus, setScanStatus] = useState('idle') // idle|starting|scanning|looking-up|error
  const [scanError, setScanError] = useState('')
  const [manualBarcode, setManualBarcode] = useState('')
  const videoRef = useRef(null)
  const scanStreamRef = useRef(null)
  const scanActiveRef = useRef(false)
  const [templateNameInput, setTemplateNameInput] = useState('')
  const [historicalMealLogs, setHistoricalMealLogs] = useState([])

  // Messages state
  const [messages, setMessages] = useState([])
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const [messageInput, setMessageInput] = useState('')

  // Program state
  const [currentWeek, setCurrentWeek] = useState(null)
  const [allWeeks, setAllWeeks] = useState([])
  const [viewingWeekIdx, setViewingWeekIdx] = useState(0)
  const [pastLogs, setPastLogs] = useState([])
  const [allExerciseLogs, setAllExerciseLogs] = useState([])
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
  const [skipConfirmEx, setSkipConfirmEx] = useState(null)
  const [openRpePicker, setOpenRpePicker] = useState(null)

  // Session feedback state
  const [dismissedFeedback, setDismissedFeedback] = useState(new Set())
  const [feedbackInputs, setFeedbackInputs] = useState({})

  const [showRpeGuide, setShowRpeGuide] = useState(false)

  // Warmup state
  const [warmupTemplates, setWarmupTemplates] = useState([])
  const [warmupChecked, setWarmupChecked] = useState({})
  const [warmupExpanded, setWarmupExpanded] = useState(new Set())
  const [exWarmupExpanded, setExWarmupExpanded] = useState(new Set())
  const [exWarmupWeightOverride, setExWarmupWeightOverride] = useState({})
  const [exWarmupWeightEditing, setExWarmupWeightEditing] = useState(null)
  const [warmupPhase, setWarmupPhase] = useState('focus')
  const [warmupFocus, setWarmupFocus] = useState(null)
  const [warmupSubtype, setWarmupSubtype] = useState(null)
  const [warmupProblems, setWarmupProblems] = useState(new Set())
  const [warmupExercises, setWarmupExercises] = useState([])
  const [warmupStep, setWarmupStep] = useState(0)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [timerDone, setTimerDone] = useState(false)
  const timerRef = useRef(null)

  // Stævnedag state
  const [hasMeetPlan, setHasMeetPlan] = useState(false)
  const [meetType, setMeetType] = useState('sbd')
  const [meetPlanNotes, setMeetPlanNotes] = useState('')
  const [meetWarmupEditing, setMeetWarmupEditing] = useState(null)
  const [meetWarmupDraft, setMeetWarmupDraft] = useState([])
  const [meetWarmupOverrides, setMeetWarmupOverrides] = useState({})
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
  useEffect(() => { if (tab === 'beskeder' && athlete) { fetchAthleteMessages(); markMessagesAsRead() } }, [tab, athlete?.id])
  useEffect(() => { if (tab === 'stævnedag' && athlete) fetchMeetPlan(athlete.id) }, [tab, athlete?.id])

  useEffect(() => {
    if (tab === 'opvarmning' && currentWeek && warmupPhase === 'focus' && !warmupFocus) {
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
  }, [tab, currentWeek])

  useEffect(() => {
    if (!timerActive) return
    if (timerSeconds <= 0) { setTimerActive(false); setTimerDone(true); return }
    timerRef.current = setTimeout(() => setTimerSeconds(s => s - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [timerActive, timerSeconds])

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoadError(true), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  async function fetchAthlete() {
    if (!coachAthleteId && role !== 'athlete') { setLoading(false); return }
    const query = supabase.from('athletes').select('*')
    const { data } = await (coachAthleteId
      ? query.eq('id', coachAthleteId)
      : query.eq('email', session.user.email)
    ).maybeSingle()
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
      fetchProgram(data.id)
      fetchAthleteMessages(data.id)
      fetchWeightLogs(data.id)
      fetchReadiness(data.id)
      fetchWarmupTemplates(data.id)
      fetchMeetPlan(data.id)
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

  async function fetchWarmupTemplates(athleteId) {
    const { data } = await supabase
      .from('warmup_templates')
      .select('*')
      .eq('athlete_id', athleteId)
    setWarmupTemplates(data || [])
  }

  function detectSessionCategory(session) {
    for (const ex of session.exercises || []) {
      const n = (ex.name || '').toLowerCase()
      if (n.includes('squat')) return 'Squat'
      if (n.includes('bænk') || n.includes('bench')) return 'Bænkpres'
      if (n.includes('dødl') || n.includes('deadlift')) return 'Dødløft'
    }
    return null
  }

  function isMainLift(name) {
    const n = (name || '').toLowerCase()
    if (n.includes('romanian') || n.includes('rdl') || n.includes('stiff') || n.includes('front squat') || n.includes('hack') || n.includes('goblet') || n.includes('sumo')) return false
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
    let score = 100
    const h = parseFloat(sleep) || 0
    if (h > 0) {
      if (h < 6) score -= 25
      else if (h < 7) score -= 10
      else if (h > 9) score -= 5
    }
    if (energy) score += (energy - 3) * 10
    if (motivation) score += (motivation - 3) * 8
    if (stress) score += (stress - 3) * -8
    if (soreness) score += (soreness - 3) * -8
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async function saveReadiness() {
    if (!athlete || !readinessInput.energy || !readinessInput.motivation || !readinessInput.stress || !readinessInput.soreness) return
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
    fetchAllExerciseLogs(athleteId, weeks)
  }

  async function fetchAllExerciseLogs(athleteId, weeks) {
    const allExIds = weeks.flatMap(w => (w.sessions || []).flatMap(s => (s.exercises || []).map(e => e.id)))
    if (allExIds.length === 0) return
    const { data } = await supabase
      .from('exercise_logs')
      .select('exercise_id, skipped')
      .eq('athlete_id', athleteId)
      .in('exercise_id', allExIds)
    setAllExerciseLogs(data || [])
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
      rpe_actual: input.rpe ? parseFloat(input.rpe) : null,
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

    // PR detection
    if (payload.weight > 0) {
      const exerciseName = allWeeks
        .flatMap(w => w.sessions || [])
        .flatMap(s => s.exercises || [])
        .find(e => e.id === exerciseId)?.name
      if (exerciseName) {
        const { data: prData } = await supabase
          .from('personal_records')
          .select('weight')
          .eq('athlete_id', athlete.id)
          .eq('exercise_name', exerciseName)
          .order('weight', { ascending: false })
          .limit(1)
        const currentPR = prData?.[0]?.weight ?? 0
        if (payload.weight > currentPR) {
          await supabase.from('personal_records').insert({
            athlete_id: athlete.id,
            exercise_name: exerciseName,
            weight: payload.weight,
            reps: parseInt(repsCompleted) || null,
          })
          setPrToast(exerciseName)
          setPrToastFading(false)
          setTimeout(() => setPrToastFading(true), 2400)
          setTimeout(() => setPrToast(null), 3000)
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

  async function fetchLogs(athleteId) {
    const { data } = await supabase
      .from('meal_logs')
      .select('*')
      .eq('athlete_id', athleteId)
      .eq('date', today())
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

  async function fetchMealTemplates(athleteId) {
    const { data } = await supabase
      .from('meal_templates')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('created_at', { ascending: false })
    setMealTemplates(data || [])
  }

  async function copyYesterday() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const yStr = d.toISOString().slice(0, 10)
    const { data } = await supabase
      .from('meal_logs')
      .select('meal, kcal, protein, carb, fat')
      .eq('athlete_id', athlete.id)
      .eq('date', yStr)
    if (!data || data.length === 0) return
    await supabase.from('meal_logs').insert(
      data.map(item => ({ ...item, athlete_id: athlete.id, date: today() }))
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
      template.items.map(item => ({ ...item, athlete_id: athlete.id, date: today() }))
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
    if (units.length > 1) { setUnitIdx(1); setAmount(1) }
    else { setUnitIdx(0); setAmount(100) }
  }

  async function addFromSearch() {
    if (!selectedFood || !athlete) return
    const units = unitsForFood(selectedFood)
    const unit = units[unitIdx] || units[0]
    const grams = amount * unit.grams
    const ratio = grams / 100
    // Beskriv portionen i navnet når enheden ikke er gram, så loggen er læsbar.
    const label = unit.label === 'g'
      ? `${selectedFood.name} · ${Math.round(grams)} g`
      : `${selectedFood.name} · ${amount} ${unit.label} (${Math.round(grams)} g)`
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id,
      date: today(),
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

  async function addManual() {
    if (!manual.name.trim() || !athlete) return
    await supabase.from('meal_logs').insert({
      athlete_id: athlete.id,
      date: today(),
      meal: manual.name,
      kcal: parseInt(manual.kcal) || 0,
      protein: parseInt(manual.protein) || 0,
      carb: parseInt(manual.carb) || 0,
      fat: 0,
    })
    setManual({ name: '', kcal: '', protein: '', carb: '' })
    setShowManual(false)
    fetchLogs(athlete.id)
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

  // Slår en stregkode op i Open Food Facts og prefiller opret-fødevare-formen.
  async function lookupBarcode(rawCode) {
    const code = String(rawCode || '').replace(/\D/g, '')
    if (code.length < 6) { setScanError('Ugyldig stregkode'); setScanStatus('error'); return }
    setScanStatus('looking-up')
    setScanError('')
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,nutriments,serving_quantity`)
      const json = await res.json()
      if (json.status !== 1 || !json.product) {
        setScanError('Produktet blev ikke fundet. Opret det manuelt nedenfor.')
        setScanStatus('error')
        return
      }
      const p = json.product
      const n = p.nutriments || {}
      const kcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : '')
      const name = [p.product_name, p.brands ? `(${p.brands.split(',')[0].trim()})` : ''].filter(Boolean).join(' ').trim() || `Stregkode ${code}`
      const servingG = Number(p.serving_quantity) > 0 ? Math.round(Number(p.serving_quantity)) : ''
      stopScanner()
      setSearchQuery('')
      setSearchResults([])
      setSelectedFood(null)
      setShowCreateFood(true)
      setCreateFood({
        name,
        kcal100: kcal !== '' ? String(Math.round(kcal)) : '',
        protein100: n['proteins_100g'] != null ? String(round1(n['proteins_100g'])) : '',
        carb100: n['carbohydrates_100g'] != null ? String(round1(n['carbohydrates_100g'])) : '',
        fat100: n['fat_100g'] != null ? String(round1(n['fat_100g'])) : '',
        unit_label: servingG ? 'portion' : '',
        unit_grams: servingG ? String(servingG) : '',
      })
    } catch {
      setScanError('Kunne ikke hente data (tjek netværk). Opret manuelt nedenfor.')
      setScanStatus('error')
    }
  }

  function round1(v) { return Math.round(Number(v) * 10) / 10 }

  function stopScanner() {
    scanActiveRef.current = false
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(t => t.stop())
      scanStreamRef.current = null
    }
    setShowScanner(false)
    setScanStatus('idle')
  }

  async function startScanner() {
    setManualBarcode('')
    setScanError('')
    setShowScanner(true)
    if (!('BarcodeDetector' in window)) {
      // Ingen native scanner (fx iOS Safari) — vis manuel indtastning i stedet.
      setScanStatus('error')
      setScanError('Din browser understøtter ikke kamera-scanning. Indtast stregkoden manuelt herunder (virker på alle enheder).')
      return
    }
    setScanStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      scanStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      scanActiveRef.current = true
      setScanStatus('scanning')
      const tick = async () => {
        if (!scanActiveRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes && codes.length > 0) {
            scanActiveRef.current = false
            lookupBarcode(codes[0].rawValue)
            return
          }
        } catch { /* enkelt frame fejlede — fortsæt */ }
        if (scanActiveRef.current) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch {
      setScanStatus('error')
      setScanError('Kunne ikke åbne kameraet. Giv adgang i browseren, eller indtast stregkoden manuelt.')
    }
  }

  // Ryd op i kamera-stream hvis komponenten unmountes mens scanneren kører.
  useEffect(() => () => {
    scanActiveRef.current = false
    if (scanStreamRef.current) scanStreamRef.current.getTracks().forEach(t => t.stop())
  }, [])

  async function autoCompleteSession(session) {
    const exerciseIds = (session.exercises || []).map(e => e.id)
    if (exerciseIds.length === 0) { alert('Ingen øvelser fundet i sessionen.'); return }

    const { data: existing, error: fetchErr } = await supabase
      .from('exercise_logs')
      .select('exercise_id, set_number')
      .eq('athlete_id', athlete.id)
      .in('exercise_id', exerciseIds)
    if (fetchErr) { alert('Fejl ved hentning af eksisterende logs: ' + fetchErr.message); return }

    const logged = new Set((existing || []).map(l => `${l.exercise_id}_${l.set_number}`))
    const rows = []
    for (const ex of (session.exercises || [])) {
      const last = lastLogByExerciseName[ex.name?.toLowerCase()]
      const weight = last?.weight ?? parseFloat(ex.recommended_weight) ?? 0
      const reps = last?.reps_completed ?? parseInt(ex.reps) ?? 0
      for (let n = 1; n <= (parseInt(ex.sets) || 0); n++) {
        if (logged.has(`${ex.id}_${n}`)) continue
        rows.push({ exercise_id: ex.id, athlete_id: athlete.id, set_number: n, weight, reps_completed: reps, note: null, rpe_actual: null, rpe_planned: null, skipped: false })
      }
    }

    if (rows.length === 0) {
      alert('Alle sæt er allerede logget.')
      return
    }

    const { error: insertErr } = await supabase.from('exercise_logs').insert(rows)
    if (insertErr) { alert('Fejl ved indsætning: ' + insertErr.message); return }

    alert(`${rows.length} sæt udfyldt.`)
    await fetchExerciseLogs(athlete.id, currentWeek)
    await fetchPastLogs(allWeeks[viewingWeekIdx], athlete.id)
    await fetchAllExerciseLogs(athlete.id, allWeeks)
  }

  async function deleteLog(id) {
    await supabase.from('meal_logs').delete().eq('id', id)
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
          🏆 Ny PR på {prToast}!
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
        {tab === 'hjem' && (
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
                      Uge {currentWeek.week_number}
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
                          onClick={() => { setTab('program'); setProgOpenSession(sess.id) }}
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
                    Fejl: {readinessError}
                  </div>
                )}
                <button
                  style={{ ...s.btnPrimary, width: '100%', opacity: (!readinessInput.energy || !readinessInput.motivation || !readinessInput.stress || !readinessInput.soreness) ? 0.45 : 1 }}
                  onClick={saveReadiness}
                  disabled={savingReadiness || !readinessInput.energy || !readinessInput.motivation || !readinessInput.stress || !readinessInput.soreness}
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
          const isCurrentWeek = viewingWeekIdx === activeWeekIdx
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
                  {/* Phase bar */}
                  {allWeeks.length > 0 && (() => {
                    const compDate = athlete?.competition_date
                    const compMs = compDate ? new Date(compDate + 'T12:00:00') - new Date() : null
                    const weeksToComp = compMs != null ? Math.ceil(compMs / (7 * 24 * 3600 * 1000)) : null

                    const phases = computePhases(allWeeks)
                    const totalWeeks = allWeeks.length

                    // Find which phase the active (current) week belongs to
                    let currentPhaseName = null, weekInPhase = 0, phaseTotalWeeks = 0
                    let ps = 0
                    for (const phase of phases) {
                      if (ps + phase.weeks.length > activeWeekIdx) {
                        currentPhaseName = phase.name
                        weekInPhase = activeWeekIdx - ps + 1
                        phaseTotalWeeks = phase.weeks.length
                        break
                      }
                      ps += phase.weeks.length
                    }

                    const markerPct = (activeWeekIdx + 0.5) / totalWeeks * 100

                    return (
                      <div style={{ marginBottom: '1.25rem' }}>
                        {weeksToComp != null && weeksToComp > 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#c8923a', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
                            🏆 {weeksToComp} uger til stævne
                          </div>
                        )}
                        {weeksToComp != null && weeksToComp <= 0 && (
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', color: '#6cba6c', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
                            🏆 Stævne passeret
                          </div>
                        )}

                        {/* Proportional phase bar with marker */}
                        <div style={{ position: 'relative', paddingBottom: '2.5rem' }}>
                          <div style={{ display: 'flex', height: '30px', gap: '2px' }}>
                            {phases.map((phase, pi) => {
                              const color = blockColor(phase.name)
                              const phaseStartIdx = phases.slice(0, pi).reduce((a, p) => a + p.weeks.length, 0)
                              return (
                                <div
                                  key={pi}
                                  style={{
                                    flex: `${phase.weeks.length} 0 0`,
                                    background: phase.name ? color + '28' : 'rgba(237,234,226,0.05)',
                                    border: `1px solid ${phase.name ? color + '60' : 'rgba(237,234,226,0.1)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    overflow: 'hidden',
                                    minWidth: 0,
                                  }}
                                  onClick={() => {
                                    setViewingWeekIdx(phaseStartIdx)
                                    setProgOpenSession(null)
                                    if (phaseStartIdx < activeWeekIdx) fetchPastLogs(allWeeks[phaseStartIdx], athlete.id)
                                    else setPastLogs([])
                                  }}
                                >
                                  {phase.name && phase.weeks.length >= 2 && (
                                    <span style={{
                                      fontFamily: "'IBM Plex Mono', monospace",
                                      fontSize: '0.42rem',
                                      letterSpacing: '0.07em',
                                      textTransform: 'uppercase',
                                      color,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      padding: '0 6px',
                                    }}>{phase.name}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Marker arrow at current week */}
                          <div style={{
                            position: 'absolute',
                            left: `${markerPct}%`,
                            top: '30px',
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                          }}>
                            <div style={{ color: '#c8923a', fontSize: '0.6rem', lineHeight: 1, textAlign: 'center' }}>▲</div>
                          </div>

                          {/* Phase info text */}
                          <div style={{ marginTop: '1rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                            {currentPhaseName && (
                              <span style={{ color: blockColor(currentPhaseName) }}>{currentPhaseName} · Uge {weekInPhase} af {phaseTotalWeeks} · </span>
                            )}
                            <span style={{ color: '#4a4844' }}>Total uge {activeWeekIdx + 1} af {totalWeeks}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Week header — navigation only shown when multiple weeks exist */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    {allWeeks.length > 1 ? (
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
                            Uge {viewedWeek.week_number}
                            {!isCurrentWeek && <span style={{ color: '#4a4844', marginLeft: '0.5em' }}>· historisk</span>}
                          </div>
                          {viewedWeek.block_name && (
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2', marginTop: '0.1rem' }}>{viewedWeek.block_name}</div>
                          )}
                        </div>
                        <button
                          style={{ ...s.btnGhost, fontSize: '0.58rem', padding: '0.4rem 0.75rem', opacity: isCurrentWeek ? 0.25 : 1 }}
                          disabled={isCurrentWeek}
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
                      <div key={session.id} style={{ marginBottom: '0.75rem' }}>
                        <div
                          style={{ ...s.card, marginBottom: 0, cursor: 'pointer', borderLeft: isDone ? '3px solid #6cba6c' : isOpen ? '3px solid #c8923a' : '3px solid transparent' }}
                          onClick={() => setProgOpenSession(isOpen ? null : session.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ ...s.cardLabel, marginBottom: '0.3rem', fontSize: '0.72rem' }}>{session.title}</div>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem', color: '#7a7770', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                {(session.exercises || []).length} øvelser · {loggedSets}/{totalSets} sæt logget{sessionLogs.filter(l => l.skipped).length > 0 ? ` · ${sessionLogs.filter(l => l.skipped).length} skippet` : ''}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isDone && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#6cba6c', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Færdig ✓</span>}
                              {!isDone && totalSets > 0 && (
                                <button
                                  style={{ ...s.btnGhost, fontSize: '0.5rem', padding: '0.3rem 0.6rem', color: '#c8923a', borderColor: 'rgba(200,146,58,0.35)' }}
                                  onClick={e => { e.stopPropagation(); if (window.confirm('Udfyld manglende sæt med sidst loggede vægt og reps?')) autoCompleteSession(session) }}
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
                                            type="number" inputMode="decimal" placeholder="kg" value={input.weight}
                                            onChange={e => setLogInputs(p => ({ ...p, [key]: { ...p[key], weight: e.target.value } }))}
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
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginBottom: '0.5rem' }}>Kost</div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', fontWeight: 400, color: '#edeae2', lineHeight: 1.1 }}>Kostlog.</h1>
            </div>

            {progressBars}

            {/* TDEE estimate */}
            <div style={{ ...s.card, marginBottom: '1.5rem' }}>
              <div style={s.cardLabel}>Estimeret TDEE</div>
              {!tdeeEstimate.ready ? (
                <div style={{ fontSize: '0.82rem', color: '#4a4844' }}>
                  {tdeeEstimate.missingWeight
                    ? 'Vej dig mindst 2 gange med 7 dages mellemrum for at aktivere dette estimat.'
                    : `Log kalorier i mindst ${tdeeEstimate.missingKcalDays} dage mere for at aktivere dette estimat.`}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.6rem' }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', color: '#edeae2', lineHeight: 1 }}>{tdeeEstimate.tdee}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', color: '#7a7770' }}>kcal/dag</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.48rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: tdeeEstimate.confidence === 'høj' ? '#6cba6c' : tdeeEstimate.confidence === 'moderat' ? '#c8923a' : '#7a7770', border: `1px solid ${tdeeEstimate.confidence === 'høj' ? 'rgba(108,186,108,0.4)' : tdeeEstimate.confidence === 'moderat' ? 'rgba(200,146,58,0.4)' : 'rgba(122,119,112,0.3)'}`, padding: '0.15rem 0.4rem', marginLeft: '0.25rem' }}>{tdeeEstimate.confidence} sikkerhed</span>
                  </div>
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
            </div>

            {/* Stregkode-scanner overlay */}
            {showScanner && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.94)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8923a' }}>Scan stregkode</div>
                    <button onClick={stopScanner} style={{ background: 'none', border: 'none', color: '#7a7770', fontSize: '1.1rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
                  </div>

                  {(scanStatus === 'starting' || scanStatus === 'scanning' || scanStatus === 'looking-up') && (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000', overflow: 'hidden', border: '1px solid rgba(200,146,58,0.3)' }}>
                      <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '2px', background: '#c8923a', boxShadow: '0 0 8px #c8923a', transform: 'translateY(-50%)' }} />
                    </div>
                  )}

                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: scanStatus === 'error' ? '#e05555' : '#7a7770', marginTop: '0.75rem', lineHeight: 1.6, minHeight: '1.2rem', textAlign: 'center' }}>
                    {scanStatus === 'starting' && 'Åbner kamera…'}
                    {scanStatus === 'scanning' && 'Hold stregkoden inden for stregen'}
                    {scanStatus === 'looking-up' && 'Henter ernæring…'}
                    {scanStatus === 'error' && scanError}
                  </div>

                  {/* Manuel indtastning — virker på alle enheder (også iOS) */}
                  <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(237,234,226,0.1)', paddingTop: '1rem' }}>
                    <div style={s.fieldLabel}>Eller indtast stregkode manuelt</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                      <input
                        style={{ ...s.fieldInput, flex: 1 }}
                        type="text"
                        inputMode="numeric"
                        placeholder="fx 5701234567890"
                        value={manualBarcode}
                        onChange={e => setManualBarcode(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && lookupBarcode(manualBarcode)}
                      />
                      <button style={{ ...s.btnPrimary, flexShrink: 0 }} onClick={() => lookupBarcode(manualBarcode)} disabled={scanStatus === 'looking-up'}>Slå op</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div style={s.card}>
              <div style={s.cardLabel}>Tilføj fødevare</div>

              <button
                style={{ ...s.btnPrimary, width: '100%', fontSize: '0.6rem', padding: '0.6rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={startScanner}
              >📷 Scan stregkode</button>

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
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', color: '#7a7770', textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                        {f.kcal100} kcal · P: {f.protein100}g · K: {f.carb100}g<br />
                        <span style={{ color: '#4a4844' }}>pr. 100g</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedFood && (() => {
                const units = unitsForFood(selectedFood)
                const unit = units[unitIdx] || units[0]
                const grams = amount * unit.grams
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
                          onClick={() => { setUnitIdx(ui); setAmount(u.label === 'g' ? 100 : 1) }}
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
                        onClick={() => setAmount(q)}
                        style={{ ...s.btnGhost, fontSize: '0.55rem', padding: '0.3rem 0.6rem', color: amount === q ? '#c8923a' : '#7a7770', borderColor: amount === q ? 'rgba(200,146,58,0.5)' : undefined }}
                      >{q}{unit.label === 'g' ? 'g' : ` ${unit.label}`}</button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div>
                      <div style={s.fieldLabel}>Mængde ({unit.label})</div>
                      <input style={{ ...s.fieldInput, maxWidth: '100px' }} type="number" inputMode="decimal" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} />
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
              <div style={s.cardLabel}>Dagens måltider — {today()}</div>

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
                      {logs.map(l => (
                        <tr key={l.id} style={{ fontSize: '0.85rem' }}>
                          <td style={{ padding: '0.45rem 0', color: '#b8b4a8' }}>{l.meal}</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#c8923a', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>{l.kcal}</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.protein}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.carb}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.72rem' }}>{l.fat}g</td>
                          <td style={{ textAlign: 'right', padding: '0.45rem 0' }}>
                            <button onClick={() => deleteLog(l.id)} style={{ background: 'none', border: 'none', color: '#4a4844', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✕</button>
                          </td>
                        </tr>
                      ))}
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

        {/* OPVARMNING */}
        {tab === 'opvarmning' && (() => {
          const FOCUSES = ['Squat', 'Bænkpres', 'Dødløft']
          const PROBLEMS = ['Hofte / baller', 'Lyske / inderlår', 'Lænde', 'Øvre ryg', 'Ankel', 'Knæ', 'Skulder', 'Nakke / trapez']
          const baseKey = warmupFocus === 'Dødløft' ? `Dødløft — ${warmupSubtype}` : warmupFocus
          const focusReady = warmupFocus && (warmupFocus !== 'Dødløft' || warmupSubtype)

          function startGuide() {
            const base = WARMUP_BASE[baseKey] || []
            const coachFocusKey = warmupFocus === 'Dødløft' ? 'Dødløft' : warmupFocus
            const coachSteps = (warmupTemplates.find(t => t.exercise_category === coachFocusKey)?.steps || [])
              .map((step, i) => ({ id: `coach_${i}`, name: step, desc: '', label: '', type: 'reps' }))
            const addons = [...warmupProblems].map(p => WARMUP_ADDONS[p]).filter(Boolean)
            const all = [...base, ...addons, ...coachSteps]
            setWarmupExercises(all)
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
            const ex = warmupExercises[idx]
            setTimerSeconds(ex?.type === 'timer' ? ex.duration : 0)
          }

          function resetWarmup() {
            setWarmupPhase('focus')
            setWarmupFocus(null)
            setWarmupSubtype(null)
            setWarmupProblems(new Set())
            setWarmupExercises([])
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
            const ex = warmupExercises[warmupStep]
            const isLast = warmupStep === warmupExercises.length - 1
            const pct = Math.round(((warmupStep) / warmupExercises.length) * 100)

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

                {/* Exercise card */}
                <div style={{ background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.75rem', marginBottom: '1.25rem', minHeight: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.6rem', fontWeight: 400, color: '#edeae2', marginBottom: '1rem', lineHeight: 1.2 }}>{ex.name}</h2>
                    {ex.desc && <p style={{ fontSize: '0.9rem', color: '#b8b4a8', lineHeight: 1.75, margin: 0 }}>{ex.desc}</p>}
                  </div>
                  <div style={{ marginTop: '1.5rem' }}>
                    {ex.type === 'timer' ? (
                      <div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '3rem', color: timerDone ? '#6cba6c' : '#c8923a', lineHeight: 1, marginBottom: '0.75rem' }}>
                          {timerDone ? '✓' : timerSeconds > 0 ? timerSeconds : ex.duration}
                          {!timerDone && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.9rem', color: '#7a7770', marginLeft: '0.4rem' }}>sek</span>}
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
                        const done = att.r !== null
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
