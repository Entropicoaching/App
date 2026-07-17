# Startprompt til ny chat — fix bugs i draft.py / send-program.ps1

Jeg vil have rettet en række bugs i mit coaching-app's ugentlige udkast-flow. Filerne er:
- `C:\Users\Entropi\Desktop\entropi-agent\draft.py` (genererer næste uges træningsudkast som JSON)
- `C:\Users\Entropi\Desktop\entropi-app\supabase\send-program.ps1` (sender udkast-JSON til Supabase)
- Supabase project ID: `dsqgaxwgtcbqgphsofav`

Læs begge filer først, og ret derefter følgende:

**1. "Seneste uge"-logik i draft.py er forkert.**
Scriptet vælger i dag simpelthen den uge med højeste `week_number` i databasen som kilde til kopiering. Det er forkert hvis der allerede ligger en ufærdig eller fremtidig kladde-uge i systemet — så kopierer den den ufærdige uge i stedet for den senest faktisk trænede. Ret til: vælg den seneste uge hvor `start_date <= CURRENT_DATE` (evt. med flest faktiske exercise_logs), ikke bare højeste week_number.

**2. Blind ±2,5 kg-progression rammer placeholder-øvelser.**
Progressionsreglen lægger/trækker 2,5 kg på ALLE øvelser hvor faktisk RPE afviger fra target — inklusive øvelser hvor `recommended_weight = 0` (bodyweight/vælg-selv-vægt-placeholder, fx accessories). Det gav bl.a. "Leg press 0 → 2,5 kg" og endda negative vægte. Ret til: skip progression helt på øvelser hvor baseline-vægten er 0.

**3. Manglende kollisionshåndtering på start_date.**
Der ligger nu en UNIQUE constraint i databasen på `weeks(athlete_id, start_date)`, så scriptet vil fejle med en constraint-violation hvis det prøver at oprette en uge der kolliderer med en eksisterende. Ret `send-program.ps1` (og evt. draft.py) til at fange denne fejl pænt og printe en tydelig besked om HVILKEN eksisterende uge der kolliderer, i stedet for et rå Postgres-fejl-dump. Scriptet må aldrig selv ændre datoen for at tvinge det igennem.

**4. Manglende validering før afsendelse.**
Tilføj et sanity-check i draft.py (eller som separat trin) der, før JSON'en gemmes:
   - Sammenligner antal sessioner i udkastet med atletens etablerede ugentlige frekvens (seneste 2-3 ugers faktiske sessionsantal) og advarer ved mismatch.
   - Tjekker at alle sessioner har `weekday` sat (0-6) og fornuftig `session_order`.

**5. Encoding-bug i terminal-output.**
`--vis`-outputtet printer danske tegn forkert (æ/ø/å bliver til `�`/mojibake) i PowerShell. Ret encoding (fx `chcp 65001` / sæt `PYTHONIOENCODING=utf-8` / `sys.stdout.reconfigure(encoding='utf-8')` i draft.py) så output er læsbart.

Gå igennem én ting ad gangen, vis mig diffen for hver rettelse, og lad mig teste undervejs — ikke en stor omskrivning på én gang.
