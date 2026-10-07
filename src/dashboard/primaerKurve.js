// Ordre 1502 (fund 2): kurven paa "Primaere loeft" og dens overskrift/enhed skal altid passe sammen.
// e1RM naar der er tunge saet; ellers viser vi de faktiske kg og siger det.

export function primaerKurve(ls) {
  const e1rm = ls?.e1rmData || []
  if (e1rm.length) return { data: e1rm, enhed: 'e1RM', note: null }
  return { data: ls?.actualData || [], enhed: 'kg', note: 'kg (ingen tunge sæt til e1RM)' }
}

export function primaerOverskrift(lifts) {
  const alleE1rm = lifts.every(l => primaerKurve(l.s).enhed === 'e1RM')
  return alleE1rm
    ? 'Primære løft — e1RM af tungeste tunge sæt per dag (kg)'
    : 'Primære løft — e1RM per dag; løft uden tunge sæt vises i faktiske kg (står ved løftet)'
}
