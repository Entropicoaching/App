// ORDRE 320 · blok 1 — ren funktion for den lokale, optimistiske del af "ret"
// på et allerede klaret sæt (Dagens pas). Den SAMME log-række (matchet på
// exercise_id + set_number, ligesom nextSetInSession selv slår sæt op)
// erstattes ALDRIG (ingen filter+genindsæt, det var undoLoggedSet-genbrugets
// fejl, se docs/KRITIK-314.md fund 3) — kun dens felter opdateres, så
// exerciseLogs beholder samme antal rækker og nextSetInSession derfor aldrig
// ser sættet som uloggede igen. Samme mønster som nextSet.js/setLogDefaults.js:
// ingen React/DOM, enhedstestes med node --test.
export function applySetEdit(exerciseLogs, exerciseId, setNumber, payload) {
  return (exerciseLogs || []).map(l =>
    (l.exercise_id === exerciseId && l.set_number === setNumber) ? { ...l, ...payload } : l
  )
}
