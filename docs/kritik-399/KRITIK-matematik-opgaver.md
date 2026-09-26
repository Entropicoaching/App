# Kritik: hvorfor er matematikopgaverne "lidt spøjse"? (ORDRE 399)

Marc (26. sep): "ser også bedre ud, synes opgaverne er sådan lidt spøjse, men det er klar forbedring."

Jeg har genereret 1262 opgaver med spillets egne generatorer (`QUEST_BANK.lavOpgaver` i matematik
`main` @ `e662c66`, kopi via `git archive`). Det er 30-36 pr. opgavetype på alle seks steder, og
jeg har læst dem som lærer i 4.-6. klasse og som elev. Alle opgaver står med dom i
`outputs/kritik-399/opgaver.txt`. **799 af 1262 (63 %) har mindst én spøjshed.** Fjerner man de to
lette fund ("svaret står uden enhed" og "kun hele timer"), er det stadig 769 (61 %).

Kort sagt er regnestykkerne fagligt rigtige, og hintene er gode. Det spøjse ligger i
**historien omkring tallene**:

- de samme sætninger kommer igen og igen,
- ting i landsbyen har størrelser, der ikke passer til hinanden (en sporvognstur på 6 timer, et
  spor på 1 cm og 9 mm),
- brøkerne står i historien, som ingen ville sige dem ("2/4 sæk", "3/9 sæk", "1/7 sæk"),
- nogle historier giver ingen mening (købmanden deler sine penge ud til kunderne, møllen sender
  korn *ud* til gårdene).

Kodeplaceringerne herunder er i matematik-repoet, `main` @ `e662c66`.

---

## De fem fund, der fjerner mest spøjshed for eleven

### M-SP1: Sporvognen kører i timevis og kun på hele klokkeslæt

- **Hvad:** 108 af 108 regneopgaver ved Sporvognen (ankomst, turens længde, baglæns) siger
  "Turen tager 2-7 timer", og alle tider er hele timer (`kl. 13:00`). En sporvogn i sognet kører
  ikke 5 timer. Grusgravens enhedsopgave siger selv, at sporvognens tur er 8-15 km, så eleven kan
  regne sig frem til 2 km i timen. Hele timer er desuden 2.-3.-klasses stof; i 4.-6. klasse regner
  man med minutter.
- **Kode:** `src/spil-quest.js:135-183` (`tidTekst`, `ankomstOpgave`, `sejltidOpgave`,
  `afgangTilbageOpgave`; `sejltid = heltalMellem(rng, 1 + sværhed, 3 + sværhed)` i timer).
- **Før:** "Sporvognen afgår fra holdepladsen kl. 13:00. Turen tager 4 timer. Hvad er klokken, når
  sporvognen når frem?"
- **Nu:** "Sporvognen kører fra holdepladsen kl. 13.40. Turen til kirken tager 25 minutter. Hvad er
  klokken, når den er fremme?" (svar kl. 14.05; forkerte svar: 13.65 og 14.25).
- **Regel til Ganita:** turen er 10-50 minutter, klokkeslæt i 5-minutters spring, og mindst hver
  anden opgave går over en hel time. Klokkeslæt skrives med punktum (kl. 14.05), som i dansk
  skrivebrug.

### M-SP2: Købmanden (og Kirkens gamle opgaver) er ét stift regnestykke uden enhed og uden mening

- **Hvad:** Alle 90 opgaver hos Købmanden og 180 af Kirkens 288 er spøjse. Der er tre skabeloner
  med ét tal skiftet ud:
  - "Købmanden sælger æbler for N kr stykket".
  - "Købmanden har N kr, som skal deles ligeligt mellem N kunder". Det er U1 og U4: en købmand
    deler ikke sine penge ud til kunderne.
  - "Der ankommer N kasser med N varer i hver". "Varer" er ikke noget, man tæller, og
    "den største leverance i år" er 35 varer.

  Svarene står uden kr eller m ("24", ikke "24 kr"), selvom Grusgraven lærer eleven, at enheden
  hører til svaret. Forklaringen skriver "6 æbler á 4 kr" med forkert accent; på dansk hedder det
  "à" (U3, `src/spil-quest.js:98`). I hele spillet findes kun 12-30 forskellige opgaver af hver slags, så eleven
  møder de samme igen (U6). Kirkens areal og omkreds er de gamle opgaver fra før 393, med
  "En anden grusplads" uden en første og svar uden m og m².
- **Kode:**
  - `src/spil-quest.js:18-24` (`heltalSvarmuligheder` sætter ingen enhed på).
  - `src/spil-quest.js:88-128` (`prisOpgave`, `delHandelOpgave`, `kasseOpgave`).
  - `src/spil-quest.js:36-58` (`arealOpgave`, `omkredsOpgave` i Kirkens blanding).
  - `src/spil-quest.js:222` (`LANDSBY_POOL`).
- **Før:** "Købmanden har 30 kr, som skal deles ligeligt mellem 6 kunder. Hvor mange kr får hver
  kunde?" (svar: 5 / 30 / 6)
- **Nu:** "Seks børn køber en pose bolsjer sammen for 30 kr. De betaler lige meget hver. Hvor meget
  skal hver betale?" (svar: 5 kr / 6 kr / 24 kr).
