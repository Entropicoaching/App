// Pinnet R1-UP-T1-data, uforandret JSON efter eksportprefix.
export const coachTekstData = {
  "schema": "up-t1-coachtekster/v1",
  "sprog": "da",
  "bemaerkning": "Kladder til coachen. Coachen kan rette frit før afsendelse. Intet her ændrer programmet automatisk.",
  "automatiskProgramaendring": false,
  "pladsholdere": {
    "atlet": "Atletens fornavn",
    "coach": "Coachens fornavn",
    "gennemfoert": "Antal gennemførte sæt i ugen",
    "planlagt": "Antal planlagte sæt i ugen",
    "oevelser": "Øvelser uden fuld dækning, skilt med komma",
    "antal": "Antal sæt hvor atletens egen vurdering mangler eller ikke kan bruges",
    "gns": "Gennemsnit af atletens egen vurdering, 1 til 10"
  },
  "afslutning": "Hilsen {coach}",
  "situationer": {
    "fuld_uge": {
      "navn": "Fuld uge",
      "naarModulMelder": "status fuld",
      "bruger": ["atlet"],
      "tekst": "Hej {atlet}. Flot arbejde, du har gennemført alle sæt i ugens program. Hvordan føltes ugen for dig? Skriv gerne, hvis noget var for let, for tungt eller drillede."
    },
    "delvis_uge": {
      "navn": "Delvis uge",
      "naarModulMelder": "status delvis",
      "bruger": ["atlet", "gennemfoert", "planlagt", "oevelser"],
      "tekst": "Hej {atlet}. Tak for ugens træning. Der er registreret {gennemfoert} gennemførte sæt, og ugens program havde {planlagt} planlagte sæt. Der mangler stadig sæt i disse øvelser: {oevelser}. Det er helt i orden, at en uge ikke går efter planen. Hvad kom i vejen, og hvad kan gøre næste uge nemmere at passe ind i din hverdag?"
    },
    "sprunget_over": {
      "navn": "Uge sprunget over",
      "naarModulMelder": "status sprunget_over",
      "bruger": ["atlet"],
      "tekst": "Hej {atlet}. De sæt, der er registreret i denne uge, er markeret som sprunget over. Hvordan gik resten af ugen? Fortæl gerne, også hvis du har trænet uden at registrere det. Så finder vi sammen ud af, hvordan næste uge bedst passer til dig."
    },
    "manglende_oevelse": {
      "navn": "Manglende øvelse",
      "naarModulMelder": "status delvis og mindst ét træningspas har manglendeOevelser",
      "bruger": ["atlet", "oevelser"],
      "tekst": "Hej {atlet}. I denne uge manglede der sæt i disse øvelser: {oevelser}. Var det tiden, smerter, manglende udstyr eller noget fjerde? Sig til, så finder vi ud af, om øvelsen skal tages igen eller erstattes."
    },
    "manglende_rpe": {
      "navn": "Manglende vurdering af hvor hårdt det føltes",
      "naarModulMelder": "rpe.saetUdenRpe plus rpe.ugyldigeRpe er over nul, og der er gennemførte sæt",
      "bruger": ["atlet", "antal"],
      "tekst": "Hej {atlet}. Til {antal} sæt mangler din egen vurdering af, hvor hårdt det føltes, på en skala fra 1 til 10. Den hjælper mig med at forstå, hvordan ugen var for dig. Skriv den gerne ind næste gang, også hvis du er i tvivl. Dit bedste gæt er godt nok."
    },
    "hoej_rpe": {
      "navn": "Høj vurdering af hvor hårdt det føltes",
      "naarModulMelder": "rpe.gennemsnit er 9 eller derover, og der er gennemførte sæt",
      "bruger": ["atlet", "gns"],
      "tekst": "Hej {atlet}. Din egen vurdering af, hvor hårdt ugen føltes, lå i gennemsnit på {gns} af 10. Det er højt, og din oplevelse tæller. Hvordan har du det med kroppen og energien lige nu? Vi taler om det, før vi beslutter noget om næste uge."
    }
  }
}
