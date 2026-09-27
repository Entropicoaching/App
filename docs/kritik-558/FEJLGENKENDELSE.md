fejlgenkendelsen klar til sitet: ja

Yantras 549 har lukket det, jeg sagde nej til i 548:
- **L6 er lukket.** Linjen "Ligner ikke ..." læses ikke længere som "uden fejl". Den navngiver det tjekkede, siger "Det udelukker ikke fejlen" og "Andre fejl tjekker siden ikke".
- **L9 er lukket.** En rigtig bund i sko, hvor løfteren holder torsoen, får ikke længere dommen "hoften skudt for langt tilbage": 0 % dom ved 1,5-3 cm (før 53 % ved 2 cm). Siden viser i stedet et hint med grunden.
- **Sumo:** falsk alarm er lav, også med mine dybder og kameraer.
- **Bænkens vip** fejler til den sikre side: det giver flere "ikke tjekket", ikke flere falske fund.

Der er ét nyt middel-fund (L10), og det er kun tekst. Linjens tal ("overses i ca. 2 af 100") holder kun med omhyggelige klik lige fra siden. Med typiske klik er det op til 10 gange flere. Det bør rettes i samme runde, som Setu kopierer siden i. Det stopper ikke dommen, fordi linjen selv siger, at den ikke udelukker fejlen, og fordi ingen af de fem nye fund giver en falsk anklage over 5 % fra vejledningens plads.

# Kritik 558, blok 1: fejlgenkendelsen efter Yantras 545, 549 og 554

Bhishak, 28. sep 2026. Ordre 558 fra Dhruva via Marc. Planet coaching, spor kropsmodel-til-teknikfeedback.

**Grundlag:** `entropi-loeftmodel-dhruva` main @ `346f791` (545, 549 og 554 er merget), hentet med `git archive`. Jeg har læst:
- `docs/RAPPORT-dag-78.md`, `-79.md` og `-80.md`,
- `src/maalBilledeFejl.js`, `src/sumoModel.js`, `src/pinhole.js` og `src/loeftVirkelighed.js`,
- Yantras forslag `outputs/549/bhishak/fejl-549.mjs`.

Intet træ er rørt.

**Målingerne:**
- `outputs/kritik-558/fejl-558.mjs` → `fejl-558.json` (`fejl-558.log`, 70 s). Det er mit 548-script med Yantras to rettelser fra 549: feltets hæl sendes til `genkendFejl`, og "hint" tælles for sig. Diffen er ti linjer, og jeg har læst den. Nyt:
  - **L:** linjens egne tal mod mine.
  - **H:** sko halvvejs og ved 1,5 og 2,5 cm.
  - **S:** sumo med mine dybder og kameraer, og en træner, der filmer i hånden.
  - **B:** fire slags større bue.

  60 billeder pr. stilling i A og H, 40 i S og B, fem kroppe, omhyggelige og typiske klik.
- `outputs/kritik-558/side-558.mjs` → `side-558.json` og `S-*.png`: siden headless uden net på 360 og 390 med touch og 1280 med mus. **18/18** tjek er grønne. Mine fem 548-tjek, som Yantra fandt røde efter 549, er skrevet om til den nye tekst.
- **Data:** kun syntetiske, tegnede figurer (mærket SYNTETISK) og Marcs eget gulv- og knæbillede.

## L6-L9 fra 548

