// U10b (ordre 115): coachens uge fra Claude. Læser forslagene (én plan pr. dag) fra de
// live kostplan_v1-tabeller med coachens egen klient og sender ugen med én godkendelse
// pr. dag. Databasen sætter selv planen til godkendt; atleten ser kun godkendte versioner.
// Kostmålet er athletes.kcal_target/protein_target. Planens total vises mod det, aldrig som nyt mål.
import { createPlanSnapshot, summarizePlanSnapshot } from '../planSnapshot.mjs'
import { medMikronaering } from '../ugeMikronaering.mjs'
import { day, identifier } from './model.mjs'
import { friFraBasis, friProcent, medFriPct, FRI_NIVEAUER } from '../friPulje.mjs'

const PLANS = 'kostplan_v1_plans', VERSIONS = 'kostplan_v1_versions', APPROVALS = 'kostplan_v1_approvals', SEEN = 'kostplan_v1_seen'
export const MAKS_AFVIGELSE_PROCENT = 10
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export const plusDage = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const fail = () => { throw Error('Ugen fra Claude kunne ikke læses.') }
const rows = result => {
  if (!result || result.error || !Array.isArray(result.data) || result.data.length >= 501) fail()
  return result.data
}
const kort = new Intl.DateTimeFormat('da-DK', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
export const dagNavn = date => kort.format(new Date(`${date}T12:00:00Z`))
const tal = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(value)
const kbh = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' })
const sendtDag = value => { const ms = Date.parse(value); return Number.isFinite(ms) ? kbh.format(new Date(ms)) : null }
const positiv = value => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

// Ren model: rækkerne fra de tre tabeller bliver til 7 dage, status og en låsegrund.
export function weekModel({ plans = [], versions = [], approvals = [], seen = null, athlete, today, start: fixedStart }) {
  if (!identifier(athlete?.id) || !day(today)) fail()
  const targets = { kcal: positiv(Number(athlete.kcal_target)), protein: positiv(Number(athlete.protein_target)) }
  // Arkiverede planer kan ikke godkendes og indgår ikke.
  const perPlan = plans.filter(p => p.athlete_id === athlete.id && uuid(p.id) && day(p.valid_from) && p.status !== 'arkiveret').map(p => {
    const own = versions.filter(v => v.plan_id === p.id).sort((a, b) => b.version_no - a.version_no)
    const latest = own[0]
    if (!latest) return null
    const ownApprovals = approvals.filter(a => a.plan_id === p.id && own.some(v => v.id === a.version_id))
    const latestApproval = ownApprovals.find(a => a.version_id === latest.id)
    // Et forslag fra Claude genkendes på sin første version: samme begrundelse og grundlagsdato for hele ugen.
    const first = own.at(-1)
    return { plan: p, latest, batch: JSON.stringify([first.rationale ?? null, first.basis_as_of ?? null]),
      sent: Boolean(latestApproval), everSent: ownApprovals.length > 0,
      sentOn: latestApproval ? sendtDag(latestApproval.approved_at) : null }
  }).filter(Boolean)
  // Ugerne er 7 dage i træk fra samme forslag. Enkeltdagsplaner (fx en manuel aktivering) er ingen uge.
  const weeks = []
  for (const batch of new Set(perPlan.map(x => x.batch))) {
    const dates = [...new Set(perPlan.filter(x => x.batch === batch).map(x => x.plan.valid_from))].sort()
    for (let i = 0; i < dates.length; i++) {
      if (i && dates[i - 1] === plusDage(dates[i], -1)) continue
      let n = 1
      while (dates.includes(plusDage(dates[i], n))) n++
      for (let k = 0; k + 7 <= n; k += 7) weeks.push({ batch, start: plusDage(dates[i], k) })
    }
  }
  const inWeek = (w, date) => perPlan.filter(x => x.batch === w.batch && x.plan.valid_from === date)
  const weekDates = w => Array.from({ length: 7 }, (_, i) => plusDage(w.start, i))
  const unsentWeek = w => weekDates(w).some(d => inWeek(w, d).some(x => !x.sent))
  weeks.sort((a, b) => a.start.localeCompare(b.start))
  // Den tidligste uge med noget at sende, som ikke er helt forbi; ellers den nyeste sendte uge.
  const chosenWeek = day(fixedStart) ? weeks.find(w => w.start === fixedStart)
    : weeks.find(w => unsentWeek(w) && plusDage(w.start, 6) >= today) ?? weeks.filter(w => !unsentWeek(w)).at(-1)
  if (!chosenWeek) return { state: 'empty', targets }
  const start = chosenWeek.start
  const dates = Array.from({ length: 7 }, (_, i) => plusDage(start, i))
  const days = dates.map(date => {
    // Én plan pr. dato i ugen. Står der flere, vinder et usendt forslag, ellers den nyest sendte.
    const candidates = inWeek(chosenWeek, date)
      .sort((a, b) => Number(a.sent) - Number(b.sent) || String(b.sentOn).localeCompare(String(a.sentOn)))
    const chosen = candidates[0]
    if (!chosen) return { date, label: dagNavn(date), state: 'mangler', meals: [], mealCount: 0, kcal: null, protein: null }
    let meals = [], summary = null, unreadable = false
    try {
      const snapshot = createPlanSnapshot(chosen.latest)
      meals = snapshot.meals.map(meal => ({ name: meal.name,
        portions: meal.portions.map(p => ({ name: p.food.name, grams: p.grams })) }))
      if (meals.length) summary = summarizePlanSnapshot(snapshot).nutrients
    } catch { meals = []; summary = null; unreadable = true }
    return { date, label: dagNavn(date), planId: chosen.plan.id, versionId: chosen.latest.id,
      versionNo: chosen.latest.version_no, rationale: chosen.latest.rationale ?? null,
      state: chosen.sent ? 'sendt' : unreadable ? 'ulaeselig' : chosen.everSent ? 'aendret' : 'udkast', sentOn: chosen.sentOn, unreadable,
      meals, mealCount: meals.length,
      seenOn: chosen.sent && Array.isArray(seen) ? seen.filter(r => r.version_id === chosen.latest.id).map(r => sendtDag(r.seen_at)).filter(Boolean).sort().at(-1) ?? null : null,
      friPct: friFraBasis(chosen.latest.calculation_basis),
      kcal: summary?.energyKcal?.value ?? null, protein: summary?.proteinG?.value ?? null }
  })
  const afvig = (value, target) => value === null || target === null ? null : Math.abs(value - target) / target * 100
  for (const d of days) {
    const procent = [afvig(d.kcal, targets.kcal), afvig(d.protein, targets.protein)]
    d.deviation = procent.includes(null) ? null : Math.max(...procent)
    d.ok = d.state !== 'mangler' && d.mealCount > 0 && d.deviation !== null && d.deviation <= MAKS_AFVIGELSE_PROCENT
  }
  // Delvist sendt (fx en afbrudt sending) er stadig et udkast; ændret efter sending kræver en nyere version.
  const status = days.every(d => d.state === 'sendt') ? 'sendt' : days.some(d => d.state === 'aendret') ? 'aendret' : 'udkast'
  const sentOn = status === 'sendt' ? days.map(d => d.sentOn).sort().at(-1) : null
  const rationale = days.find(d => d.rationale)?.rationale ?? null
  // Set-mærket: kun for en sendt uge og kun når set-tabellen kunne læses (ellers vises intet).
  const seenDays = days.filter(d => d.seenOn).length
  const seenState = status !== 'sendt' || !Array.isArray(seen) ? null : seenDays === 7 ? 'set' : seenDays ? 'delvist' : 'ikke'
  const seenOn = seenState && seenDays ? days.map(d => d.seenOn).filter(Boolean).sort().at(-1) : null
  // 2137: ugens niveau; null når dagene er blandede (fx en afbrudt ændring).
  const planDays = days.filter(d => d.state !== 'mangler')
  const friPct = planDays.length && planDays.every(d => d.friPct === planDays[0].friPct) ? planDays[0].friPct : null
  return { state: 'ready', status, sentOn, friPct, seen: seenState, seenDays, seenOn, start, end: dates[6], days, targets, rationale,
    lock: status === 'sendt' ? null : lockReason(days, targets) }
}

// Én linje, der siger hvorfor knappen er låst. Null betyder, at ugen kan sendes.
export function lockReason(days, targets) {
  const missing = days.find(d => d.state === 'mangler')
  if (missing) return `${missing.label} mangler en plan.`
  const unreadable = days.find(d => d.state === 'ulaeselig')
  if (unreadable) return `${unreadable.label} kan ikke læses.`
  const empty = days.find(d => d.mealCount === 0)
  if (empty) return `${empty.label} har 0 måltider.`
  if (targets.kcal === null || targets.protein === null) return 'Atleten mangler et kostmål.'
  const off = days.find(d => d.deviation === null || d.deviation > MAKS_AFVIGELSE_PROCENT)
  if (off) return off.deviation === null ? `${off.label} kan ikke regnes ud.`
    : `${off.label} afviger ${tal(off.deviation)} % fra målet.`
  return null
}

async function readRows(client, athleteId, today) {
  const plans = rows(await client.from(PLANS).select('id,athlete_id,valid_from,status')
    .eq('athlete_id', athleteId).gte('valid_from', plusDage(today, -6)).order('valid_from', { ascending: true }).limit(501))
  if (!plans.length) return { plans, versions: [], approvals: [], seen: null }
  const ids = plans.map(p => p.id)
  const versions = rows(await client.from(VERSIONS)
    .select('id,plan_id,version_no,effective_from,basis_as_of,rationale,goal,intensity,meals,calculation_basis,portion_guidance').in('plan_id', ids).limit(501))
  const approvals = rows(await client.from(APPROVALS)
    .select('version_id,plan_id,athlete_id,approved_at,approval_kind').in('plan_id', ids).eq('athlete_id', athleteId).limit(501))
  // Set-tabellen er ny (U10f). Mangler den eller svarer den med fejl, vises intet Set-mærke, og ugen læses som før.
  const seenResult = versions.length ? await client.from(SEEN).select('version_id,athlete_id,seen_at')
    .in('version_id', versions.map(v => v.id)).eq('athlete_id', athleteId).limit(501) : null
  const seen = seenResult && !seenResult.error && Array.isArray(seenResult.data) && seenResult.data.length < 501 ? seenResult.data : null
  return { plans, versions, approvals, seen }
}

export async function readClaudeWeek({ client, athlete, today, start }) {
  if (typeof client?.from !== 'function' || !identifier(athlete?.id) || !day(today)) fail()
  const rows = await readRows(client, athlete.id, today)
  // U10d: mikronæring fra de samme versioner, som ugen viser.
  return medMikronaering(weekModel({ ...rows, athlete, today, start }), rows.versions, athlete)
}

// "Send uge": én godkendelse pr. dag med seneste version. Ugen læses igen først, så
// en ændret version aldrig godkendes blindt. Bagefter kontrolleres netop de viste 7 dage.
export async function sendClaudeWeek({ client, athlete, today, shown }) {
  const fresh = await readClaudeWeek({ client, athlete, today })
  if (fresh.state !== 'ready' || shown?.state !== 'ready' || fresh.start !== shown.start
    || fresh.days.some((d, i) => d.versionId !== shown.days[i]?.versionId)) throw Error('Ugen er ændret. Se den igen, før du sender.')
  if (fresh.lock) throw Error(fresh.lock)
  for (const d of fresh.days.filter(d => d.state !== 'sendt')) {
    const result = await client.from(APPROVALS).insert({ version_id: d.versionId, approval_kind: 'coach' }).select('version_id')
    // 23505: godkendelsen findes allerede (fx et tidligere svar, der gik tabt). Den tæller.
    if (result?.error && result.error.code !== '23505') throw Error('Ugen kunne ikke sendes. Prøv igen.')
  }
  const sent = await readClaudeWeek({ client, athlete, today, start: fresh.start })
  if (sent.status !== 'sendt' || sent.days.some((d, i) => d.versionId !== fresh.days[i].versionId))
    throw Error('Ugen blev ikke bekræftet som sendt. Prøv igen.')
  return { sent }
}

// 2137: coachen sætter ugens fri pulje (0, 10, 15, 20 eller 30 %) før afsendelse. Niveauet ligger i
// versionens calculation_basis.fri_pct, og en ny version pr. dag (samme måltider) bærer det, så ingen
// sendt version ændres. Ugen læses igen først; en ændret uge afvises. Allerede rette dage springes over.
export async function setClaudeWeekFri({ client, athlete, today, shown, pct }) {
  if (!FRI_NIVEAUER.includes(Number(pct))) throw Error('Vælg 0, 10, 15, 20 eller 30 %.')
  const fri = friProcent(Number(pct))
  if (typeof client?.from !== 'function' || !identifier(athlete?.id) || !day(today)) fail()
  if (shown?.state !== 'ready' || shown.status === 'sendt') throw Error('Niveauet kan kun sættes, før ugen er sendt.')
  const data = await readRows(client, athlete.id, today)
  const fresh = weekModel({ ...data, athlete, today, start: shown.start })
  if (fresh.state !== 'ready' || fresh.days.some((d, i) => d.versionId !== shown.days[i]?.versionId)) throw Error('Ugen er ændret. Se den igen, før du ændrer niveauet.')
  for (const d of fresh.days.filter(d => d.versionId && d.friPct !== fri)) {
    const latest = data.versions.find(v => v.id === d.versionId)
    const result = await client.from(VERSIONS).insert({ plan_id: latest.plan_id, version_no: latest.version_no + 1,
      effective_from: latest.effective_from, basis_as_of: latest.basis_as_of, calculation_basis: medFriPct(latest.calculation_basis, fri),
      rationale: latest.rationale, goal: latest.goal, intensity: latest.intensity, meals: latest.meals,
      portion_guidance: latest.portion_guidance ?? null }).select('id')
    if (result?.error) throw Error('Niveauet blev ikke gemt for alle dage. Prøv igen.')
  }
  const after = await readClaudeWeek({ client, athlete, today, start: fresh.start })
  if (after.friPct !== fri) throw Error('Niveauet blev ikke bekræftet. Prøv igen.')
  return { week: after }
}
