import { FOODS } from '../foedevarer/index.mjs'

// Husstandsopskrifter: rigtige hverdagsretter til to styrkeløftere, der spiser
// sammen. Alle ingredienser er katalognavne fra ../foedevarer/, og gram er den
// spiselige del i katalogets tilstand (ris, pasta, bulgur, couscous og
// kartofler vejes kogte; kød og fisk vejes rå). Mængderne er én grundportion;
// planen skalerer hver portion til personens mål og runder til hele gram.
//
// flex er den kulhydratvare, der justeres op og ned mellem træningsdag og
// hviledag. fedtflex (valgfri) er olie, smør eller nødder, der kun bruges,
// når flexvaren har nået sin portionsgrænse. vare (valgfri) er indkøbsnøglen, når varen købes i en anden form
// end katalognavnet, fx hakkede tomater på dåse. Krydderier og salt indgår
// ikke i makroerne og står kun i fremgangsmåden.

const byName = new Map(FOODS.map(food => [food.name, food]))

function opskrift({ id, navn, kategori, koekken = null, minutter, holdbarDage = 0, madpakke = false,
  ingredienser, flex, fedtflex = null, krydderier = [], trin }) {
  const ingredients = ingredienser.map(([name, grams, vare]) => {
    const food = byName.get(name)
    if (!food) throw new TypeError('Fødevaren findes ikke i kataloget: ' + name)
    return Object.freeze({ foodId: food.id, grams, ...(vare ? { vare } : {}) })
  })
  const flexFood = byName.get(flex)
  if (!flexFood || !ingredients.some(item => item.foodId === flexFood.id)) {
    throw new TypeError('Flexvaren skal være en ingrediens i opskriften: ' + id)
  }
  const fedtFood = fedtflex ? byName.get(fedtflex) : null
  if (fedtflex && (!fedtFood || !ingredients.some(item => item.foodId === fedtFood.id))) {
    throw new TypeError('Fedtvaren skal være en ingrediens i opskriften: ' + id)
  }
  return Object.freeze({
    id, name: navn, category: kategori, koekken, minutter, holdbarDage, madpakke,
    ingredients: Object.freeze(ingredients), flex: flexFood.id, fedtflex: fedtFood?.id ?? null,
    krydderier: Object.freeze(krydderier), steps: Object.freeze(trin),
  })
}

export const MORGENMAD = Object.freeze([
  opskrift({ id: 'hh-havregroed-skyr', navn: 'Havregrød med skyr og blåbær', kategori: 'morgenmad', minutter: 8,
    ingredienser: [['Havregryn', 80], ['Mælk minimælk', 250], ['Skyr naturel', 200], ['Blåbær', 100, 'blåbær frost'], ['Mandler', 10]],
    flex: 'Havregryn', fedtflex: 'Mandler',
    trin: ['Kog havregryn og mælk under omrøring i 3 til 4 minutter.', 'Rør skyr i, og fordel optøede blåbær og hakkede mandler ovenpå.'] }),
  opskrift({ id: 'hh-aeg-rugbroed-skinke', navn: 'Røræg på rugbrød med skinke og tomat', kategori: 'morgenmad', minutter: 10,
    ingredienser: [['Æg helt', 150], ['Rugbrød', 120], ['Skinke mager', 50], ['Tomat', 100], ['Smør', 5]],
    flex: 'Rugbrød', fedtflex: 'Smør', krydderier: ['salt', 'peber', 'purløg (valgfrit)'],
    trin: ['Pisk æggene, og rør dem langsomt i smørret på panden.', 'Læg skinke og røræg på rugbrødet, og servér tomat i skiver til.'] }),
  opskrift({ id: 'hh-skyr-muesli-banan', navn: 'Skyrskål med müsli og banan', kategori: 'morgenmad', minutter: 3,
    ingredienser: [['Skyr naturel', 300], ['Müsli uden sukker', 60], ['Banan', 120], ['Mandler', 15]],
    flex: 'Müsli uden sukker', fedtflex: 'Mandler',
    trin: ['Kom skyr i en skål.', 'Top med müsli, banan i skiver og hakkede mandler.'] }),
  opskrift({ id: 'hh-proteinpandekager', navn: 'Havrepandekager med skyr og bær', kategori: 'morgenmad', minutter: 15,
    ingredienser: [['Havregryn', 70], ['Æg helt', 100], ['Skyr naturel', 200], ['Banan', 100], ['Hindbær', 80, 'hindbær frost'], ['Rapsolie', 5]],
    flex: 'Havregryn', fedtflex: 'Rapsolie',
    trin: ['Blend havregryn, æg, banan og halvdelen af skyren til en tyk dej.', 'Steg små pandekager i olien, 2 minutter på hver side.',
      'Servér med resten af skyren og optøede hindbær. Dejen kan laves aftenen før.'] }),
])