- **Før:** "Der ankommer 4 kasser med 6 varer i hver. Hvor mange varer er der i alt?"
- **Nu:** "Købmanden får 4 kasser æg med 6 bakker i hver. Hvor mange bakker er det?"
- **Regel til Ganita:** Købmanden får 3-4 skabeloner pr. type (varer, priser, byttepenge), og alle
  svar bærer enheden. Kirkens areal og omkreds tager Grusgravens nye generatorer (trin 4-5, med
  enhed og hint) i stedet for de gamle.

### M-SP3: Møllens brøker står i historien, som ingen ville sige dem

- **Hvad:** 177 af Møllens 318 opgaver er spøjse. De almindeligste grunde:
  - Brøker i selve historien, der ikke er forkortede eller er skæve (U2): "2/4 sæk eller 2/5 sæk",
    "Mølleren havde 3/9 sæk mel", "fylder 1/7 sæk korn om morgenen", "2/4 af dem skal til
    bageren". En lærer siger "en halv sæk", og ingen deler en melsæk i syvendedele.
  - Næsten hver sætning begynder med "Mølleren har/havde … sæk" (U6).
  - "Forlænge" spørger om poser, men vil have en brøk (U4): "Han hælder det i små poser, der hver
    rummer 1/9 sæk. Hvilken brøk er lige så meget som 2/3?" Barnet vil svare "6 poser".
  - "Skriv brøken så kort som muligt" er ikke skolesprog (U3).
- **Kode:**
  - `src/broek-trappe.js:163-205` (`sammenligningOpgave`)
  - `src/broek-trappe.js:211-250` (`lignendeBroekOpgave`: tekst 223 og 244; distraktoren "lagt d til" i 228)
  - `src/broek-trappe.js:263-310` (`sammenlaegning`, `fratraekning`: tekst 273 og 299)
  - `src/broek-trappe.js:322-350` (`broekAfMaengdeOpgave`: tekst 348)
  - `src/broek-trappe.js:367-420` (`forskelligeNaevnereOpgave`)
  - `src/broek-trappe.js:451` (`blandetTalOpgave`: "Mølleren har 11/8 sæk mel")
- **Før:** "Mølleren havde 3/9 sæk mel og solgte 1/9 sæk. Hvor meget har han tilbage?"
- **Nu:** "Mølleren havde 5/8 sæk mel og solgte 3/8 sæk til bageren. Hvor meget er der tilbage?"
- **Før:** "Mølleren har 2/3 sæk mel. Han hælder det i små poser, der hver rummer 1/9 sæk. Hvilken
  brøk er lige så meget som 2/3?"
- **Nu:** "Mølleren har 2/3 sæk mel. Han hælder det i poser, der hver rummer 1/9 sæk. Hvor mange
  niendedele sæk er det? Skriv det som en brøk." (svar 6/9)
- **Regel til Ganita:**
  - Brøkerne, der *står i historien*, er altid forkortede, og nævnerne er 2, 3, 4, 5, 6, 8, 10
    eller 12. Uforkortede brøker hører kun hjemme i svarene.
  - Mindst tre personer eller ting skifter som grundled: Mølleren, mølledrengen, bageren, poserne
    og brødet.
  - I "blandede tal" skal det være noget, man kan have mere end en hel af, fx "11 ottendedels
    poser".

### M-SP4: Møllens to første trin er historier, der ikke hænger sammen, og svaret er forkortet, før eleven har lært det

- **Hvad:** Trin 1 og 2 er det første, en ny elev ser.
  - "Kværnhjulet er delt i 4 lige store felter, og 2 er malet" (U1). Ingen maler felter på et
    kvaernhjul. Det sker i 41 af 72 opgaver af typen.
  - "Mølleren deler 2 sække korn ligeligt mellem 4 gårde" (U1). Gårdene kører korn TIL møllen, og
    møllen leverer mel, ikke korn. Det gælder alle 60.
  - Med 1 sæk hedder det "1 sække" og "de 1 sække" i forklaring og hint (U3).
  - Typen har kun 14 forskellige opgaver i hele spillet (Kirken: 5), så eleven får de samme igen
    (U6).
  - Svaret står forkortet i 25 opgaver. Eleven tæller 4 af 8 og ser kun "1/2" blandt svarene,
    selvom forkortning først kommer på trin 4 (U4).
  - Stangen `■■■■□□□□` tegnes med en stor fyldt og en lille tom firkant, fordi skrifttypen har to
    størrelser. Det ses i `outputs/kritik-399/korn/mobil-svar1-250ms.png` (U7).
- **Kode:**
  - `src/broek-trappe.js:96-100` (`HELHEDER`: "Kværnhjulet er delt i … er malet")
  - `src/broek-trappe.js:108` (stangen)
  - `src/broek-trappe.js:125` og `src/broek-trappe.js:152` (`vis: rng() < 0.5 ? raa : facit`)
  - `src/broek-trappe.js:135-160` (`delOpgave`: tekst 144 har `sæk${saekke === 1 ? "" : "ke"}`, men hint og forklaring
    i 152-157 skriver altid "sække")
- **Før:** "Kværnhjulet er delt i 6 lige store felter, og 2 er malet: ■■□□□□. Hvor stor en del af
  hjulet er malet?"
- **Nu:** "Bageren har skåret en plade kage i 6 lige store stykker. 2 er spist: ■■□□□□. Hvor stor
  en del af kagen er spist?"
- **Før:** "Mølleren deler 1 sæk korn ligeligt mellem 3 gårde." Hintet siger: "… én del fra hver
  af de 1 sække."
- **Nu:** "Mølleren deler 2 sække mel ligeligt mellem 3 bagere. Hvor meget mel får hver bager?"
  Ved 1 sæk: "… én del af sækken."
