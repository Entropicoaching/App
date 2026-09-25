# Rapport: ordre 373, AthleteView.jsx delt i moduler (tre blokke)

Ordren: `src/AthleteView.jsx` (4.597 linjer) skulle deles i moduler under
`src/athlete/`, uden at atleten mærker noget, så fremtidige app-ordrer kan
læse én lille fil i stedet for hele visningen. Resultat: **593 linjer** (mål:
under 600) plus 22 nye moduler. Alle 44 kontroller er bestået både før og
efter. De 11 skærmbilleder har **0 % afvigelse**, og 3.920 flyttede linjer er
genfundet tegn for tegn.

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): **ja, indirekte.** Atleterne ser ingen forskel (det var kravet). Gevinsten er at hver fremtidig ordre, der rører atletens visning, kan nøjes med at læse den ene fil, der passer (typisk 50–700 linjer), frem for 4.597. Duta målte, at netop den fil var den største enkeltdriver af tokenforbruget.

## Gren

Gren `atleteview-moduler`, forgrenet fra `main` (`5d1486f`). Ti commits:

- `a50e128` blok 1: kortet over filen og sikkerhedslinen FØR (foer.json, 11 skærmbilleder)
- `a81c4eb` blok 2: de 16 statiske verify-tjek læser `AthleteView.jsx` + modulerne via `scripts/athleteViewKilde.mjs`
- `cb0268d` blok 2: rene hjælpere, data og forsidens komponenter (8 moduler)
- `e3e048b` blok 2: HJEM-fanens JSX → `HjemTab.jsx`
- `9de1b95` blok 2: onboarding-guiden og rammen (overlays + topbar)
- `1a668f6` blok 2: kost-, vægt- og beskedhandlere som fabrikker
- `cb82d26` blok 2: læsninger og sæt-skrivning som fabrikker; kaldene står før effekterne
- `21a9351` blok 2: VideoCoach-broens effekter som hooks
- `d3b893b` blok 2: skærme, kost-kort, toast, bundnav og parathedsudkast
- blok 3-commit (denne rapport, efter.json, skærmbilleder, nyt kort): se `git log -1`

## Hvad ændret

**Blok 1.** `docs/ATHLETEVIEW-KORT.md` (FØR-kortet: dele, linjeintervaller,
hvem kalder hvem, snittet). `outputs/373/koer-verify.mjs` kører build, lint
og alle 42 `verify:*` og skriver `outputs/373/foer.json`: 44/44 bestået.
`outputs/373/skaermbilleder.mjs` tager 11 headless skærmbilleder på 390×844
mod den ægte app (vite) med e2e-mocken og `buildSeed` (kun syntetiske data;
en stævnedato er sat i seeden, så Stævne-fanen kommer med): forside, "Mere",
Program, Volumen, Fremgang, Kost, Mobilitet, Beskeder, Stævne, Program med
session åben og onboarding-guiden. To FØR-kørsler gav 0 % indbyrdes
afvigelse, så sammenligningen er deterministisk.

**Blok 2.** 22 nye filer under `src/athlete/`, alle flyttet uændret (kun
import/export og en omsluttende funktion er nye):

- Komponenter: `HjemTab`, `DagensPasCard`, `WeekCalendar`, `RestPauseFooter`, `ForsideGrafer`, `Ramme`, `OnboardingGuide`, `BundNav`, `NavItems`, `ToastPlads`, `KostKort`, `IkkeKoblet`, `Indlaeser`.
- Handler-fabrikker (`lavX(ctx)`, kaldt i hvert render med samme navne, altså samme closures): `laesninger.js`, `saetSkrivning.js`, `kostHandlinger.js`, `beskederOgVaegt.jsx`.
- Hooks, kaldt på effekternes gamle pladser (samme effekt-rækkefølge): `useVideoCoachBro.js` (broen + G16-varslet), `useParathedUdkast.js`.
- Rene moduler: `videoCoachBro.js`, `ugeHjaelp.js`, `lokaleFoedevarer.js`.