export const FROKOST = Object.freeze([
  opskrift({ id: 'hh-rugbroed-tun-aeg', navn: 'Rugbrød med tun, æg og peberfrugt', kategori: 'frokost', minutter: 10, madpakke: true, holdbarDage: 1,
    ingredienser: [['Rugbrød', 150], ['Tun i vand', 100], ['Æg helt', 60], ['Hytteost', 60], ['Peberfrugt rød', 100], ['Smør', 5]],
    flex: 'Rugbrød', fedtflex: 'Smør', krydderier: ['peber', 'citronsaft (valgfrit)'],
    trin: ['Kog æggene i 8 minutter, køl dem, og skær dem i skiver.', 'Rør afdryppet tun med hytteost og peber.',
      'Smør rugbrødet tyndt, fordel tunrøre, læg æg ovenpå, og pak peberfrugt i stave ved siden af.'] }),
  opskrift({ id: 'hh-wrap-kylling-hummus', navn: 'Wraps med kylling, hummus og grønt', kategori: 'frokost', minutter: 15, madpakke: true, holdbarDage: 2,
    ingredienser: [['Tortilla wrap', 120], ['Kyllingebryst', 130], ['Hummus', 50], ['Salat iceberg', 40], ['Agurk', 80]],
    flex: 'Tortilla wrap', fedtflex: 'Hummus', krydderier: ['paprika', 'salt'],
    trin: ['Steg kyllingen gennem på en slip-let-pande med paprika og salt, og skær den i strimler. Steg gerne til to dage.',
      'Smør hummus på wraps, fyld kylling, salat og agurk i, og rul dem stramt. Pak dem i folie.'] }),
  opskrift({ id: 'hh-rugbroed-makrel-aeg', navn: 'Rugbrød med makrel i tomat, æg og agurk', kategori: 'frokost', minutter: 10, madpakke: true, holdbarDage: 1,
    ingredienser: [['Rugbrød', 150], ['Makrel i tomat', 90], ['Æg helt', 60], ['Skyr naturel', 150], ['Agurk', 80], ['Smør', 5]],
    flex: 'Rugbrød', fedtflex: 'Smør',
    trin: ['Kog æggene i 8 minutter, og skær dem i både.', 'Smør rugbrødet tyndt, læg makrel og æg på, og pak agurk ved siden af.',
      'Skyr pakkes i en lille boks som en del af frokosten.'] }),
  opskrift({ id: 'hh-pastasalat-kylling', navn: 'Pastasalat med kylling, pesto og tomat', kategori: 'frokost', minutter: 20, madpakke: true, holdbarDage: 2,
    ingredienser: [['Pasta kogt', 200], ['Kyllingebryst', 140], ['Tomat', 100], ['Pesto', 15], ['Spinat', 30, 'spinat frisk']],
    flex: 'Pasta kogt', fedtflex: 'Pesto', krydderier: ['salt', 'peber'],
    trin: ['Kog pastaen, og skyl den kold. Vej den efter kogning.', 'Steg kyllingen gennem, og skær den i tern.',
      'Vend pasta, kylling, tomat, spinat og pesto sammen. Holder 2 dage i køleskab.'] }),
])

