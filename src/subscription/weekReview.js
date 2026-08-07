// Ugens evaluering: rykker du frem i blokken, eller gentager du ugen?
//
// Det her er løkken fra APP-FLOW — følg → evaluér indsats → næste uge — og
// det er den ene ting man betaler for. Før nu steg RPE'en per uge uanset
// hvordan det faktisk gik, hvilket ikke er progressive overload, men bare en
// kalender.
//
// Reglen er ikke opfundet her. Den står i programmernes egen `progression`:
//   "Rammer du toppen af repintervallet i alle sæt, lægger du på næste gang.
//    Ellers gentager du."
// Modulet gør den målbar i stedet for at være en tekst brugeren selv skal
// håndhæve.
//
// SKAL-UAFHÆNGIGT MED VILJE (CT-033): ingen React, ingen Supabase, ingen
// localStorage. Når piloten bliver produktet, følger denne fil med uændret.

import { COMPETITION_LIFTS } from './competitionLifts.js'

// Nederste tal i et repinterval: '8–12' → 8, '5' → 5.
// Målet er bunden, ikke toppen: rammer man ikke bunden, var vægten for tung.
export function minReps(reps) {
  const tal = String(reps).match(/\d+/g)
  if (!tal || !tal.length) return null
  return Math.min(...tal.map(Number))
}

export function maxReps(reps) {
  const tal = String(reps).match(/\d+/g)
  if (!tal || !tal.length) return null
  return Math.max(...tal.map(Number))
}

// Hvordan gik ét løft i én session? Sammenligner de loggede sæt med recepten.
//
// `entry` er { exerciseId, sets: [{ weightKg, reps, rpe }] }.
export function liftOutcome(exercise, entry) {
  const maal = minReps(exercise.reps)
  const top = maxReps(exercise.reps)
  const saet = entry?.sets ?? []

  if (!saet.length) return { status: 'ikke-logget', ramtAlle: false, ramtTop: false }

  // Færre sæt end foreskrevet tæller som ikke gennemført. At lade tre ud af
  // fire sæt tælle som "ramt" ville skjule at volumen manglede.
  const nokSaet = saet.length >= exercise.sets
  const alleOverMaal = saet.every(s => Number(s.reps) >= maal)
  const alleOverTop = top != null && saet.every(s => Number(s.reps) >= top)

  if (!nokSaet) return { status: 'ufuldstændig', ramtAlle: false, ramtTop: false }
  if (!alleOverMaal) return { status: 'missede', ramtAlle: false, ramtTop: false }
  return { status: alleOverTop ? 'ramte-toppen' : 'ramte', ramtAlle: true, ramtTop: alleOverTop }
}

// Ugens dom for konkurrenceløftene. Kun dem — assistancearbejde skal ikke
// kunne blokere en hel blok, og det er ikke det man bliver målt på.
//
// `ugensSessions` er de gennemførte sessions i ugen, hver med `entries`.
export function reviewWeek(program, ugensSessions) {
  const perLoeft = []

  for (const session of program.sessions) {
    for (const exercise of session.exercises) {
      if (!COMPETITION_LIFTS.includes(exercise.lift)) continue

      // Find den loggede session for netop dette pas.
      const loggede = ugensSessions.filter(x => x.dayId === session.id)
      const entry = loggede
        .flatMap(x => x.entries ?? [])
        .find(e => e.exerciseId === exercise.id)

      perLoeft.push({
        lift: exercise.lift,
        exerciseId: exercise.id,
        navn: exercise.name,
        rolle: exercise.role || 'tung',
        ...liftOutcome(exercise, entry),
      })
    }
  }

  // Kun de TUNGE dage afgør om blokken rykker. En let dag er til for at holde
  // fatiguen nede — den skal ikke kunne bremse progressionen.
  const tunge = perLoeft.filter(r => r.rolle === 'tung')
  const utestede = tunge.filter(r => r.status === 'ikke-logget')
  const fejlede = tunge.filter(r => r.status === 'missede' || r.status === 'ufuldstændig')

  // Er intet logget, er der intet at dømme på. Det er hverken fremgang eller
  // tilbagegang — og en uge uden data må ikke skubbe en op i intensitet.
  if (utestede.length === tunge.length) {
    return { dom: 'ingen-data', rykFrem: false, perLoeft, begrundelse: 'Du har ikke logget konkurrenceløftene i denne uge.' }
  }

  if (fejlede.length) {
    const navne = [...new Set(fejlede.map(r => r.navn))].join(' og ')
    return {
      dom: 'gentag',
      rykFrem: false,
      perLoeft,
      begrundelse: `Du ramte ikke rep-målet på ${navne}. Du gentager ugen på samme RPE i stedet for at gå op.`,
    }
  }

  return {
    dom: 'ryk-frem',
    rykFrem: true,
    perLoeft,
    begrundelse: 'Du ramte rep-målet på alle de tunge løft. Næste uge stiger RPE et halvt trin.',
  }
}

// Hvilken uge i blokken står man i, når evalueringerne tages med?
//
// Uden den her ville ugen kun afhænge af hvor mange pas man har taget, og en
// gentaget uge ville alligevel skubbe RPE'en op. `gentagelser` er antallet af
// uger der er dømt 'gentag'.
// Del de gennemførte pas op i uger. En "uge" er `program.days` pas i den
// rækkefølge de blev taget — ikke syv kalenderdage. Samme princip som
// blokugen: man rykker frem ved at træne, ikke ved at datoen skifter.
//
// Den sidste gruppe er kun med hvis den er hel. En halv uge kan ikke dømmes.
export function completedWeeks(program, sessions) {
  const gennemfoerte = sessions.filter(x => x.completedAt)
  const uger = []
  for (let i = 0; i + program.days <= gennemfoerte.length; i += program.days) {
    uger.push(gennemfoerte.slice(i, i + program.days))
  }
  return uger
}

// Hele historikken dømt uge for uge, og hvor man står nu.
export function blockStatus(program, sessions, blokUger) {
  const uger = completedWeeks(program, sessions)
  const domme = uger.map(uge => reviewWeek(program, uge))
  const gentagelser = domme.filter(d => d.dom === 'gentag').length
  return {
    uger: uger.length,
    gentagelser,
    ugeIBlok: effectiveWeek(uger.length, gentagelser, blokUger),
    seneste: domme.length ? domme[domme.length - 1] : null,
    // Pas taget siden sidste hele uge — hvor langt man er inde i den nuværende.
    iGang: sessions.filter(x => x.completedAt).length - uger.length * program.days,
  }
}

export function effectiveWeek(gennemfoerteUger, gentagelser, blokUger) {
  const netto = Math.max(0, gennemfoerteUger - gentagelser)
  return (netto % blokUger) + 1
}
