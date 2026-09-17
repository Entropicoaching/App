// ORDRE 263 · commit 1 — "Dagens pas" skal vise præcis det næste sæt, ikke
// hele planlægningen. Rene funktioner (ingen React/DOM), samme mønster som
// restTimer.js/warmupOverride.js, så de enhedstestes uden en rigtig browser.
// Session/øvelse-rækkefølgen antages allerede sorteret efter
// session_order/exercise_order (se fetchProgram i AthleteView.jsx).

export function sessionSetTotal(session) {
  return (session?.exercises || []).reduce((acc, ex) => acc + (ex.sets || 0), 0)
}

export function sessionLoggedCount(session, logs) {
  const ids = new Set((session?.exercises || []).map(ex => ex.id))
  return (logs || []).filter(l => ids.has(l.exercise_id)).length
}

// Samme regel som ProgramTab.jsx's isDone: alle sæt skal have en log-række
// (logget ELLER sprunget over) — ikke bare "øvelsen er rørt".
export function isSessionDone(session, logs) {
  const total = sessionSetTotal(session)
  return total > 0 && sessionLoggedCount(session, logs) >= total
}

// Første øvelse (i rækkefølge) med et sæt der endnu ikke har en log-række,
// og det sæts nummer. Null hvis alle sæt i sessionen er logget/sprunget over.
export function nextSetInSession(session, logs) {
  for (const ex of session?.exercises || []) {
    const total = ex.sets || 0
    for (let setNumber = 1; setNumber <= total; setNumber++) {
      const logged = (logs || []).find(l => l.exercise_id === ex.id && l.set_number === setNumber)
      if (!logged) return { exercise: ex, setNumber, totalSets: total }
    }
  }
  return null
}

function firstSessionWithContent(week) {
  return (week?.sessions || []).find(sess => (sess.exercises || []).length > 0) || null
}

// Leder fremad gennem ugerne (fra fromIdx) efter den første session med
// øvelser i — "hvad der er næste dag" når der intet er tilbage i denne uge.
function findUpcoming(allWeeks, fromIdx) {
  const weeks = allWeeks || []
  for (let i = Math.max(fromIdx, 0); i < weeks.length; i++) {
    const session = firstSessionWithContent(weeks[i])
    if (session) return { week: weeks[i], session }
  }
  return null
}

// "Dagens pas": den første ikke-færdige session i den aktive uge og dens
// næste sæt (status 'open'). Er alle sessioner i ugen færdige eller tomme,
// afgøres om noget rent faktisk blev gennemført ('done' — fejres) eller om
// ugen bare ikke havde noget i dag ('empty' — neutralt), og der ledes
// fremad efter en forhåndsvisning af det næste (upcoming).
export function findDagensPas(allWeeks, currentWeek, exerciseLogs) {
  if (!currentWeek) return null
  const weeks = allWeeks || []
  const weekIdx = weeks.findIndex(w => w.id === currentWeek.id)
  const openSession = (currentWeek.sessions || []).find(sess =>
    (sess.exercises || []).length > 0 && !isSessionDone(sess, exerciseLogs))
  if (openSession) {
    return { status: 'open', session: openSession, next: nextSetInSession(openSession, exerciseLogs) }
  }
  const hasAnyProgress = (currentWeek.sessions || []).some(sess => sessionLoggedCount(sess, exerciseLogs) > 0)
  const upcoming = findUpcoming(weeks, weekIdx + 1)
  return { status: hasAnyProgress ? 'done' : 'empty', upcoming }
}

// Det tungeste sæt (højeste vægt) fra sidste gang øvelsen blev trænet — ikke
// dags dato (excludeDate), så et allerede loggede sæt i den igangværende
// session ikke forveksles med "sidste gang". history[navn] kommer fra
// AthleteView.jsx's fetchExerciseHistory (nyeste dato først).
export function lastHeaviestSet(history, exerciseName, excludeDate) {
  const entries = history?.[exerciseName?.toLowerCase()]
  if (!entries || !entries.length) return null
  const entry = entries.find(e => e.date !== excludeDate)
  if (!entry || !entry.sets?.length) return null
  return entry.sets.reduce((best, set) => (set.weight > (best?.weight ?? -1) ? set : best), null)
}
