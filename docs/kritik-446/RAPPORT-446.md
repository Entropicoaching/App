Ordre 446

Appen før Marcs push: alt fra 397 til 439 på én gang, som atlet i kælderen og som coach på telefonen. (Bhishak)

## Gren

`kritik-446` fra main `dd68c77`. Der er intet merget og intet pushet.
- `2e5ae5f`: blok 1, atleten.
- `810550d`: blok 2, coachen.
- Blok 3 (denne rapport og KRITIK'en) er grenens sidste commit.

## Hvad ændret

Intet i appen er rørt. Nyt er:
- `docs/kritik-446/`: `ATLET-446.md` (blok 1), `COACH-446.md` (blok 2), `KRITIK-app-push.md` (fund A1–A9 og dommen)
  og denne rapport.
- `outputs/kritik-446/`:
  - `tid-446`: tid til Dagens pas før og efter 439.
  - `graense-446`: rekorden mod rækkegrænsen.
  - `uge-446`: en uge i kælderen.
  - `coach-446`: coachen på 390 og 1280.
  - Fælles opsætning, `verify-kritik-446.mjs`, målingerne som `.json` og skærmbilleder (`U-*`, `U2-*`, `G-*`,
    `C-*`).
- `package.json`: scriptet `verify:kritik-446`, som ordren kræver.

Dommen er **klar til push: nej**. Det, der holder:
- Intet sæt tabt og ingen dubletter: 38/38 sæt, også når appen lukkes uden net og igen midt i afsendelsen.
- Rigtig tid på hvert sæt.
- Hver rekord fejret én gang.
- Coachens Log viser hvert sæt én gang.

Det, der ikke holder:
- **A1:** efter en genåbning uden net står vægtfeltet tomt, og Godkendt gemmer 0 kg.
- **A2:** "Spring over" virker ikke uden net, så sættet står som lavet hos coachen.
- **A3:** vurderingen af passet går tabt uden net.
- **A4:** 439 fejrer en falsk rekord, når atletens top ligger uden for de hentede rækker (4000, eller 1000, hvis
  prod står på Supabases standard).
- **A5–A9** er mindre: `personal_records` mangler kælderens rekorder og har dubletter, dobbelttryk på "Kopiér
  seneste uge" giver to uger, coachens telefon siger "Ingen logs" i 5 s, datoen er UTC, og tung historik koster
  ca. 2 s.

## Testresultat

- `npm run verify:kritik-446`: grøn (blok 3). Blok 1 og 2 var grønne før deres commits.
- `npm run lint`: grøn.
- Målingerne er kørt med `node outputs/kritik-446/{tid,graense,uge,coach}-446.mjs`. Byggene ligger uden for repoet
  (`K446_BYG`).

| Måling | Resultat |
|---|---|
| Dagens pas brugbart, let historik (114 sæt), før/efter 439 | 1,0 s / 1,0 s |
| Dagens pas brugbart, tung historik (4940 sæt), før/efter 439 | 3,3 s / **5,3 s** (historik 623 kB, 7,7 s) |
| Rekord med top 130 uger tilbage / 60 uger / 60 uger + loft 1000 | **falsk** / ingen / **falsk** |
| Uge i kælderen: sæt i mocken, dubletter, tid fra Godkendt | 38/38, 0, 0,0–0,2 s |
| Rekorder fejret / i Fremgang / i "din uge" | 7 × én gang / 7 / 7 |
| 0 kg-sæt efter genåbning uden net | **5** |
| Spring over og vurdering uden net | **virker ikke** |
| `personal_records` efter ugen | kælderens 2 mangler, **4 dubletter** |
| Coachens forside på telefonen: "Ingen logs" før "4 af 4 pas" | **3,8 → 8,7 s** |
| Kopiér seneste uge: ét tryk (1280) / dobbelttryk (390) | 1 uge / **2 uger** |

## Hvad er næste

**Til Vaidya (fundene, i rækkefølge):**
1. **A1:** forudfyld vægten fra ugens seneste sæt på samme øvelse (det, kortet allerede viser som "senest"), når
   historikken ikke er hentet. Gem historikkens seneste sæt i øjebliksbilledet. Godkendt bør ikke gemme 0 kg på en
   vægtøvelse uden at spørge (`DagensPasCard.jsx`).
2. **A2:** lad `skipSet` gå gennem samme offline-kø som Godkendt, med `skipped: true` og tiden
   (`saetSkrivning.js`).
3. **A3:** læg vurderingen i kø, eller behold spørgsmålet, til den er gemt, også hen over en genåbning.
4. **A4:** regn "bedst før" ud fra hele historikken, fx en side ad gangen eller et samlet maksimum pr. øvelse på
   serveren, i stedet for de nyeste 4000/1000 rækker. Indtil da: fejr kun, når historikken er hentet helt (færre
   rækker end grænsen).
5. **A5:** skriv `personal_records` fra de samme rekorder, som fejres (også efter køens afsendelse), og kun én gang
   pr. sæt. Ryd dubletterne i visningen.
6. **A6:** spær "Kopiér seneste uge", mens kopien kører.
7. **A7–A9:** "henter" i stedet for "Ingen logs", dansk dato i Log og PR-tidslinjen, og historikken hentet efter
   Dagens pas (eller kun det nye siden sidst).

**Til Marc, før pushet:** Se i Supabase-dashboardet under Settings → API → "Max rows", hvad prod står på. Står den
på 1000, rammer A4 alle atleter med mere end ca. 7 måneders historik. Det er en læsning i dashboardet, og jeg har
ikke gjort den (ingen kald mod prod).

**Til Marc om repoet:** `CLAUDE.local.md` (agentens private instruktioner med navne på miljøvariabler, ikke
værdier) er committet og ligger derfor i det offentlige repo. Det er ikke rørt her.

**For Hara** (Coaching, delmål "Appen mærkbart bedre"): kælder-løftet holder på det vigtigste, nemlig intet tabt,
ingen dubletter og rigtig tid. Men tre småting giver stille forkerte data hos coachen, og rekordfejringen kan lyve
for atleter med lang historik. Rettes A1–A4, er pushet det, der gør appen mærkbart bedre for atleterne i kælderen.

## Ærlige grænser

- **Alt er målt headless mod e2e-mocken,** ikke på en rigtig telefon og ikke mod prod. "Ældre telefon" er Chromiums
  drosling (Slow 4G, 4× CPU), ikke en rigtig iPhone med iOS' egne regler for at dræbe PWA'er.
- Mocken har ikke RLS, ikke Postgres-funktionen til signalerne og intet "Max rows". Loftet på 1000 er simuleret ved
  at skrive `limit` om i browseren.
- **Offline er Chromiums `setOffline`** plus CDP. Service workeren skulle have set én genåbning med net, før den
  kunne åbne appen uden net. Første åbning efter login kunne ikke genåbnes uden net. En rigtig atlet har brugt
  appen før, så det er ikke regnet som et fund.
- **Atletens regel** er "løft det anbefalede, ellers godkend det, der står". En opmærksom atlet ville se det tomme
  felt i A1 og skrive 25 selv. Fundet er, at appen tillader 0 kg og selv kender tallet.
- **A2:** efter det fejlede "Spring over" godkendte scriptet sættet, fordi det var den eneste vej videre. En rigtig
  atlet kunne også gå til Program-fanen (som heller ikke har en offline-vej) eller give op.
- Koden bag årsagerne til A1–A3, A5 og A6 er læst, men ikke rettet eller enhedstestet her.
- **A8 blev synlig, fordi målingerne kørte ca. kl. 01.30 dansk tid.** Om dagen ville Log og Fremgang vise samme
  dato.
- Blok 2's uge er kørt igen med samme scenarie plus ét sprunget sæt med net (Planke 2 i pas 3), så coachen havde
  et at se. Tallene i blok 1 og 2 er fra hver sin kørsel og passer sammen.
- "Før 439" er `412f2c1`, udpakket med `git archive` til et temp-bibliotek og bygget dér. Der er ingen
  git-handlinger på andre grene.
- **Arbejdstræet havde ingen `node_modules`.** Jeg lagde en junction til `entropi-app/node_modules` (samme
  `package-lock.json`) for at kunne bygge og køre lint. Den er git-ignoreret og fjernet igen efter sidste kørsel.
- **Ordren var til Bhishak, men `CLAUDE.local.md` i dette arbejdstræ siger Vaidya.** Marc bad mig udtrykkeligt om
  at udføre ORDRE-Bhishak.md, så det gjorde jeg og holdt mig til Bhishaks grænser: ret intet og skriv kun i
  kritik-mapperne. `package.json` er rørt for `verify:kritik-446`, som ordren beder om.