- **Regel til Ganita:**
  - På trin 1-3 vises svaret altid, som eleven har talt det (`vis: raa`).
  - Stangen tegnes med to tegn af samme størrelse, fx ▰▱, eller som små SVG-felter.
  - Delopgaven får mindst 4 skabeloner (mel til bagere, brød til gårde, kage, æbler), så der er
    over 30 forskellige.

### M-SP5: Grusgravens mål passer ikke til hinanden, og hintene har småfejl i sproget

Grusgraven er det bedste sted, fordi måletrappen fra 393 er skrevet med omhu: 69 af 212 er spøjse
(33 %). Men dét, der er tilbage, springer i øjnene:

- **"Tipvognens spor er 1 cm og 9 mm"** (U5). Et spor til en tipvogn på 2 cm. Kode:
  `src/maale-trappe.js:195-203`. Når `o` er cm→mm, genbruges tipvognens spor.
- **"En sten starter ikke ved 0"** i hintet om *den* sten, eleven lige har læst om. Det skal være
  "Stenen starter" (U3). Det sker i 41 opgaver. Kode: `src/maale-trappe.js:61` og `81`
  (`${t.navn}` er "En sten" og bruges både i opgaven og i hintet).
- **"Omregn til samme enhed: 390 cm = 390 cm"** (U3). Det sker i 45 opgaver, fordi der altid er
  ét stykke i cm. Kode: `src/maale-trappe.js:241`.
- **"ligger på linealen fra 0 og ender …"** (U3). Der mangler "0-stregen" eller "nul". Kode:
  `src/maale-trappe.js:85` (`const fra = s === 2 ? "fra 0" : …`), brugt i 90.
- **"En grusplads er 8 m lang og 300 cm bred"** (U1). Ingen måler den ene side i m og den anden i
  cm. Kode: `src/maale-trappe.js:289`.
- **"Gruspladsen er 2 m lang i virkeligheden"** i målestok, men 30-90 m i de andre opgaver og
  "30-50 m" i enhedsopgaven (U5). Kode: `src/maale-trappe.js:374-392` (`virkM` ved 1:100).

Før og nu:

- **Før:** "Tipvognens spor er 1 cm og 9 mm. Hvor mange mm er det i alt?"
- **Nu:** "Et søm i skuret er 4 cm og 5 mm langt. Hvor mange mm er det?"
- **Før** (hint): "En sten starter ikke ved 0, men ved 1 cm-stregen."
- **Nu:** "Stenen starter ikke ved 0, men ved 1 cm-stregen."
- **Før** (hint): "Omregn til samme enhed: 390 cm = 390 cm, men 5100 mm = 510 cm."
- **Nu:** "Omregn til samme enhed: 5100 mm = 510 cm, og det er mere end 390 cm."

Regel til Ganita: `LINEAL_TING` får en bestemt form (`den`: "Stenen"), og hintet bruger den.
Omregning fra cm til mm bruger en lille ting (søm, blyant), ikke sporet. Målestok ved 1:100 bruger
skuret eller vognen (2-9 m), ikke gruspladsen.

---

## Det levende: forstyrrer kornene "Rigtigt!"-teksten? (Ganita 395)

**Ja, præcis når teksten siger noget vigtigt.** Målt headless: spillets `spil.html` fra `main`,
390×844 med touch og 1280×800, tre rigtige svar i Møllens forløb 1, prøve hver 25. ms i 0,9 s.
Kornenes kasser er målt mod tekstens egen glyf-kasse (Range), ikke hele det grønne felt. Script:
`outputs/kritik-399/korn-maaling.mjs`, tal i `outputs/kritik-399/korn/maaling.json`.

| Visning | Besked | Tid med korn oven på teksten | Flest korn på teksten samtidig |
|---|---|---|---|
| mobil | "Rigtigt! 4/6 kan også skrives 2/3." | **0,70 s** (84-761 ms) | **7** |
| mobil | "Rigtigt!" | 0 s | 0 |
| mobil | "Rigtigt!" | 0 s | 0 |
| desktop | "Rigtigt! 4/6 kan også skrives 2/3." | 0,10 s (650-726 ms) | 1 |

Kornene springer fra *midten af det grønne felt* (`src/spil-app.js:141-144`: `x0 = rekt.left +
rekt.width / 2`). Det giver to fejl:

1. **Ved den lange ros** ligger midten inde i teksten. På mobilen dækker kornene netop "også" og
   "2/3" i 0,7 s (`outputs/kritik-399/korn/mobil-svar1-250ms.png`). Det er den ene sætning i
   beskeden, der lærer eleven noget. Rosen kommer ved 56 af Møllens 318 opgaver (18 %) og ved 24
   af 36 i forløb 4 ("Samme mel, nye poser").
2. **Ved den korte "Rigtigt!"** ligger midten i tomt felt. Kornene springer fra ingenting midt i det
   grønne og ikke fra ordet (`mobil-svar2-80ms.png`). Det forstyrrer ikke, men det ser tilfældigt
   ud.

**Forslag:** kornene springer fra enden af ordet "Rigtigt!" (glyf-kassen for det første ord) og
kun opad-til-højre, væk fra resten af teksten. Når beskeden har en ros eller et hint, springer de
fra "+10"-mærket under beskeden i stedet.

---

## Tabeller pr. sted

