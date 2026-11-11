// U10b (ordre 115): coachens uge fra Claude. Læser forslagene (én plan pr. dag) fra de
// live kostplan_v1-tabeller med coachens egen klient og sender ugen med én godkendelse
// pr. dag. Databasen sætter selv planen til godkendt; atleten ser kun godkendte versioner.
// Kostmålet er athletes.kcal_target/protein_target. Planens total vises mod det, aldrig som nyt mål.
import { createPlanSnapshot, summarizePlanSnapshot } from '../planSnapshot.mjs'
import { day, identifier } from './model.mjs'

const PLANS = 'kostplan_v1_plans', VERSIONS = 'kostplan_v1_versions', APPROVALS = 'kostplan_v1_approvals'
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
export function weekModel({ plans = [], versions = [], approvals = [], athlete, today }) {
  if (!identifier(athlete?.id) || !day(today)) fail()
  const targets = { kcal: positiv(Number(athlete.kcal_target)), protein: positiv(Number(athlete.protein_target)) }
  const perPlan = plans.filter(p => p.athlete_id === athlete.id && uuid(p.id) && day(p.valid_from)).map(p => {
    const own = versions.filter(v => v.plan_id === p.id).sort((a, b) => b.version_no - a.version_no)
    const latest = own[0]
    if (!latest) return null
    const ownApprovals = approvals.filter(a => a.plan_id === p.id && own.some(v => v.id === a.version_id))
    const latestApproval = ownApprovals.find(a => a.version_id === latest.id)
    return { plan: p, latest, sent: Boolean(latestApproval), everSent: ownApprovals.length > 0,
      sentOn: latestApproval ? sendtDag(latestApproval.approved_at) : null }
  }).filter(Boolean)
  if (!perPlan.length) return { state: 'empty', targets }
  // Ugen starter ved det tidligste usendte forslag. Er alt sendt, vises den nyeste sammenhængende
  // uge (højst 7 dage tilbage fra sidste plandag), så en ældre enkeltdagsplan ikke flytter ugen.
  const unsent = perPlan.filter(x => !x.sent)
  const planDays = new Set(perPlan.map(x => x.plan.valid_from))
  let start = unsent.map(x => x.plan.valid_from).sort()[0]
  if (!start) {
    start = [...planDays].sort().at(-1)
    for (let i = 0; i < 6 && planDays.has(plusDage(start, -1)); i++) start = plusDage(start, -1)
  }
  const dates = Array.from({ length: 7 }, (_, i) => plusDage(start, i))
  const days = dates.map(date => {
    // Én plan pr. dato. Står der flere, vinder et usendt forslag, ellers den nyest sendte.
    const candidates = perPlan.filter(x => x.plan.valid_from === date)
      .sort((a, b) => Number(a.sent) - Number(b.sent) || String(b.sentOn).localeCompare(String(a.sentOn)))
    const chosen = candidates[0]
    if (!chosen) return { date, label: dagNavn(date), state: 'mangler', meals: [], mealCount: 0, kcal: null, protein: null }
    let meals = [], summary = null
    try {
      const snapshot = createPlanSnapshot(chosen.latest)
      meals = snapshot.meals.map(meal => ({ name: meal.name,
        portions: meal.portions.map(p => ({ name: p.food.name, grams: p.grams })) }))
      if (meals.length) summary = summarizePlanSnapshot(snapshot).nutrients
    } catch { meals = []; summary = null }
    return { date, label: dagNavn(date), planId: chosen.plan.id, versionId: chosen.latest.id,
      versionNo: chosen.latest.version_no, rationale: chosen.latest.rationale ?? null,
      state: chosen.sent ? 'sendt' : chosen.everSent ? 'aendret' : 'udkast', sentOn: chosen.sentOn,
      meals, mealCount: meals.length,
      kcal: summary?.energyKcal?.value ?? null, protein: summary?.proteinG?.value ?? null }
  })
  const afvig = (value, target) => value === null || target === null ? null : Math.abs(value - target) / target * 100
  for (const d of days) {
    const procent = [afvig(d.kcal, targets.kcal), afvig(d.protein, targets.protein)]
    d.deviation = procent.includes(null) ? null : Math.max(...procent)
    d.ok = d.state !== 'mangler' && d.mealCount > 0 && d.deviation !== null && d.deviation <= MAKS_AFVIGELSE_PROCENT
  }
  // En sendt uge kan være kortere end 7 dage (fx en ældre enkeltdagsplan); tomme dage tæller ikke imod.
  const status = days.every(d => d.state === 'sendt' || d.state === 'mangler') && days.some(d => d.state === 'sendt') ? 'sendt'
    : days.some(d => d.state === 'aendret') || days.some(d => d.state === 'sendt') ? 'aendret' : 'udkast'
  const sentOn = status === 'sendt' ? days.map(d => d.sentOn).sort().at(-1) : null
  const rationale = days.find(d => d.rationale)?.rationale ?? null
  return { state: 'ready', status, sentOn, start, end: dates[6], days, targets, rationale,
    lock: status === 'sendt' ? null : lockReason(days, targets) }
}

// Én linje, der siger hvorfor knappen er låst. Null betyder, at ugen kan sendes.
export function lockReason(days, targets) {
  const missing = days.find(d => d.state === 'mangler')
  if (missing) return `${missing.label} mangler en plan.`
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
  if (!plans.length) return { plans, versions: [], approvals: [] }
  const ids = plans.map(p => p.id)
  const versions = rows(await client.from(VERSIONS)
    .select('id,plan_id,version_no,effective_from,rationale,goal,intensity,meals').in('plan_id', ids).limit(501))
  const approvals = rows(await client.from(APPROVALS)
    .select('version_id,plan_id,athlete_id,approved_at,approval_kind').in('plan_id', ids).eq('athlete_id', athleteId).limit(501))
  return { plans, versions, approvals }
}

export async function readClaudeWeek({ client, athlete, today }) {
  if (typeof client?.from !== 'function' || !identifier(athlete?.id) || !day(today)) fail()
  return weekModel({ ...await readRows(client, athlete.id, today), athlete, today })
}

// "Send uge": én godkendelse pr. dag med seneste version. Ugen læses igen først, så
// en ændret version aldrig godkendes blindt; bagefter kontrolleres, at alle 7 er sendt.
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
  const after = await readClaudeWeek({ client, athlete, today })
  if (after.status !== 'sendt' || after.start !== fresh.start) throw Error('Ugen blev ikke bekræftet som sendt. Prøv igen.')
  return after
}
