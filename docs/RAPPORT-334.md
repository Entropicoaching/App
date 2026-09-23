**main kan pushes: ja** (ingen kodeændring, kun kritik-script og dokumenter)

Model: `claude-sonnet-5`.

# Rapport — ordre 334: kritiker på den rolige forside (330) og skak 326 (to blokke)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

Har arbejdet betydning for Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): ja. Kritikken siger at 330 kan pushes, og hvilke fire småting Marc bør vide om (for lille tekst i ugestrimlen, smal celle på 360 px, chips skubbet under folden midt i et pas, toast over overskriften).

## Gren

Gren `kritik-330`, fra `main` (`ce65d2e`).

- `8608213` blok 1: forsiden målt headless (script + skærmbilleder)
- commit 2: blok 2 (skak) + `docs/KRITIK-330-326.md` + denne rapport

## Hvad ændret

Intet, kritik. Ingen app-kode og intet i skak-repoet er rørt. Tilføjet: `scripts/kritik-334.mjs` (én kommando, begge blokke), `outputs/334/` (skærmbilleder og fund-json, kun mock-data), `docs/KRITIK-330-326.md`, denne rapport.

## Testresultat

- Verificering: `node scripts/kritik-334.mjs` (headless, egne porte 8993/5193 sat i scriptets eget proces-miljø). Blok 1: forsiden ved 390x844 og 360x780, touch, mock med fire dage og logs på to. Blok 2: skak fra `git show 288c95a:skak.html`, 14 punkter, alle grønne, konsol/sidefejl tomme.
- Fund: 8 (4 middel, 4 lav), ingen høj. Se `docs/KRITIK-330-326.md`. Domme: **Forside: push. Skak: klar til Marc.**
- `npm run lint`: rent.
- Én af fundene (F4, "Løs gåder" efter et spil viser spilbrættet) findes også på `4215ec2`, så den er ikke 326's.

## Hvad er næste

- Dhruva/Marc: merge/push af `rolig-forside` kan ske; F1–F3 og F5 er små rettelser til en senere ordre (større strimmeltekst, celle ≥44 px på 360, pas-kortets "ret"-rækker kollapset så chips holder sig over folden, toast uden om overskriften).
- F4 (gåder efter spil) er en ordre for sig til Chaturanga.

## Ærlige grænser

- Alt er headless Chromium på mock; ingen rigtig telefon. 330's "før"-tal er ikke genmålt.
- Skak-repoets arbejdstræ har ucommittede ændringer fra anden side; jeg testede `288c95a` fra git, ikke træet. "Find mat" er kun åbnet, ikke gennemspillet; Edge og `roegtest-dag5` er ikke kørt.
- Træet er ikke helt rent: syv filer under `outputs/kritik-skole/skak/` stod som ændrede allerede da sessionen startede (ikke mine, ikke rørt, ikke committet).
- Port 8991 var optaget af en andens proces; den er ikke lukket, scriptet bruger egne porte.