Andel spøjse = opgaver med mindst ét U-mærke. U-typer: U1 unaturlig sammenhæng, U2 mærkelige tal,
U3 unaturligt dansk, U4 historie og regnestykke passer ikke, U5 enheder og størrelser uden mening,
U6 gentagelse, U7 andet. Alle eksempler er ordrette fra `outputs/kritik-399/opgaver.txt`.

### Møllen (318 opgaver, 192 spøjse = 60 %)

| Opgavetype | Opgaver | Andel spøjse | Hyppigste U |
|---|---|---|---|
| del-af-helhed (trin 1) | 36 | 67 % | U1 (19), U4 (7) |
| del (trin 2) | 30 | 100 % | U1 (30), U6 (30), U4 (6), U3 (4) |
| sammenlign (trin 3) | 36 | 50 % | U2 (18) |
| lignende (trin 4) | 36 | 100 % | U4 (24), U3 (12), U7 (8) |
| sammenlaeg (trin 5) | 36 | 75 % | U2 (27) |
| traek-fra (trin 5) | 36 | 72 % | U2 (26) |
| af-maengde (trin 6) | 36 | 28 % | U2 (10) |
| faelles-naevner (trin 7) | 36 | 19 % | U2 (7) |
| blandet (trin 8) | 36 | 39 % | U1 (14) |

**del-af-helhed**
1. "Kværnhjulet er delt i 4 lige store felter, og 2 er malet: ■■□□. Hvor stor en del af hjulet er
   malet?" (U1)
   - Nu: "Bageren har skåret en kageplade i 4 lige store stykker, og 2 er spist: ■■□□. Hvor stor
     en del af kagen er spist?"
2. "Mølleren har delt sin mark i 8 lige store stykker, og 4 er sået: ■■■■□□□□. Hvor stor en del
   af marken er sået?" Svar: 4/4, **1/2**, 8/4 (U4).
   - Nu: samme tekst, men svarene er **4/8**, 4/4 og 8/4. Forkortningen kommer på trin 4.
3. "Kværnhjulet er delt i 10 lige store felter, og 5 er malet: ■■■■■□□□□□." (U1)
   - Nu: "Mølleren har 10 sække på vognen, og 5 er fyldt med mel: ■■■■■□□□□□. Hvor stor en del af
     sækkene er fyldt?"

**del**
1. "Mølleren deler 2 sække korn ligeligt mellem 4 gårde. Hvor meget korn får hver gård?" (U1, U6)
   - Nu: "Mølleren deler 2 sække mel ligeligt mellem 4 bagere. Hvor meget mel får hver bager?"
2. "Mølleren deler 1 sæk korn ligeligt mellem 3 gårde." Hint: "… én del fra hver af de 1 sække."
   (U3, fra Kirkens udgave)
   - Nu: hint "Del sækken i 3 lige store dele. Hver bager får én del."
3. "Mølleren deler 2 sække korn ligeligt mellem 4 gårde." Svar: 4/2, **1/2**, 1/4 (U4, U1)
   - Nu: svaret **2/4**, som eleven har regnet sig frem til. Forkortningen står i
     forklaringen.

**sammenlign**
1. "Hvilken portion er størst: 2/4 sæk eller 2/5 sæk?" (U2)
   - Nu: "Hvilken portion er størst: 2/3 sæk eller 2/5 sæk?"
2. "Om mandagen malede mølleren 1/6 sæk, om tirsdagen 4/6 sæk. Hvilken dag malede han mest?" (U2)
   - Nu: "Om mandagen malede mølleren 1/6 af sækken, om tirsdagen 5/6. Hvilken dag malede han mest?"
3. "Hvilken portion er størst: 2/4 sæk eller 2/6 sæk?" (U2)
   - Nu: "Bageren kan få 3/4 sæk fra den ene mølle eller 3/5 sæk fra den anden. Hvor får han mest?"

**lignende**
1. "Mølleren har 2/3 sæk mel. Han hælder det i små poser, der hver rummer 1/9 sæk. Hvilken brøk er
   lige så meget som 2/3?" (U4)
   - Nu: "… Hvor mange niendedele sæk er det? Skriv det som en brøk."
2. "Mølleren har 1/6 sæk mel. Han hælder det i små poser, der hver rummer 1/18 sæk." Svar: 1/18,
   3/18, **13/18** (U4, U7: 13/18 vælger ingen)
   - Nu: 1/18, 3/18 og **3/6**. Det sidste er den typiske fejl, hvor eleven kun ganger tælleren.
3. "Mølleren har skrevet 6/10 sæk i regnebogen. Skriv brøken så kort som muligt." (U3)
   - Nu: "Mølleren har skrevet 6/10 sæk i regnebogen. Forkort brøken så meget som muligt."

**sammenlaeg**
1. "Mølleren fylder 1/7 sæk korn om morgenen og 2/7 sæk mere om eftermiddagen. Hvor meget har han
   fyldt i alt?" (U2)
   - Nu: "Mølledrengen fylder 1/8 sæk mel om morgenen og 3/8 sæk om eftermiddagen. Hvor meget har
     han fyldt i alt?"
2. "Mølleren fylder 2/7 sæk korn om morgenen og 3/7 sæk mere om eftermiddagen." (U2)
   - Nu: "Bageren henter 2/5 sæk om morgenen og 2/5 sæk til om aftenen. Hvor meget har han hentet?"
3. "Mølleren fylder 1/6 sæk korn om morgenen og 2/6 sæk mere om eftermiddagen." (U2)
   - Nu: "Mølledrengen fylder 1/5 sæk mel om morgenen og 2/5 sæk om eftermiddagen. Hvor meget har
     han fyldt i alt?"

