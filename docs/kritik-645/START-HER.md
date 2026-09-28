START-HER-MARC let for Marc at bruge: nej (linkene virker, men artiklen, værktøjet og Instagram er svære at finde; H1, H2 og H4 skal rettes)

# Kritik 645, blok 2: START-HER-MARC.html (Setu 633) som Marc ser den (Bhishak)

## Hvad jeg målte

- `C:\Users\Entropi\Desktop\START-HER-MARC.html` er kun læst, og det samme er de otte sider, den linker til.
- `outputs/kritik-645/start-645.mjs` åbnede siden som `file://` i Google Chrome headless, 390 med touch og 1280 med mus, med alt net afbrudt. Resultat: **10/10** (`start-645.json`). Skærmbillederne er `H-645-*.png`.
- Scriptet gjorde fire ting:
  - Målte kortene, linkene og svar-linjerne, og hvor langt nede hvert kort står.
  - Trykkede på hvert link i samme fane.
  - Holdt hver svar-linje op mod LAES-siden, kortet linker til.
  - Målte, hvor langt nede artiklen står i LAES-SQUAT, om værktøjet kan åbnes fra LAES-VAERKTOEJER, og hvor den første slide står i LAES-INSTAGRAM og LAES-INSTAGRAM-2.
- Dommene på kortene er holdt op mod mine egne rapporter 464, 622, 631, 632 og 639 i `docs/`.
- Om artiklen og værktøjet er online, har jeg set i sitets træ med `git ls-tree`. Jeg har ikke hentet noget fra nettet.

## Linkene

- **Alle 8 links virker på 390 og 1280.** De er relative, filerne ligger på skrivebordet, og et tryk åbner den rigtige side med titel, 0 brudte billeder og 0 JS-fejl.
  - Selv de store sider åbner på under et sekund headless: LAES-SQUAT er 5,2 MB (0,5-0,8 s), og LAES-VAERKTOEJER er 4,1 MB.
- **Siden selv:** 7 kort, 0 JS-fejl og ingen sidelæns rulning. Den er 6,9 skærme lang på 390 og 4,1 på 1280.
- **Sprog og stil:** siden er rolig, og hvert kort har samme opbygning (Hvad, Bhishak, Tid, link, svar). Kopiér-knapperne og fluebenene virker (Setus 633-tjek, og ingen JS-fejl i mit).

## Svar-sætningerne

- **Dommene er rigtige for 28. sep. før 645:**
  - App: 464 "klar til push: ja" med Max rows 1000 og et minut på net.
  - Squat: 622 kapitel 6 bedre ja og klar til læsning ja, Q1-Q7 lukket.
  - Værktøjer: 632 17/17 og 639 ja.
  - Instagram: 1-6 ja (622), og 7-12 ikke set efter rettelsen.
  - Matematik: 631 ja.
- **Men kort 4 er forældet nu (H4).** 645 siger "Instagram 7-12 klar til Marcs godkendelse: ja". Kort 3 nævner ikke 636 (`ed32064`) eller 645.
- **Squat-linjen passer ikke til LAES-SQUAT (H2).**
  - START-HER beder om `squat udgiv 28. sep 2026`. Den form findes ikke på LAES-SQUAT.
  - LAES-SQUAT har `squat udgiv forslag`, `squat udgiv, men <nr>: <dit valg>` og `squat vent: ...`. Datoen er valg 3 (U8), og forslaget der er "den dag du siger ja".
  - Sender Marc START-HER's linje, er det uklart, om de ni valg er taget som foreslået.
  - Datoen er skrevet fast som 28. sep. 2026, så linjen er forkert fra i morgen (H7).
- **Tre linjer står kun på START-HER (H3):**
  - `klar til app`: Setu skriver, at den kommer fra ordre 633. LAES-APP beder i stedet om "Til Dhruva: app-pushet ..." ved fejl.
  - `film klip lagt: 1 2 3 4 5`: Setus eget valg.
  - `M14 halvdelen`.
  - Dhruva skal kende dem, for LAES-siderne gør ikke.
- **Kort 7 sender Marc til den forkerte side (H5).** MARCS-VALG-MATEMATIK beder om `matematik: M2 ?, N1 ?` og siger "Ingen regel er ændret, før du har svaret". M14 står ikke på siden. Kortet siger selv, at siden handler om noget andet.

## Hvorfor Marc ikke fandt artiklen, værktøjet og Instagram

Her er præcis det, der gør det svært, målt i dag:

1. **Ingen af de tre findes der, hvor man ville lede.**
   - Squat-artiklen ligger på sitets gren `udgivelse-squat-min-krop` (`artikel-squat.html`), og værktøjssiden på grenen `vaerktoejer`.
   - Ingen af dem ligger i sitets `main` (jeg har set den lokale kopi af GitHubs `main` og ikke hentet den i dag).
   - Instagram er ikke postet.
   - START-HER nævner ikke entropicoaching.dk og siger ikke, at artiklen og værktøjet kun kan ses her. Kun Instagram-kortet siger "Intet er postet".
   - Leder Marc på sitet eller på Instagram, finder han intet, og siden har ikke forberedt ham på det.
