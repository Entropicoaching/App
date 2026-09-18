# Måling — ordre 269 commit 3: er bundtet vokset siden b1c3815?

Samme tre skærme som `scripts/maal-kaeden.mjs` (226/228/231/233): Atletliste
(coach), Dagens pas (atlet), Check-in (atlet). FØR = `b1c3815` (ordre 248,
samme basispunkt `docs/PROEVER-KORT.md` selv bruger — 28 commits før denne
ordres branchpunkt). EFTER = denne gren (`atletflader-bevist`, samme indhold
som `main` lige nu).

## Metode (stå på skuldre af 226 + 228, ikke en ny målemetode)

`npm run maal:kaeden`s egen TTI-måling (Lighthouse+mock+login) svarer på "føles
skærmen langsommere" — den er støjfølsom (se `docs/KAEDEN-233.md`s eget
"Ærligt"-afsnit: ±184ms mellem to ellers identiske builds). Ordrens spørgsmål
her er snævrere og mere faktuelt: er selve BUNDTET (bytes) vokset. Derfor er
`scripts/maal-produktion.mjs` (228)s egen teknik brugt i stedet — Lighthouse's
`mainScript`-udtræk af transfer-/resource-størrelse — men anvendt direkte på
`vite build`s egne to versioner (ingen Lighthouse-kørsel nødvendig for et
rent byte-spørgsmål): `npm run build` kørt to gange, samme metode, samme
maskine, ét git-worktree pr. version (`git worktree add --detach`, delt
`node_modules` via en NTFS-junction — ingen `npm install` nødvendig, `git
diff b1c3815 HEAD -- package.json` viser ingen afhængighedsændring).

De tre skærme deler to bundter: `index-*.js` (hovedbundtet, altid hentet) +
`AthleteView-*.js` (Dagens pas/Check-in, begge på Hjem-fanen) eller
`Dashboard-*.js` (Atletliste). Tabellen viser summen pr. skærm.

## Tabel

| Skærm | b1c3815 (rå / gzip) | Nu (rå / gzip) | Vækst rå | Vækst gzip |
| --- | --- | --- | --- | --- |
| Atletliste (coach) | 641,91 kB / 173,29 kB | 643,88 kB / 173,95 kB | +0,31 % | +0,38 % |
| Dagens pas (atlet) | 514,37 kB / 144,10 kB | 531,67 kB / 148,43 kB | +3,36 % | +3,00 % |
| Check-in (atlet) | 514,37 kB / 144,10 kB | 531,67 kB / 148,43 kB | +3,36 % | +3,00 % |

Ingen af de tre skærme er vokset over 10 % siden `b1c3815`.

## Hvad tallet gemmer

Under overfladen er `AthleteView-*.js`-bundtet selv (delt af Dagens pas og
Check-in) vokset fra 120,30 kB til 137,52 kB rå (+14,3 %) og 32,98 kB til
37,25 kB gzip (+12,9 %) — over 10 % på chunk-niveau, men det drukner i de to
skærmes fælles ~394 kB `index`-bundt, som er stort set uændret (+0,08 kB rå).
Jf. ordrens "er det over 10 %, så navngiv den tungeste nye del": den tungeste
nye del i `AthleteView.jsx` (9 commits, 429 nye linjer siden `b1c3815`, se
`git log --oneline b1c3815..HEAD -- src/AthleteView.jsx`) er commit `aa5ba94`
("Dagens pas viser næste sæt øverst, ikke hele planen", ordre 263 · commit 1)
med 143 tilføjede linjer alene — mere end dobbelt så meget som den næststørste
(09a4dd6, pausetimeren, 71 linjer). `Dashboard-*.js` (Atletliste) er derimod
stort set uændret (+0,76 % rå) — ordre 259/262/263/266/267 er alle
atlet-vendte, ikke coach-vendte.

## Ærligt

- Dette er en BYTE-måling, ikke en oplevet-hastigheds-måling — se
  `docs/KAEDEN-233.md`/`docs/RAPPORT-226.md` for TTI-tallene, som denne
  ordre ikke gentager (ingen ordre om at genmåle TTI, og støjniveauet der
  ville gøre en 3-4 % bundtvækst umulig at skelne fra støj alligevel).
- Sammenligningen er lokal (`npm run build` mod hinandens git-commits, delt
  `node_modules` via junction) — ikke mod produktionens faktiske,
  CDN-komprimerede bytes (se `docs/RAPPORT-228.md`s egen grænse for hvorfor
  kun login-skærmen er målt der).
