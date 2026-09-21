# Måling — ordre 281 blok 4: er main stadig klar til push?

Samme tre skærme og samme metode som `docs/KAEDEN-269.md` (som igen står på
skuldre af 226/228/231/233): Atletliste (coach), Dagens pas (atlet),
Check-in (atlet). FØR = `b1c3815` (samme basispunkt som 269 brugte). EFTER =
denne gren (`afvigelsen-oeverst`), som er `main` (268, 269, 276 merget)
med ordre 281 blok 1-3 ovenpå — dvs. tallene her er det main VILLE veje
hvis denne gren merges.

## Metode

`vite build` kørt to gange (`b1c3815` og `afvigelsen-oeverst`), hver i sit
eget `git worktree add --detach`, delt `node_modules` via NTFS-junction —
ingen `npm install` nødvendig (`git diff b1c3815 afvigelsen-oeverst --
package.json` viser kun nye npm-scripts, ingen afhængighedsændring). Samme
mock-URL/-nøgle brugt til begge builds (kun til at pege Supabase-klienten
et sted, ingen netværkskald sker under selve `vite build`).

## Tabel

| Skærm | b1c3815 (rå / gzip) | Nu (rå / gzip) | Vækst rå | Vækst gzip |
| --- | --- | --- | --- | --- |
| Atletliste (coach) | 641,96 kB / 173,33 kB | 646,51 kB / 174,73 kB | +0,71 % | +0,81 % |
| Dagens pas (atlet) | 514,43 kB / 144,13 kB | 540,42 kB / 150,70 kB | +5,05 % | +4,56 % |
| Check-in (atlet) | 514,43 kB / 144,13 kB | 540,42 kB / 150,70 kB | +5,05 % | +4,56 % |

Ingen af de tre skærme er vokset over 10 % siden `b1c3815`.

## Hvad tallet gemmer

Under overfladen er `AthleteView-*.js`-bundtet selv (delt af Dagens pas og
Check-in) vokset fra 120,31 kB til 146,31 kB rå (+21,6 %) og 32,97 kB til
39,55 kB gzip (+20,0 %) — over 10 % på chunk-niveau, ligesom 269 selv fandt
(dengang +14,3 %/+12,9 %). Det drukner fortsat i det delte ~394 kB
`index`-bundt (uændret, -10 bytes). Den tungeste enkeltcommit siden
`b1c3815` er STADIG den samme som 269 fandt: `aa5ba94` ("Dagens pas viser
næste sæt øverst, ikke hele planen", ordre 263 · commit 1, 143 tilføjede
linjer) — de fire commits der er landet SIDEN 269 (276's blok 1+2, ordre
281's egne tre) rører `src/athlete/UgensStatusKort.jsx` og
`src/dashboard/afvigelse.js`, ikke `AthleteView.jsx` selv i samme omfang
(største enkeltcommit siden 269 er `d26a3de`, 39 linjer i
`AthleteView.jsx` + 72 i `UgensStatusKort.jsx`).

`Dashboard-*.js` (Atletliste) er stort set uændret (+1,84 % rå) — ordre 281
er den første coach-vendte ordre siden 269, og afvigelse-koden
(`src/dashboard/afvigelse.js`, 57 linjer + kaldet fra `Dashboard.jsx`) er
lille i forhold til hele Dashboard-chunken.

## Svar

**Ja, main kan pushes.** Ingen skærm er vokset over 10 % siden `b1c3815`,
alle tre prøvehøst-farver (se rapportens "Testresultat") er grønne bortset
fra én kendt, allerede eksisterende fejl der er uafhængig af denne ordre
(verificeret ved at gentage samme prøve på uændret `main`).

## Ærligt

- Samme grænser som 269's egen måling: dette er en BYTE-måling, ikke en
  oplevet-hastigheds-måling (ingen TTI genmålt). Sammenligningen er lokal
  (`vite build` mod hinandens git-commits) — ikke mod produktionens
  faktiske, CDN-komprimerede bytes.
- Bygget mod en placeholder-mock-URL, ikke den ægte `.env` — irrelevant
  for et rent byte-spørgsmål (ingen netværkskald sker under `vite build`),
  men nævnt for gennemsigtighed.
