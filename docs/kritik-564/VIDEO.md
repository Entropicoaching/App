video i Mål dit billede klar til sitet: ja

# Kritik 564, blok 1: Mål dit billede fra en video (Yantra 560)

Målt på `entropi-loeftmodel-dhruva` main `296b9bf` (merge af 560), hentet med `git archive` til en midlertidig mappe; intet træ er rørt. Siden er `dist/maal-billede/index.html`, som Setu kopierer til sitet. Headless Chromium 151 på 360 og 390 px med touch, 1280 px med mus, og 390 px med 4x langsommere CPU. Alt net uden for `file:`, `data:` og `blob:` er afbrudt.

Dommen er **ja**: videoen bliver på telefonen (0 netkald efter siden er hentet, i alle 4 opsætninger og med alle 7 klip), og hver knap gør det, den siger. De fund, der er, handler om teksten ved "Hop til laveste punkt" og om et HEVC-klip, som browseren ikke kan læse. Ingen af dem giver et forkert tal i målingen.

## Hvad jeg målte

Mine egne syntetiske klip (`outputs/kritik-564/klip-564.mjs`, tegnet i node og kodet med ffmpeg-static; intet klip i repoet):

| klip | format | størrelse |
|---|---|---|
| `sq30.mp4` | H.264, 1080 x 1920 (telefon på højkant), 30 billeder/s, 30 s, ca. 16 Mbit/s | 57,5 MB |
| `sq30.mov` | samme, QuickTime-beholder | 57,5 MB |
| `sq30.webm` | VP9 | 71,1 MB |
| `sq30-60.mp4`, `sq30-25.mp4` | 60 og 25 billeder/s | 61,9 / 55,4 MB |
| `sq30-hevc.mp4` | H.265/HEVC (iPhones "Høj effektivitet"), 10 s | 9,5 MB |
| `sq5-4k.mp4` | H.264, 2160 x 3840, 5 s | 25,8 MB |

Hvert billede har sit nummer skrevet i 11 blokke øverst, så målingen læser præcis hvilket billede siden viser, og hvilket den sender videre. En skive med nav går ned og op i fem squats med kendt bund: "jævn" (ned 1,2 s, op 1,0 s), "hurtig op" (1,5 / 0,8), "grind" (1,0 / 2,2), "pause" (1,3 s ned, 0,6 s pause, 1,0 s op) og "dyk" (0,8 / 1,4). Klippene er valgt med sidens eget filfelt (`setInputFiles`), knapperne trykket med rigtige touch-tryk på telefonen og musen på 1280, skyderen trukket med en finger (CDP-touch). Script: `outputs/kritik-564/video-564.mjs`, 21 af 21 tjek grønne; tallene står i `video-564.json`.

## Privat: bliver videoen på telefonen?

Ja.

- **0 netkald efter siden er hentet** i alle fire opsætninger og med alle andre klip: ikke når klippet åbnes, spoles, trinnes, bruges, lukkes eller åbnes igen. De eneste kald er sidens egne to filer, når den hentes.
- Kilden har ingen `fetch`, `XMLHttpRequest`, `WebSocket` eller `sendBeacon`. Den eneste `localStorage` er en læsning af "Min krop" (nøglen `loeftmodel-min-krop-468`); intet skrives.
- Klippet læses med `URL.createObjectURL`. Jeg har talt objekt-URL'erne i siden: med videoen åben er der én (klippet, 57,5 MB, peger på filen), fotoernes PNG'er frigives, så snart de er læst, og efter **Luk videoen** er der 0.
- Siden og boksen siger det to steder ("Videoen bliver i din browser. Den sendes ingen steder hen, og intet gemmes."). Det holder.

## Skyderen og et billede frem og tilbage

| | 360 | 390 | 1280 | 390, 4x CPU |
|---|---|---|---|---|
| Åbn 30 s MP4 (til skyderen virker) | 96 ms | 78 ms | 237 ms | 837 ms |
| Skyderen til 50 % / 90 % | 15,00 / 27,00 s | 15,00 / 27,00 s | 15,00 / 27,00 s | 15,00 / 27,00 s |
| Skyderen, sekunder pr. px | 0,103 | 0,094 | 0,029 | 0,094 |
| 20 tryk frem fra skyderens sted | 1 billede hver | 1 hver | 1 hver | 1 hver |
| 20 tryk tilbage | 1 billede hver | 1 hver | 1 hver | 1 hver |
| Tryk til billedet står (median / maks.) | 89 / 161 ms | 94 / 155 ms | 207 / 494 ms | 94 / 160 ms |

