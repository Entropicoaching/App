# ENTROPI FRAMEWORK - fra vision til baerende konstruktion
_Fable 8/7-2026. Dette er IKKE en ideliste (den ligger i VISION-
BRAINSTORM.md). Dette er maskinrummet: formler, skemaer, beslutnings-
regler og protokoller, som Opus kan implementere DIREKTE efter, og som
Marc kan skyde huller i FOER der bygges. Alt kan aendres - men aendringer
skal ske her foerst, saa vision og kode aldrig driver fra hinanden._

=====================================================================
## 1. GOVERNANCE - reglerne over reglerne
=====================================================================

### 1.1 SJAELTESTEN (enhver ny feature skal svare JA til alle fem)
  S1: Goer den Marcs OEJE skarpere eller hans TID laengere? (ikke bare "smart")
  S2: Er den deterministisk og forklarlig ned til komponenterne?
  S3: Kan atleten moede den uden at blive forvirret eller doemt?
  S4: Virker den 95%+ af gangene i praksis (ikke demo)?
  S5: Kan den staa paa sitets saetninger (struktur, aerlighed, proces)?
Nej til EN = byg den ikke, eller redesign til der er fem ja'er.

### 1.2 DE FEM JERNREGLER (fra ugens dyrekoebte laering)
  R1: CV/tracker-aendringer: rig-bevis FOER port. Trackerens 6
      invarianter er fredet (se HANDOVER, "BAR-TRACKER FREDNING").
  R2: Intet deployes uden Marcs go efter lokal/mobil test.
  R3: Al atlet-/offentlig tekst er Marcs ord (AI leverer stikord).
  R4: Atletdata krydser ALDRIG atleter uden eksplicit samtykke.
      Ingen leaderboards paa tvaers. Atleten maales mod sig selv.
  R5: En feature der virker halvt fjernes eller faerdiggoeres -
      den faar ikke lov at staa og skabe mistillid.

### 1.3 VERSIONERING AF MAAL (kritisk for troværdighed)
Alle beregnede stoerrelser (score, e1RM, baselines) baerer et versions-
nummer (score_v1, lv_v1 ...). Aendres formlen, stiger versionen, og
historik GENBEREGNES med ny version eller vises adskilt. En atlet maa
aldrig se sin score falde fordi VI aendrede matematikken uden forklaring.

=====================================================================
## 2. DATAMODELLEN - fundamentet alt staar paa
=====================================================================

### 2.1 Nuvaerende tilstand (som gemt af 💾 i dag)
video_analyses: athlete_name (TEKST, ikke FK!), lift, load_note
(FRITEKST "142,5kg @8"), bias_note, rom_cm, loss_pct, stick_pct,
dip_pct, drift_cm, reps[] (mcv pr. rep), extra{hip_ratio, eff_pct,
hyst_cm, tempo[{ecc,pause,con,peak}]}, findings[], ai_text, analyzed_at.
PROBLEMER: (a) athlete_name binder ikke til athletes.id -> historik
knaekker ved navnaendring/gaest; (b) kg skal parses af fritekst;
(c) banens PUNKTER gemmes ikke -> teknik-tvillingen umulig bagudret.

### 2.2 Maalskema (migrationer i prioriteret raekkefoelge)
M1 (foer svinghjulet ruller for alvor - billig nu, dyr senere):
  ALTER TABLE video_analyses
    ADD COLUMN athlete_id uuid REFERENCES athletes(id),
    ADD COLUMN load_kg numeric,          -- parses ved gem/import
    ADD COLUMN rpe numeric,              -- parses af "@8"-moenster
    ADD COLUMN bar_path jsonb,           -- se 2.3
    ADD COLUMN low_conf_pct numeric,     -- kvalitetsfilter
    ADD COLUMN schema_v int DEFAULT 2;
  Backfill: athlete_id via navnematch (manuel godkendelse af mapping).
  OBS kendt faelde: athletes.id != athletes.user_id.
M2 (naar VBT bygges):
  CREATE TABLE athlete_baselines (
    athlete_id uuid, lift text, metric text,      -- 'eff_pct','hyst_cm',...
    median numeric, mad numeric, n int, version text, updated_at timestamptz,
    PRIMARY KEY (athlete_id, lift, metric, version));
  CREATE TABLE athlete_lv_profiles (
    athlete_id uuid, lift text, slope numeric, intercept numeric,
    r2 numeric, n_points int, kg_span_pct numeric, mvt numeric,
    e1rm_est numeric, version text, updated_at timestamptz,
    PRIMARY KEY (athlete_id, lift, version));