2. **Linkene er filnavne, ikke tingene.**
   - Der står "Åbn LAES-SQUAT.html", "Åbn LAES-VAERKTOEJER.html" og "Åbn LAES-INSTAGRAM.html (1-6)".
   - Ordet "artikel" står kun i kortets overskrift "Squat-artiklen". Intet link hedder "Læs artiklen", "Prøv værktøjet" eller "Se opslagene".
3. **Artiklen står 33 skærme nede i LAES-SQUAT på 390** (y 25 874 af 76 550 px, 19 skærme på 1280).
   - Den kommer efter de ni valg, sammenligningen og Marcs ord. Siden hedder "Squat-artiklen: læs og vælg" og er først en valgside.
   - Der er en genvej "Hele artiklen" (`#s5`) 1,2 skærme nede, men START-HER linker ikke direkte til `LAES-SQUAT.html#s5`.
4. **Værktøjet kan ikke åbnes fra nogen af siderne.**
   - LAES-VAERKTOEJER har 0 links, 0 iframes og 0 knapper, men 15 skærmbilleder.
   - Adresserne `entropicoaching.dk/vaerktoejer/` og `.../assets/vaerktoejer/maal-billede/index.html` står som tekst. De virker først efter `vaerktoejer udgiv`.
   - Marc kan kun se billeder af værktøjet, ikke prøve det.
5. **Instagram er det nemmeste af de tre.** Første slide står 1,4-1,5 skærme nede på begge LAES-INSTAGRAM-sider, og alle billeder er indlejret.
   - Men kortet har to links og fire svar-linjer i ét kort. På 390 står kortet først 3,1 skærme nede i START-HER.
6. **Der er ingen oversigt øverst.**
   - På 390 viser første skærm kun overskriften, indledningen og halvdelen af kort 1 (appen).
   - Squat begynder 1,2 skærme nede, værktøjer 2,3 og Instagram 3,1.
   - Skrivebordet har 111 ting, heraf 10 HTML-sider. START-HER er én af dem uden at stå øverst.

## Fund

| Fund | Alvor | Hvor | Hvad Setu gør |
|---|---|---|---|
| H1 | middel | kort 2, 3, 4 | Skriv på hvert kort, hvor tingen er i dag. Artiklen: "ikke på entropicoaching.dk endnu, kun her". Værktøjet: "kan først prøves på sitet efter vaerktoejer udgiv; her er skærmbilleder". Instagram: "intet postet". Giv linkene navne efter tingen ("Læs squat-artiklen", "Se værktøjet i billeder", "Se opslag 1-6"). Lad artikel-linket gå til `LAES-SQUAT.html#s5`, og valgene have deres eget link. |
| H2 | middel | kort 2 | Brug LAES-SQUAT's former: `squat udgiv forslag` (datoen bliver dagen for ja) eller `squat udgiv, men 3: <dato>`, og behold `squat kapitel 6: ny/gammel`. Ingen fast dato i linjen. |
| H3 | lav | kort 1, 5, 7 | `klar til app`, `film klip lagt: ...` og `M14 halvdelen` står kun på START-HER. Enten skrives de også på LAES-siderne, eller kortet siger, at det er Dhruvas linje. |
| H4 | middel | kort 3, 4 | Opdatér efter 645: Instagram 7-12 ja, og værktøjssiden ja fra `ed32064` med løftmodellens nyeste Mål dit billede (`0d4d11f`). |
| H5 | lav | kort 7 | Fjern linket til MARCS-VALG-MATEMATIK (M2 og N1 er afgjort), eller læg M14 ind på en side, der kun spørger om M14. |
| H6 | lav | toppen | En kort oversigt øverst med syv genveje (artiklen, værktøjet og Instagram først, hvis det er dem, Marc skal bruge i dag), så første skærm på 390 viser alle syv. |
| H7 | lav | kort 2 | Datoen 28. sep. 2026 står fast. Den går væk med H2. |

## Ærlige grænser

- **Headless Chrome på Windows,** ikke Marcs egen browser eller telefon. Kopiér-knappen har jeg ikke trykket; det har Setu (633).
- **Hvor Marc faktisk ledte, ved jeg ikke.** Punkterne ovenfor er det, siden og skrivebordet viser, ikke et interview.
- **Sitets online-stand** er set i den lokale kopi af GitHubs `main`, ikke på entropicoaching.dk.
- **Jeg har ikke prøvet,** om værktøjet kan åbnes fra `file://` uden en server. Det er grunden til, at H1 foreslår billeder og ærlig tekst og ikke et link.