**traek-fra**
1. "Mølleren havde 6/7 sæk mel og solgte 5/7 sæk. Hvor meget har han tilbage?" (U2)
   - Nu: "Mølleren havde 7/8 sæk mel og solgte 5/8 sæk. Hvor meget er der tilbage?"
2. "Mølleren havde 4/6 sæk mel og solgte 1/6 sæk." (U2: 4/6 er 2/3)
   - Nu: "Mølleren havde 5/6 sæk mel og solgte 1/6 sæk."
3. "Mølleren havde 3/9 sæk mel og solgte 1/9 sæk." (U2)
   - Nu: "Bageren havde 3/4 sæk mel og brugte 1/4 sæk til rugbrød. Hvor meget er der tilbage?"

**af-maengde**
1. "Mølleren har 40 sække mel. 2/4 af dem skal til bageren." (U2)
   - Nu: "Mølleren har 40 sække mel. 3/4 af dem skal til bageren."
2. "Mølleren har 30 sække mel. 4/6 af dem skal til bageren." (U2)
   - Nu: "Mølleren har 30 sække mel. 2/3 af dem skal til bageren."
3. "Mølleren har 40 sække mel. 2/10 af dem skal til bageren." (U2)
   - Nu: "Mølleren har 40 sække mel. 3/10 af dem skal til bageren."

**faelles-naevner**
1. "Mølleren har 1/2 sæk hvedemel og 2/7 sæk rugmel. Hvor meget mel har han i alt?" (U2)
   - Nu: "Mølleren har 1/2 sæk hvedemel og 1/3 sæk rugmel. Hvor meget mel har han i alt?"
2. "Mølleren havde 1/3 sæk mel og brugte 2/9 sæk til brød." (U2)
   - Nu: "Bageren havde 1/2 sæk mel og brugte 1/8 sæk til boller. Hvor meget er der tilbage?"
3. "Mølleren har 2/3 sæk hvedemel og 2/9 sæk rugmel." (U2)
   - Nu: "Mølleren har 2/3 sæk hvedemel og 1/6 sæk rugmel."

**blandet**
1. "Mølleren har 11/8 sæk mel. Skriv det som et blandet tal: hele sække og en brøk." (U1)
   - Nu: "Mølleren har fyldt 11 poser, der hver rummer 1/8 sæk. Hvor mange hele sække og hvor meget
     mere er det?"
2. "Mølleren har 13/6 sæk mel." (U1)
   - Nu: "Bageren har 13 poser mel, der hver rummer 1/6 sæk. Hvor mange hele sække og hvor meget
     mere er det?"
3. "Mølleren har 9/8 sæk mel." (U1)
   - Nu: "Mølledrengen har båret 9 poser à 1/8 sæk. Hvor mange sække er det, skrevet som et
     blandet tal?"

### Grusgraven (212 opgaver, 69 spøjse = 33 %)

| Opgavetype | Opgaver | Andel spøjse | Hyppigste U |
|---|---|---|---|
| lineal (trin 1) | 36 | 92 % | U3 (33) |
| enhed (trin 2) | 36 | 17 % | U7 (6) |
| omregn (trin 3) | 36 | 42 % | U3 (9), U5 (6) |
| omkreds-trin (trin 4) | 36 | 14 % | U1 (5) |
| areal-trin (trin 5) | 36 | 6 % | U5 (2) |
| maalestok (trin 6) | 32 | 25 % | U5 (8) |

Lineal-tallet (92 %) er højt, fordi to småfejl ("En sten starter" i hintet og "fra 0 og ender"
i teksten) går igen i næsten hver opgave. Én rettelse fjerner næsten det hele.

**lineal**
1. "En sten ligger på linealen fra 1 cm-stregen til 4 cm-stregen. Hvor lang er stenen?" Hint: "En
   sten starter ikke ved 0, men ved 1 cm-stregen." (U3)
   - Nu: hint "Stenen starter ikke ved 0, men ved 1 cm-stregen."
2. "Et søm ligger på linealen fra 0 og ender 7 små streger efter 4 cm-stregen." (U3)
   - Nu: "Et søm ligger på linealen fra 0-stregen og ender 7 små streger efter 4 cm-stregen."
3. "En sten ligger på linealen fra 0 og ender 5 små streger efter 4 cm-stregen. Hver lille streg er
   1 mm." (U3, og sætningen om "1 mm" står i hver opgave)
   - Nu: "En sten ligger fra 0 til 5 små streger efter 4 cm-stregen. Hvor lang er den i mm?"
     Sætningen "hver lille streg er 1 mm" står kun i de første to opgaver.

**enhed**
1. "Grusgraverens trillebør er 140 ___ lang." Forklaring: "140 gange bredden af en finger." (U7)
   - Nu: "140 cm passer til en trillebør: lidt kortere end dig."
2. "Et søm i skuret er 60 ___ langt." Forklaring: "60 gange tykkelsen af en fingernegl." (U7)
   - Nu: "60 mm er 6 cm. Det passer til et søm: omtrent så langt som din lillefinger."
3. "Gruspladsen er 50 ___ lang." Forklaring: "50 gange et langt skridt." (U7, mild)
   - Nu: "50 m passer til en grusplads: halvdelen af en fodboldbane."

**omregn**
1. "Tipvognens spor er 1 cm og 9 mm. Hvor mange mm er det i alt?" (U5)
   - Nu: "Et søm er 1 cm og 9 mm langt. Hvor mange mm er det i alt?"