- Alle synlige knapper og skyderen i videoboksen er 44 px høje (◀ 1 billede og 1 billede ▶ 102 x 44, Brug dette billede 151 x 44, Klik navet 158 x 44, Hop til 166 x 44). Ingen vandret rulning.
- Når **1 billede ▶** står nederst på skærmen, ses hele videoen (100 %). På en rigtig telefonhøjde (360 x 640 og 390 x 664, adresselinjen fratrukket) står navet i squattens bund og knappen **Klik navet i videoen** 332-337 px fra hinanden, altså på én skærm.
- **Første tryk fra 0,00 s flytter intet** (V4): 0 + 1/30 afrundes til 0,033 s, som er før billede 1 (0,0333 s). Derefter 1 billede pr. tryk. Det samme sker fra ethvert tidspunkt præcis på et billedes start (i MOV og 4K efter min søgning til 2,00 s). Fra skyderens sted sker det ikke.
- Tiden ved knapperne passer med billedet (0,66 s viser billede 19).

## Brug dette billede

Fotoet i klik-trinnet er **præcis det viste billede** i alle 12 forsøg (billede 96, 255 og 744 på fire opsætninger), i videoens egne pixels (1080 x 1920), og navnet siger hvor: "sq30.mp4, 3,20 s". Billedeboksen er synlig bagefter. Tid fra tryk til foto: 85-127 ms på telefonen, 118-170 ms på 1280, 359-505 ms med 4x CPU. Samme klip kan åbnes igen efter **Luk videoen**, og fotoet bliver stående, når videoen lukkes.

## Fase-hjælpen og Hop til laveste punkt

Sætningen skifter med fasen (fx "**Squat bund:** Hofterne lavest: billedet lige før stangen vender i bunden."), og hop-boksen står kun i squat og bænk, ikke i dødløftet. Navets klik tegnes som ringe oven på videoen (`V-390-4-hop.png`).

Hop til med to klik i 15 % af dybden over bunden, ét på vej ned og ét i samme højde på vej op:

| squat | ned / op (s) | hop landet (billeder fra bunden) | regnet over 54 klikpar* | rådet "gå et billede eller to tilbage" |
|---|---|---|---|---|
| jævn | 1,2 / 1,0 | -1 | median -1 (-3 til 0) | gør det værre i 87 % |
| hurtig op | 1,5 / 0,8 | -4 | median -4 (-8 til -1) | gør det værre i 100 % |
| grind | 1,0 / 2,2 | +6 | median +7 (+2 til +11) | hjælper i 100 %, men 1-2 er for lidt |
| pause | 1,3 / 0,6 / 1,0 | 0 | 0 | ikke brug for |
| dyk | 0,8 / 1,4 | +4 | median +3 (0 til +6) | hjælper i 98 % |

\* Klikhøjder 5, 10, 15, 20, 30 og 40 % over bunden, og brugerens "samme højde" 1 billede ved siden af på hver side; regnet med Yantras egen `lavestePunkt`. Ens på 360, 390, 1280 og 4x CPU.

- **Rådet peger den forkerte vej, når opturen er hurtigst** (V1). Er opturen hurtigere end nedturen, krydser stangen klikhøjden hurtigere på vej op, og midten i tid ligger *før* bunden; det rigtige billede er *efter*. Teksten siger det modsatte: "opturen er tit hurtigere end nedturen, så gå et billede eller to tilbage". I Yantras egen testvideo var opturen langsomst (1,1 s ned, 1,3 s op), og der passer rådet. Samme sætning står i vejledningen og i kommentaren i `src/maalVideo.js`.
- **Tre eller fem klik hjælper ikke** (parabel): "hurtig op" -5 og -5, "grind" +7 og +8. Parablen er symmetrisk, så klik i samme højder giver samme midte.
- **Hvad det koster:** i mine squats står navet stille i bunden, så 4-7 billeder ved siden af er ca. 1 % af dybden (under 1 cm i en squat på 60 cm), langt under sidens 1,5 cm i sticking point. Men en rigtig squat med hurtig vending (eller bænkens berøring af brystet) har fart i bunden; ved 0,5 m/s er 4 billeder ca. 7 cm. Det har jeg ikke målt.

## Tid og hukommelse

Browserens processer tilsammen (privat hukommelse), JS-heap og objekt-URL'er:

| | tom side | video åben | efter 3 x Brug | efter Luk videoen |
|---|---|---|---|---|
| 360 | 93 MB | 182 MB | 268 MB | 151 MB |
| 390 | 93 MB | 184 MB | 276 MB | 154 MB |
| 1280 | 99 MB | 185 MB | 252 MB | 128 MB |
| 390, 4x CPU | 91 MB | 182 MB | 307 MB | 172 MB |

