// Short display copies of existing catalogue reasons, retaining their limits.
// Full source metadata remains on the generated food and saved draft.
const reasons = new Map([
  ['Skyr naturel', 'Mælkeprotein; leucinmængden er ikke registreret.'],
  ['Kyllingebryst', 'Protein med essentielle aminosyrer; andre kilder kan dække behovet.'],
  ['Tofu fast', 'Plantebaseret protein; tilpas portion og dagens samlede protein.'],
  ['Havregryn', 'Fuldkorn; fibermængden er ukendt, og mavekomfort varierer.'],
  ['Linser kogte', 'Bælgfrugt med protein og fibre; dokumenterer ikke jerndækning.'],
  ['Ris kogt', 'Kulhydratkilde; behov og timing afhænger af resten af dagen.'],
  ['Broccoli', 'Grøntsag til variation; dokumenterer ikke mikronæringsdækning.'],
  ['Laks fersk', 'Fed fisk med protein; D-vitaminmængde og dækning er ukendt.'],
  ['Hakket oksekød 8%', 'Hæmjern og kreatin: mængder og behov er ukendte. Følg kostråd om rødt kød.'],
].map(([name, reason]) => ['local:' + encodeURIComponent(name), reason]))

export function suggestionReason(foodId, catalogueReason) {
  return typeof catalogueReason === 'string' && catalogueReason.trim()
    ? reasons.get(foodId) ?? null : null
}
