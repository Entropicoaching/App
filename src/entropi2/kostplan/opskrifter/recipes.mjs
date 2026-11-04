import { FOODS } from '../foedevarer/index.mjs'

export const CATEGORIES = Object.freeze([
  'morgenmad', 'frokost', 'aftensmad', 'mellemmaaltid', 'foer-traening', 'efter-traening',
])

const byName = new Map(FOODS.map(food => [food.name, food]))
function recipe(id, name, category, ingredients, steps) {
  return Object.freeze({
    id, name, category,
    ingredients: Object.freeze(ingredients.map(([name, grams]) => {
      const food = byName.get(name)
      if (!food) throw new TypeError('Fødevaren findes ikke i kataloget: ' + name)
      return Object.freeze({ foodId: food.id, grams })
    })),
    steps: Object.freeze(steps),
  })
}

// Grams refer to the named catalog food, including cooked grains/potatoes.
// No nutrient values or claims of verified food preparation are added here.
export const RECIPES = Object.freeze([
  recipe('skyr-havre-baer', 'Skyr med havre og bær', 'morgenmad', [
    ['Skyr naturel', 250], ['Havregryn', 60], ['Blåbær', 100],
  ], ['Kom skyr i en skål, og fordel havregryn og blåbær ovenpå.']),
  recipe('koeleskabshavre', 'Køleskabshavre med banan', 'morgenmad', [
    ['Havregryn', 60], ['Mælk minimælk', 150], ['Skyr naturel', 150], ['Banan', 100],
  ], ['Rør havregryn, mælk og skyr sammen, og stil det tildækket på køl natten over.',
    'Skær bananen i skiver, og fordel den ovenpå.']),
  recipe('aeg-rugbroed', 'Æg på rugbrød med tomat', 'morgenmad', [
    ['Æg helt', 120], ['Rugbrød', 100], ['Tomat', 100],
  ], ['Kog æggene, og pil dem. Æggemængden er uden skal.',
    'Servér æg og skåret tomat på rugbrød.']),
  recipe('hytteost-grovbroed', 'Grovbrød med hytteost', 'morgenmad', [
    ['Grovbrød', 100], ['Hytteost', 200], ['Agurk', 100],
  ], ['Fordel hytteost og agurkeskiver på brødet.']),

  recipe('tun-rugbroed', 'Rugbrød med tun', 'frokost', [
    ['Rugbrød', 120], ['Tun i vand', 120], ['Agurk', 100], ['Tomat', 100],
  ], ['Lad tunen dryppe af, og vej den afdryppede mængde.',
    'Fordel tun, agurk og tomat på rugbrødet.']),
  recipe('kylling-wrap', 'Wrap med kylling og grønt', 'frokost', [
    ['Tortilla wrap', 80], ['Kyllingebryst', 150], ['Salat iceberg', 50],
    ['Tomat', 100], ['Dressing let', 20],
  ], ['Tilbered kyllingen helt igennem på en slip-let-pande, og skær den i strimler.',
    'Fyld wrappen med kylling, snittet grønt og dressing.']),
  recipe('linse-quinoa', 'Quinoasalat med linser og feta', 'frokost', [
    ['Quinoa kogt', 180], ['Linser kogte', 180], ['Tomat', 100], ['Feta', 40],
  ], ['Vej quinoa og linser efter kogning, og lad dem køle af.',
    'Vend dem med tomat i tern og smuldret feta.']),
  recipe('hummus-aeg', 'Rugbrød med hummus og æg', 'frokost', [
    ['Rugbrød', 100], ['Hummus', 60], ['Æg helt', 120], ['Peberfrugt rød', 100],
  ], ['Kog æggene, og pil dem. Æggemængden er uden skal.',
    'Smør hummus på brødet, og servér med æg og peberfrugt.']),

  recipe('kylling-ris', 'Kylling med ris og broccoli', 'aftensmad', [
    ['Kyllingebryst', 180], ['Ris kogt', 250], ['Broccoli', 200], ['Olivenolie', 10],
  ], ['Vej risene efter kogning. Damp broccolien.',
    'Tilbered kyllingen helt igennem i den afmålte olie, og servér med ris og broccoli.']),
  recipe('laks-kartofler', 'Laks med kartofler og bønner', 'aftensmad', [
    ['Laks fersk', 150], ['Kartofler kogte', 300], ['Grønne bønner', 150], ['Rapsolie', 5],
  ], ['Pensl laksen med den afmålte olie, og bag den, til den er gennemtilberedt.',
    'Kog bønnerne, og servér med kartofler. Kartoffelmængden vejes efter kogning.']),
  recipe('pasta-oksekoed', 'Pasta med oksekød og tomat', 'aftensmad', [
    ['Pasta kogt', 250], ['Hakket oksekød 8%', 150], ['Tomat', 200], ['Løg', 50], ['Olivenolie', 5],
  ], ['Tilbered kødet helt igennem sammen med hakket løg i den afmålte olie.',
    'Tilsæt tomat i tern, lad det simre, og vend med pasta vejet efter kogning.']),
  recipe('tofu-ris', 'Tofu med ris og ærter', 'aftensmad', [
    ['Tofu fast', 250], ['Ris kogt', 250], ['Ærter frosne', 150], ['Soja sauce', 15], ['Rapsolie', 5],
  ], ['Steg tofu i tern i den afmålte olie, og tilbered ærterne.',
    'Vend med soja og ris vejet efter kogning.']),

  recipe('skyr-aeble', 'Skyr med æble og mandler', 'mellemmaaltid', [
    ['Skyr naturel', 200], ['Æble', 150], ['Mandler', 20],
  ], ['Skær æblet i tern, og servér med skyr og mandler.']),
  recipe('hytteost-paere', 'Hytteost med pære og valnødder', 'mellemmaaltid', [
    ['Hytteost', 200], ['Pære', 150], ['Valnødder', 15],
  ], ['Skær pæren i tern, og servér med hytteost og valnødder.']),
  recipe('yoghurt-musli', 'Yoghurt med müsli og jordbær', 'mellemmaaltid', [
    ['Græsk yoghurt 2%', 200], ['Müsli uden sukker', 40], ['Jordbær', 100],
  ], ['Fordel müsli og skårne jordbær over yoghurten.']),
  recipe('knaekbroed-ost', 'Knækbrød med ost og peberfrugt', 'mellemmaaltid', [
    ['Knækbrød', 40], ['Ost 30+', 50], ['Peberfrugt rød', 100],
  ], ['Læg ost på knækbrødet, og servér peberfrugt i stave til.']),

  recipe('broed-syltetoej', 'Brød med syltetøj og skyr', 'foer-traening', [
    ['Franskbrød', 80], ['Syltetøj', 25], ['Skyr naturel', 150],
  ], ['Smør syltetøj på brødet, og servér skyr ved siden af.']),
  recipe('banan-skyr', 'Banan med skyr', 'foer-traening', [
    ['Banan', 150], ['Skyr naturel', 200],
  ], ['Skær bananen i skiver, og servér med skyr.']),
  recipe('cornflakes-maelk', 'Cornflakes med mælk', 'foer-traening', [
    ['Cornflakes', 60], ['Mælk minimælk', 250],
  ], ['Vej mælken i gram, og hæld den over cornflakes.']),
  recipe('riskager-honning', 'Riskager med honning og yoghurt', 'foer-traening', [
    ['Riskager naturel', 40], ['Honning', 20], ['Græsk yoghurt 0%', 150],
  ], ['Fordel honningen på riskagerne, og servér yoghurt ved siden af.']),

  recipe('skyr-banan-havre', 'Skyr med banan og havre', 'efter-traening', [
    ['Skyr naturel', 300], ['Banan', 150], ['Havregryn', 50],
  ], ['Skær bananen i skiver, og vend den med skyr og havregryn.']),
  recipe('kakao-hytteost', 'Kakaomælk og rugbrød med hytteost', 'efter-traening', [
    ['Kakaomælk', 300], ['Rugbrød', 80], ['Hytteost', 150],
  ], ['Fordel hytteost på rugbrødet, og servér med kakaomælk vejet i gram.']),
  recipe('kylling-pasta', 'Pastasalat med kylling', 'efter-traening', [
    ['Kyllingebryst', 150], ['Pasta kogt', 200], ['Tomat', 150], ['Pesto', 15],
  ], ['Tilbered kyllingen helt igennem på en slip-let-pande, og skær den i strimler.',
    'Vend kyllingen med pasta vejet efter kogning, tomat i tern og pesto.']),
  recipe('aeg-broed-skyr', 'Æg og grovbrød med skyr', 'efter-traening', [
    ['Æg helt', 120], ['Grovbrød', 100], ['Skyr naturel', 150],
  ], ['Kog æggene, og pil dem. Æggemængden er uden skal.',
    'Servér æg på grovbrød med skyr ved siden af.']),
])
