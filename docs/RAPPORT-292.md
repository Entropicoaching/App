**Anbefaling: push ikke endnu.** Én sikker fejl (reps-knapperne starter på 0 fra sæt 2) og én uafklaret (Fremgang kan tabe de nyeste sæt, hvis Supabases Max rows er 1000). Se `docs/KRITIK-288.md`.

# Rapport — ordre 292: kritiker på app-main før Marcs push (to blokke, intet rettet)

Planet: coaching · Spor: spor-appen-m-rkbart-bedre-for-atleterne-5d2c3a

## Gren

Gren `kritik-288`, forgrenet fra `main` = `e4ecc56` (280, 281, 284, 285 samlet af Vaidya). Ordrens to commits, plus en tredje der kun retter rapportens overskrift til høstens format:

- `e3511ee` blok 1: skærmbilleder fra den headless gennemgang (`outputs/kritik-288/`, 55 billeder, fiktive data)
- `6ae90d2` blok 2: `docs/KRITIK-288.md` og `docs/RAPPORT-292.md`
- denne commit (hoest-format): rapportens overskrift `## Gren`

Arbejdstræet er rent. Ingen push, ingen kode rettet, ingen test committet, ingen migration, ingen Supabase-forbindelse, ingen atletdata. Port 8991 var fri hver gang; jeg lukkede ingen andres processer.

## Hvad ændret

Intet, kritik. Kun skærmbillederne og de to dokumenter er nye.

Det jeg fandt (alle detaljer, skærmbilleder og mistænkte filer i `docs/KRITIK-288.md`):

- **Bloker:** F1, reps plus/minus i Dagens pas starter fra 0 fra sæt 2 (`src/AthleteView.jsx:331`, `??` fanger ikke tom streng). F2, Fremgang henter uden datogrænse, stigende, `.limit(4000)`: mister de nyeste sæt, hvis Max rows er lav (`src/AthleteView.jsx:1726`; kode-mistanke, ikke testet).
- **Ret efter push:** F3 første øvelse forudfyldes med planen, ikke sidste gang (effekten kører før historikken er hentet). F4 vægt/reps-rækken brydes over to linjer ved 390 og 360. F5 offline-sæt er først i køen efter ca. 4 s; lukket fane i vinduet tabte sættet. F6 Fremgang-grafens label klippes ("158 kg e") og skriften er 5–6 px. F7 trykflader 22–38 px i Fremgang og pause-linjen. F8 pause-linjen sidder 5 px (ved stor tekst 24 px) under navigationen.
- **Kosmetisk:** F9 coachens liste hopper til en forældet rulleposition efter Coach Briefing og tilbage. F10–F14 småting.
- **Holdt:** ingen vandret overflow, 281 og 285 holdt i alle prøver (sortering, ind/ud på 3 og 30 atleter, rulleposition), ingen langsomme steder målt (alle interaktioner ≤ 44 ms også ved 4× CPU; Fremgang 330 ms, ikke CPU-bundet), alle tomme tilstande så rigtige ud.

## Testresultat

- `npm run lint`: ren (intet er ændret; kørt efter alle commits).
- Ingen verify-scripts kørt: der er ingen kode at verificere, og ordren siger ingen nye tests. Den ubrudte `proever`-kørsel er Vaidyas (77 af 78, 288-rapporten).
- Min egen gennemgang: 48 skærmbillede-tjek (26 atlet, 22 coach) med automatisk måling af overflow, afskåret tekst, trykflader, overlap og skriftstørrelse, plus seks målrettede prøver (reps-trin, offline og lukket fane, tre-cifret e1RM, stor tekst, tomme tilstande, coach med 0/1/30 atleter). Fundene er set på skærmbillede eller målt direkte; falske alarmer fra overlap-tjekket (indhold under faste bjælker) er sorteret fra.

## Hvad er næste

1. Marc (eller Dhruva) slår Supabase Project Settings → API → Max rows op (F2). Står den på 1000 og har en atlet flere sæt, skal Fremgang hentes anderledes, før den vises for atleterne.
2. F1 rettes af en bygger (én linje, `||` i stedet for `??`) og får en prøve der trykker reps-knappen i sæt 2. Derefter kan main pushes.
3. F3–F8 samles i én "sæt-skærmen på telefon"-ordre efter push; F3, F4 og F5 hører til 280 og bør rettes af den der ejer den.
4. Prøven mangler stadig på en rigtig telefon: se nedenfor.

For Hara (Coaching-planeten, delmål "Appen mærkbart bedre"): kritikerrollen fangede to ting før Marc gjorde, som byggerens egen prøvekørsel var grøn omkring. F1 er den knap 280 er bygget om, og den er forkert fra sæt 2. Mønstret er det samme som i de andre fund: prøverne testede delene hver for sig (`stepReps` alene, Dagens pas uden historik, Fremgang uden mange rækker), ikke det atleten rent faktisk gør. Værdifuldt at gentage før næste push.

## Ærlige grænser

- Headless Chromium mod mock. Ingen rigtig telefon, ingen WebKit/iOS, ingen PWA-tilstand, intet tastatur der åbner sig, ingen produktionsdata, ingen rigtig netlatens. F2 kan jeg kun se i koden.
- F5 er bevist med `page.close()` (fanen dræbes). En rigtig telefon sætter oftere appen på pause end dræber den; om OS'et dræber den i de ca. 4 sekunder har jeg ikke målt.
- Tidsmålingerne har et gulv på ca. 30 ms (to animationsframes), og mocken svarer på millisekunder. De viser at klientsiden ikke er langsom, ikke hvordan det føles på 4G.
- Ikke dækket: coach på iPad/desktop, VideoCoach, check-in, Volumen, beskeder/videoer i coachens rækker, skærmlæser.
- Måle-scripts lå i scratchpad og er ikke committet. Skærmbillederne er mine; de tidligere leverancebilleder i `outputs/` er urørt. `verify:ugen-faar-dato` overskriver som bekendt sporede billeder; jeg kørte det ikke.