2. "Tre stykker skinne ligger i gruset: 3 m, 390 cm, 5100 mm." Hint: "390 cm = 390 cm" (U3)
   - Nu: hint "Omregn til samme enhed: 5100 mm = 510 cm, og det er mere end 390 cm."
3. "Tipvognens spor er 6 cm og 8 mm." (U5)
   - Nu: "Grusgraverens blyant er 6 cm og 8 mm lang."

**omkreds-trin**
1. "En grusplads er 10 m lang og 300 cm bred. Hvor mange meter hegn skal der til hele vejen rundt?"
   (U1)
   - Nu: "Grusgraveren måler pladsens længde: 10 m. Lærlingen måler bredden med sin tommestok:
     300 cm. Hvor mange meter hegn skal der til hele vejen rundt?"
2. "En grusplads er 8 m lang og 300 cm bred." (U1)
   - Nu: "Skuret er 8 m langt og 300 cm bredt (målt med tommestok). Hvor mange meter hegn skal
     der rundt om det?"
3. "En grusplads er 8 m lang og 500 cm bred." (U1)
   - Nu: samme som 2, men med "bedet ved skuret".

**areal-trin**
1. "En grusplads er 3 m lang og 2 m bred. Den er delt i felter på 1 m × 1 m: ■■■ / ■■■." (U5: 6 m²)
   - Nu: "Gulvet i skuret er 3 m langt og 2 m bredt …"
2. "En grusplads er 5 m lang og 2 m bred …" (U5: 10 m²)
   - Nu: "Bunden af tipvognens læs er 5 m lang og 2 m bred …"
3. Kun to spøjse. Resten er fine, også "Plads A og Plads B har samme hegn". Det er typens bedste
   opgave.

**maalestok**
1. "Gruspladsen er 8 m lang i virkeligheden. Hvor lang bliver den på et kort i målestok 1:100?"
   (U5)
   - Nu: "Skuret er 8 m langt. Hvor langt bliver det på en tegning i målestok 1:100?"
2. "Gruspladsen er 7 m lang i virkeligheden …" (U5)
   - Nu: "Tipvognen er 4 m lang …" eller "Hegnet langs vejen er 7 m …"
3. "Gruspladsen er 3 m lang i virkeligheden …" (U5)
   - Nu: "Arbejdsbordet i skuret er 3 m langt …"

### Købmanden (90 opgaver, 90 spøjse = 100 %)

| Opgavetype | Opgaver | Andel spøjse | Hyppigste U |
|---|---|---|---|
| pris | 30 | 100 % | U5 (30) |
| del-handel | 30 | 100 % | U1 (30), U5 (30), U6 (30) |
| kasser | 30 | 100 % | U1 (30), U6 (30), U4 (5) |

**pris** (kun 30 forskellige opgaver i hele spillet, alle med æbler)
1. "Købmanden sælger æbler for 4 kr stykket. Hvad koster 6 æbler i alt?" Svar: 30 / 28 / 24 (U5)
   - Nu: "Et æble koster 4 kr. Hvad koster 6 æbler?" Svar: 24 kr / 28 kr / 10 kr.
2. "Købmanden sælger æbler for 5 kr stykket. Hvad koster 6 æbler i alt?" (U5)
   - Nu: "En pose bolsjer koster 5 kr. Du køber 6. Hvad skal du betale?"
3. "Købmanden sælger æbler for 7 kr stykket. Hvad koster 8 æbler i alt?" (U5)
   - Nu: "Et brød koster 18 kr. Hvad koster 3 brød, og hvad får du tilbage af 100 kr?" (to trin, 4.-6.
     klasses niveau)

**del-handel**
1. "Købmanden har 12 kr, som skal deles ligeligt mellem 4 kunder. Hvor mange kr får hver kunde?"
   (U1, U5, U6)
   - Nu: "4 venner køber en kage for 48 kr og deler regningen. Hvad skal hver betale?"
2. "Købmanden har 30 kr, som skal deles ligeligt mellem 5 kunder." (U1)
   - Nu: "Købmanden har 30 æbler og lægger dem i 5 kurve med lige mange i hver. Hvor mange i hver
     kurv?"
3. "Købmanden har 30 kr, som skal deles ligeligt mellem 6 kunder." (U1)
   - Nu: "Købmanden og hans 5 hjælpere deler dagens drikkepenge på 30 kr. Hvad får hver?"

**kasser**
1. "Der ankommer 4 kasser med 6 varer i hver. Hvor mange varer er der i alt?" (U1, U6)
   - Nu: "Købmanden får 4 kasser med 6 flasker saft i hver. Hvor mange flasker er det?"
2. "Der ankommer 4 kasser med 7 varer i hver." (U1)
   - Nu: "Vognen kommer med 4 kasser æbler med 7 poser i hver."
3. "Der ankommer 6 kasser med 6 varer i hver." Questen hedder "Den store leverance" (U1, U4)
   - Nu: "Den store leverance: 12 kasser med 24 dåser i hver. Hvor mange dåser er det?"

### Kirken, Degnen (288 opgaver, 221 spøjse = 77 %)

Kirken blander de gamle generatorer. Brøkdelene er de samme som Møllens trin 1-3, og areal,
omkreds, "størst" og handel er de samme som Købmandens. Derfor går Møllens og Købmandens fund
igen. Kirkens egne er: svarene står uden enhed, og "En anden grusplads" står uden en første.

