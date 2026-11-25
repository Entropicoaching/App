// U10a (ordre 111): en ugeplan fra Claude bliver til SQL-tekst med 7 forslag.
// Ren funktion: ingen net, ingen nøgler, ingen database. Uden send skriver scriptet aldrig
// en godkendelse; det gør coachen i appen (kostplan_v1_approvals kræver auth.uid()).
// Med send (ordre 1537a, efter coachens ja i chatten) godkendes ugen som coachen.
// Reglerne genbruges fra appen: fødevarekataloget, realismeprøven, snapshotkontrakten
// og dagsummen. Intet her regner næring eller portionsgrænser på en ny måde.
import { EXTENDED_COACH_FOODS } from '../../src/entropi2/kostplan/foedevarer/frida55Extended.mjs'
import { sumDay } from '../../src/entropi2/kostplan/foedevarer/totals.mjs'
import { supportedFoodSnapshot, supportedPlanSnapshot } from '../../src/entropi2/kostplan/sqlSnapshot.mjs'
import { tjekMaaltid } from '../../src/entropi2/kostplan/realisme.mjs'
import { FRIDA_KOBLING } from './fridaKobling.mjs'

export const BASIS_KEYS = Object.freeze(['weight_trend', 'training_volume', 'training_intensity',
  'food_log', 'readiness', 'competition_date'])
export const MAKS_AFVIGELSE_PROCENT = 5
export const MAALTIDER_PR_DAG = Object.freeze({ min: 4, max: 6 })

const catalog = new Map(EXTENDED_COACH_FOODS.map(food => [food.id, food]))
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = value => typeof value === 'string' && value.trim().length > 0
const fmt = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)

export class ForslagFejl extends Error {
  constructor(message) { super(message); this.name = 'ForslagFejl' }
}
const stop = message => { throw new ForslagFejl(message) }