| Fund | Nu | Målt |
|---|---|---|
| L6 | **lukket** | Linjen navngiver reglerne og siger "Det udelukker ikke fejlen: ... Andre fejl tjekker siden ikke." (`S-360-l6-sticking.png`). I sko står "kun knæene kan næsten ikke ses i sko med hæl" (`S-360-l6-sko.png`); fejlfiguren får netop den linje i 94-100 %. Men se L10 |
| L7 | **lukket** | Forskudt 50 cm: "Kameraet står skråt eller ikke ud for stangen: de to nav står 23 cm fra hinanden ... Står kameraet kun ved siden af stangen, flytter vinklerne sig mindre." (`S-360-l7-hint.png`) |
| L8 | **delvis** | "Hvert tredje til femte" passer ved 2 cm (25 / 30 %). Ved 2,5 cm, som vejledningen kalder typisk for vægtløftersko, er det 54 / 48 %, og med telefonen i hånden 75 % ved 2 cm (lav) |
| L9 | **lukket** | Torsoen holdt i sko og feltet udfyldt: dom 0 % ved 1,5-3 cm, hint 23 / 56 / 82 / 95 % ved 1,5 / 2 / 2,5 / 3 cm. Halvvejs mellem de to valg: hint 3 % ved 2 cm, 20 % ved 3 cm, dom 0 % (`S-360-l9-hint.png`) |
| L3 | **lukket** | Sætningen nævner ikke hælen; 0 af 76 sætninger |

Falsk alarm er fra alle ti pladser højst 4 % for alle syv regler (telefonen i hånden, "kun knæene": 4 / 3,2 %), ellers højst 1,7 %. Højst 39 ord i sætningerne, ingen forbudte ord.

## Læses linjen som "uden fejl"?

Nej. Før stod der "Ligner ingen af modellens fejlfigurer over målefejlen." Nu står der fx ved sticking point:

> Ligner ikke "kun knæene" eller "hoften skudt for langt tilbage" over målefejlen. Det udelukker ikke fejlen: "kun knæene" ved sticking point overses i ca. hvert tredje billede filmet lige fra siden, med tæerne 30° ud i ca. 9 af 10. Andre fejl tjekker siden ikke.

Den siger tre ting, som "uden fejl" ikke siger: hvad der er tjekket, at det tjekkede kan være overset, og at resten ikke er tjekket. Det holder.

**L10 (middel): tallet holder kun med omhyggelige klik.** Linjen siger "filmet lige fra siden", men ikke "klikket omhyggeligt", og det er klikkene, der flytter tallet mest. Her er, hvad linjen lover, mod hvad mit kamera måler for modellens egen fejlfigur:

| Fase, fejlen | Linjen siger | Vinkelret, omhyggelig / typisk | Telefonen i hånden | 5° skråt | 10° skråt |
|---|---|---|---|---|---|
| Dødløft, knæhøjde, stangen glider frem | ca. 2 af 100 | 3,7 / **18,7 %** | 3 / 18 % | 13 / 29 % | 29 / 47 % |
| Squat, bunden, hoften tilbage | ca. 3 af 100 | 3,3 / **13,7 %** | **18,7 / 23 %** | 4 / 12 % | 2 / 10 % |
| Squat, sticking point, kun knæene | ca. hvert tredje | 30 / **58 %** | 59 / 64 % | 31 / 45 % | 35 / 38 % |
| Dødløft, gulvet, hoften stiger først | ca. 1 af 100 | 2,7 / 4,7 % | 3,7 / 6 % | 2 / 6 % | 2 / 7 % |
| Sumo, knæhøjde, stangen glider frem | ca. 1 af 100 | 0,5 / **10,5 %** | 61 % (overset) | 3° til den anden side: 16 / 36 % | ikke tjekket |
| Bænk, albuen helt ude | ca. hvert tredje | 37-42 % (vippet, 554) | 42 % | | 24 % |

Med "ca. 2 af 100" tror træneren, at siden næsten aldrig overser stangen, der glider frem. Med typiske klik overser den hvert femte. Det er ikke en falsk anklage, men en for stor tryghed ved et "nej".

**Ret (tekst):** sig klikkene, fx *"overses i ca. 2 af 100 billeder med omhyggelige klik lige fra siden (med hurtige klik ca. hvert femte)"*. Eller vis det største af de to tal. `OVERSET` kan få en `typisk` ved siden af `pct`; tallene står i Yantras egne tabeller.

## Er 30-45 ord for mange på en telefon?

