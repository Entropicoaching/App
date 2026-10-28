// Compose HVILE into an older feature baseline without editing its pinned bytes.
// OFF comparisons still compare every DOM property and handler of the other feature.
export function withHvileBaseline(source) {
  const marker = '                  {(viewedWeek.sessions || []).map(session => {'
  if (source.split(marker).length !== 2) throw Error('Expected one pinned session loop')
  return "import RestDays from './RestDays.jsx';\nimport { isRestSession } from './restDays.mjs';\n" +
    source.replace(marker,
      '                  <RestDays week={viewedWeek} weekStart={weekStartDate(allWeeks, viewedWeek.week_number)} />\n\n                  {(viewedWeek.sessions || []).filter(session => !isRestSession(viewedWeek, session)).map(session => {')
}
