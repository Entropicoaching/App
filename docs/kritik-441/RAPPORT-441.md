Ordre 441

Dødløft- og bænkfigurerne set af en styrkeløftcoach: ligner det de rigtige løft? (Bhishak)

## Gren

- **Gren:** `kritik-441` i `C:\Users\Entropi\Desktop\entropi-app-kritik`, lavet fra app-`main` `0fbe9d4`. Ikke pushet, ikke merget.
- **Commit 1** `f7bd6be`: `outputs/kritik-441/` (`figurer-441.mjs`, 46 figurbilleder og 4 sidebilleder, `figurer-441.json`), `verify-kritik-441.mjs`, `verify:kritik-441` i `package.json` og `docs/kritik-441/FIGURER-441.md`.
- **Commit 2:** `docs/kritik-441/KRITIK-doedloeft-baenk.md` og denne rapport. Hashen står i `git log`.
- **Løftmodellen** (`C:\Users\Entropi\Desktop\entropi-loeftmodel-dhruva`) er kun læst: `main` @ `f1e84b3` (429 og 434 merget) via `git archive` til en midlertidig mappe. Playwright er lånt fra skak-mappen som i 374 og 384 (kun læst).

## Hvad ændret

Intet i løftmodellen eller sitet. Kun nye filer i mine egne mapper og én linje i `package.json` (`verify:kritik-441`). Linjen kræves af ordrens verificeringskommando, og 432 og 437 gjorde det samme.