Nej, ikke i sig selv. Målt på siden (skrift 14,7 px):

| Linjen | Ord | Linjer 360 / 390 / 1280 | Højde på 360 |
|---|---|---|---|
| Dødløft, gulv og knæ | 30 | 4 / 4 / 2 | 88 px |
| Sumo | 33 | 4 / 4 / 2 | 88 px |
| Bænk | 37 | 5 / 5 / 2 | 110 px |
| Sticking point | 45 | 6 / 5 / 2 | 132 px |
| Squat i sko | 50 | 6 / 6 / 2 | 132 px |
| Hintet i sko | 62 inkl. linket | 7 / 7 / 3 | 155 px |

- **Højden:** 88-155 px er en sjettedel af en telefonskærm, og ingen linje rækker ud over skærmen.
- **Det egentlige problem er, hvor linjen står.** Den er tredje grå afsnit under tabellen efter to faste noter, med samme skrift. På 360 står den ca. 1.600 px (1,9 skærme) under tabellens top, så den kan forveksles med de faste noter (lav, `S-360-l6-sticking.png`).
- **Forslag:** en fed første sætning ("Ligner ikke ...") og resten under den.
- **Linket i hintet** "Se fejlfiguren i hele opturen" står i browserens standardblå på den mørke baggrund og er svært at læse (`S-360-l9-hint.png`, lav).

## Hintet i sko: det rigtige snit?

Ja, i bunden. Med samme hæl i billedet og feltet (modellens eget valg):
- modellens egen bund får aldrig hintet (0 %),
- fejlfiguren "hoften tilbage" får hintet i 97-98 % (telefonen i hånden 93-94 %).

Hintet siger altså kun noget, når billedet ligner fejlfiguren, og det siger ærligt, at det kan være løfterens valg. Prisen er, at en rigtig "hoften tilbage" i sko aldrig får en dom i bunden, men "Sammenlign selv med fejlfiguren" giver træneren vejen.

**L11 (lav): sticking point i sko.** Holder løfteren torsoen, giver dommen ved sticking point falsk "hoften skudt for langt tilbage" i 12,8 / 16,1 % ved 3 cm og 5,1 / 7,2 % ved 2,5 cm (omhyggelig / typisk). Grænsen siger "læs med forsigtighed". **Ret:** hint også ved sticking point fra 2,5 cm.

Ved 1 cm (under hintets grænse) giver det omvendte valg falsk dom i bunden i 4,3 / 5,3 %. Det er lige på grænsen og i orden.

## Sumo med mine dybder og klik

Sidens sumomodel er modellens sumo fotograferet med Yantras dybder. Jeg har flyttet billedets knæ og fod i stedet for modellens:
- knæet 10 cm længere ud og 10 cm længere ind,
- hele benet 10 cm smallere og bredere,
- mine ti kamerapladser plus 2-5° til begge sider og 25 cm forskudt.

**Falsk alarm holder:** i snit højst 2,8 % for alle fem dybder og alle pladser, der tjekkes. Det højeste ved én stilling er 8 % (smal fod, kameraet i 45 cm, 5 cm over gulvet, typiske klik); vinkelret højst 2,5 %.

**Overset** (vinkelret 3 m, omhyggelig / typisk):

| Dybder | Gulvet, hoften stiger først | Knæhøjde, stangen glider frem | "Ikke tjekket" ved gulvet / knæet |
|---|---|---|---|
| Yantras | 2 / 5,5 % | 0,5 / 10,5 % | 80 / 13 % |
| Knæet 10 cm ud | 2,5 / 6,5 % | 0,5 / 10,5 % | 86 / 24 % |
| Knæet 10 cm ind | 6,5 / 8 % | 2 / 16 % | 75 / 7 % |
| Smal | 5 / 6 % | 2 / 11 % | 70 / 10 % |
| Bred | **13,5 / 30,5 %** | 1,5 / 9 % | 97 / 22 % |

