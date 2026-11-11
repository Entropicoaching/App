import { FOODS } from '../foedevarer/index.mjs'
import { afdelingFor, AFDELINGER } from '../realisme.mjs'
import { SLOTS } from './plan.mjs'

// Indkøb for husstanden. Planens gram er katalogets tilstand (kogt ris og
// pasta, afdryppet tun og bønner, spiselig del af frugt og grønt). faktor
// omregner til den vare, man køber; pakning er gram af katalogtilstanden i én
// almindelig pakning i Netto eller Dagli'Brugsen. Omregningerne er afrundede
// køkkenregler (kogt ris cirka 2,8 gange tørvægten), ikke målte værdier.
export const PAKNINGER = Object.freeze({
  'Skyr naturel': { tekst: 'Skyr naturel 1 kg', g: 1000 },
  'Kvark naturel': { tekst: 'Kvark naturel 500 g', g: 500 },
  'Græsk yoghurt 2%': { tekst: 'Græsk yoghurt 2 % 1 kg', g: 1000 },
  'Hytteost': { tekst: 'Hytteost 400 g', g: 400 },
  'Mælk minimælk': { tekst: 'Minimælk 1 l', g: 1000 },
  'Kakaomælk': { tekst: 'Kakaomælk 1 l', g: 1000 },
  'Proteinmælk': { tekst: 'Proteinmælk/proteindrik 500 ml', g: 500 },
  'Cremefraiche 9%': { tekst: 'Cremefraiche 9 % 200 g', g: 200 },
  'Parmesan': { tekst: 'Parmesan revet 100 g', g: 100 },
  'Ost 30+': { tekst: 'Revet ost 30+ 150 g', g: 150 },
  'Smør': { tekst: 'Smør 250 g', g: 250, basis: true },
  'Æg helt': { tekst: 'Æg 10 stk (ca. 55 g spiselig pr. æg)', g: 550 },
  'Skinke mager': { tekst: 'Skinkepålæg 100 g', g: 100 },
  'Hummus': { tekst: 'Hummus 200 g', g: 200 },
  'Kyllingebryst': { tekst: 'Kyllingebryst 1 kg', g: 1000 },
  'Kyllingelår u/skind': { tekst: 'Kyllingeoverlår uden skind 500 g', g: 500 },
  'hakket kalkun': { tekst: 'Hakket kalkun 500 g', g: 500, afdeling: 'Kød og fisk' },
  'Hakket oksekød 8%': { tekst: 'Hakket oksekød 4 til 7 % (8 %) 500 g', g: 500 },
  'Bøf/oksefilet': { tekst: 'Oksestrimler 400 g', g: 400 },
  'Svinekød mørbrad': { tekst: 'Svinemørbrad ca. 500 g', g: 500 },
  'Svinekam': { tekst: 'Svinestrimler (kam) 400 g', g: 400 },
  'Laks fersk': { tekst: 'Laksefilet 4 stk 500 g (køl eller frost)', g: 500 },
  'torsk frost': { tekst: 'Torskefilet frost 400 g', g: 400, afdeling: 'Frost' },
  'Tun i vand': { tekst: 'Tun i vand, dåse (ca. 130 g afdryppet)', g: 130 },
  'Makrel i tomat': { tekst: 'Makrel i tomat, dåse 125 g', g: 125 },
  'kidneybønner dåse': { tekst: 'Kidneybønner, dåse 400 g (ca. 240 g afdryppet)', g: 240, afdeling: 'Kolonial' },
  'hakkede tomater dåse': { tekst: 'Hakkede tomater, dåse 400 g', g: 400, afdeling: 'Kolonial' },
  'Tomatpuré': { tekst: 'Tomatpuré 140 g', g: 140 },
  'Kokosmælk': { tekst: 'Kokosmælk, dåse 400 ml', g: 400 },
  'Salsa': { tekst: 'Salsa, glas 230 g', g: 230 },
  'Pesto': { tekst: 'Pesto 190 g', g: 190 },
  'Rugbrød': { tekst: 'Rugbrød 1 kg', g: 1000 },
  'Franskbrød': { tekst: 'Franskbrød/toast 500 g', g: 500 },
  'Tortilla wrap': { tekst: 'Tortilla wraps 8 stk (ca. 480 g)', g: 480 },
  'Knækbrød': { tekst: 'Knækbrød 250 g', g: 250 },
  'Riskager naturel': { tekst: 'Riskager 130 g', g: 130 },
  'Havregryn': { tekst: 'Havregryn 1 kg', g: 1000 },
  'Müsli uden sukker': { tekst: 'Müsli uden tilsat sukker 750 g', g: 750 },
  'Ris kogt': { tekst: 'Ris 1 kg (tør)', g: 1000, faktor: 1 / 2.8 },
  'Pasta kogt': { tekst: 'Pasta 1 kg (tør)', g: 1000, faktor: 1 / 2.4 },
  'Bulgur kogt': { tekst: 'Bulgur 500 g (tør)', g: 500, faktor: 1 / 2.7 },
  'Couscous kogt': { tekst: 'Couscous 500 g (tør)', g: 500, faktor: 1 / 2.3 },
  'Kartofler kogte': { tekst: 'Kartofler 2 kg', g: 2000, faktor: 1.1 },
  'Rødbede kogte': { tekst: 'Kogte rødbeder, vakuum 500 g', g: 500 },
  'Banan': { tekst: 'Bananer (ca. 120 g spiselig pr. stk)', stk: 120 },
  'Æble': { tekst: 'Æbler (ca. 150 g pr. stk)', stk: 150 },
  'Tomat': { tekst: 'Tomater 500 g', g: 500 },
  'Agurk': { tekst: 'Agurk (ca. 350 g pr. stk)', stk: 350 },
  'Peberfrugt rød': { tekst: 'Rød peberfrugt (ca. 150 g spiselig pr. stk)', stk: 150 },
  'Salat iceberg': { tekst: 'Icebergsalat (ca. 400 g pr. stk)', stk: 400 },
  'Broccoli': { tekst: 'Broccoli (ca. 300 g buketter pr. stk)', stk: 300 },
  'Løg': { tekst: 'Løg 1 kg', g: 1000 },
  'Gulerod': { tekst: 'Gulerødder 1 kg', g: 1000 },
  'Champignon': { tekst: 'Champignon 250 g', g: 250 },
  'spinat frisk': { tekst: 'Babyspinat 150 g', g: 150, afdeling: 'Frugt og grønt' },
  'spinat frost': { tekst: 'Hakket spinat frost 450 g', g: 450, afdeling: 'Frost' },
  'blåbær frost': { tekst: 'Blåbær frost 500 g', g: 500, afdeling: 'Frost' },
  'hindbær frost': { tekst: 'Hindbær frost 250 g', g: 250, afdeling: 'Frost' },
  'grønne bønner frost': { tekst: 'Grønne bønner frost 450 g', g: 450, afdeling: 'Frost' },
  'edamame frost': { tekst: 'Edamamebønner frost 400 g', g: 400, afdeling: 'Frost' },
  'Ærter frosne': { tekst: 'Ærter frost 450 g', g: 450 },
  'Mandler': { tekst: 'Mandler 200 g', g: 200 },
  'Valnødder': { tekst: 'Valnødder 100 g', g: 100 },
  'Sesamfrø': { tekst: 'Sesamfrø 100 g', g: 100, basis: true },
  'Honning': { tekst: 'Honning 450 g', g: 450, basis: true },
  'Syltetøj': { tekst: 'Syltetøj 400 g', g: 400, basis: true },
  'Soja sauce': { tekst: 'Sojasauce 150 ml', g: 150, basis: true },
  'Olivenolie': { tekst: 'Olivenolie 500 ml', g: 460, basis: true },
  'Rapsolie': { tekst: 'Rapsolie 1 l', g: 920, basis: true },
  'Hvedemel': { tekst: 'Hvedemel 1 kg', g: 1000, basis: true },
  // Uge 3 og 4 (ordre 96).
  'Hakket svinekød': { tekst: 'Hakket svinekød 500 g', g: 500 },
  'hamburgerryg': { tekst: 'Hamburgerryg ca. 600 g', g: 600, afdeling: 'Kød og fisk' },
  'svinekamsteaks': { tekst: 'Svinekamsteaks uden ben 500 g', g: 500, afdeling: 'Kød og fisk' },
  'oksekød i tern': { tekst: 'Oksekød i tern (gullasch) 500 g', g: 500, afdeling: 'Kød og fisk' },
  'rejer frost': { tekst: 'Rejer pillede frost 250 g', g: 250, afdeling: 'Frost' },
  'kikærter dåse': { tekst: 'Kikærter, dåse 400 g (ca. 240 g afdryppet)', g: 240, afdeling: 'Kolonial' },
  'Linser kogte': { tekst: 'Linser kogte, dåse eller pose (ca. 250 g afdryppet)', g: 250 },
  'risottoris': { tekst: 'Risottoris 1 kg (tør)', g: 1000, faktor: 1 / 2.8, afdeling: 'Kolonial' },
  'burgerboller': { tekst: 'Burgerboller 4 stk (ca. 300 g)', g: 300, afdeling: 'Brød' },
  'Dressing let': { tekst: 'Let dressing eller burgerdressing 250 ml', g: 250 },
  'Rødkål': { tekst: 'Rødkål, glas 580 g', g: 580 },
  'rosenkål frost': { tekst: 'Rosenkål frost 450 g', g: 450, afdeling: 'Frost' },
  'grønkål frost': { tekst: 'Grønlangkål hakket frost 450 g', g: 450, afdeling: 'Frost' },
  'Hvidkål': { tekst: 'Spidskål eller hvidkål (ca. 600 g pr. stk)', stk: 600 },
  'Porre': { tekst: 'Porrer (ca. 200 g spiselig pr. stk)', stk: 200 },
  'Blomkål': { tekst: 'Blomkål (ca. 500 g buketter pr. stk)', stk: 500 },
  'Søde kartofler': { tekst: 'Søde kartofler 1 kg', g: 1000, faktor: 1.1 },
})