`AthleteView.jsx` ejer stadig al tilstand, de små fane-effekter og
`LazyBoundary`-fanerne. `onReadError`/`showFlash`/`askConfirm` og de fire
fabrikskald står nu lige efter tilstanden, før effekterne. Ingen props er
omdøbt, og ingen logik eller stil er ændret. Hvert frit navn i de flyttede
dele er fundet af ESLints `no-undef`, ikke gættet.

De 16 statiske verify-scripts læste `src/AthleteView.jsx` som tekst. De
læser nu `athleteViewKilde()`: samme fil plus de nye moduler (fast liste), med
`'../x'` skrevet som `'./x'`. Regex'erne er uændrede. En gang glemte jeg at
føje en ny fil til listen, og fem tjek fejlede straks. Det viser, at de stadig
vogter koden.

**Blok 3.** `outputs/373/efter.json`, `outputs/373/efter/` (11 billeder),
`outputs/373/pixel.json`, `outputs/373/flytte-tjek.mjs` + `flytte-tjek.json`
og `docs/ATHLETEVIEW-KORT.md`, omskrevet til det nye kort med en
"Læs KUN src/athlete/X"-tabel pr. emne.

## Testresultat

- `node outputs/373/koer-verify.mjs foer|efter`: **foer 44/44, efter 44/44, samme scripts bestået** (build, lint, 42 × verify). Én ting skal nævnes: i efter-kørslen fejlede `verify:videocoach-clip` første gang. Alene bestod den to gange (245 s, forhold 1,06×/1,08× mod grænsen 1,1×). Den tester trackeren i `public/videocoach.html` mod et lokalt klip, og den læser intet, grenen har rørt (`git diff main -- public scripts/verify-videocoach-clip.mjs` er tom). Det første udfald er bevaret i `efter.json` under `foersteKoersel`, og omkørslen er markeret `omkoert: true`.
- Pixel-sammenligning (`node outputs/373/sammenlign.mjs`, pixelmatch, threshold 0), afvigelse pr. skærm:

  | Skærm | Afvigelse |
  |---|---|
  | 01-forside | 0 % |
  | 02-forside-mere (hele siden, 2.999 px) | 0 % |
  | 03-program | 0 % |
  | 04-volumen | 0 % |
  | 05-fremgang | 0 % |
  | 06-kost | 0 % |
  | 07-mobilitet | 0 % |
  | 08-beskeder | 0 % |
  | 09-staevne | 0 % |
  | 10-program-session-aaben | 0 % |
  | 11-guide | 0 % |

- `node outputs/373/flytte-tjek.mjs`: **3.920 linjer flyttet uændret, 0 forsvundne linjer ikke genfundet** i modulerne (multimængde, samme indrykning, uden importlinjer).
- `npm run e2e` (atlet → coach, ni skridt): grøn før (28,4 s) og efter (28,2 s). Desuden grønne efter: `e2e:atlet`, `e2e:dagens-pas`, `e2e:dagens-pas-historik`, `e2e:check-in`, `e2e:film-et-saet`, `e2e:atlet-uge`, `e2e:fremgang`, `e2e:saet-nu`, `e2e:ret-saet`, `e2e:rolig-forside`. De dækker bl.a. PR-toasten, ret sæt offline, check-in og fortryd.
- Bundtstørrelse (`npm run build`): `AthleteView`-chunken **161,83 → 173,25 kB** (gzip 43,55 → 46,36 kB). Alle andre chunks er uændrede (±0,02 kB). I alt 1.125,33 → 1.136,77 kB (gzip 291,10 → 293,91).

## Hvad er næste

Næste ordre (foreslået af mig i 370): **appens coach-prioritet i samme rækkefølge som mailen.** `src/coachPriority.js` rangerer i dag alert 0 / context 3, men Coach Briefing-mailen rangerer smerte 0 → fravær 1 → afvigelse 2 → besked/video 3 → PR 4. Ændringen er lille og afgrænset: læs KUN `src/coachPriority.js` og `scripts/verify-coach-priority.mjs`, giv detektorernes labels samme rang som `n8n/build-coach-briefing.code`, og lås rækkefølgen med et tjek i `verify:coach-priority`. Så står den samme atlet øverst i indbakken og i mailen.