export const FOER_TRAENING = Object.freeze([
  opskrift({ id: 'hh-proteinmaelk-banan', navn: 'Proteinmælk, banan og riskager (på farten)', kategori: 'foer-traening', minutter: 1,
    ingredienser: [['Proteinmælk', 500], ['Banan', 120], ['Riskager naturel', 25]],
    flex: 'Banan',
    trin: ['Tag en flaske proteinmælk, en banan og et par riskager med. Spis 1 til 2 timer før træning.'] }),
  opskrift({ id: 'hh-skyr-honning-havre', navn: 'Skyr med honning og havregryn', kategori: 'foer-traening', minutter: 2,
    ingredienser: [['Skyr naturel', 250], ['Havregryn', 40], ['Honning', 15]],
    flex: 'Havregryn',
    trin: ['Rør honning i skyren, og drys havregryn over. Kan pakkes i en boks.'] }),
  opskrift({ id: 'hh-kakaomaelk-rugbroed', navn: 'Kakaomælk og rugbrødsmad med skinke og æg', kategori: 'foer-traening', minutter: 5,
    ingredienser: [['Kakaomælk', 250], ['Rugbrød', 60], ['Æg helt', 60], ['Skinke mager', 40]],
    flex: 'Rugbrød',
    trin: ['Kog æggene på forhånd (holder 4 dage i køleskab).', 'Tag kakaomælk og en rugbrødsmad med skinke og æg med.'] }),
  opskrift({ id: 'hh-franskbroed-syltetoej-kvark', navn: 'Franskbrød med syltetøj og kvark', kategori: 'foer-traening', minutter: 3,
    ingredienser: [['Franskbrød', 70], ['Syltetøj', 20], ['Kvark naturel', 200]],
    flex: 'Franskbrød',
    trin: ['Smør syltetøj på brødet, og spis kvarken ved siden af.'] }),
])

export const AFTENSNACK = Object.freeze([
  opskrift({ id: 'hh-kvark-blaabaer-mandler', navn: 'Kvark med blåbær og mandler', kategori: 'mellemmaaltid', minutter: 2,
    ingredienser: [['Kvark naturel', 250], ['Blåbær', 80, 'blåbær frost'], ['Mandler', 15]],
    flex: 'Blåbær', fedtflex: 'Mandler',
    trin: ['Rør kvarken let, og top med optøede blåbær og hakkede mandler.'] }),
  opskrift({ id: 'hh-skyr-muesli-hindbaer', navn: 'Skyr med müsli og hindbær', kategori: 'mellemmaaltid', minutter: 2,
    ingredienser: [['Skyr naturel', 300], ['Müsli uden sukker', 30], ['Hindbær', 80, 'hindbær frost']],
    flex: 'Müsli uden sukker',
    trin: ['Kom skyr i en skål, og top med müsli og optøede hindbær.'] }),
  opskrift({ id: 'hh-hytteost-knaekbroed', navn: 'Hytteost på knækbrød med tomat', kategori: 'mellemmaaltid', minutter: 3,
    ingredienser: [['Hytteost', 250], ['Knækbrød', 30], ['Tomat', 100]],
    flex: 'Knækbrød', krydderier: ['peber'],
    trin: ['Fordel hytteost på knækbrødet, og læg tomat i skiver ovenpå.'] }),
  opskrift({ id: 'hh-graesk-yoghurt-valnoed', navn: 'Græsk yoghurt med valnødder og honning', kategori: 'mellemmaaltid', minutter: 2,
    ingredienser: [['Græsk yoghurt 2%', 300], ['Valnødder', 15], ['Honning', 10], ['Æble', 100]],
    flex: 'Æble', fedtflex: 'Valnødder',
    trin: ['Kom yoghurt i en skål, og top med æble i tern, valnødder og honning.'] }),
])

