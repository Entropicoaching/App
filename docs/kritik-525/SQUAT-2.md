squat-artiklen klar til udgivelse naar Marc har valgt: ja (U1-U4's stoppere er lukket; U2 er Marcs valg; U12 og U15 er små og åbne, N1 skal med i V8-valget)

# Squat-udgivelsen efter Setus 516, gentjek af U1-U16 fra kritik 502

Bhishak, ordre 525, blok 2. Grenen er `udgivelse-squat-min-krop` @ `273d670` i `entropi-coaching-site-wt2` (516
blok 1 `44ce420` og blok 3 `273d670`). Den er hentet med `git archive` til en midlertidig mappe, og intet træ er
rørt; worktreen står stadig på `loeft-instagram`.

Siderne er serveret på 127.0.0.1 og kørt headless i Chromium på 390 px (touch) og 1280 px, med alt uden for huset
blokeret: `artikel-squat.html`, `artikler.html` og `assets/min-krop/index.html`. Kilden er læst direkte.

Script: `outputs/kritik-525/squat-525.mjs`. Data: `squat-525.json`. Billeder: `S-390-top.png`, `S-1280-top.png` og
`S-390-kap4-min-krop.png`.

## Teknik, alle seks kørsler

- 0 JS-fejl, 0 konsolfejl, 0 manglende filer og ingen vandret rulning.
- 0 synlige [MARC], også i Min krop-rammen.
- 0 atletnavne i den synlige tekst. Tjekket mod fornavnene i appens `.gitignore`, som ikke er skrevet ud.
- 0 tankestreger i artiklen og på `artikler.html`. Min krop har stadig sine 8 forbindelsesstreger ("stang–hofte"),
  som i 502. De kommer fra løftmodellen.

## U1-U16

| # | Status | Hvad jeg så på `273d670` |
|---|---|---|
| U1 | lukket | "[MARC] " foran linket er væk. 0 [MARC] synligt og 0 `[MARC]`/`[MARC:` i kilden. |
| U2 | venter paa Marc | "Skriv dine egne mål ind og se dine tre løft ..." står uændret. Setu har mit forslag klar ("Med dine egne mål viser Min krop ..."). |
| U3 | lukket | Indledningen siger "men er ikke regnet i bunden, hvor hoften er bøjet mere, end modellen kan regne på". Legenden og tabellen i `squat-anatomi.js` siger "ikke regnet (uden for modellens område)". "intet krav" står kun ét sted, om den stående stilling, og det er rigtigt dér. Risikoen er Setus egen: bygger Yantra `squat-anatomi.js` igen fra løftmodellen, kommer den gamle tekst tilbage. |
| U4 | lukket | 0 `class="marc"` i kilden. |
| U5 | venter paa Marc | "Marcs målte skelet" og "Marcs eget klip, 270 kg" står synligt 2 gange i kapitel 6 og 4 gange i bundtet, og der er stadig reserveteksten "SYNTETISK, indtil Marcs video kommer". Yantra retter bundtet efter Marcs valg. |
| U6 | venter paa Marc | "Squat-udgaven kommer, når der er film; her er dødløftet som eksempel på metoden." står uændret. |
| U7 | lukket | Titlen er 67 tegn og beskrivelsen 150. Setu har forkortet med Marcs egne ord, og Marc kan rette ordene, når han godkender. |
| U8 | venter paa Marc | `datePublished`/`dateModified` er `[MARC-DATO]` (2 gange). Artiklen har `noindex`, står ikke i `sitemap.xml`, og `SITEMAP-KLAR.txt` ligger på grenen. Det er tre trin i én commit på udgivelsesdagen (RAPPORT-503). **Merges grenen uden de tre trin, går artiklen live med noindex og en ugyldig dato.** |
| U9 | lukket | "< Artikler" øverst og "Tilbage til artikler" nederst går til `artikler.html`, hvor squat-kortet er. "Flere artikler" går stadig til `viden.html#artikler`, som i de andre artikler. |
| U10 | venter paa Marc | 6 JS-kommentarer i artiklen har ordrenumre og agentnavne ("Ordre 405", "Yantras fase-vælger", "Drishtis indlejring"). Bundterne er urørte. Setu foreslår at fjerne dem. |
| U11 | venter paa Marc | `main` har stadig 22 filer i `outputs/` og `scripts/`, bl.a. `RAPPORT-174.md`, `FORSLAG-TIL-MARC.md` og `maal.mjs`, og de serveres live. Setu foreslår en særskilt commit før udgivelsen. |
| U12 | aaben | Kapitel 7 siger stadig "anden referencekrop end de fire fejlbilleder derefter" uden højde og vægt. Den venter på Yantras tal. |
| U13 | venter paa Marc | "ikke et litteraturtal" står 7 gange i kilden (2 i den tekst, der er foldet ud som standard). Setu foreslår at beholde dem i denne udgave. |
| U14 | lukket | Larsen 2021a ×4 og 2021b ×4, og 0 uden bogstav. Afsnittet "Modellens kilder" findes. Setu har ret i, at McGill er to referencer (1988 og 2002), så der er ni, ikke otte. |
| U15 | aaben | "0,09 m/s" står stadig i kapitel 1 og har stadig ingen kilde i folden. Ordet "opslaget" ("som resten af opslaget bruger") står også stadig. Det er Setus egen lille rettelse og kræver ikke Yantra. |
| U16 | lukket | Anatomitabellen har 11,52 px skrift på 390 og ingen egen rulning. |

**Optalt:** 7 lukket, 7 venter på Marc og 2 åbne (U12 og U15, begge små).

## Nyt

| # | Vægt | Fund | Hvem |
|---|---|---|---|
| N1 | bør, før merge | **Stien til Min krop.** Setus valg 11 foreslår `assets/vaerktoejer/min-krop/` "som artiklen peger på". Men artiklen på `273d670` peger på `assets/min-krop/index.html` (link) og `assets/min-krop/kort.html` (ramme), og det er kun værktøjsgrenen, der har `assets/vaerktoejer/min-krop/`. Vælger Marc Setus forslag, skal artiklens to stier ændres i samme commit, ellers bliver de 404 efter merge. | Marc vælger (V8), Setu retter |
| N2 | lille | U15 kan lukkes nu uden Yantra: "opslaget" til "artiklen", og indtil Yantra har fundet kilden, "0,09 m/s" til "omkring 0,1 m/s (Larsen m.fl., 2021a)" eller ud. | Setu |

## Dommen

Stopperne fra 502 er U1, U3 og U4, og de er lukket. U2 var den fjerde stopper, og den er Marcs valg, ikke en fejl.
Det, der er tilbage, er Marcs valg (U2, U5, U6, U8, U10, U11 og U13) og to små faglige ting (U12 og U15), som jeg
også i 502 vurderede som ikke-stoppende.

**Når Marc har valgt, er artiklen klar til udgivelse.** Tre ting skal ske i selve udgivelsescommitten: datoen,
noindex ud og sitemap-linjen (U8). N1 skal afgøres sammen med V8, før begge grene merges.

Jeg anbefaler, at U15 (N2) tages med i samme commit. Et tal uden kilde i hovedteksten er det, en fagfælle
bemærker først.
