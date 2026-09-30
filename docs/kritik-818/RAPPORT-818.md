Klar til klassen: ja, paa telefon og computer (main, 00ff47d, ordre 812 merget). De tre vigtigste ting Chaturanga retter naeste gang: (1) efter Giv op staar der "Det kommer. Proev igen." under "Du gav op mod niveau 1." - en 11-aarig ved ikke, hvad der kommer (skaerm: Spil, Mod computeren, e4 Nf3 Bc4 Nc3, Giv op, `outputs/kritik-818/360x560-L2b-giv-op-langt-hel.png` og `1280x800-L2-giv-op-langt.png`; fil: `src/partianalyse.js` linje 174; skriv en rigtig raad eller drop linjen); (2) hovedet (titel og to raekker faner) fylder 148 px af 560 paa 360 x 560, saa braettet kun er 304 px bredt (mod 374 paa 390) og vendepunkterne efter et parti ligger 595-655 under kanten (skaerm: `360x560-A3-efter-2-traek.png`; fil: `src/skak.template.html` og `src/styles.css`; kraever Marcs ja til nye fanenavne); (3) skakur-valget "5+0" ligger stadig under kanten paa 360 x 560 (620-688 mod vindue 560), selv om folden nu er aaben af sig selv: barnet skal rulle for at vaelge uret (skaerm: Spil, Mod en makker, `360x560-A1-makker-efter-valg.png`; fil: `src/main.js` `aabnUret` og `src/skak.template.html` `#segment-skakur`; flyt urvalget op i foerste skaerm eller giv det en fast plads over braettet).

## Hvad jeg proevede

Skakken paa `main` (00ff47d, hentet med git archive, kun laest), headless Chromium, ny profil pr. scenarie, 360 x 560, 390 x 844 (touch) og 1280 x 800 (mus). Scripts og udskrifter: `outputs/kritik-818/elevtur-818.mjs`, `laengere-818.mjs`, `*-udskrift.txt`. Spillet: mod computeren (e4/Nf3/Bc4/Nc3, derefter Giv op), makker-parti med ur 5+0 og to traek, Laer skak (Jeg er ny, trin 1) og en gaade. Kun syntetisk. Laest: Chaturangas RAPPORT-812 og -809, ranglisten i `docs/MOD-LICHESS.md` og min kritik 813.

## Kan en 11-aarig komme i gang, og ser hun braettet?

Ja. Paa 360 x 560 ligger braettet 148-452 i alle scenarier, og status ("Hvid traekker."), Fortryd, Hint og Giv op ligger under braettet 459-503, altsaa i foerste skaerm. I makker-parti staar uret som to store knapper "Hvid 5:00" og "Sort 5:00" lige under braettet, og folden hedder "Skakur og valg: ur 5+0" (synlig). Paa 390 er alt i skaermen (braet 228-602, ur-valg 787-839 af 844). Paa 1280 ligger braet og panel side om side uden rulning. Laer skak trin 1 har kort tekst og en groen ring paa e4 (braet 207-487 paa 360 x 560). Gaaden viser "Sort traekker", vendt braet og "Vis et hint". Ingen sidescroll paa nogen stoerrelse.

## Hvad er stadig besvaerligt paa lav telefon

- Hovedet paa 148 px og braettet paa 304 px (fund 2).
- Urvalget (fund 3): at vaelge 5+0 kraever en rulning paa ca. 130 px; bagefter er uret fint synligt.
- Efter Giv op paa 360 x 560 ligger resultatkortet og knapperne i skaermen (455-540), men analysen ligger langt nede (siden er 2153 px hoej), og Spil-kortet nedenunder viser stadig Fortryd, Vis et hint og Giv op paa et afsluttet parti.
- Paa 1280 er aabningsnavnet ("Kongespringerpart...") skaaret af op mod knappen "Hvad spiller man her?" (`1280x800-L2-giv-op-langt.png`, nederst til venstre). Lavt fund.
- "Niveau: 0 af 10" paa gaadeskaermen er uforklaret for en ny elev (`360x560-D1-gaade.png`). Lavt fund.

## Er mine seneste fund lukket? (kritik 813)

- "Du tabte" efter Giv op: lukket ("Du gav op mod niveau 1", 809).
- Overskriften "Vil du se, hvad du kunne have gjort?" over tomt rum: lukket ("Ingen store fejl at vise", 812).
- Urvalget under kanten og folden "Valg: intet ur": delvist lukket. Folden hedder "Skakur og valg" og er aaben, men 5+0-knapperne ligger stadig under kanten paa 360 x 560.
- Hovedet paa 148 px: aabent, venter paa Marc.

## Hvad jeg ikke kunne / graenser

Headless Chromium, ingen rigtig telefon og ingen boern; "en 11-aarig" er mine oejne, ikke en test. 390 x 844 er brugt for 390. Paa 1280 findes strimmel-knapperne ikke, saa scriptet kunne ikke trykke Giv op i makker-partiet der; det er set via det lange parti mod computeren. Computerens svar varierer; "Det kommer. Proev igen." vises kun, naar motoren intet finder. Skakken er ikke aendret. Afleveringen med hoest.mjs blev afvist af tilladelsesklassifikatoren og er ikke koert.

## Hvad er naeste / betydning for Hara

Hara: ingen. Chaturangas "Hvad er naeste" (#29, hovedet, ustabil forklaring) passer med fund 1 og 2; jeg tilfoejer urvalget (fund 3) og de to lave fund.
