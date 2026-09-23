**main kan pushes: ja**

Model: sessionen der afleverede blok 2 og denne rapport kørte på Sonnet 5 (`claude-sonnet-5`), ikke Opus 5.5. Blok 1's commit er signeret "Claude Opus 5.5" af en tidligere session, som jeg ikke kan verificere.

# Rapport — ordre 330: atletens forside, dagene står tydeligt adskilt, og forsiden er rolig (to blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Marcs dom fra telefonen: dagene skilles ikke tydeligt, og forsiden er for "meget". Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja. Det er en direkte reaktion på Marcs egen dom over 314/320 live, og forsiden går fra 105 til 30 elementer.

## Gren

Gren `rolig-forside`, forgrenet fra `main` (`f68ebdf`).

- `59427b3` blok 1: ugestrimlen skiller dagene ad, overskrift "Ugedag · pas" øverst
- denne commit: blok 2 (rolig forside, "Mere"-fold, toast under topbaren, prøve, rapport)

Træet er rent efter commit. Ingen push, ingen migration, ingen atletdata, ingen nye biblioteker. Coach-siden, Fremgang og Indbakken er ikke rørt.

## Hvad ændret

**Blok 1** (`src/AthleteView.jsx`, `WeekCalendar` og forsidens top)
- Hver tilstand bæres af form, ikke kun farve. Den viste dag har 2 px kant, fed ugedag og en lille trekant under cellen. I dag har datoen i en udfyldt lys cirkel (`aria-current="date"`). Pas-dage har fast kant og prik, klarede pas har ✓, og hviledage har stiplet kant og teksten "hvile" og er dæmpet.
- Afstanden mellem dagene er øget fra 0,3 til 0,5 rem, og cellerne er mindst 64 px høje.
- "God morgen"-hilsenen er erstattet af én overskrift øverst, fx "Onsdag · Dag 1 — Squat". Underlinjen siger "I dag" eller "I dag er det <ugedag>". Uden fast ugedag på passet bruges i dag.

**Blok 2**
- Forsiden viser nu: overskrift, ugestrimmel, dagens pas (aktuelt sæt øverst), én linje "Næste øvelse: … (+n)" og én række med højst tre sekundære ting: Parathed (score eller "Ikke logget"), Besked (antal nye) og Film et sæt (kun atleter). Pausen har som før sin faste linje nederst.
- Alt andet ligger bag folden "Mere" (`aria-expanded`, lukket fra start, ikke husket): ugestatus, "Mit program", parathedskortet, kropsvægt, rekorder, tonnage, styrke, kost, VideoCoach og coachens feedback. Parathed-chippen åbner "Mere" og ruller til kortet.
- "Resten af passet" (listen over alle øvrige øvelser) er skåret ned til den ene linje om næste øvelse. "Start din dag"-banneret og det store "Film et sæt"-kort er fjernet fra forsiden, fordi deres handlinger nu er chips.
- F12 fra 292: både PR-toasten og den almindelige toast ligger nu under topbaren (`top: calc(52px + 0.6rem)`), må bryde linjen og løber ikke ud over 360 px.
- Prøver: ny `e2e/rolig-forside.spec.mjs` (nr. 16 i `scripts/proever.mjs`, `npm run e2e:rolig-forside`). Ældre specs og tre verify-scripts er rettet, så de åbner "Mere", hvor "Mit program" og "Ugen som planlagt" nu ligger. `verify-athlete-first-day-flow` tjekker nu parathed-chippen i stedet for det fjernede banner.

## Testresultat

- `npm run lint`: rent.
- `npm run proever`, én ubrudt kørsel: **90/90 grønne**, 0 fejl, 0 sprunget over, inkl. den nye `e2e (rolig-forside.spec.mjs)`.
- Første kørsel gav 87/90. `verify:athlete-first-day-flow`, `verify:atletens-uge` og `verify:atletens-uge-holder` ledte efter ting, som nu ligger bag "Mere". De er rettet, og den endelige kørsel er den anden.
- Elementer over folden (knapper, inputs, links og tekstlinjer med tekst i første skærm), målt i headless med samme mock-data før og efter:

| Viewport | Før | Efter | Hele siden før | Hele siden efter |
|---|---|---|---|---|
| 390×844 | 30 | 30 | 105 | 30 |
| 360×780 | 28 | 30 | 105 | 30 |

  Over folden er tallet altså uændret, fordi forsiden før var fyldt op til folden med de samme ting. Forskellen ligger under folden: siden blev 3138 px høj før og 892 px efter (3184 → 892 på 360 px), og hele siden er nu omtrent én skærm. Blokke over folden gik fra 4 til 5, fordi overskrift og strimmel nu er blokke for sig.
- 3 sekundære ting over folden. PR-toast: øverste kant 61,6 px mod topbarens nederste kant på 53 px på begge viewports, altså under den. Ingen vandret rulning (`scrollWidth` = viewportbredden).
- Skærmbilleder foer/efter på 390×844 og 360×780 ligger i `outputs/330/` (forside, hele siden, "Mere" åben, PR-toast) sammen med `taelling-*.json`.

## Hvad er næste

- Marc ser forsiden på telefonen. Hvis tre chips stadig er for mange, er "Film et sæt" den nærmeste til at flytte ned i "Mere".
- Dhruva merger og pusher `rolig-forside`. Ingen migration hører til.

## Ærlige grænser

- Tallet "over folden" er uændret på 390 px, så Marcs "for meget" afhænger af, om han oplever helheden (én skærm i alt) eller kun første skærm. Jeg har ikke set forsiden på en rigtig telefon; alt er målt headless i Chromium på mock-data.
- Som "hvad der skal bruges nu" har jeg tolket parathed, besked og film et sæt. Pause og journal fra ordrens eksempel findes ikke som egne handlinger på forsiden. Pausen har sin faste linje, og en journal har jeg ikke fundet som selvstændig handling på forsiden.
- "Sidste gang"-hints ud over det aktuelle kort og kost/tonnage/rekorder er flyttet bag "Mere", ikke slettet. Toasts der hænger fast er kun løst for placeringen (under topbaren), ikke for varigheden.
- Foer-tallene stammer fra `outputs/330/taelling-foer.json`, målt af en tidligere session; jeg har ikke genkørt dem.
- Blok 1's commit står med Opus 5.5 som medforfatter; det kan jeg ikke ændre uden at omskrive en commit.
