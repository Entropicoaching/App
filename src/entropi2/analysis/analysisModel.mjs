import { estimatedOneRepMax, erDeloadBlok } from '../../exerciseProgress.js'
import { calendarDaysBetween } from '../../calendarDate.js'
import { heavyPointEvidence } from '../../dataEvidence.mjs'
import { hasEnoughData } from '../../dataEnough.mjs'
import { adaptPublicContract } from './publicContract.mjs'
import { weekOverview } from './weekOverview.mjs'

export const QUESTIONS = Object.freeze(['Hvor står jeg?', 'Hvad går godt?', 'Hvad arbejder vi med nu?'])
const kg = n => String(n).replace('.', ',')
const instruction = 'Log vægt og gentagelser på tunge sæt i samme øvelse og samme rep-område (1–3, 4–6 eller 7–8) på mindst fire forskellige dage over mindst 21 dage inden for 84 dage. Nyeste dag skal være højst 14 dage gammel. Programblokken skal være kendt; deload, taper og aflastning indgår ikke.'

export function analysisModel(props = {}, now = new Date()) {
  const contract = adaptPublicContract(props, now)
  const answers = QUESTIONS.map((title, i) => ({ key: ['status', 'good', 'focus'][i], title,
    message: i === 2 ? 'Åbn dit program og log vægt og gentagelser efter hvert sæt. En aktuel dateret programuge er nødvendig for at vise fokus.' : instruction,
    destination: i === 2 ? 'program' : 'hjem', action: i === 2 ? 'Åbn program' : 'Log i dagens pas' }))
  const groups = new Map()
  for (const row of contract.rows) {
    const key = JSON.stringify([row.liftKey, row.repZone])
    groups.set(key, [...(groups.get(key) || []), row])
  }
  const series = [...groups.values()].map(rows => {
    // Group validated Danish dates without depending on global appData2 or
    // the device timezone. Use the existing metric formula and evidence gate.
    const days = new Map()
    for (const r of rows) {
      const value = estimatedOneRepMax(r.weight, r.reps_completed)
      if (!(value > 0)) continue
      const old = days.get(r.logged_at)
      if (!old || value > old.value || (value === old.value && r.weight > old.weight))
        days.set(r.logged_at, { dag: r.logged_at, weight: r.weight, reps: r.reps_completed,
          navn: r.exercises.name, deload: false, value, e1rm: Math.round(value) })
    }
    const points = [...days.values()].sort((a, b) => a.dag.localeCompare(b.dag))
    const lift = rows[0].lift
    return { lift, zone: rows[0].repZone, points,
      ready: hasEnoughData('D18', { rows: points.map(p => heavyPointEvidence(p, lift)) }) &&
        points.length > 0 && calendarDaysBetween(points.at(-1).dag, contract.today) <= 14 }
  }).filter(s => s.ready).sort((a, b) => b.points.at(-1).dag.localeCompare(a.points.at(-1).dag) || a.lift.localeCompare(b.lift) || a.zone.localeCompare(b.zone))
  if (contract.loading || !contract.historyReady) {
    for (const answer of answers.slice(0, 2)) answer.message = contract.loading
      ? 'Henter løftehistorik. Vent på indlæsningen.'
      : 'Løftehistorikken er ikke klar. Åbn analyse igen for at hente den; log derefter vægt og gentagelser i dagens pas.'
  } else {
    const status = series[0]
    if (status) {
      const last = status.points.at(-1)
      answers[0].value = `${kg(last.e1rm)} kg e1RM`
      answers[0].message = `${status.lift}, ${status.zone} gentagelser. Seneste dagsbedste den ${last.dag}, fra ${kg(last.weight)} kg × ${last.reps}. Beregnet enrepetitionsmaksimum, ikke samlet form eller parathed.`
    }
    const good = series.find(s => s.points.at(-1).e1rm > s.points[0].e1rm)
    if (good) {
      const first = good.points[0], last = good.points.at(-1)
      answers[1].value = `+${kg(last.e1rm - first.e1rm)} kg e1RM`
      answers[1].message = `${good.lift}, ${good.zone} gentagelser: forskel mellem dagsbedste den ${first.dag} og ${last.dag}. Registreringerne viser en stigning; årsagen kan ikke udledes.`
    } else if (series.length) answers[1].message = 'De sammenlignelige registreringer viser ingen stigning fra første til seneste dagsbedste. Fortsæt med at logge vægt og gentagelser i samme øvelse og rep-område. Det siger ikke noget om din indsats eller årsagen.'
  }
  if (contract.activeWeek && contract.exercises.length) {
    const block = contract.week?.block_name
    if (typeof block === 'string' && block.trim()) {
      answers[2].value = block.trim()
      answers[2].message = erDeloadBlok(block)
        ? 'Din aktuelle programblok er en lettere uge. Følg programmets vægte og gentagelser og log dine sæt; de indgår ikke i styrkesammenligningen.'
        : 'Dette er navnet på din aktuelle programblok, ikke en udledt årsag eller anbefaling. Følg øvelserne i programmet og log vægt og gentagelser efter hvert sæt.'
    }
  }
  return { answers, weekOverview: weekOverview(contract, now), setTab: contract.setTab }
}