JS-heap 2,5-7 MB hele vejen; videoen ligger ikke i JavaScript. 4K (2160 x 3840): 581-617 MB med video og ét foto, 127-171 MB efter Luk. Med 4x CPU: siden hentes på 2,9 s, klippet åbnes på 0,8 s, et tryk tager 94-167 ms, Brug dette billede 359-505 ms (1080p) og 1,43 s (4K). Det virker på en ældre telefon, men se grænserne: CPU-bremsen rammer ikke videoafkoderen.

## Andre klip

| klip | åbnes | tryk frem (billeder) | Brug rigtigt billede | Brug (ms) |
|---|---|---|---|---|
| MOV | 80 ms | 0 1 1 1 ... | ja | 166 (557 med 4x) |
| VP9 webm | 59 ms | 1 0 1 1 ... | ja | 158 |
| 60 billeder/s | 65 ms | 1 2 2 2 ... | ja | 198 |
| 25 billeder/s | 95 ms | 0 1 1 1 1 0 1 1 1 1 1 0 | ja | 168 |
| 4K | 313 ms | 0 1 1 1 ... | ja | 369 (1433 med 4x) |
| HEVC | **15,0 s**, så "Videoen kunne ikke læses i denne browser. Prøv en MP4 eller MOV fra telefonen, eller tag et skærmbillede." | | | |

- 60 og 25 billeder/s opfører sig, som Yantra skriver (hvert andet billede springes over; hvert 5.-6. tryk viser samme billede). Men Yantras råd "brug skyderen" til de oversprungne billeder virker ikke på en telefon: skyderen er 0,094-0,103 s pr. px, altså 3 billeder ved 30/s og 6 ved 60/s pr. pixel (V5).
- **HEVC:** headless Chromium kan ikke afkode det, og siden venter på `loadedmetadata` i hele sin tidsgrænse på 15 s, før beskeden kommer (V2). Der lyttes ikke på videoens `error`. En iPhone filmer i HEVC som standard; Safari på iPhonen kan afspille det, men en coach, der får klippet til Chrome på Windows eller Android uden HEVC, ser 15 s uden svar.

## Fund

| id | alvor | fund |
|---|---|---|
| V1 | lav | Hop-teksten efter to klik ("opturen er tit hurtigere end nedturen, så gå et billede eller to tilbage") er logisk vendt: hurtigere optur betyder, at det rigtige billede er *efter* hoppet. I "jævn" og "hurtig op" gør rådet det værre (87 og 100 %). Vejledningen og `src/maalVideo.js` siger det samme. Højdefejlen er lille i mine squats (ca. 1 % af dybden). |
| V2 | lav | HEVC-klip, som browseren ikke kan afkode: 15 s uden svar, før beskeden kommer. Et `error`-lyt på videoen ville give beskeden med det samme. |
| V3 | lav | Parablen med tre eller flere klik rammer ikke bedre end to klik, når klikkene er i samme højder (-5 i "hurtig op", +7/+8 i "grind"). Vejledningen lover "en bue gennem dem og hopper til dens bund", hvilket er sandt, men ikke bedre. |
| V4 | lav | Første tryk på 1 billede ▶ fra 0,00 s (eller fra et billedes præcise start) flytter intet, fordi trinet afrundes til 0,033 s. |
| V5 | lav | "Brug skyderen" til de billeder, 1 billede springer over i 60 billeder/s, kan ikke lade sig gøre på en telefon: én pixel på skyderen er 3-6 billeder. |
| V6 | lav | "Store klip (4K) giver store PNG'er i hukommelsen; ikke målt": nu målt headless, 581-617 MB for browseren med 4K-klip og ét foto (1080p: 250-310 MB), Brug dette billede 1,4 s med 4x CPU. Ikke målt på en rigtig telefon. |

Ingen middel eller høj. Intet af det gør et tal i målingen forkert; V1 og V3 koster højst et par tryk mere.

## Ærlige grænser

- **Headless Chromium på Windows, ikke en telefon.** Ingen iOS Safari, ingen Android Chrome og intet rigtigt telefonklip. Mine klip er tegnede og kodet af ffmpeg med en telefons bitrate og korn, ikke optaget af en telefon (ingen variabel billedrate, ingen rotationsmærke, ingen lyd).
- **4x CPU er Chromes CPU-bremse.** Den bremser sidens JavaScript og tegning, ikke videoafkoderen eller hukommelsen; en ældre telefon kan afkode 1080p og 4K langsommere, end jeg har målt.
- **Hukommelsen** er browserens processer tilsammen på en pc (privat hukommelse fra Windows), ikke en telefons grænse for en fane.
- **Hop til** er målt på fem syntetiske squats med stille bund (sinus ned, cosinus op). En rigtig squat med fart i vendingen og bænkens berøring er ikke målt; der kan de samme billeder være flere cm.
- Navet er trykket præcis, hvor klippet tegnede det; to-klik-hoppet bruger kun tiderne, så det betyder ikke noget her.