| Opgavetype | Opgaver | Andel spøjse | Hyppigste U |
|---|---|---|---|
| del-af-helhed | 36 | 72 % | U1 (22), U4 (9) |
| del | 30 | 100 % | U1 (30), U6 (30), U3 (7), U4 (7) |
| sammenlign | 36 | 42 % | U2 (15) |
| areal (gammel) | 30 | 100 % | U5 (30), U6 (30) |
| omkreds (gammel) | 30 | 100 % | U4 (30), U5 (30), U6 (30) |
| stoerst | 36 | 0 % | - |
| pris | 30 | 100 % | U5 (30), U6 (30) |
| del-handel | 30 | 100 % | U1 (30), U5 (30), U6 (30) |
| kasser | 30 | 100 % | U1 (30), U6 (30) |

**del-af-helhed:**
1. "Kværnhjulet er delt i 6 lige store felter, og 1 er malet: ■□□□□□." (U1)
   - Nu: "Degnen har delt tavlen i 6 lige store felter og skrevet i 1: ■□□□□□. Hvor stor en del er
     skrevet?"
2. "Mølleren har delt sin mark i 4 lige store stykker, og 2 er sået: ■■□□." Svar: **1/2** (U4)
   - Nu: svaret **2/4**.
3. "Kværnhjulet er delt i 9 lige store felter, og 2 er malet." (U1)
   - Nu: "Kirkens vindue har 9 lige store ruder, og 2 er farvede."

**del:**
1. "Mølleren deler 1 sæk korn ligeligt mellem 3 gårde." (U1, U3, U6: kun 5 forskellige i Kirken)
   - Nu: "Degnen deler 1 kage ligeligt mellem 3 børn. Hvor meget får hvert barn?"
2. "Mølleren deler 2 sække korn ligeligt mellem 3 gårde." (U1)
   - Nu: "Degnen deler 2 plader chokolade mellem 3 elever."
3. "Mølleren deler 2 sække korn ligeligt mellem 4 gårde." Svar: **1/2** (U4)
   - Nu: svaret 2/4.

**sammenlign:**
1. "Hvilken portion er størst: 2/5 sæk eller 2/4 sæk?" (U2)
   - Nu: "Hvilken portion er størst: 2/5 af en kage eller 2/3 af en kage?"
2. "Hvilken portion er størst: 2/6 sæk eller 2/4 sæk?" (U2)
   - Nu: "… 1/3 sæk eller 1/2 sæk?"
3. "Hvilken portion er størst: 2/6 sæk eller 2/7 sæk?" (U2)
   - Nu: "… 3/8 sæk eller 3/10 sæk?"

**areal (gammel):**
1. "Grusgraveren skal jævne en grusplads, der er 4 m bred og 5 m lang. Hvor mange kvadratmeter er
   gruspladsen?" Svar: 21 / 18 / 20 (U5, U6)
   - Nu: brug `arealTrinOpgave`, så svaret er "20 m²" og den typiske fejl "18 m" får sit hint.
2. "… 5 m bred og 8 m lang …" Svar: 40 / 41 / 26 (U5)
   - Nu: "Kirkegulvet er 8 m langt og 5 m bredt. Hvor stort er det?" Svar: 40 m² / 26 m / 13 m².
3. "… 4 m bred og 7 m lang …" (U5, U6: kun 18 forskellige)
   - Nu: som 2, med kirkegården.

**omkreds (gammel):**
1. "En anden grusplads er 6 m bred og 6 m lang. Hvor langt hegn skal der til hele vejen rundt om
   den?" Svar: 24 / 36 / 12 (U4, U5, U6)
   - Nu: "Kirkegården er 6 m bred og 6 m lang. Hvor langt stendige skal der rundt om den?" Svar:
     24 m / 36 m² / 12 m.
2. "En anden grusplads er 5 m bred og 6 m lang." (U4, U5)
   - Nu: "Præstens have er 5 m bred og 6 m lang …"
3. "En anden grusplads er 5 m bred og 7 m lang." (U4, U5)
   - Nu: "Skolestuen er 5 m bred og 7 m lang. Degnen vil sætte en bort langs alle fire vægge. Hvor
     lang skal borten være?"

**pris, del-handel, kasser:** se Købmanden. Samme tekster, men færre forskellige: 23, 12 og 12
i hele spillet.
1. "Købmanden sælger æbler for 7 kr stykket. Hvad koster 9 æbler i alt?" Svar: 63 / 56 / 72 (U5,
   U6)
   - Nu: "Degnen køber 9 lys til kirken à 7 kr. Hvad koster de?" Svar: 63 kr.
2. "Købmanden har 40 kr, som skal deles ligeligt mellem 5 kunder." (U1)
   - Nu: "5 børn samler 40 kr ind til kirkens høstfest og giver lige meget. Hvor meget gav hver?"
3. "Der ankommer 7 kasser med 9 varer i hver." (U1)
   - Nu: "Til høstfesten kommer 7 kurve med 9 æbler i hver."

### Sporvognen, Konduktøren (144 opgaver, 108 spøjse = 75 %)

| Opgavetype | Opgaver | Andel spøjse | Hyppigste U |
|---|---|---|---|
| ankomst | 36 | 100 % | U5 (36), U7 (36) |
| sejltid (turens længde) | 36 | 100 % | U5 (36), U7 (36) |
| afgang-tilbage | 36 | 100 % | U5 (36), U7 (36) |
| tabel (aflæs tavlen) | 36 | 0 % | - |

