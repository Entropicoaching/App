Ordre 564: to kritikker, Mål dit billede fra en video (Yantra 560) og Marcs valg-side i matematik (Ganita 557) (Bhishak)

Planet: coaching. Spor: spor-kropsmodel-til-teknikfeedback-i-de-tre-loeft-fb7bd5.

**Domme:** video i Mål dit billede klar til sitet: **ja**. Marc kan vælge ud fra siden: **ja**.

## Gren

`kritik-564` fra `main` (`c8104ee`). Ingen push, ingen merge, ingen sub-agenter. Kun filer under `docs/kritik-564/` og `outputs/kritik-564/`. Løftmodellen (`entropi-loeftmodel-dhruva` main `296b9bf`) og matematik (main `af963d8`) er hentet med `git archive` til midlertidige mapper; ingen af træerne og ingen skrivebordsfil er rørt.

- `c611c9b` kritik 564 blok 1: Mål dit billede fra en video
- blok 2: Marcs valg i matematik, verificering og denne rapport (hashen står i `git log`; den kan ikke stå i sin egen commit)

## Hvad ændret

Intet i appen. Nye filer:

- `docs/kritik-564/VIDEO.md`: blok 1, dom i første linje, fund V1-V6.
- `docs/kritik-564/MATEMATIK-VALG.md`: blok 2, dom i første linje, fund N9-N12.
- `outputs/kritik-564/klip-564.mjs`: mine syntetiske klip (tegnet i node, kodet med ffmpeg-static til `%TEMP%`; intet klip i repoet): 30 s H.264 1080 x 1920 (57,5 MB), MOV, VP9, 60 og 25 billeder/s, HEVC og 4K. Hvert billede har sit nummer i blokke øverst, og en skive med nav laver fem squats med kendt bund.
- `outputs/kritik-564/video-564.mjs` + `video-564.json` + `V-*.png`: blok 1 headless.
- `outputs/kritik-564/valg-564.mjs` + `valg-564.json` + `M-*.png`: blok 2 headless og mod koden.
- `outputs/kritik-564/verify-kritik-564.mjs`: `--blok 1` og `--blok 2`.

**Blok 1, kort:** videoen bliver på telefonen (0 netkald efter siden er hentet, alle opsætninger og klip; objekt-URL'erne frigives ved Luk videoen). Et 30 s klip åbnes på 78-237 ms (837 ms med 4x CPU), skyderen rammer, 1 billede frem og tilbage flytter præcis 1 billede, alle knapper er 44 px, og Brug dette billede giver præcis det viste billede (85-170 ms; 359-505 ms med 4x). Browseren bruger 182-185 MB med videoen åben og 252-307 MB efter tre fotos (4K: 581-617 MB). Fund, alle lave: V1 rådet efter Hop til ("gå et billede eller to tilbage") er vendt, når opturen er hurtigst; V2 HEVC giver 15 s uden svar; V3 parablen er ikke bedre end to klik; V4 første tryk fra 0 s flytter intet; V5 skyderen kan ikke nå de oversprungne billeder i 60 billeder/s; V6 4K-hukommelsen.

**Blok 2, kort:** M2 og N1 er forklaret i almindeligt sprog; alle syv muligheder siger, hvad eleven mærker; N6 (titlen forsvinder) og N7 (Hjerte starter på 1) står tydeligt; forslaget er mærket. Et tal pr. valg passer med koden (1-1-1, 7-1-1, niveau 5 med et halvt i vente, titler 3/5/8/11, halvt niveau for hjælp, Bigårdens og Hans' krav). Fund: N9 middel (M2 A og A0 siger ikke, hvad der sker med tallene hos elever, der allerede spiller), N10-N12 lav.

## Testresultat

- `node outputs/kritik-564/video-564.mjs`: **21 af 21** (dhruva `296b9bf`), 360 og 390 med touch, 1280 med mus, 390 med 4x CPU, og 360 x 640 / 390 x 664 som rigtig telefonhøjde. 0 netkald efter siden er hentet, 0 JS-fejl.
- `node outputs/kritik-564/valg-564.mjs`: **20 af 20** (matematik `af963d8`), 360 og 390 lyst, 390 mørkt, 1280.
- `node outputs/kritik-564/verify-kritik-564.mjs --blok 1`: grøn (før commit 1).
- `node outputs/kritik-564/verify-kritik-564.mjs --blok 2`: grøn (før commit 2).
- `npm run lint`: grøn.

## Hvad er næste

**Yantra** (løftmodellen, lille ordre): vend sætningen efter to klik i Hop til (V1): er opturen hurtigere end nedturen, ligger det rigtige billede *efter* hoppet, så "gå et billede eller to frem"; bedst "tjek et par billeder til begge sider". Ret samme sætning i vejledningen (`index.html`) og kommentaren i `src/maalVideo.js`, og tilføj en testvideo med hurtigere optur. Lyt på videoens `error`, så et HEVC-klip, som browseren ikke kan læse, får beskeden med det samme i stedet for efter 15 s (V2). Start trinene fra billedets midte, så første tryk fra 0 s flytter (V4), og fjern "brug skyderen" om 60 billeder/s eller sig, at det kun går på en computer (V5). Setu kopierer `dist/maal-billede/` igen bagefter. Det, jeg ikke kunne måle, bør Marc tjekke med et rigtigt klip: iPhone (HEVC/MOV) og Android (MP4) i Safari og Chrome på telefonen, og Hop til på en rigtig squat med hurtig vending.

**Ganita** (matematik, kun siden): skriv under M2 A og A0, hvad der sker med tallene hos en elev, der allerede spiller (N9): regnes Hoved, Hånd og Hjerte om, eller tæller de videre, og falder et tal; ét ord om A0's Hjerte 1 til 0. Flyt "Mit forslag" til "Ganitas forslag", sæt grundene fra den lange udgave ind i én linje pr. valg, og brug et neutralt eksempel i svarformen (N10). Forklar "mestret" og fjern agentnavnene eller sig, hvem de er (N11). Sig, hvilket tal der stiger hvor, og at niveauerne er én kørsel (den travle 7-9 over fire terninger) (N12). Ingen regelændring før Marc har svaret.

**Marc:** siden kan bruges til at vælge nu. Vælger du M2 A eller A0, så sig samtidig, om tallene skal regnes om for dem, der allerede spiller.

**Hara (Coaching, "Appen mærkbart bedre"):** video-vejen i Mål dit billede er klar til sitet og holder løftet om, at klippet bliver på telefonen. Det gør det lettere for atleter at få feedback fra deres egne klip uden skærmbilleder.

## Ærlige grænser

- Blok 1 er headless Chromium på Windows med mine syntetiske klip, ikke en telefon og ikke et rigtigt telefonklip. iOS Safari og Android Chrome er ikke målt. 4x CPU er Chromes CPU-bremse; den bremser ikke videoafkoderen. Hukommelsen er browserens processer på en pc.
- Hop til er målt på fem syntetiske squats med stille bund; en rigtig vending med fart og bænkens berøring er ikke målt.
- Blok 2 er læst af mig, ikke af en lærer. Tallene mod koden er ét pr. valg; A, A+, B og C er ikke bygget, så hvad eleven mærker, er sidens forudsigelse. Elev-tallene er min model-elev fra kritik 552.
- Ingen rigtige atleter, elever eller klip; intet pushet, intet merget.