M3 (naar scoren gaar live): score-felter paa video_analyses
  (score int, score_components jsonb, score_version text).

### 2.3 bar_path-formatet (muliggoer teknik-tvillingen)
Decimeret til maks 120 punkter (uniform i tid), delta-kodet heltal:
  { "v": 1, "t0": <sek>, "dt": <sek/punkt>,
    "x0": <px>, "y0": <px>, "dx": [..], "dy": [..],
    "cm_per_px": <num>, "w": <canvas-bredde>, "h": <hoejde> }
~1-2 KB pr. analyse. Afkodning er 10 linjer. cm_per_px + normalisering
til skulder-/stanghoejde goer baner sammenlignelige paa tvaers af
optagelser (forskellig afstand/zoom): sammenlign i CM-rum, ikke px-rum,
og juster x til stangens startposition = 0.

### 2.4 RLS-skitse (M4, foer mobil-gem)
- coach-rolle (Marcs user_id): fuld read/write paa alle tabeller her.
- atlet-rolle: SELECT paa egne raekker (athlete_id -> athletes.user_id
  = auth.uid()), INTET write. Al skrivning gaar via coach eller
  service-noegle. Gaeste-analyser (athlete_id NULL) er coach-only.

=====================================================================
## 3. ENTROPI-SCOREN v1 - fuld specifikation
=====================================================================

### 3.1 Princip
Scoren maaler ORDEN i et saet, 0-100, hoejt = rent. Den er PERSONLIG:
komponenter normaliseres mod atletens egen baseline, saa scoren maaler
"dig mod din normal", ikke "dig mod Regitze". Foer baseline findes
(n < 5 analyser pr. loeft) bruges befolknings-defaults = de eksisterende
FUND-graenser, og scoren maerkes "foreloebig" i visning.

### 3.2 Komponenter (alle maales ALLEREDE i dag)
  C1 BANEORDEN     eff_pct           omveje i banen
  C2 SPORSTABILITET hyst_cm / rom_cm  positionstab ned/op (normaliseret
                                      mod ROM saa hoeje/lave atleter
                                      behandles ens)
  C3 KONTROL       dip_pct           fartfald ind i sticking point
  C4 KONSISTENS    0.5*CV(rep-mcv) + 0.5*CV(con-tempo)
                                      rep-til-rep spredning (CV =
                                      std/middel). KUN ved reps >= 3,
                                      ellers udgaar C4 og vaegte
                                      renormaliseres.
  (C5 HOFTETIMING  hip_ratio         KUN squat + kun naar skelet/maaling
                                      findes - indgaar ellers ikke.)
BEVIDST UDELADT: fart i absolutte tal (det er STYRKE, ikke orden - en
tung dag maa ikke straffe scoren), ROM (kropsbygning), drift_cm i baenk
(J-kurven er KORREKT teknik - se TEKNIK-blokken).

### 3.3 Normalisering pr. komponent -> 0-100
  z = (vaerdi - median_atlet) / MAD_atlet     (retningsjusteret saa
                                               "bedre" altid er positiv)
  z klippes til [-2.5, +2.5]
  komponent-score = 50 + 20*z                 (median = 50, +2.5 MAD = 100)
Defaults foer baseline (befolknings-ankre, fra FUND-graenserne):
  C1: 90% = 50p, 96% = 85p    C2: 4cm/50cm ROM = 50p
  C3: 55% = 50p, 35% = 85p    C4: CV 8% = 50p, 4% = 85p
(Ankre lineaert interpoleret/ekstrapoleret, klippet 0-100.)

### 3.4 Vaegte v1 (STARTBUD - kalibreres, se 3.5)
  score = 0.30*C1 + 0.20*C2 + 0.25*C3 + 0.25*C4
  (med C5: 0.25*C1 + 0.15*C2 + 0.20*C3 + 0.20*C4 + 0.20*C5)
