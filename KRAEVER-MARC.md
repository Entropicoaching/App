# APP-PERATLET1: afklaring af faelles lagring

Status: STOP efter ORDER.md. Ingen funktionsstyring eller schemaaendring er lavet.
Base: f79d5c1bb37362f4dd6d9a50e6e91571cbf276eb.

Coachen og atleten bruger hver sin klient. De fire valg skal derfor gemmes i
faelles lagring med atletens id, saa coachens valg kan laeses paa atletens telefon.
Jeg kan ikke dokumentere et eksisterende felt eller en eksisterende kontrakt til
dette i de pinnede offentlige input. Det minimale SQL-testskema er ikke et komplet
produktionsskema, saa fravaer her er ikke bevis for den faktiske databases felter.

Belæg i de pinnede moduler:

* src/dashboard/atletHandlinger.js: saveEdit sender editData som opdatering af
  athletes med id-filter. Der er ingen saerskilt kontrakt for disse fire valg.
* src/dashboard/OversigtTab.jsx og src/dashboard/NoterTab.jsx bruger eksisterende
  profilfelter og fritekstnoter. Noter maa ikke overtages til skjult konfiguration.
* src/athlete/laesninger.js: fetchAthlete laeser athletes for den aktuelle atlet.
* src/athlete/offlineSnapshot.js gemmer et lokalt snapshot pr. bruger.
  Det er ikke et faelles indstillingslager. Syntetiske proever viser, at to
  klientlagre ikke deler indhold, og at en normal noteredigering erstatter noten.

Marc skal enten udpege en eksisterende faelles lagringskontrakt med tilstraekkelig
coach-skriveadgang og atlet-laeseadgang, eller godkende en ny kolonne og dens
adgangsregler. Et muligt efterfoelgende design er et objekt med fire booleans paa
atletraekken. Det er et forslag, ikke en antagelse om et eksisterende felt.
Ingen migration eller SQL er leveret.

Efter afklaring skal flaget stadig vaere false som standard. Med flaget fra skal
alt fungere som foer. Med flaget til skal manglende valg betyde alt til. Slukning
skal daekke navigation, genveje, kort og direkte fanevalg for kost, mobilitet,
staevne og volumen. Der maa ikke slettes data.