// Aftensmad: 14 forskellige retter. Hverdagsretter tager højst 30 minutter;
// weekendretter må tage længere. Alle kan gemmes i køleskab og varmes eller
// tages med dagen efter (holdbarDage), og alle laves gerne dobbelt.
export const AFTENSMAD = Object.freeze([
  opskrift({ id: 'hh-bolognese', navn: 'Pasta bolognese med gulerod', kategori: 'aftensmad', koekken: 'Italiensk', minutter: 30, holdbarDage: 3,
    ingredienser: [['Hakket oksekød 8%', 170], ['Pasta kogt', 280], ['Tomat', 200, 'hakkede tomater dåse'], ['Løg', 50], ['Gulerod', 60], ['Tomatpuré', 15], ['Parmesan', 10], ['Olivenolie', 5]],
    fedtflex: 'Olivenolie', flex: 'Pasta kogt', krydderier: ['hvidløg', 'oregano', 'salt', 'peber'],
    trin: ['Svits hakket løg og revet gulerod i olien. Brun kødet, til det er gennemstegt.',
      'Tilsæt tomatpuré, hakkede tomater og krydderier, og lad det simre 15 minutter.',
      'Kog pastaen imens, og vej den efter kogning. Servér med revet parmesan.'] }),
  opskrift({ id: 'hh-thai-karry-kylling', navn: 'Rød karry med kylling, kokosmælk og ris', kategori: 'aftensmad', koekken: 'Thailandsk', minutter: 25, holdbarDage: 3,
    ingredienser: [['Kyllingebryst', 190], ['Ris kogt', 260], ['Kokosmælk', 60], ['Peberfrugt rød', 100], ['Broccoli', 100], ['Løg', 40], ['Soja sauce', 10]],
    flex: 'Ris kogt', fedtflex: 'Kokosmælk', krydderier: ['rød karrypasta 1 spsk', 'hvidløg', 'lime (valgfrit)'],
    trin: ['Sæt risene over. Steg kylling i strimler på en varm pande med karrypasten, til den er gennemstegt.',
      'Tilsæt løg, peberfrugt og broccoli, og steg 3 minutter.', 'Hæld kokosmælk og soja ved, og lad det simre 5 minutter. Servér med ris vejet efter kogning.'] }),
  opskrift({ id: 'hh-hakkeboef', navn: 'Hakkebøf med kartofler, bløde løg og ærter', kategori: 'aftensmad', koekken: 'Dansk', minutter: 30, holdbarDage: 3,
    ingredienser: [['Hakket oksekød 8%', 180], ['Kartofler kogte', 330], ['Løg', 80], ['Ærter frosne', 100], ['Rapsolie', 6], ['Cremefraiche 9%', 30]],
    fedtflex: 'Rapsolie', flex: 'Kartofler kogte', krydderier: ['salt', 'peber', 'timian'],
    trin: ['Kog kartoflerne (cirka 20 minutter). Form kødet til bøffer, og krydr dem.',
      'Steg bøfferne gennem i olien, og tag dem af panden. Svits løgene bløde i fedtstoffet.',
      'Rør cremefraiche i løgene til en let sovs. Kog ærterne 2 minutter, og servér det hele sammen.'] }),
  opskrift({ id: 'hh-shawarma-bowl', navn: 'Shawarmakylling med bulgur, hummus og salat', kategori: 'aftensmad', koekken: 'Mellemøstlig', minutter: 25, holdbarDage: 3,
    ingredienser: [['Kyllingelår u/skind', 190], ['Bulgur kogt', 280], ['Hummus', 40], ['Agurk', 100], ['Tomat', 100], ['Græsk yoghurt 2%', 60], ['Rapsolie', 5]],
    fedtflex: 'Rapsolie', flex: 'Bulgur kogt', krydderier: ['spidskommen', 'paprika', 'kanel en knivspids', 'hvidløg', 'citron'],
    trin: ['Vend kyllingelårene i olie og krydderier, og steg dem gennem på panden i 12 til 15 minutter.',
      'Kog bulguren imens, og vej den efter kogning. Skær agurk og tomat i tern.',
      'Saml i skåle med hummus og yoghurt med hvidløg og citron.'] }),
  opskrift({ id: 'hh-fajitas-okse', navn: 'Fajitas med oksestrimler, peberfrugt og salsa', kategori: 'aftensmad', koekken: 'Mexicansk', minutter: 25, holdbarDage: 2,
    ingredienser: [['Bøf/oksefilet', 170], ['Tortilla wrap', 130], ['Peberfrugt rød', 120], ['Løg', 60], ['Salsa', 50], ['Cremefraiche 9%', 30], ['Ost 30+', 25], ['Rapsolie', 5]],
    fedtflex: 'Rapsolie', flex: 'Tortilla wrap', krydderier: ['spidskommen', 'røget paprika', 'chili', 'salt'],
    trin: ['Steg oksestrimlerne hurtigt ved høj varme i olien med krydderierne, og tag dem af panden.',
      'Steg peberfrugt og løg i strimler møre, og vend kødet tilbage.',
      'Varm tortillas, og fyld med kød, grønt, salsa, cremefraiche og revet ost. Rester kan rulles og spises kolde.'] }),
  opskrift({ id: 'hh-ovnlaks', navn: 'Ovnbagt laks med kartofler, gulerødder og skyrdressing', kategori: 'aftensmad', koekken: 'Dansk', minutter: 35, holdbarDage: 2,
    ingredienser: [['Laks fersk', 160], ['Kartofler kogte', 300], ['Gulerod', 120], ['Grønne bønner', 100, 'grønne bønner frost'], ['Skyr naturel', 100], ['Rapsolie', 5]],
    fedtflex: 'Rapsolie', flex: 'Kartofler kogte', krydderier: ['dild', 'citron', 'salt', 'peber'],
    trin: ['Skær kartofler og gulerødder i både, vend dem i olie og salt, og bag dem 20 minutter ved 200 grader.',
      'Læg laksen på bagepladen, og bag 12 minutter mere, til den er gennembagt. Kog bønnerne 3 minutter.',
      'Rør skyr med dild, citron og salt til dressing. Kartoffelmængden er vejet efter tilberedning.'] }),
  opskrift({ id: 'hh-chili-con-carne', navn: 'Chili con carne med ris', kategori: 'aftensmad', koekken: 'Mexicansk', minutter: 45, holdbarDage: 4,
    ingredienser: [['Hakket oksekød 8%', 150], ['Bønner kidney', 100, 'kidneybønner dåse'], ['Ris kogt', 250], ['Tomat', 200, 'hakkede tomater dåse'], ['Løg', 50], ['Peberfrugt rød', 80], ['Cremefraiche 9%', 30], ['Ost 30+', 20]],
    flex: 'Ris kogt', fedtflex: 'Ost 30+', krydderier: ['chili', 'spidskommen', 'paprika', 'hvidløg', 'salt'],
    trin: ['Brun kødet gennem med hakket løg. Tilsæt peberfrugt og krydderier.',
      'Tilsæt tomater og skyllede bønner, og lad det simre 25 minutter (weekendret, smager bedre dagen efter).',
      'Servér med ris vejet efter kogning, en klat cremefraiche og revet ost. Fryses fint i portioner.'] }),

  opskrift({ id: 'hh-moerbrad', navn: 'Mørbradbøffer med champignonsovs, kartofler og ærter', kategori: 'aftensmad', koekken: 'Dansk', minutter: 30, holdbarDage: 3,
    ingredienser: [['Svinekød mørbrad', 190], ['Kartofler kogte', 320], ['Champignon', 100], ['Ærter frosne', 100], ['Cremefraiche 9%', 40], ['Rapsolie', 5]],
    fedtflex: 'Rapsolie', flex: 'Kartofler kogte', krydderier: ['salt', 'peber', 'timian'],
    trin: ['Kog kartoflerne. Skær mørbraden i 2 cm skiver, bank dem let flade, og steg dem gennem i olien.',
      'Steg champignon i samme pande, rør cremefraiche og lidt vand i til en sovs.', 'Kog ærterne 2 minutter, og servér.'] }),
  opskrift({ id: 'hh-kylling-tikka', navn: 'Kylling tikka i tomat og yoghurt med ris og spinat', kategori: 'aftensmad', koekken: 'Indisk', minutter: 30, holdbarDage: 3,
    ingredienser: [['Kyllingebryst', 190], ['Ris kogt', 260], ['Tomat', 150, 'hakkede tomater dåse'], ['Græsk yoghurt 2%', 80], ['Spinat', 80, 'spinat frost'], ['Løg', 50], ['Rapsolie', 5]],
    fedtflex: 'Rapsolie', flex: 'Ris kogt', krydderier: ['garam masala eller tikka masala krydderi', 'ingefær', 'hvidløg', 'salt'],
    trin: ['Sæt risene over. Steg løg og kylling i tern med krydderierne i olien, til kyllingen er gennemstegt.',
      'Tilsæt tomater og spinat, og lad det simre 10 minutter.', 'Tag panden af varmen, og rør yoghurten i. Servér med ris.'] }),
  opskrift({ id: 'hh-pasta-kylling-champignon', navn: 'Pasta med kylling, champignon og spinat i let flødesovs', kategori: 'aftensmad', koekken: 'Italiensk', minutter: 25, holdbarDage: 3,
    ingredienser: [['Kyllingebryst', 180], ['Pasta kogt', 280], ['Champignon', 100], ['Spinat', 60, 'spinat frisk'], ['Cremefraiche 9%', 50], ['Parmesan', 10], ['Olivenolie', 5]],
    fedtflex: 'Olivenolie', flex: 'Pasta kogt', krydderier: ['hvidløg', 'salt', 'peber'],
    trin: ['Kog pastaen. Steg kylling i strimler gennem i olien, og tilsæt champignon og hvidløg.',
      'Rør cremefraiche og lidt pastavand i, og vend spinaten med, til den falder sammen.', 'Vend pastaen i, og servér med parmesan.'] }),
  opskrift({ id: 'hh-svinewok', navn: 'Wok med svinekød, grøntsager og ris', kategori: 'aftensmad', koekken: 'Kinesisk', minutter: 20, holdbarDage: 3,
    ingredienser: [['Svinekam', 180], ['Ris kogt', 260], ['Broccoli', 100], ['Gulerod', 80], ['Peberfrugt rød', 80], ['Soja sauce', 20], ['Rapsolie', 6], ['Sesamfrø', 5]],
    fedtflex: 'Rapsolie', flex: 'Ris kogt', krydderier: ['ingefær', 'hvidløg', 'chili (valgfrit)'],
    trin: ['Sæt risene over. Skær kødet i tynde strimler, og steg det gennem ved høj varme i olien.',
      'Tilsæt grøntsager i strimler, og steg 3 til 4 minutter, så de stadig er sprøde.', 'Vend soja, ingefær og hvidløg i, drys sesam over, og servér med ris.'] }),
  opskrift({ id: 'hh-koefte-couscous', navn: 'Kalkunkøfte med couscous og tzatziki', kategori: 'aftensmad', koekken: 'Tyrkisk', minutter: 25, holdbarDage: 3,
    ingredienser: [['Kalkun', 190, 'hakket kalkun'], ['Couscous kogt', 260], ['Græsk yoghurt 2%', 80], ['Agurk', 100], ['Tomat', 100], ['Løg', 40], ['Rapsolie', 5]],
    fedtflex: 'Rapsolie', flex: 'Couscous kogt', krydderier: ['spidskommen', 'paprika', 'hvidløg', 'mynte eller persille', 'salt'],
    trin: ['Rør hakket kalkun med revet løg og krydderier, form aflange køfte, og steg dem gennem i olien.',
      'Hæld kogende vand over couscousen, og lad den trække 5 minutter. Vej den efter tilberedning.',
      'Riv agurk til yoghurten med hvidløg og salt. Servér med tomat.'] }),
  opskrift({ id: 'hh-teriyaki-laks', navn: 'Teriyakilaks med ris, edamame og agurk', kategori: 'aftensmad', koekken: 'Japansk', minutter: 20, holdbarDage: 2,
    ingredienser: [['Laks fersk', 150], ['Ris kogt', 260], ['Edamame bønner', 70, 'edamame frost'], ['Agurk', 100], ['Gulerod', 60], ['Soja sauce', 15], ['Honning', 8], ['Sesamfrø', 5]],
    flex: 'Ris kogt', fedtflex: 'Sesamfrø', krydderier: ['ingefær'],
    trin: ['Sæt risene over. Rør soja, honning og revet ingefær sammen.',
      'Steg laksen 3 til 4 minutter på hver side, og pensl med saucen de sidste minutter, til den er gennemstegt.',
      'Kog edamame 3 minutter. Saml i skåle med ris, agurk og revet gulerod, og drys sesam over.'] }),
  opskrift({ id: 'hh-torsk-rodfrugter', navn: 'Stegt torsk med kartofler, rødbeder og persillesovs', kategori: 'aftensmad', koekken: 'Dansk', minutter: 30, holdbarDage: 2,
    ingredienser: [['Torsk', 220, 'torsk frost'], ['Kartofler kogte', 320], ['Rødbede kogte', 100], ['Ærter frosne', 80], ['Mælk minimælk', 100], ['Hvedemel', 8], ['Smør', 8]],
    fedtflex: 'Smør', flex: 'Kartofler kogte', krydderier: ['persille', 'salt', 'peber'],
    trin: ['Kog kartoflerne. Steg torsken gennem på panden i halvdelen af smørret, 3 til 4 minutter på hver side.',
      'Smelt resten af smørret, pisk mel og mælk i, og kog sovsen jævn i 2 minutter. Tilsæt persille.',
      'Kog ærterne, og servér med kogte rødbeder i skiver.'] }),
])

export const HUSSTAND_OPSKRIFTER = Object.freeze([...MORGENMAD, ...FROKOST, ...FOER_TRAENING, ...AFTENSNACK, ...AFTENSMAD])