**ankomst:**
1. "Sporvognen afgår fra holdepladsen kl. 13:00. Turen tager 4 timer. Hvad er klokken, når
   sporvognen når frem?" (U5, U7)
   - Nu: "Sporvognen kører fra holdepladsen kl. 13.40. Turen til kirken tager 25 minutter. Hvornår
     er den fremme?"
2. "Sporvognen afgår fra holdepladsen kl. 18:00. Turen tager 4 timer." (U5, U7)
   - Nu: "Sidste sporvogn kører kl. 21.50 og er 35 minutter om turen. Hvornår er den ved søen?"
3. "Sporvognen afgår fra holdepladsen kl. 12:00. Turen tager 3 timer." (U5, U7)
   - Nu: "Sporvognen kører kl. 12.15 og er 45 minutter om turen til grusgraven. Hvornår er den
     fremme?"

**sejltid** (id'et hedder stadig "sejltid" fra havne-tiden):
1. "Sporvognen afgår kl. 10:00 og når frem kl. 15:00. Hvor mange timer tog turen?" (U5, U7)
   - Nu: "Sporvognen kører kl. 10.35 og er fremme kl. 11.10. Hvor mange minutter tog turen?"
2. "Sporvognen afgår kl. 11:00 og når frem kl. 15:00." (U5, U7)
   - Nu: "… kl. 11.45 og fremme kl. 12.05 …"
3. "Sporvognen afgår kl. 11:00 og når frem kl. 16:00." (U5, U7)
   - Nu: "… kl. 7.50 og fremme kl. 8.25 …"

**afgang-tilbage:**
1. "Sporvognen skal være fremme senest kl. 17:00. Turen tager 2 timer. Hvornår skal den senest
   afgå?" (U5, U7)
   - Nu: "Du skal være ved kirken kl. 17.00. Sporvognen er 25 minutter om turen. Hvilken er den
     sidste afgang, du kan nå? (16.25, 16.40, 16.55)". Det er tavle og regning i én opgave.
2. "Sporvognen skal være fremme senest kl. 19:00. Turen tager 5 timer." (U5, U7)
   - Nu: "… kl. 19.10 … 40 minutter …"
3. "Sporvognen skal være fremme senest kl. 17:00. Turen tager 3 timer." (U5, U7)
   - Nu: "… kl. 8.00 til skole … 15 minutter …"

**tabel:** ingen spøjse fundet. Et eksempel: "Sporvognens afgangstavle på holdepladsen: Kirkelinjen
– 17:00, Grusgravslinjen – 10:00, Møllelinjen – 14:00, Skovlinjen – 18:00. Hvornår afgår
Kirkelinjen?" Den er fin, men for let. Den kan blive typens gode opgave med minutter og to
afgange pr. linje.

### Den gamle gang (Grusgraven med lygten, 210 opgaver, 119 spøjse = 57 %)

Her er Grusgravens generatorer på svær, så fundene er de samme som i Grusgraven. Tre ting vejer
tungere her:

- Målestok har kun 16 forskellige opgaver (U6), og alle er "Gruspladsen er … lang i
  virkeligheden".
- Omregn er 100 % "Tre stykker skinne …" med hintet "400 cm = 400 cm" (U3).
- Omkreds er 56 % "… m lang og … cm bred" (U1).

| Opgavetype | Opgaver | Andel spøjse | Hyppigste U |
|---|---|---|---|
| areal-trin | 36 | 0 % | - |
| enhed | 36 | 17 % | U7 (6) |
| lineal | 36 | 75 % | U3 (27) |
| maalestok | 30 | 100 % | U6 (30), U5 (15) |
| omkreds-trin | 36 | 56 % | U1 (20) |
| omregn | 36 | 100 % | U3 (36) |

Eksempler med før og nu:

1. "Gruspladsen er 2 m lang i virkeligheden. Hvor lang bliver den på et kort i målestok 1:100?"
   (U5, U6)
   - Nu: "Skuret er 2 m bredt. Hvor bredt bliver det på tegningen i 1:100?"
2. "Tre stykker skinne ligger i gruset: 2 m, 400 cm, 2900 mm." Hint: "400 cm = 400 cm" (U3)
   - Nu: hint "2900 mm = 290 cm, og det er mindre end 400 cm."
3. "En grusplads er 8 m lang og 300 cm bred." (U1)
   - Nu: "Den gamle gang er 8 m lang. Grusgraveren har målt bredden med tommestok: 300 cm. Hvor
     langt reb skal der til hele vejen rundt?"

---

## Sådan er det læst, og hvor sikkert det er

- **Generering:** `outputs/kritik-399/generer-opgaver.mjs` kalder `QUEST_BANK[sted][i].lavOpgaver(0)`
  over 1500 spilsalte og tager de første 36 forskellige tekster pr. sted og type. Har en type
  færre end 30 forskellige i alt, fyldes den op til 30 med gentagelser, der står markeret
  "GENTAGET". Det er i sig selv fundet U6.
- **Dommen:** Jeg har læst opgaverne pr. type og derefter skrevet det, jeg studsede over, som
  navngivne regler i `dom()` i samme script. Hver opgave får altså den samme dom for den samme
  fejl, og grunden står ved opgaven. Reglerne er min vurdering, ikke en måling. En anden lærer vil
  lægge grænsen anderledes, især ved U5 "svar uden enhed" (let) og U7 "kun hele timer" (niveau).
  Uden de to er andelen 61 % i stedet for 63 %.
- **Ikke læst:** `matematik.html`s egne minispil (Hvad passer, Talvægten og de andre) og Lyset.
  Ordren handlede om stederne i spillet (`spil.html`).
