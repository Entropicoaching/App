# Forslag til Marc (ordre 123)

Højst ti linjer — det der kræver din dom, ikke min.

1. **Kontrast** (axe "serious", uændret i alle 6 skærme): de dæmpede farver
   `#4a4844` og `#7a7770` på `#141410`/`#1c1c18`-baggrund består ikke WCAG AA.
   Rammer bl.a. Login's "Glemt adgangskode?", check-in's talhjælpetekster og
   programmets ugenummer/dato. Kræver formentlig én til to lysere nuancer i
   paletten — jeg har bevidst ikke rettet paletten (jf. ordren).
2. **Check-in's "timer"-felt** (søvntimer-input) er ~39px højt, lige under
   44px-grænsen — den eneste trykflade jeg fandt, men ikke nåede at rette i
   dette commit.
3. **Login på desktop**: formularen står midt i en meget høj, tom mørk side —
   fungerer, men er det den visning du vil have på en bred skærm, eller skal
   den centreres lodret/have en visuel højreside?
4. **Videocoach-forsiden på desktop** har tre knapper (Video/Bane/Eksport,
   78×36px) under 44px — Bhishaks spor (`videocoach.html`), rørt ikke her.