Kvalitetsvagt: low_conf_pct > 15 -> scoren beregnes IKKE (vis "sporing
usikker" i stedet). En upaalidelig score er vaerre end ingen.

### 3.5 KALIBRERINGSPROTOKOL (Marcs oeje er facit - formaliseret)
  K1: Naar 30+ analyser findes: udtraek 15 PAR af saet (samme loeft,
      gerne samme atlet). Marc svarer blindt pr. par: "hvilket saet var
      renest?" (aldrig tal, kun A/B).
  K2: Grid-search over vaegte (trin 0.05, sum=1) -> vaelg vaegtsaet der
      maksimerer enighed med Marcs 15 domme.
  K3: Krav for at gaa live paa kort: enighed >= 80% (12/15). Under det:
      analyser uenighederne (mangler der en komponent? maaler en
      komponent forkert?) og gentag. UENIGHEDERNE ER GULD - de viser
      hvad Marcs oeje ser, som maalingerne ikke fanger endnu.
  K4: Genkalibrering ved hver +50 analyser eller naar Marc melder
      "scoren foeles forkert" 3+ gange i feltloggen.

### 3.6 Visningsregler (produkt, ikke matematik)
  Coach ser: score + alle komponenter + trend.
  Atlet ser: score + trend + EN saetning om staerkeste komponent
  (Marcs skabelontekster). Atleten ser ALDRIG komponent-tal foer
  Marc har valgt at forklare dem - tallene aabner samtaler i traening,
  ikke grublerier derhjemme kl. 23.
  Score vises ALDRIG paa tvaers af atleter. Ugens Loeft kurateres af
  Marc, aldrig af score-sortering.

### 3.7 Pseudokode (implementeres i entropi_agent/scoring.py)
  def score_v1(analysis, baselines):
      if analysis.low_conf_pct > 15: return None
      comps = {}
      comps['C1'] = norm(analysis.eff_pct, baselines, 'eff_pct', higher_better=True)
      comps['C2'] = norm(analysis.hyst_cm / analysis.rom_cm, baselines,
                         'hyst_norm', higher_better=False)
      comps['C3'] = norm(analysis.dip_pct, baselines, 'dip_pct', higher_better=False)
      if len(analysis.reps) >= 3:
          cv = 0.5*cv_of(analysis.reps) + 0.5*cv_of(analysis.tempo_con)
          comps['C4'] = norm(cv, baselines, 'cv', higher_better=False)
      w = renormalized_weights(comps.keys())
      return round(sum(w[k]*comps[k] for k in comps)), comps

=====================================================================
## 4. VBT-MATEMATIKKEN v1
=====================================================================

### 4.1 Datapunkter og filtre
Pr. atlet pr. loeft: punkter (load_kg, bedste rep-mcv i saettet).
Filtre: low_conf_pct <= 15, load_kg parsed, reps >= 1, mcv i sanitets-
interval (0.05-2.0 m/s). Punkter vaegtes med halveringstid 60 dage
(w = 0.5^(alder_dage/60)) saa profilen foelger formudvikling.

### 4.2 Fit og krav
Vaegtet lineaer regression: mcv = intercept - slope*kg.
UMODEN profil (vis ikke e1RM) hvis: n < 6, kg-spaend < 15% af maks-kg,
eller r2 < 0.80. Vis i stedet "profil bygger: 4/6 punkter".

### 4.3 MVT og e1RM
MVT (minimum velocity threshold) pr. atlet pr. loeft:
  primaert: median mcv paa saet logget med RPE >= 9.5 (n >= 2)
  fallback: litteratur-ankre (allerede i TEKNIK-blokken):
    squat 0.27, baenk 0.17, dl 0.22, sumo 0.22 m/s
  e1RM = (intercept - MVT) / slope
Vises altid som INTERVAL (fx "192-201 kg") beregnet af fittets
usikkerhed - aldrig et enkelt tal, aerlighed er brandet.

### 4.4 Dagsform
  forventet_mcv = profil(kg_i_dag)
  afvigelse = (maalt - forventet) / forventet
  |afvigelse| <= 4%: normal (vis intet - stoej skal ikke larme)
  > +4%: "over normal" (groen note)   < -4%: "under normal" (gul note)
  < -8%: flag til coach (se 5). Taersklerne kalibreres i feltloggen.

=====================================================================
## 5. FLAG-MOTOREN - soendagsagentens regelkatalog v1
=====================================================================
Formaal: fundene skal MOEDE Marc i rapporten, ikke vente paa at blive
husket. Flags er stikord til coachen - ALDRIG faerdig atlet-tekst.

### 5.1 Regelkatalog (betingelse -> stikord-skabelon)
  F1 TREND:     samme metric (eff_pct/hyst_norm/dip_pct/score) forvaerret
                3 sessioner i traek paa samme loeft
                -> "[Atlet] [loeft]: [metric] 94->91->88 over 3 sessioner"
  F2 DAGSFORM:  afvigelse < -8% mod LV-profil 2+ gange paa 7 dage
                -> "[Atlet]: fart markant under normal 2x denne uge -
                    restitution/belastning?"
  F3 BASELINEBRUD: enkeltmaaling > 2*MAD fra median (og lowConf ok)
                -> "[Atlet] [loeft]: [metric] langt fra normal i gaar"
  F4 PROFILSKIFT: e1RM-estimat aendret > 4% siden sidste rapport
                -> "+: fremgang vaerd at fejre / -: tjek traethed"
  F5 TEMPOBRUD: programmeret tempo (fra appens program) afviger > 30%
                fra maalt tempo 2+ sessioner (KRAEVER tempo-kontrakt-
                koblingen, se VISION 6) -> "programmet siger 3s ned,
                [atlet] loefter 1.8s"
  F6 DATATOERKE: atlet med video-vane har 0 analyser i 14 dage
                -> "ingen video paa [atlet] i 2 uger" (svinghjuls-vagt)

### 5.2 Stoejvaern (vigtigere end reglerne)
  - Maks 3 flags pr. atlet pr. uge, prioriteret F2 > F1 > F4 > F3 > F5 > F6.
  - Et flag gentages ikke to uger i traek medmindre det er FORVAERRET.
  - Alle taerskler i config-blok oeverst i analytics.py - Marc-justerbare.
  - Hvert flag baerer sine raadata (datoer, tal), saa Marc kan efterproeve
    med to klik. Aerlighed hele vejen ned.

=====================================================================
## 6. ATLETREJSEN - stadier, features og maal
=====================================================================
  STADIE      SER/KAN                            AKTIVERES NAAR    MAAL
  GAEST       videocoach.html, analyse, kort     QR/link           proev det
  NY ATLET    + fartgraf, video-eksport,         onboardes         foerste
              filmguide (Marcs klip)                               delte kort
  AKTIV       + fremgangs-linje, score-trend     10+ analyser      vane: film
              (naar score_v1 er kalibreret)                        topsaettet
  KERNE       + teknik-tvilling, saesonkort      1 blok gennemfoert loyalitet
  AMBASSADOER deler kort/video ud af egen drift  (kan ikke tvinges) vaeksten
Princip: features LAASES OP af rejsen i stedet for at vaelte ind over
en ny atlet paa dag et. Simpelt foerst, dybde til dem der er klar.

=====================================================================
## 7. KPI'ER - maaler vi det rigtige?
=====================================================================
  PROCES (ugentligt, feltlog/agent):
    - analyser gemt pr. uge (svinghjulet - vigtigst af alle)
    - % traeningssessioner m. video hvor 💾 blev brugt
    - feltlog-irritationer aabnet vs. lukket
  KVALITET (maanedligt):
    - score-kalibrerings-enighed (maal >= 80%)
    - % analyser m. lowConf > 15 (skal FALDE - filmguide virker?)
  VAERDI (kvartalsvis, aerlige spoergsmaal):
    - Marcs coach-timer sparet/uge (selvvurderet, feltlog)
    - atlet-delinger af kort/video (taelles manuelt/Instagram)
    - nye henvendelser der naevner VideoCoach/kortene
ANTI-KPI: antal features. Vi maaler aldrig succes i byggede ting.

=====================================================================
## 8. TEKNISK EVOLUTION - hvornaar forlader vi en-filen?
=====================================================================
En-filen har VUNDET indtil nu (delt motor, nul build-kompleksitet).
Den forlades IKKE af principielle grunde, kun ved trigger:
  T1: React-integration (niveau 2: atletvaelger fra DB, login-gem)
      gaar i gang -> videocoach bliver MODUL (motor-JS udskilles,
      React er skal). Kontrakt: motoren maa aldrig importere React.
  T2: filen runder ~4500 linjer ELLER to agenter i traek roder i
      hinandens sektioner -> split i <script src>-moduler (stadig
      uden build-step: tracker.js, skeleton.js, ui.js, card.js).
  T3: score/VBT-beregning: bor i PYTHON (entropi_agent), IKKE i
      html-filen. Kortet VISER tal fra Supabase; det beregner dem
      ikke. En kilde til sandhed.
Indtil da: en fil, chunked writes, syntaks-tjek, backups. Det virker.

=====================================================================
## 9. RISICI & MODTRAEK
=====================================================================
  RISIKO                              MODTRAEK
  Scoren foeles forkert for Marc      K-protokollen (3.5) FOER live;
                                      uenigheder = nye komponenter
  Atleter jager score i stedet for    visningsregler 3.6; Marcs sam-
  kg/teknik                           tale-foerst-kultur; ingen ranglister
  Svinghjulet doer (ingen 💾-vane)    F6-flagget + traeningsmode goer
                                      gem-vejen kort; maal i KPI
  Fritekst-kg parser forkert          parse ved GEM m. visning ("142.5
                                      kg?") saa Marc ser tallet straks
  En-filen bliver uoverskuelig        T2-triggeren, sektioner + HANDOVER
  Ny agent bryder invarianter         FREDNINGS-blokken + rigs i repo
  Marc faar for travlt til feltlog    goer den til 3 linjer, ikke essay;
                                      agenten SPOERGER i soendagsrapporten

=====================================================================
## 10. AABNE BESLUTNINGER (nummereret - svar naar du er klar, Marc)
=====================================================================
  B1: Entropi-scoren - er konceptet GO til stille kalibrering i
      rapporterne (ingen atleter ser den foer K3 er bestaaet)?
  B2: Vaegt-startbuddet 30/20/25/25 - lyder fordelingen rigtig for
      dit oeje, eller er kontrol (C3) vigtigere end baneorden (C1)?
  B3: MVT via RPE>=9.5-saet - logger dine atleter RPE paalideligt nok,
      eller skal vi starte med litteratur-ankrene alene?
  B4: Dagsform-taerskler (4%/8%) - foeles de rigtige fra din erfaring?
  B5: M1-migrationen (athlete_id-kobling) - maa Opus koere den naeste
      session, inkl. navne-mapping til godkendelse?
  B6: bar_path-lagring (1-2 KB/analyse) - GO til at 💾 begynder at
      gemme banen, saa teknik-tvillingen faar historik fra NU af?
  B7: Llama - endelig beslutning: drop? (alt i praksis peger paa ja)
  B8: Feature-oplaasning ad rejse-stadier (sektion 6) - eller skal
      alle atleter se det samme altid?

=====================================================================
## 11. IMPLEMENTERINGS-KOE FOR OPUS (efter Marcs B-svar)
=====================================================================
  1. M1-migration + kg/RPE-parser i 💾 (B5)          [lille, haster]
  2. bar_path i 💾 (B6)                              [lille, haster]
  3. scoring.py + baselines (stille, rapport-only)   [medium]
  4. lv_profile.py + dagsform i rapport              [medium]
  5. Flag-motor F1-F4 i analytics.py                 [medium]
  6. K-protokol-vaerktoej (15 par til Marc, blindt)  [lille]
  7. Score paa coach-kort naar K3 bestaaet           [lille]
  8. Teknik-tvilling (bruger bar_path-historik)      [stoerre]
  Hver bygges som alt andet: lokalt, testet, Marcs go, deploy.

_Slut. Framework'et er levende: aendr det her, foer koden aendres._

=====================================================================
## 12. MARCS BESLUTNINGER (8/7-2026 - dette er LOV)
=====================================================================
  B1 GO:  score-kalibrering starter stille (rapport-only, K-protokol
          foer nogen atlet ser den).
  B2 GO:  startvaegte 30/20/25/25 proeves - justeres af K-protokollen.
  B3 GO m. KRAV: MVT er ALTID pr. atlet PR. LOEFT (aldrig delt paa
          tvaers af loeft). Spec'en overholder det - fasthold det.
  B4 AABEN: Marc har ikke set dagsform saadan foer - START med 4%/8%
          som hypotese, kalibrer via feltlog + hans reaktioner paa
          flags. Marker dagsform-noter som "beta" i rapporten.
  B5 GO:  M1-migration + kg/RPE-parser. Navne-mapping forbi Marc.
  B6 GO:  bar_path gemmes, koblet paa ATLETEN (kontekst over tid) -
          dvs. athlete_id-koblingen (B5) er forudsaetningen. Byg begge.
  B7 GO m. KRAV: Llama DROPPES som retning, men koden SLETTES IKKE
          foer et alternativ er besluttet (evt. Claude-knap). Markér
          som deprecated i docs; ryd op senere.
  B8 GO (for nu): atletrejse-oplaasning. Funktioner kan laases op for
          alle senere, hvis praksis viser det.