function dato(value, felt) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) stop(`${felt} skal være en dato (ÅÅÅÅ-MM-DD).`)
  return value
}
const plusDage = (value, n) => new Date(Date.parse(value + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10)

// Én portion: { foodId, grams } med en lokal vare, eller { foodId: 'frida55:N', grams,
// dagligvare } med en Frida-række. Dagligvaren er den lokale vare, som realismeprøven
// kender, og den skal være koblet til netop den Frida-række (fridaKobling.mjs).
function portion(item, sted) {
  if (!object(item) || !text(item.foodId)) stop(`${sted}: en portion mangler foodId.`)
  const food = catalog.get(item.foodId)
  if (!food) stop(`${sted}: ${item.foodId} findes ikke i appens fødevarekatalog.`)
  return { food: supportedFoodSnapshot(food), grams: item.grams }
}
function realismeVare(item, sted) {
  if (!String(item?.foodId).startsWith('frida55:')) return { foodId: item?.foodId, grams: item?.grams }
  if (!text(item.dagligvare)) stop(`${sted}: ${item.foodId} mangler dagligvare til realismeprøven.`)
  if (FRIDA_KOBLING[item.dagligvare] !== item.foodId) stop(`${sted}: ${item.dagligvare} er ikke koblet til ${item.foodId}.`)
  return { name: item.dagligvare, grams: item.grams }
}

function dag(input, index, plan) {
  const sted = `Dag ${index + 1} (${input?.date ?? 'uden dato'})`
  if (!object(input) || !Array.isArray(input.meals)) stop(`${sted}: dagen skal have en liste af måltider.`)
  const { min, max } = MAALTIDER_PR_DAG
  if (input.meals.length < min || input.meals.length > max) stop(`${sted}: dagen skal have ${min} til ${max} måltider, ikke ${input.meals.length}.`)
  const meals = input.meals.map((meal, m) => {
    const navn = text(meal?.name) ? meal.name : `måltid ${m + 1}`
    if (!Array.isArray(meal?.portions)) stop(`${sted}, ${navn}: måltidet mangler portioner.`)
    const realisme = tjekMaaltid({ items: meal.portions.map(p => realismeVare(p, `${sted}, ${navn}`)) })
    if (!realisme.ok) stop(`${sted}, ${navn}: ${realisme.problemer.join(' ')}`)
    return { name: meal.name, portions: meal.portions.map(p => portion(p, `${sted}, ${navn}`)) }
  })
  // Samme kanoniske form, som appen skriver og godkender (kostplan_v1_valid_meals i JS).
  let snapshot
  try {
    snapshot = supportedPlanSnapshot({ goal: plan.goal, intensity: plan.intensity, meals })
  } catch (error) { stop(`${sted}: måltiderne passer ikke til kostplanens kontrakt (${error.message}).`) }
  const total = sumDay(snapshot.meals.map(meal => meal.portions)).nutrients
  for (const [key, label, enhed, maal] of [['energyKcal', 'Energi', 'kcal', plan.targets.kcal],
    ['proteinG', 'Protein', 'g', plan.targets.protein]]) {
    const value = total[key].value
    if (value === null) stop(`${sted}: ${label.toLowerCase()} kan ikke beregnes, fordi en fødevare mangler tallet.`)
    const procent = Math.abs(value - maal) / maal * 100
    if (procent > MAKS_AFVIGELSE_PROCENT) stop(`${sted}: ${label} ${fmt(value)} ${enhed} afviger ${fmt(procent)} % fra målet ${fmt(maal)} ${enhed} (højst ${MAKS_AFVIGELSE_PROCENT} %).`)
  }
  return { date: input.date, meals: snapshot.meals, kcal: total.energyKcal.value, protein: total.proteinG.value }
}

// Ugeplanens felter og reglerne fra planen (ORDRE-APP-PLAN-KOSTPLAN-CLAUDE-20261111, afsnit 1 punkt 3).
export function tjekUgeplan(input) {
  if (!object(input)) stop('Ugeplanen skal være et JSON-objekt.')
  if (typeof input.athleteId !== 'string' || !UUID.test(input.athleteId)) stop('athleteId skal være atletens uuid.')
  if (!['bulk', 'vedligehold', 'cut'].includes(input.goal)) stop('goal skal være bulk, vedligehold eller cut.')
  if (typeof input.intensity !== 'number' || !(input.intensity >= 0 && input.intensity <= 1)) stop('intensity skal være et tal fra 0 til 1.')
  if (!text(input.rationale) || input.rationale.length > 4000) stop('rationale skal være én sætning til coachen.')
  const t = input.targets
  if (!object(t) || !(t.kcal > 0) || !(t.protein > 0)) stop('targets skal have kcal og protein fra athletes. Atleten mangler mål, så der laves intet forslag.')
  const asOf = dato(t.as_of, 'targets.as_of')
  const basisAsOf = dato(input.basisAsOf, 'basisAsOf')
  const basis = input.calculationBasis ?? {}
  if (!object(basis) || Object.keys(basis).some(key => !BASIS_KEYS.includes(key))) stop(`calculationBasis må kun have ${BASIS_KEYS.join(', ')}.`)
  if (!Array.isArray(input.days) || input.days.length !== 7) stop('Ugeplanen skal have præcis 7 dage.')
  const first = dato(input.days[0]?.date, 'Dag 1 date')
  input.days.forEach((d, i) => {
    if (dato(d?.date, `Dag ${i + 1} date`) !== plusDage(first, i)) stop(`Dag ${i + 1} skal være ${plusDage(first, i)}; dagene skal følge hinanden.`)
  })
  // basis_as_of <= effective_from, og effective_from = valid_from = dagen.
  if (basisAsOf > first) stop(`basisAsOf ${basisAsOf} ligger efter ugens første dag ${first}.`)
  if (asOf > basisAsOf) stop(`targets.as_of ${asOf} ligger efter basisAsOf ${basisAsOf}.`)
  const plan = { athleteId: input.athleteId, goal: input.goal, intensity: input.intensity,
    rationale: input.rationale.trim(), basisAsOf,
    targets: { kcal: t.kcal, protein: t.protein, as_of: asOf },
    calculationBasis: { ...Object.fromEntries(BASIS_KEYS.map(key => [key, basis[key] ?? null])),
      targets: { kcal: t.kcal, protein: t.protein, as_of: asOf } } }
  return { ...plan, days: input.days.map((d, i) => dag(d, i, plan)) }
}

// Ordre 2375: hver fødevare står kun én gang (id -> snapshot); måltiderne peger på den med id.
// Formen kontrolleres, så SQL'en bygger præcis de samme meals som før.
function kompakt(meals, foedevarer) {
  const samme = (keys, forventet, sted) => { if (keys.join() !== forventet.join()) stop(`${sted}: uventet form i måltiderne.`) }
  return meals.map(meal => {
    samme(Object.keys(meal).sort(), ['name', 'portions'], 'Måltid')
    return { name: meal.name, portions: meal.portions.map(p => {
      samme(Object.keys(p).sort(), ['food', 'grams'], 'Portion')
      const id = p.food.id
      if (foedevarer.has(id) && JSON.stringify(foedevarer.get(id)) !== JSON.stringify(p.food)) stop(`${id} har to forskellige snapshots.`)
      foedevarer.set(id, p.food)
      return { grams: p.grams, f: id }
    }) }
  })
}

const lit = value => `'${String(value).replace(/'/g, "''")}'`
const json = value => `${lit(JSON.stringify(value))}::jsonb`

// Ordre 1537a: "Send uge til atleten" som SQL, kun efter coachens ja i chatten.
// Samme insert som knappen (version_id, approval_kind 'coach'); databasens egne triggere
// tjekker, at coachen ejer atleten, sætter coach_id og approved_at og gør planen godkendt.
// auth.uid() sættes lokalt i transaktionen til atletens egen coach og intet andet.
function sendSql(plan, ids) {
  const athlete = `${lit(plan.athleteId)}::uuid`
  const planIds = ids.map(id => `${lit(id.plan)}::uuid`).join(', ')
  return [
    '-- Coachen har sagt ja i chatten: ugen sendes til atleten (samme som "Send uge til atleten").',
    `select set_config('request.jwt.claim.sub', coach_id::text, true),
  set_config('request.jwt.claims', json_build_object('sub', coach_id, 'role', 'authenticated')::text, true)
  from public.athletes where id = ${athlete} and coach_id is not null;`,
    `insert into public.kostplan_v1_approvals (version_id, approval_kind) values\n${ids.map(id =>
      `  (${lit(id.version)}, 'coach')`).join(',\n')};`,
    `do $sendt$ begin
  if (select count(*) from public.kostplan_v1_plans p join public.kostplan_v1_approvals ap on ap.plan_id = p.id
      where p.id in (${planIds}) and p.athlete_id = ${athlete} and p.status = 'godkendt') <> ${ids.length} then
    raise exception 'Ugen blev ikke sendt; intet er gemt';
  end if;
end $sendt$;`,
  ]
}

// Niveauet (fri pulje i procent af dagens kcal) skrives af scriptet i calculation_basis.fri_pct.
// Ordre 2375: Marcs valg, 0 til 30; et tal med komma (15,5) accepteres.
export const MAKS_FRI_PROCENT = 30
export function friProcent(value) {
  const tal = typeof value === 'number' ? value : /^\d+([.,]\d+)?$/.test(String(value ?? '').trim()) ? Number(String(value).trim().replace(',', '.')) : NaN
  if (!Number.isFinite(tal) || tal < 0 || tal > MAKS_FRI_PROCENT) stop(`fri_pct skal være et tal fra 0 til ${MAKS_FRI_PROCENT}. Vælg niveau med --fri 0 til ${MAKS_FRI_PROCENT}.`)
  return tal
}

// SQL-tekst til skillens eksisterende adgang. Status udelades, så tabellens standard
// 'forslag' gælder, og kun kolonnerne i coachens insert-tilladelse bruges.
// send: true tilføjer coachens godkendelse i samme transaktion (ordre 1537a).
// fri: niveauet skrives som calculation_basis.fri_pct i alle 7 versioner (ordre 2375).
// Kompakt (ordre 2375): fælles calculation_basis og hver forskellig dags måltider står én gang
// i en DO-blok; de 7 dage peger på dem med et nummer. Samme tabeller, kolonner og værdier som før.
export function lavForslagSql(input, { uuid = () => globalThis.crypto.randomUUID(), send = false, fri } = {}) {
  const plan = tjekUgeplan(input)
  if (fri !== undefined) plan.calculationBasis = { fri_pct: friProcent(fri), ...plan.calculationBasis }
  // Teksten står i en dollar-citeret blok; $uge$ i en tekst ville lukke den for tidligt.
  if (/\$(uge|guard)\$/.test(JSON.stringify(plan))) stop('Teksterne i ugen må ikke indeholde $uge$ eller $guard$.')
  const ids = plan.days.map(() => ({ plan: uuid(), version: uuid() }))
  if (ids.some(id => !UUID.test(id.plan) || !UUID.test(id.version))) stop('uuid-generatoren gav et ugyldigt id.')
  const datoer = plan.days.map(d => d.date)
  const foedevarer = new Map()
  const maaltider = []
  const nummer = plan.days.map(d => {
    const key = JSON.stringify(kompakt(d.meals, foedevarer))
    if (!maaltider.includes(key)) maaltider.push(key)
    return maaltider.indexOf(key) + 1
  })
  const lines = [
    `-- Kostplan-forslag fra Claude (U10a): ${plan.days.length} dage fra ${datoer[0]} til ${datoer.at(-1)}.`,
    send ? '-- Sendes til atleten i samme transaktion, fordi coachen har sagt ja i chatten.'
      : '-- Status er forslag. Coachen godkender i appen; dette script skriver aldrig en godkendelse.',
    'begin;',
    // Ingen dubletter og intet forslag mod et mål, der er ændret siden as_of.
    `do $guard$ begin
  if not exists (select 1 from public.athletes where id = ${lit(plan.athleteId)}::uuid
      and kcal_target = ${Number(plan.targets.kcal)} and protein_target = ${Number(plan.targets.protein)}) then
    raise exception 'Atleten findes ikke, eller kostmålet er ændret siden ${plan.targets.as_of}';
  end if;
  if exists (select 1 from public.kostplan_v1_plans where athlete_id = ${lit(plan.athleteId)}::uuid
      and status = 'forslag' and valid_from in (${datoer.map(d => lit(d) + '::date').join(', ')})) then
    raise exception 'Der ligger allerede et forslag for en af dagene';
  end if;
end $guard$;`,
    `do $uge$
declare
  cb constant jsonb := ${json(plan.calculationBasis)};
  f constant jsonb := ${json(Object.fromEntries(foedevarer))};
  k constant jsonb[] := array[
${maaltider.map(key => `    ${lit(key)}::jsonb`).join(',\n')}];
  m jsonb[] := '{}';
  c jsonb;
  d record;
begin
  foreach c in array k loop
    m := array_append(m, (select jsonb_agg(jsonb_build_object('name', x.v->'name', 'portions', (select jsonb_agg(jsonb_build_object('grams', p.v->'grams', 'food', f->(p.v->>'f')) order by p.n)
      from jsonb_array_elements(x.v->'portions') with ordinality p(v, n))) order by x.n) from jsonb_array_elements(c) with ordinality x(v, n)));
  end loop;
  for d in select * from (values
${plan.days.map((day, i) => `    (${lit(ids[i].plan)}, ${lit(ids[i].version)}, ${lit(day.date)}, ${nummer[i]})`).join(',\n')}
  ) as t(plan_id, version_id, dag, k) loop
    insert into public.kostplan_v1_plans (id, athlete_id, valid_from) values (d.plan_id::uuid, ${lit(plan.athleteId)}::uuid, d.dag::date);
    insert into public.kostplan_v1_versions (id, plan_id, version_no, effective_from, basis_as_of, calculation_basis, rationale, goal, intensity, meals)
      values (d.version_id::uuid, d.plan_id::uuid, 1, d.dag::date, ${lit(plan.basisAsOf)}::date, cb, ${lit(plan.rationale)}, ${lit(plan.goal)}, ${Number(plan.intensity)}, m[d.k]);
  end loop;
end $uge$;`,
  ]
  if (send) lines.push(...sendSql(plan, ids))
  lines.push('commit;')
  return { sql: lines.join('\n') + '\n', plan, ids }
}
