Ordre 585: gentjek af værktøjssiden (Setu 579 og 584) og karrusellerne (slide 3, slide 4, billedtekst 1) med de to endelige domme (Bhishak)

Planet: coaching. Spor: spor-l-ft-artikler-p-entropicoaching-dk-n-pr-l-ft-39bc17.

**Domme:**
- vaerktoejssiden klar til Marcs deploy: **ja**. W0-W6 er lukket. W7 og W8 er lave og skal ikke rettes først.
- karrusellerne klar til Marc: **ja**. K1-K5 er lukket, og kun K6 (lav) står tilbage. Men de postes først, når værktøjssiden er live og kan findes fra sitet (K7, Marcs valg, trin 5 nedenfor).

## Gren

`kritik-585` fra `main` (`087f958`). Ingen push, ingen merge og ingen sub-agenter. Kun filer under `docs/kritik-585/` og `outputs/kritik-585/`.

**Hvad jeg har læst, og hvordan:**
- Grenen `vaerktoejer` (`eb7bf79`, nyeste commit) i `entropi-coaching-site-wt2` og løftmodellens main (`entropi-loeftmodel-dhruva`, `291f5bf`) er hentet med `git archive` til midlertidige mapper. Ingen gren er skiftet.
- `setu-579\RAPPORT-579.md`, `setu-584\RAPPORT-584.md`, `setu-573\` og `FILM-KLIP.html` er kun læst.
- Sitets `main` og `origin/main` er kun læst med `git log`, `git rev-list` og `git merge-tree`. Der er ikke hentet noget fra GitHub.

**Commits:**
- `dea383c` kritik 585 blok 1: værktøjssiden
- blok 2: karrusellerne, verificering og denne rapport. Hashen står i `git log`, for den kan ikke stå i sin egen commit.

## Hvad ændret

Intet i appen, på sitet eller i setu-573. Nye filer:

- `docs/kritik-585/VAERKTOEJER.md`: blok 1, dom i første linje, fund W0-W8.
- `docs/kritik-585/KARRUSELLER.md`: blok 2, dom i første linje, fund K1-K7.
- `outputs/kritik-585/vaerktoejer-585.mjs` + `vaerktoejer-585.json` + `V-*.png`: blok 1 headless i Google Chrome 154. Videoen bruger mine syntetiske klip fra 582 (`klip-582.mjs`, i `%TEMP%`, intet klip i repoet).
- `outputs/kritik-585/karruseller-585.mjs` + `karruseller-585.json` + `K*-390-*.png`: blok 2, slides i telefonstørrelse og Mål dit billede med Setus tegnede krop.
- `outputs/kritik-585/verify-kritik-585.mjs`: `--blok 1` og `--blok 2`.

**Blok 1, kort:**
- **W0:** Mål dit billede på sitet er blob for blob dhruva main `291f5bf`.
- **W1-W3:** filmeguiden følger vejledningen. Syv påstande står ordret eller næsten ordret dér, og al den gamle tekst er væk.
- **W4-W6:** lukket i sitets kopi. "Ligner"-linjen fylder under en halv skærm med "Mere", der står "fejlfigurerne", og skulderpunktet på bænken er det samme overalt.
- **Virker:**
  - 11 sider på 3 bredder med 0 JS-fejl, og 45 links med 0 fejl 404.
  - 42 "Ligner"-tilfælde er rigtige, og de seks punkter er trykket med fingeren.
  - Video i 29,97 og variabel billedrate: hvert tryk er ét billede, og foto = vist = facit.
  - Siden er stadig noindex.
- **W7 (lav):** Min krop og De tre løft er 37c9a27-udgaven. Main har kun en ulæst tekst mere i bundtet.
- **W8 (lav):** filmeguiden nævner ikke sumo og telefonen i hånden. Karrusel 2 gør. Det er ikke i strid.

**Blok 2, kort:**
- **K3:** slide 3 er Mål dit billedes egen tabel. Jeg har målt den igen: fire rækker ordret, kun knæet i guld og "Ligner ikke" som i værktøjet.
- **K4:** figuren er mærket "tegnet, ikke modellens egen fejlfigur".
- **K1:** billedteksten nævner ikke artiklerne.
- **K5:** der står seks punkter, ikke syv.
- **K2:** filmeguiden og karrusel 2 siger det samme.
- **Marcs regler, læsbarhed og 16 af 16 påstande holder** i begge karruseller. Karrusel 2 er byte for byte som i 576.
- **K7 (middel, Marc):** efter mergen linker intet på sitet til `/vaerktoejer/`.

## Testresultat

- `node outputs/kritik-585/vaerktoejer-585.mjs`: 33/33 grønne.
- `node outputs/kritik-585/karruseller-585.mjs`: 20/20 grønne.
- `node outputs/kritik-585/verify-kritik-585.mjs --blok 1`: grøn (før commit 1).
- `node outputs/kritik-585/verify-kritik-585.mjs --blok 2`: grøn. Den tjekker også:
  - at de 36 filer i setu-573 har samme sha256 som ved målingen,
  - at `vaerktoejer` stadig er `eb7bf79`, og at dhruva main stadig er `291f5bf`,
  - at commit-beskederne kun er ASCII.
- `npm run lint`: grøn (inde i verify).

Mine to første kørsler af blok 1 havde to røde tjek, W4 og W5. Begge var for stramme tjek, ikke fejl på siden:
- Korte "Ligner"-linjer har intet "Mere", og det behøver de ikke.
- Squattens link hedder "Se fejlen i hele opturen" og ikke "fejlfiguren".

## Hvad er næste

**Marc, udgivelsen. Rækkefølgen er: værktøjssiden live, et link til den, og først derefter karrusellerne.**

Ét forhold skal du kende først. Din lokale `main` i sitet er 7 commits foran `origin/main`, som den så ud ved sidste fetch. Det er ordre 257 (live-eftersyn) og ordre 271 (artikel-skabelon og to dødløftartikler). Pusher du den lokale main, går de også ud. Trinene nedenfor bygger derfor på GitHubs main, så kun værktøjssiden går ud. Vil du også have de 7 ud, er det et separat valg.

Alt i din egen PowerShell:

1. **Læs filmeguiden.** Teksten er Setus og ikke din egen stemme.
   ```powershell
   start C:\Users\Entropi\Desktop\entropi-coaching-site-wt2\vaerktoejer\index.html
   ```
   Rul ned til "Filmeguide". Vil du ændre en formulering, så bed Setu om det på `vaerktoejer`, før du går videre.

2. **Hent GitHubs stand og se, hvad der går ud.**
   ```powershell
   cd C:\Users\Entropi\Desktop\entropi-coaching-site
   git fetch origin
   git log --oneline origin/main..vaerktoejer
   ```
   Listen skal vise 17 commits fra Setu, ordre 491 til 584, der kun rører `vaerktoejer/`, `assets/vaerktoejer/` og `robots.txt` (målt mod `origin/main` = `8df8846`). Står der andet, så stop og skriv til Dhruva.

3. **Lav en ren mappe fra GitHubs main og merge værktøjerne ind.** Dine andre mapper og grene røres ikke.
   ```powershell
   git worktree add ..\entropi-coaching-site-deploy -b deploy-vaerktoejer origin/main
   cd ..\entropi-coaching-site-deploy
   git merge --no-ff vaerktoejer -m "merge: vaerktoejer (ORDRE 570, 579, 584, Setu)"
   ```
   Siger git "CONFLICT", så skriv `git merge --abort` og send besked til Dhruva. Med GitHubs main fra sidste fetch gav `merge-tree` ingen konflikt.

4. **Valgfrit: skal siden kunne findes på Google?** Hvis ja, så åbn filen, slet linje 6 (`<meta name="robots" content="noindex, nofollow">`) og gem:
   ```powershell
   notepad vaerktoejer\index.html
   git add vaerktoejer\index.html
   git commit -m "vaerktoejer: fjern noindex"
   ```
   Hvis nej, så spring trinnet over. `robots.txt` holder under alle omstændigheder `/assets/vaerktoejer/` ude.

5. **Et link fra sitet til `/vaerktoejer/` (K7).** Det kræves, før karrusellerne postes, for billedteksterne siger "ligger på entropicoaching.dk". Hvor linket skal stå, er dit valg. Der er to veje:
   - **Anbefalet:** bed Setu om én commit på `vaerktoejer` med linket (fx et kort på `viden.html`). Kør derefter trin 3 igen fra en ny mappe, eller `git merge vaerktoejer` i deploy-mappen.
   - **Selv:** `notepad viden.html`, sæt et link med `href="vaerktoejer/"` ind, hvor du vil have det, og gem. Derefter:
     ```powershell
     git add viden.html
     git commit -m "viden: link til vaerktoejer"
     ```
   Vil du vente med linket, kan værktøjssiden godt gå ud uden. Så venter karrusellerne.

6. **Deploy.**
   ```powershell
   git push origin HEAD:main
   ```
   GitHub Pages bygger sitet på et par minutter.

7. **Tjek live, på telefonen og på computeren.**
   ```powershell
   start https://entropicoaching.dk/vaerktoejer/
   start https://entropicoaching.dk/assets/vaerktoejer/maal-billede/index.html
   ```
   Siden skal vise "Filmeguide". Mål dit billede skal åbne et foto eller en video fra din egen telefon. Prøv ét klip filmet på din iPhone. Det er ikke prøvet af nogen (se Ærlige grænser).

8. **Ryd op.**
   ```powershell
   cd C:\Users\Entropi\Desktop\entropi-coaching-site
   git worktree remove ..\entropi-coaching-site-deploy
   git branch -d deploy-vaerktoejer
   ```

9. **Karrusellerne**, når trin 5-7 er gjort:
   ```powershell
   start C:\Users\Entropi\Desktop\ordrer\kilder\setu-573\karrusel-1-maal-dit-billede
   Get-Content C:\Users\Entropi\Desktop\ordrer\kilder\setu-573\billedtekst-1.txt -Encoding UTF8 | Set-Clipboard
   ```
   - Læg `slide-01.png` til `slide-08.png` i rækkefølge i ét Instagram-opslag og indsæt billedteksten.
   - Gør det samme med `karrusel-2-film-dit-loeft` (6 slides) og `billedtekst-2.txt`.
   - Teksten er beskrivende og ikke din egen stemme. Vil du have din egen slide med, så læg den i `slides.mjs` og kør `node lav.mjs 1` i `setu-573`. Ellers skal intet køres.

**Andre:**
- **Setu, næste gang han kopierer (ikke før deploy):**
  - W7: `dist/min-krop/` og `dist/tre-loeft/` fra dhruva main.
  - W8: én linje om sumo i filmeguiden, hvis Marc vil.
  - K6: etiketterne på 34-36 px, hvis Marc vil.
- **Bhishak:** intet før Marc har udgivet. Derefter kan jeg måle den live side headless (siderne, 404 og "Ligner").
- **Hara:** på Coaching-planeten er værktøjssiden og karrusellerne nu klar. Sporet "løft-artikler på entropicoaching.dk" venter kun på Marcs deploy og hans link. Der er ingen rettelser tilbage hos Setu eller Yantra.

## Ærlige grænser

- **Ingen rigtig telefon:** alt er headless Chrome på Windows med mobilemulering. Hverken et rigtigt iPhone-klip i Safari eller Instagram på en telefon er prøvet.
- **GitHubs stand er fra sidste fetch:** jeg har ikke hentet fra GitHub. At lokal main er 7 foran `origin/main`, og at mergen er ren, gælder `origin/main` = `8df8846`. Trin 2 og 3 viser Marc den rigtige stand.
- **"Ligner" er ikke målt på rigtige løft:** tilfældene er modellens egne tegnede stillinger fotograferet vinkelret. Falsk alarm med skrå kameraer og klikfejl står i Yantras dokument.
- **Karrusellernes sandhed** er holdt op mod vejledningen og FILM-KLIP. Kun slide 3 er målt selv, i værktøjet.
- **Filmeguiden og karrusellerne** er Setus tekst og ikke Marcs. Det er ikke en fejl, men Marc bør læse dem (trin 1 og 9).
- **Ingen atletdata** er brugt eller skrevet. Kroppene og klippene er syntetiske.
