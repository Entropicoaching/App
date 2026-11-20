// 1921 (Marc 19. nov.: "gøre en træls gentagelig handling lidt nemmere"): et logget måltid
// "Fødevare · 60 g" kan logges igen med en anden mængde uden at søge fødevaren frem.
// Ren model: finder fødevaren i kostloggens egen liste; ingen ny læsning.
export function andenMaengde(snapshot, meal) {
  const m = /^(.+) · (\d+(?:[.,]\d+)?) g$/.exec(String(meal?.meal ?? ''))
  if (!m || !snapshot?.loaded) return null
  const foods = snapshot.foods ?? []
  const index = foods.findIndex(food => food?.name === m[1])
  return index < 0 ? null : { index, name: m[1], unit: 0, amount: m[2] }
}
