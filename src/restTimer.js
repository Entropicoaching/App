// ORDRE 76 — "stille fejl, runde 4", G5: hviletimerne i mobilisering
// (ExerciseTimer, MobilityGuideStep) talte ned via setTimeout(...,1000) og
// et tick-tal i state. Låses telefonen midt i et hold — almindeligt, man
// lægger telefonen og strækker sig — bliver setTimeout-kæden throttlet
// eller helt sat på pause af browseren i baggrunden. Nedtællingen driver
// eller springer uforudsigeligt ved genoptagelse, uden nogen besked om at
// den er upålidelig i baggrunden.
//
// remainingSeconds regner ud fra tidsstempler (hvor mange sekunder der var
// tilbage da det aktive segment startede, og hvornår "nu" faktisk er), ikke
// ud fra hvor mange ticks der nåede at køre. Uanset hvor længe fanen har
// været i baggrunden, giver et enkelt kald det korrekte resultat — der er
// intet at indhente. Ren funktion, enhedstestbar uden React/DOM.
export function remainingSeconds(remainingAtStart, startedAt, now = Date.now()) {
  if (startedAt == null) return remainingAtStart
  const elapsed = Math.floor((now - startedAt) / 1000)
  return Math.max(0, remainingAtStart - elapsed)
}