Ved gulvet er ca. 71 % af modellens egen bane over vagten, så "ikke tjekket" ved gulvet er ventet. En bred sumo stoppes næsten altid ved gulvet (97 %), og kun få billeder tjekkes. Det er ærligt, men "hoften stiger først" i bred sumo tjekkes sjældent.

**4° skråt som grænse, man kan filme efter:** kun med stativ.
- Navene står 2,6 cm fra hinanden pr. grad og 0,5 cm pr. cm, kameraet står ved siden af stangen. Grænsen på 10 cm er altså **3,8° eller 20 cm til siden**. 3° tjekkes (7-10 % stoppes med typiske klik), 4° stoppes i 63-89 %, og 5° og 25 cm forskudt stoppes i 96-100 %.
- En træner, der filmer i hånden, er simuleret med vinklen og pladsen spredt:

| Filmet | Sumo tjekket | Sumoens fejl fundet | Konventionel tjekket |
|---|---|---|---|
| Stativ (±1°, ±5 cm) | 99 % | 90 % | 100 % |
| Roligt i hånden (±2°, ±10 cm) | 82 % | 71 % | 100 % |
| Almindeligt (±4°, ±20 cm) | **52 %** | 44 % | 95 % |
| Hurtigt (±6°, ±30 cm) | 36 % | 30 % | 82 % |

- **Til den ene side overses fejlen:** 3° til den anden side overses "stangen glider frem" i 16 / 36 %, og 14-28 % af fejlfigurerne får "Ligner ikke ... ca. 1 af 100" (L10).
- **L12 (lav): siden siger "ud for stangen", men ikke hvor præcist.** Skriv: *"Sumo: stativ ud for stangen (højst ca. 20 cm til siden)."* Stoppet er ærligt ("de to nav står N cm fra hinanden ... højst ca. 4° skråt"). Men i hånden er halvdelen af sumoklippene "ikke tjekket", og det bør træneren vide før optagelsen.
- **Telefonen i hånden i 140 cm:** sumo ved gulvet er ikke tjekket i 100 %. Ved knæhøjde overses fejlen i 61 %, med den stille linje i kun 1-7 %; resten er "ikke tjekket". Det er ærligt.

## Bænkens vip (Yantras dag 80, punkt 1)

Spørgsmålet: flytter en rigtig større bue stangen mod halsen set fra siden, eller holder løfteren stangen samme sted over skulderen? Jeg har målt fire måder at lave buen på:

| Buen | Stangen mod halsen / højere over skulderen ved 5 cm | Falsk "stangen for højt" 0 / 5 cm, vinkelret | "Ikke tjekket" 0 / 2,5 / 5 cm |
|---|---|---|---|
| Vip (554) | 1,2 cm (op til 8,5) / 4,8 cm | 0,1 / 0 % | 31 / 39 / 49 % |
| Lodret, lænden (545) | 0 / 5,5 cm | 0,1 / 0 % | 32 / 37 / 56 % |
| Halvt af hver | 0 / 6,3 cm | 0,1 / 0 % | 32 / 38 / 60 % |
| Vip med skuldrene 3 cm ned mod hofterne | 4,2 cm / 4,8 cm | **3,1 / 0,1 %** | 33 / 43 / 52 % |