**Blok 1, figurerne (commit 1).** `node outputs/kritik-441/figurer-441.mjs` viser de to sider headless ved 390x844 (touch, 2x) og 1280x900 og fotograferer hver figur med sin figurtekst: 13 dødløft og 10 bænk i hver bredde. Jeg har set hvert billede som en coach, der har set tusind dødløft og bænkpres. Tre ting er målt eller regnet ud over modellens egne tal:
- hvor stangen rører i forhold til brystets højeste punkt, og hvor albuen står i forhold til hånden forfra (målt i SVG'erne),
- hvad knæhøjde ville være med 159° knæ (overslag med modellens regler, kontrolleret mod modellen ved 140°),
- hvor langt skulderen står foran anklen ved lockout.

Fundene er D1-D7 og B1-B5 i `FIGURER-441.md`, hver med skærmbillede.

**Blok 2, dom (commit 2).** `KRITIK-doedloeft-baenk.md` har fundene øverst i en tabel og derefter én linje pr. løft:
- Konventionelt dødløft: klar til sitet: nej (D1, D3, D4).
- Sumo: klar til sitet: nej (D5 og det arvede).
- Bænkpres: klar til sitet: nej (B1, B2, B3).

Kort sagt: stangens vej er rigtig i begge løft. Kroppen omkring stangen ligner ikke de rigtige løft i de billeder, en coach ser først. Ved dødløftet er det opstillingen og lockout, ved bænken stangen på brystet.

## Testresultat

- `npm run verify:kritik-441`: grøn (blok 1 + 2): 23 figurer x 2 bredder, 12 fund, 3 domme, rapport. `node outputs/kritik-441/verify-kritik-441.mjs 1` var grøn før commit 1. Testen tjekker desuden, at de målinger fundene bygger på, stadig står sådan i `figurer-441.json`. Rettes figurerne og måles de igen, fejler den med navnet på fundet.
- Målt: ingen sidelæns rulning på 390 eller 1280 på nogen af siderne. Mindste tekst i figurerne er 12,5 px på 390 og 14,2 px på 1280, og HTML-teksten er 14,4 px. Alle billeder hentes.
- `npm run lint` er ikke kørt. Worktreen har ingen `node_modules`, og der er ingen app-kode i denne gren.

## Hvad er næste

Til Yantra (løftmodellen), fundene i punktform. Tal og skærmbilleder står i `docs/kritik-441/FIGURER-441.md`:
- D1: Den konventionelle opstilling er stivbenet (skinneben 4°, hofte 50°, torso 68°, knæet 4,2 cm bag stangen). Marcs klip har hoften 80° og torsoen 50°. Et skinneben der kan hælde frem til stangen, fx med stangen lidt foran midtfoden eller mindre end 6 cm fra skinnebenet, er det, der mangler.
- D2: Vis enten opstillingen eller "stangen forlader gulvet", ikke to næsten ens figurer.
- D3: Knæet ved knæhøjde (140° mod 159°) koster ca. en tredjedel af hoftens arm. Overslag: 34,0 → 21,2 cm og hoftemomentet 1078 → ca. 670 Nm. Ret knæet før hoftemomentet ved knæhøjde citeres. Torsoen er ikke problemet (Marc 45°, modellen 48°).
- D4: Lockout hælder 5° som én ret linje, og skulderen står 11,4 cm foran anklen. Det er squattens F1 igen. Marcs klip står med skulderen næsten over anklen.
- D5: Sumo har brug for et vindue forfra som bænken (stand, fødder, knæ ud). Sumoens torso ved gulvet (57°) er mere vandret end Marcs konventionelle (50°), og sumo-lockout ligner en mindre person.
- D6: Klippets blå knæ før knæhøjde står foran stangen (384 F7). Det er mærket nu; overvej at skjule det upålidelige knæ helt.
- D7: Arm uden hånd, flad ryg og kantet balde (kosmetisk, som squattens F9).
- B1: Stangen rører 15 cm tættere på hovedet end brystets top (13,7 cm ved stor bue). Lad berøringspunktet følge brystets højeste punkt med buen.
- B2: Underarmen ved brystet hælder 25° fra siden, og albuen står 11 cm uden for hånden forfra. Smalt greb er foldet sammen (albue 38°, underarm 47° fra siden). "Albuen under stangen" er det, en coach ser efter først.
- B3: Midt i opturen står overarmen 80° ud, og albuen står 17 cm uden for hånden forfra: kyllingevinger. Fra siden er armen en lodret stang.
- B4: Buen er et knæk mellem bryst og mave, ikke en bro fra skulderblade til balder. De tre buer ligner hinanden, og en V-streg på brystet går igen i alle figurer.
- B5: Stangen forfra slutter ved hænderne. Udgang og lockout er samme figur (kosmetisk).

Til Marc: figurerne skal ikke på sitet endnu. Det, der kan bruges nu, er bænkens lockout og grebsvinduet.

For Hara (Coaching-planeten): arbejdet hører til sporet "kropsmodel til teknikfeedback i de tre løft", ikke til delmålet "Appen mærkbart bedre". Appen er ikke rørt. Det, Hara kan bruge: dødløft og bænk er i modellen, men ingen af dem er klar til sitet endnu. Der er 12 fund til Yantra, heraf 7 vigtige.

## Ærlige grænser

- **Coachens øje er ikke en måling.** "Ligner et rigtigt løft" er min vurdering af billederne. Hvor jeg sammenligner med rigtige løftere, bruger jeg Marcs eget klip (i repoet), Escamilla 2001's 159° (fra Yantras rapport) og almindelig coachviden. Jeg har ikke læst nye kilder, og tal som "de fleste rører nederst på brystbenet" er erfaring, ikke citat.
- **Overslaget i D3 er mit, ikke modellens.** Det holder skinnebenet, de 6 cm fra knæled til stang og skulderen 5 cm foran stangen fast og skalerer hoftemomentet groft med armen. Overkroppens tyngdepunkt er ikke regnet om. Det rammer modellen ved 140° (34,0 cm, 48°), men 159° med de samme regler giver en for oprejst torso (30° mod Marcs 45°), så ~670 Nm er en retning og en størrelsesorden, ikke et tal til sitet.
- **SVG-målingerne** (B1, B2, B3, B4) er læst ud af tegningens koordinater med skivens diameter (45 cm) som målestok fra siden og skulderbredden (47,4 cm) forfra. De måler tegningen, ikke modellen, og de afhænger af, at SVG'ernes opbygning ikke ændrer sig.
- **D4's "skulderen næsten over anklen" i Marcs klip** er skønnet fra skærmbilledet (`fig-390-dl-13`), ikke målt.
- **Sumo er kun vurderet fra siden**, fordi figurerne kun findes fra siden. Det er en del af fundet (D5).
- **Siderne er set som selvstændige sider** (`dist/*/index.html`), ikke som en del af sitet, fordi de ikke er dér endnu. Hvordan de ser ud i sitets ramme, er ikke målt.
- **Ordren er stilet til Bhishak.** Worktreens `CLAUDE.local.md` siger "Vaidya", men ordren blev givet direkte af Marc, og mappen er Bhishaks hjem (432, 437). Jeg har fulgt ordren og Bhishaks grænser: ingen sub-agenter, ingen push, ingen merges, kun `kritik-441`.
- Ingen atletnavne; kun Marc er nævnt, som i løftmodellen.
