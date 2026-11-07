// Same { name, text } contract as dashboard/coachTemplateMessages.mjs.
// Unwired drafts: the coach chooses a situation, edits and approves the text.
// No athlete data, numeric claims, storage access or sending on import.
export const WEEKLY_LETTER_TEMPLATES = Object.freeze([
  {
    name: 'God uge',
    text: 'Hej {atlet}. Dejligt at høre, at ugen har føltes god for dig.\n\nLad os tage det, der fungerede i hverdagen, med ind i den kommende uge.\n\nHvad vil du især gerne holde fast i?',
  },
  {
    name: 'Misset træning',
    text: 'Hej {atlet}. Tak fordi du fortæller om træningen, der ikke blev til noget.\n\nLad os tilpasse den kommende uge til det, der er realistisk for dig, uden at presse de missede pas ind.\n\nHvad stod mest i vejen for træningen?',
  },
  {
    name: 'Smerte i træningen',
    text: 'Hej {atlet}. Tak fordi du fortæller om smerten.\n\nLad os afklare, hvordan du oplever den, før vi aftaler den videre træning. Du skal ikke presse dig gennem smerte for at følge planen.\n\nHvordan påvirker smerten dig under og efter træning?',
  },
  {
    name: 'Stævneforberedelse',
    text: 'Hej {atlet}. Jeg vil gerne høre, hvordan du har det med det kommende stævne.\n\nLad os gennemgå den aftalte forberedelse, så du ved, hvad du skal forholde dig til frem mod dagen.\n\nHvad vil du helst have afklaret inden stævnet?',
  },
  {
    name: 'Deload',
    text: 'Hej {atlet}. Jeg vil gerne følge op på, hvordan den aftalte rolige uge passer til dig.\n\nLad os holde fokus på den planlagte aflastning og bruge din oplevelse, når vi aftaler næste skridt.\n\nHvordan føles træningen i den rolige uge?',
  },
  {
    name: 'Kostopfølgning',
    text: 'Hej {atlet}. Jeg vil gerne høre, hvordan vores aftaler om kosten fungerer i din hverdag.\n\nLad os vælge det, der er mest relevant at arbejde videre med, ud fra det du fortæller og har registreret. Dage uden registrering fortæller os ikke, hvad du har spist.\n\nHvad har gjort det let eller svært at følge vores aftaler?',
  },
  {
    name: 'Søvn',
    text: 'Hej {atlet}. Jeg vil gerne høre din egen oplevelse af søvnen i denne uge.\n\nLad os se på, hvad der fylder omkring din søvn, og finde et overskueligt fokus sammen. Manglende registreringer er ikke det samme som manglende søvn.\n\nHvad har især påvirket din søvn i denne uge?',
  },
  {
    name: 'Ny blok',
    text: 'Hej {atlet}. Nu skal vi sammen finde retningen for den nye træningsblok.\n\nLad os afstemme fokus med dine ønsker og den tid og energi, du har til rådighed.\n\nHvad vil du gerne have, at vi prioriterer i den nye blok?',
  },
  {
    name: 'Travl hverdag',
    text: 'Hej {atlet}. Tak fordi du fortæller, at hverdagen er travl lige nu.\n\nLad os gøre den kommende uges plan overskuelig, så træningen kan passe ind i det, du faktisk har plads til.\n\nHvad er realistisk for dig at prioritere i den kommende uge?',
  },
  {
    name: 'Tilbage efter pause',
    text: 'Hej {atlet}. Jeg vil gerne hjælpe dig med at finde en rolig vej tilbage efter pausen.\n\nLad os aftale en start, der passer til, hvordan du har det nu, frem for at tage udgangspunkt i det, du tidligere kunne.\n\nHvad vil gøre det trygt og overskueligt for dig at komme i gang igen?',
  },
  {
    name: 'Tvivl om en øvelse',
    text: 'Hej {atlet}. Tak fordi du siger til, når en øvelse giver anledning til tvivl.\n\nLad os afklare det, du er usikker på, så næste pas bliver lettere at gå til.\n\nHvilken del af øvelsen vil du gerne have hjælp til?',
  },
  {
    name: 'Manglende registreringer',
    text: 'Hej {atlet}. Jeg har ikke nok registreringer til at danne et sikkert billede af din uge.\n\nLad os tage udgangspunkt i din oplevelse; de manglende registreringer fortæller ikke, om du har fulgt planen.\n\nHvad vil du gerne fortælle mig om, hvordan ugen er gået?',
  },
].map(template => Object.freeze(template)))