Til fremtidige app-ordrer, der rører atletens visning: brug tabellen i `docs/ATHLETEVIEW-KORT.md` og skriv "Læs KUN src/athlete/X". Skal der ny tilstand eller en ny prop til, skal `AthleteView.jsx` (593 linjer) læses med. Flyttes kode til en ny fil, skal filen føjes til `scripts/athleteViewKilde.mjs`.

## Ærlige grænser

- **Bundtet voksede med 11,4 kB (2,8 kB gzip),** alt i `AthleteView`-chunken, som atleten henter ved opstart. Årsagen er, at fabrikkernes og komponenternes navnelister (ctx-objekter, returværdier, props) er objekt-nøgler, som minifieren ikke kan forkorte. Adfærden er uændret. Tallet bør måles i felten (`maal:app`/`maal:telefon`), før man siger at det er ubetydeligt. Jeg har ikke målt indlæsningstid.
- **Lint ser nu kode, den ikke så før.** Efter opdelingen kan React Compiler-reglerne (`eslint-plugin-react-hooks` 7) analysere `AthleteView`. På `main` meldte de intet om filen, sandsynligvis fordi compileren opgav den. Undervejs meldte de 5 eksisterende setState-i-effekt; tre af dem ligger nu i hooks, hvor reglen ikke kan se at setteren er en setState, så to står tilbage i `AthleteView.jsx` (offline-tælleren og opvarmnings-autodetektionen). Dertil ref-objekter givet til fabrikkerne og (i de nye hooks) refs/settere, som exhaustive-deps ikke kan se er stabile. Alle er undertrykt med en begrundelse (samme mønster som `src/dashboard/AnalyseTab.jsx:753`): i alt 9 nye direktiver (1 `refs`-blok, 2 `set-state-in-effect`, 6 `exhaustive-deps`). Compileren kører ikke i build (`vite.config.js` bruger ren `react()`), så appen påvirkes ikke. Men setState-i-effekt-mønstrene er reelle, og de fortjener en egen vurdering (som `docs/HOOKS-ADVARSLER.md` gjorde for deps).
- **Ikke fotograferet:** "ikke koblet"-skærmen, indlæser-/fejlskærmen, RPE-guiden, bekræft-modalen, fortryd-toasten og coach-preview-visningen (`coachAthleteId`). De er flyttet uændret (flytte-tjekket dækker dem), og flere køres af e2e (fejl, fortryd, PR-toast), men de er ikke pixel-sammenlignet.
- **Fire små flytninger ud over ren tekst:** `BundNav` er pakket i et fragment (ingen DOM-ændring). G16-effekten ligger nu i en hook i samme fil som broen, så importtjekket i `verify:athlete-silent-fails-5` fortsat finder hele stille-fejl-API'et i én import. De to parathedsudkast-refs oprettes nu inde i hooken (samme levetid, andet sted i hook-rækkefølgen). Fabrikskaldene er rykket op før effekterne; effekter kører efter render, så det ændrer intet.
- **De statiske tjek er flyttet med, ikke svækket:** 16 scripts læser en samlet tekst i stedet for én fil. Et tjek, der tidligere kunne fejle, fordi koden lå "i den forkerte fil", kan det ikke længere, fordi listen er samlet. Til gengæld tæller og matcher de præcis den samme kode, og negative tjek ser ikke de ældre faner.
- `verify:ugen-faar-dato` og de ekstra e2e-specs overskriver committede leverancebilleder (`outputs/ugen-faar-dato`, `outputs/314|320|330`) med dagsdatoen. Dem har jeg sat tilbage med `git checkout`, så træet er rent. Ingen af dem er en del af denne leverance.
- `verify:videocoach-clip` bruger to lokale, git-ignorerede klip, heriblandt en optagelse fra Marc. Kun tal er skrevet i logs/JSON, intet billede eller navn.

main kan pushes: ja
