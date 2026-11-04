import { FOODS } from './catalog.mjs'

// Known publications, not fetched or independently verified in this offline task.
export const SOURCES = Object.freeze([
  Object.freeze({ id: 'issn-protein-2017', citation: 'Jäger et al. (2017). International Society of Sports Nutrition Position Stand: protein and exercise.',
    doi: '10.1186/s12970-017-0177-8', verification: 'kilde skal verificeres' }),
  Object.freeze({ id: 'nutrition-performance-2016', citation: 'Thomas, Erdman & Burke (2016). Nutrition and Athletic Performance.',
    doi: '10.1249/MSS.0000000000000852', verification: 'kilde skal verificeres' }),
  Object.freeze({ id: 'nnr-2023', citation: 'Nordic Nutrition Recommendations 2023.',
    doi: '10.6027/nord2023-003', verification: 'kilde skal verificeres' }),
])

const foodIds = names => Object.freeze(names.map(name => {
  const food = FOODS.find(food => food.name === name)
  if (!food) throw new Error('Prioritering henviser til ukendt fødevare: ' + name)
  return food.id
}))

// Editorial evidence labels, not a formal GRADE assessment or an automatic rank
// of individual products. No claims of measured leucine/calcium in legacy data.
export const PRIORITIES = Object.freeze([
  {
    id: 'protein', order: 1, title: 'Dæk protein over dagen',
    rationale: 'Vælg proteinkilder i måltiderne. Mælkeprotein, æg, fisk og kød bidrager med essentielle aminosyrer; mælkeprotein er en leucinrig mulighed. Varierede plantekilder kan også indgå.',
    evidence: 'high', scope: 'Samlet protein og styrketræning; moderat evidens for at favorisere bestemte leucinrige fødevarer, når samlet protein er dækket.',
    caveat: 'Ingen leucinmængde er registreret her. Kosttilskud er ikke et krav; tilpas efter præferencer og tolerancer.',
    examples: ['Skyr naturel', 'Æg helt', 'Kyllingebryst', 'Tofu fast', 'Linser kogte'], sources: ['issn-protein-2017'],
  },
  {
    id: 'carbohydrate', order: 2, title: 'Tilpas kulhydrat til træningen',
    rationale: 'Ris, pasta, kartofler og havre er praktiske stivelseskilder før eller efter krævende træning og til at dække energi og glykogenbehov.',
    evidence: 'moderate', scope: 'Sportsernæring generelt; behovet afhænger af volumen, varighed og restitutionstid. Direkte styrkeevidens er mere begrænset.',
    caveat: 'Intet obligatorisk snævert tidsvindue. Vælg mængde og timing efter dagens belastning og mavekomfort.',
    examples: ['Ris kogt', 'Pasta kogt', 'Kartofler kogte', 'Havregryn'], sources: ['nutrition-performance-2016'],
  },
  {
    id: 'plants', order: 3, title: 'Varier frugt, grønt og bælgfrugter',
    rationale: 'Variation bidrager til fibre og mikronæringsstoffer og bør have plads i en kostplan til styrkeatleter.',
    evidence: 'high', scope: 'Generel ernæringsmæssig dækning; indirekte og begrænset evidens for ekstra styrkeeffekt af bestemte frugter eller grøntsager.',
    caveat: 'Generelle anbefalinger er ikke et præstationsløfte. Ukendte mikronæringsværdier må ikke bruges som bevis for dækning.',
    examples: ['Broccoli', 'Spinat', 'Appelsin', 'Banan', 'Linser kogte'], sources: ['nnr-2023'],
  },
  {
    id: 'calcium-protein', order: 4, title: 'Husk calcium og protein',
    rationale: 'Mælk, skyr og yoghurt er praktiske muligheder for calcium og protein. Et passende beriget alternativ kan indgå ved fravalg af mejeri.',
    evidence: 'moderate', scope: 'Næringsstofdækning og knoglesundhed; ingen dokumenteret særfordel for styrke fra mejeri alene, når kosten ellers dækker behovet.',
    caveat: 'Berigelse og protein varierer mellem produkter. Kontrollér deklarationen; legacy-listens calcium er ukendt.',
    examples: ['Mælk minimælk', 'Skyr naturel', 'Yoghurt naturel'], sources: ['nnr-2023', 'issn-protein-2017'],
  },
].map(({ examples, sources, ...entry }) => Object.freeze({
  ...entry, foodIds: foodIds(examples), sourceIds: Object.freeze(sources),
  verification: 'kilde skal verificeres',
})))