const byId = new Map(FOODS.map(food => [food.id, food]))
export const vareNoegle = item => item.vare ?? byId.get(item.foodId).name

// dage: output fra bygPlan. Returnerer varer grupperet efter afdeling med
// behov (gram i katalogtilstand), købsmængde og hvilke måltider de dækker.
export function bygIndkoeb(dage) {
  const behov = new Map()
  for (const dag of dage) for (const plan of Object.values(dag.personer)) for (const slot of SLOTS) {
    const meal = plan.maaltider[slot]
    for (const item of meal.items) {
      const key = vareNoegle(item)
      const row = behov.get(key) ?? { key, foodName: item.name, gram: 0, maaltider: new Set() }
      row.gram += item.grams
      row.maaltider.add(meal.recipeId)
      behov.set(key, row)
    }
  }
  const rows = [...behov.values()].map(row => {
    const pak = PAKNINGER[row.key]
    if (!pak) throw new TypeError('Mangler pakningsstørrelse for ' + row.key)
    const koebGram = row.gram * (pak.faktor ?? 1)
    const antal = Math.ceil((pak.stk ? row.gram / pak.stk : koebGram / pak.g) - 1e-9)
    const daekketGram = pak.stk ? antal * pak.stk : antal * pak.g / (pak.faktor ?? 1)
    return {
      key: row.key, tekst: pak.tekst, antal, enhed: pak.stk ? 'stk' : 'pk',
      behovGram: row.gram, koebGram, daekketGram, basis: Boolean(pak.basis),
      afdeling: pak.basis ? 'Basisvarer (tjek skabet først)' : (pak.afdeling ?? afdelingFor(row.foodName)),
      maaltider: [...row.maaltider].sort(),
    }
  })
  const orden = [...AFDELINGER, 'Basisvarer (tjek skabet først)']
  rows.sort((a, b) => orden.indexOf(a.afdeling) - orden.indexOf(b.afdeling) || a.tekst.localeCompare(b.tekst, 'da'))
  return rows
}