**Svar:**
- **Retningen er rimelig.** En stor bue bruges til at få stangen over skulderen (en kortere vandret afstand). Skuldrene trukket ned og tilbage flytter skulderleddet samme vej. Vippets retning passer altså med, hvordan løftere buer.
- **Vagten på 5 cm fejler til den sikre side.** Bøjer en rigtig bue mest i lænden (lodret), ville reglen ikke give falske fund. Så er vagten for stram, men prisen er "ikke tjekket", ikke forkerte svar.
- **Prisen er stor:** en tredjedel af modellens egne bryststillinger (dem med "stor bue") er "ikke tjekket" allerede uden ekstra bue, og halvdelen ved 5 cm.
- **L13 (lav): skuldrene ned.** Står skulderpunktet 3 cm nærmere hofterne end i modellen, giver modellens egen bue falsk "stangen for højt" i 3,1 / 5,7 % vinkelret og 8,6 / 11,2 % 10° skråt. Grunden er, at reglens margen er 7 cm og modellens egne stillinger står ca. 3-4 cm fra den. Et skulderled, der ligger 3 cm anderledes, eller et klik 2-3 cm ved siden af (armen dækker leddet på bænken), bruger halvdelen af margenen.
  - **Ret:** grænsen under bænken kan nævne, at skuldrene trukket ned og et usikkert skulderklik trækker samme vej som "stangen for højt".
  - Linjens "albuen helt ude ... hvert tredje" er med vippet 37-42 % (hvert andet til tredje).

## Marcs klip

- Gulvbilledet (Yantras og mine klik): "Billedet kan ikke tjekkes for fejl: stangens højde ved gulvet kræver det fjerne nav."
- Knæbilledet: "... stangens plads kræver det fjerne nav."

Uændret og ærligt.

## Småting i teksten

- Sumo uden det fjerne nav: "Billedet kan ikke tjekkes for fejl: sumo kræver det fjerne nav: uden det kan siden ikke se ..." har to koloner i træk (lav, L14).
- Hintlinket i standardblå (se ovenfor, L14).

## Fund

| Fund | Alvor | Hvad | Ret |
|---|---|---|---|
| L10 | middel | Linjens tal ("ca. 2 af 100", "ca. 3 af 100", "ca. 1 af 100 i modellens sumo") gælder omhyggelige klik lige fra siden. Med typiske klik overses "stangen glider frem" i 19 %, "hoften tilbage" i bunden i 14 % (telefonen i hånden 19-23 %), sumoens "stangen glider frem" i 10,5 % | Sig "med omhyggelige klik" og tallet for hurtige klik, eller vis det største |
| L11 | lav | I sko med torsoen holdt giver sticking point falsk dom "hoften tilbage" i 13-16 % ved 3 cm og 5-7 % ved 2,5 cm | Hint også ved sticking point fra 2,5 cm |
| L12 | lav | Sumo tjekkes kun inden for 3,8° og 20 cm til siden; i hånden er halvdelen "ikke tjekket", og 3° til den ene side overser 16-36 % | Vejledningen: stativ ud for stangen, højst ca. 20 cm til siden |
| L13 | lav | Skulderen 3 cm mod hofterne giver falsk "stangen for højt" 3-6 % vinkelret, 9-11 % 10° skråt; en tredjedel af modellens egne bryststillinger er "ikke tjekket" | Nævn skuldrene og skulderklikket i grænsen |
| L8 | lav | "Hvert tredje til femte" passer ved 2 cm, ikke ved 2,5 cm (ca. hvert andet) eller i hånden (3 af 4) | "hvert andet til femte" |
| L14 | lav | To koloner i sumoens grund; hintlinket i standardblå på mørk baggrund; linjen står som tredje grå afsnit under tabellen | Tekst og farve |

## Ærlige grænser

- **Kun syntetiske figurer og Marcs to billeder.** Intet rigtigt løft med en kendt fejl, intet i vægtløftersko, intet rigtigt sumo- eller bænkklip med stor bue.
- **Mine modeller, ikke målinger:**
  - pinhole uden linseforvrængning,
  - dybderne,
  - klikfejlen fra 511 ("typisk" er mit bud på hurtige klik på en telefon),
  - sumoens knæ og fod ±10 cm,
  - buen på fire måder,
  - "halvvejs" i sko som billedet med den halve hæl,
  - skuldrene 3 cm ned som et rent skift af skulderpunktet.
- **Træneren i hånden** er en normalfordeling af vinkel og plads, som jeg har valgt, ikke målt.
- **Kun headless Chromium på Windows**, ikke en rigtig telefon.
- **Ingen atletdata** ud over Marcs eget klip.
