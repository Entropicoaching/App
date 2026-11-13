// Kobling fra appens lokale dagligvarenavn til én Frida 5.5-række (FoodID).
// Kilde: ordre 107 (KOST-MIKRONAERING-20261111, Hara\tmp\ordre107\beregn.py), 80 koblinger.
// Her står kun de 37, der er direkte (ingen stedfortræder eller omregning) og hvis
// Frida-række findes i appens katalog (frida55 og frida55Extended). Udeladt med vilje:
// stedfortrædere (bulgur, couscous, hummus, proteinmælk, tortilla), tvivlsomme
// (riskager = rå ris, kyllingelår = kyllingebryst, kogt rødbede = rå) og 35, hvis
// Frida-række ikke er i appens katalog endnu. En ukoblet vare stopper omsætningen.
export const FRIDA_KOBLING = Object.freeze(Object.fromEntries([
  ['Agurk', 388],
  ['Banan', 3],
  ['Blomkål', 14],
  ['Blåbær', 1848],
  ['Broccoli', 17],
  ['Bønner kidney', 1810],
  ['Champignon', 961],
  ['Edamame bønner', 1806],
  ['Græsk yoghurt 2%', 1765],
  ['Grønkål', 23],
  ['Gulerod', 24],
  ['Havregryn', 480],
  ['Hindbær', 1850],
  ['Hvidkål', 26],
  ['Hytteost', 1678],
  ['Kalkun', 732],
  ['Kartofler kogte', 801],
  ['Kikærter kogte', 1812],
  ['Kyllingebryst', 795],
  ['Laks fersk', 1658],
  ['Linser kogte', 1807],
  ['Løg', 716],
  ['Mandler', 35],
  ['Mælk minimælk', 1066],
  ['Olivenolie', 1467],
  ['Pasta kogt', 1296],
  ['Peberfrugt rød', 38],
  ['Rapsolie', 1483],
  ['Ris kogt', 1973],
  ['Rugbrød', 1671],
  ['Sesamfrø', 370],
  ['Skyr naturel', 1693],
  ['Spinat', 50],
  ['Tomat', 52],
  ['Torsk', 72],
  ['Valnødder', 647],
  ['Æble', 2],
].map(([navn, foodId]) => [navn, `frida55:${foodId}`])))
