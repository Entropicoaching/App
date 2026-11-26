import { harNyKostGem } from '../../kostplan/atlet/kostGemSignal.mjs'
import * as React from 'react'
import { homeStyles as s } from '../homeStyles.mjs'
import { formatKg, stepKg, parseKgText, KG_MIN, KG_MAX, latestWeight, weightDone, readinessDone, readinessSuggestion, todayItems, planTally, firstSetPrefill } from './todayModel.mjs'
import { readTodayMeals, copyYesterdayMeals, undoCopiedMeals, yesterdayToCopy, readLastWeights, readTodayPlan, planLine } from './todayRead.mjs'
import { u6Enabled } from '../../u6/flag.mjs'
import { planWeightLines, planWeightRows, planFirstSetPrefill } from '../../u6/planWeight.mjs'
import { u7Enabled } from '../../u7/flag.mjs'

// Hooks hentes via navnerummet, som i U3's kort: lukkede prøveharnesser kan erstatte 'react'
// for forsiden. Kortet skriver kun gennem værtens eksisterende logWeight og saveReadiness:
// først udkastet, så gem, når værten har modtaget udkastet (samme mønster som QuickLogs).
const h = React.createElement
const GRACE_MS = 5000
// 2353: samme vindue som kostloggens fortrydelse (nutrition/controller.mjs, 5 sekunder).
const UNDO_MS = 5000
const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const shortDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${MONTHS[Number(m[2]) - 1]}` : '' }

const row = { borderTop: '1px solid #2f2f29', paddingTop: 12, marginTop: 12 }
const label = { ...s.text, margin: '0 0 6px', color: '#edeae2', fontWeight: 600 }
const hint = { ...s.text, fontSize: 14, margin: '6px 0 0' }
const step = { ...s.secondary, marginTop: 0, minWidth: 0, padding: 0 }
// Ordre 2035f: kun "Start dagens pas" er amber på Hjem; kortets egne handlinger er sekundære knapper.
const primary = { ...s.secondary, marginTop: 0, minHeight: 48 }

export default function TodayCard(props) {
  const { athlete, today } = props
  const athleteId = athlete?.id
  const [typed, setTyped] = React.useState(null)
  const [pending, setPending] = React.useState(null)
  const [grace, setGrace] = React.useState(null)
  const timer = React.useRef(null)
  const sent = React.useRef(null)
  const latest = React.useRef(props)
  latest.current = props
  const [meals, setMeals] = React.useState(null)
  const [copy, setCopy] = React.useState(null)
  const [lastByName, setLastByName] = React.useState(null)
  const undoTimer = React.useRef(null)
  React.useEffect(() => () => { clearTimeout(timer.current); clearTimeout(undoTimer.current) }, [])
  const showMeals = !props.sessionReadOnly && !!athleteId && !!today && props.visKost !== false
  const readMeals = props.u5ReadMeals ?? readTodayMeals
  React.useEffect(() => {
    if (!showMeals) return
    let active = true
    Promise.resolve(readMeals({ athleteId, today, client: latest.current.u5Client }))
      .then(data => { if (active) setMeals({ data, athleteId, day: today }) }, () => { if (active) setMeals({ status: 'error' }) })
    return () => { active = false }
  }, [showMeals, athleteId, today, readMeals])
  // Ordre 1690: Mad-rækken kender dagens godkendte kostplan. Læses én gang pr. atlet og dag som
  // måltiderne. Prøver, der giver deres egen måltidslæser, får ingen planlæsning uden u5ReadPlan.
  const [plan, setPlan] = React.useState(null)
  const [planLaest, setPlanLaest] = React.useState(null)
  const readPlan = props.u5ReadPlan ?? (props.u5ReadMeals ? null : readTodayPlan)
  React.useEffect(() => {
    if (!showMeals || typeof readPlan !== 'function') return
    let active = true
    Promise.resolve(readPlan({ athleteId, today, client: latest.current.u5Client }))
      .then(data => { if (active) { setPlan(data ? { line: planLine(data), planned: data.meals, names: Array.isArray(data.names) ? data.names : null, athleteId, day: today } : null); setPlanLaest({ athleteId, day: today }) } },
        () => { if (active) { setPlan(null); setPlanLaest({ athleteId, day: today }) } })
    return () => { active = false }
  }, [showMeals, athleteId, today, readPlan])
  const trainingToday = props.u5Training?.kind === 'today' && !props.sessionReadOnly && !!athleteId
  const readLast = props.u5ReadLastWeights ?? readLastWeights
  React.useEffect(() => {
    if (!trainingToday) return
    let active = true
    Promise.resolve(readLast({ athleteId, client: latest.current.u5Client }))
      .then(map => { if (active) setLastByName(map ?? {}) }, () => { if (active) setLastByName({}) })
    return () => { active = false }
  }, [trainingToday, athleteId, readLast])
  // Første sæt uden coachens vægt får sidste pas' vægt i udkastet, så det kan godkendes med ét tryk,
  // når atleten starter passet. Kun tomme felter udfyldes; intet gemmes.
  // U6: med coachens plan står planvægten i første sæt; uden plan gælder sidste pas som i U5.
  const exercises = props.u5Training?.exercises
  const planOn = u6Enabled('planWeight', props.u6PlanWeight)
  React.useEffect(() => {
    const p = latest.current
    if (!trainingToday || typeof p.setLogInputs !== 'function') return
    const fill = current => ({ ...(planOn ? planFirstSetPrefill(exercises, current) : {}),
      ...(lastByName ? firstSetPrefill(exercises, lastByName, current) : {}) })
    if (!Object.keys(fill(p.logInputs)).length) return
    p.setLogInputs(current => ({ ...current, ...fill(current) }))
  }, [trainingToday, lastByName, exercises, planOn])
  // Gem først, når værten har udkastet; ellers ville en gammel logWeight/saveReadiness gemme et tomt felt.
  React.useEffect(() => {
    if (!pending || sent.current === pending) return
    const p = latest.current
    const ready = pending.kind === 'weight' ? p.weightInput === pending.value
      : p.readinessInput?.energy === pending.input.energy && p.readinessInput?.motivation === pending.input.motivation
    if (!ready) return
    sent.current = pending
    Promise.resolve(pending.kind === 'weight' ? p.logWeight?.() : p.saveReadiness?.())
      .finally(() => { if (sent.current === pending) setPending(null) })
  }, [pending, props.weightInput, props.readinessInput])

  if (props.sessionReadOnly || !athleteId || !today) return null
  const canWeight = typeof props.logWeight === 'function' && typeof props.setWeightInput === 'function'
  const canReadiness = typeof props.saveReadiness === 'function' && typeof props.setReadinessInput === 'function'
  const wDone = weightDone(props.weightLogs, athleteId, today)
  const rDone = readinessDone({ readinessLog: props.readinessLog, trackingData: props.trackingData, athleteId, today })
  const planNames = plan?.athleteId === athleteId && plan?.day === today && plan.names?.length ? plan.names : null
  const baseMeals = meals?.athleteId === athleteId && meals?.day === today && meals.data?.status === 'ready' ? meals.data : null
  // 2359: for en kostklient tæller Hjem kun rækker med et plannavn; kopierede rækker har plannavne (withIds),
  // og Fortryd fjerner dem igen. Fri mad vises som "+ N fri" og lukker aldrig Mad. Uden plan: alle rækker som før.
  const copiedNames = baseMeals && planNames && !copy?.undoResult ? yesterdayToCopy(baseMeals.yesterday, planNames, baseMeals.todayNames).slice(0, copy?.saved ?? 0).map(row => row.meal) : []
  const tally = baseMeals && planNames ? planTally(planNames, [...(baseMeals.todayNames ?? []), ...copiedNames]) : null
  const mealData = baseMeals
    ? { ...baseMeals, today: baseMeals.today + (copy?.saved ?? 0) - (copy?.undone ?? 0),
      planned: plan?.athleteId === athleteId && plan?.day === today ? plan.planned : null,
      ...(tally ? { planLogged: tally.logged, free: tally.free } : {}) } : null
  // 2353: for en kostklient får kopien plannavne som i Kost i dag; uden plan er listen gårsdagens som før.
  const copyList = mealData ? yesterdayToCopy(mealData.yesterday, planNames, mealData.todayNames) : []
  const training = props.u5Training
  const model = todayItems({ weight: canWeight ? { done: wDone } : null, readiness: canReadiness ? { done: rDone } : null,
    training: training ? { ...training, today: true } : null, meal: showMeals ? mealData : null })
  if (!model.headline) return null
  // 2411: lige efter en gem i Kost monteres kortet igen; vent på måltider og plan, så "Klaret: mad" ikke mangler et øjeblik (kun efter en gem, så øvrige visninger er uændrede).
  const venterMad = showMeals && harNyKostGem(athleteId, today) && (!(meals?.athleteId === athleteId && meals?.day === today) || (typeof readPlan === 'function' && !(planLaest?.athleteId === athleteId && planLaest?.day === today)))
  if (venterMad && meals?.status !== 'error') return null
  const busy = Boolean(pending || props.savingWeight || props.savingReadiness)

  const last = latestWeight(props.weightLogs, athleteId, today)
  // Feltet er forudfyldt med seneste vægt; atleten kan skrive over det, eller justere med ±0,1.
  const fieldText = typed ?? (last != null ? formatKg(last) : '')
  const parsed = parseKgText(fieldText)
  const badWeight = typed != null && !parsed.kg
  const saveWeight = () => {
    const text = formatKg(parsed.kg)
    if (!text || busy || !canWeight) return
    latest.current.setWeightInput(text)
    setPending({ kind: 'weight', value: text })
  }
  const nudge = delta => {
    const next = stepKg(parsed.kg ?? last, delta)
    if (next != null) setTyped(formatKg(next))
  }
  const weightRow = () => h('form', { key: 'weight', style: row, 'data-u5-weight': '',
    onSubmit: event => { event.preventDefault(); saveWeight() } },
    h('p', { style: label }, 'Vægt'),
    h('div', { style: { display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 56px', gap: 8 } },
      h('button', { type: 'button', style: step, 'aria-label': '0,1 kg mindre', disabled: busy, onClick: () => nudge(-0.1) }, '−0,1'),
      h('input', { type: 'text', inputMode: 'decimal', 'aria-label': 'Vægt i kg', placeholder: 'kg', value: fieldText, disabled: busy,
        'aria-invalid': badWeight ? 'true' : undefined,
        style: { ...s.secondary, marginTop: 0, boxSizing: 'border-box', padding: 12, background: '#171814', textAlign: 'center', minWidth: 0 },
        onChange: event => setTyped(event.target.value) }),
      h('button', { type: 'button', style: step, 'aria-label': '0,1 kg mere', disabled: busy, onClick: () => nudge(0.1) }, '+0,1')),
    h('button', { type: 'button', style: { ...primary, marginTop: 8 }, disabled: busy || !parsed.kg, onClick: saveWeight },
      pending?.kind === 'weight' ? 'Gemmer…' : parsed.kg ? `Gem ${formatKg(parsed.kg)} kg` : 'Gem vægt'),
    badWeight
      ? h('p', { role: 'alert', style: hint }, `Skriv din vægt i kg mellem ${KG_MIN} og ${KG_MAX}, fx 82,5.`)
      : last != null && typed == null ? h('p', { style: hint }, 'Samme som sidst. Skriv en ny vægt, eller ret med ±0,1.')
        : last != null ? h('p', { style: hint }, `Sidst ${formatKg(last)} kg`) : null)

  // Ordre 2145: kostklientens korte Dagsform (søvn og energi) har ingen gamle motivation, stress og ømhed at låne; kortet åbner formen.
  const suggestion = props.kortDagsform === true ? null : readinessSuggestion({ athleteId, today, trackingData: props.trackingData,
    readinessLog: props.readinessLog, readinessInput: props.readinessInput })
  const pick = energy => {
    if (busy || grace || !suggestion || !canReadiness) return
    const input = { sleep: '', energy: String(energy), motivation: suggestion.motivation, stress: suggestion.stress, soreness: suggestion.soreness, soreZones: [] }
    setGrace({ energy })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setGrace(null)
      const p = latest.current
      if (p.sessionReadOnly || p.athlete?.id !== athleteId) return
      p.setReadinessInput(current => ({ ...current, ...input }))
      setPending({ kind: 'readiness', input })
    }, props.u5GraceMs ?? GRACE_MS)
  }
  const undo = () => { clearTimeout(timer.current); setGrace(null) }
  // Uden historik: åbn den fulde Dagsform i "Log i dag" under pas-kortet.
  const openFull = () => {
    const button = typeof document === 'undefined' ? null : document.querySelector?.('[data-home-quick-logs] button')
    button?.click?.(); button?.scrollIntoView?.({ block: 'center' })
  }
  const readinessRow = () => h('div', { key: 'readiness', style: row, 'data-u5-readiness': '' },
    h('p', { style: label }, 'Dagsform · energi i dag'),
    suggestion ? h('div', null,
      grace ? h('div', { role: 'status', style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8, alignItems: 'center' } },
        h('p', { style: { ...s.text, margin: 0 } }, `Energi ${grace.energy} gemmes om 5 sek.`),
        h('button', { type: 'button', style: { ...s.secondary, marginTop: 0 }, onClick: undo }, 'Fortryd'))
        : h('div', { role: 'group', 'aria-label': 'Energi i dag, 1 lav og 5 høj',
          style: { display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 } },
        ...[1, 2, 3, 4, 5].map(value => h('button', { key: value, type: 'button', disabled: busy,
          'aria-label': `Energi ${value}`, style: { ...s.secondary, marginTop: 0, minWidth: 0, padding: 0, minHeight: 48 },
          onClick: () => pick(value) }, String(value)))),
      h('p', { style: hint }, `1 lav, 5 høj. Resten som ${shortDate(suggestion.from)}`))
      : h('div', null,
        h('button', { type: 'button', style: primary, disabled: busy, onClick: openFull }, 'Udfyld dagsform'),
        h('p', { style: hint }, props.kortDagsform === true ? 'Tre korte svar: søvn, energi og sult.' : 'Fire korte svar. Næste gang er det ét tryk.')))

  // Start bliver i "Dit næste pas" lige under kortet; her står kun status, så handlingen ikke findes to gange.
  const lines = planOn && trainingToday ? planWeightLines(exercises, lastByName, { topSet: u7Enabled('topSet', props.u7TopSet) }) : []
  const planRows = planWeightRows(lines)
  const planned = lines.some(line => line.source === 'plan')
  const trainingRow = () => h('div', { key: 'training', style: row, 'data-u5-training': '' },
    // Ordre 1542: antal sæt står kun i pas-kortet øverst ("3 af 4 sæt klaret"); her står planen.
    h('p', { style: label }, 'Træning'),
    planRows.length > 0 && h('ul', { 'data-u6-plan-weight': '', style: { ...hint, margin: '0 0 6px', paddingLeft: 18 } },
      ...planRows.slice(0, 4).map(row => h('li', { key: row.id, 'data-u6-source': row.source }, row.text)),
      planRows.length > 4 && h('li', { key: 'flere' }, `${planRows.length - 4} øvelser mere i passet`)),
    h('p', { style: { ...hint, margin: 0 } }, planned
      ? 'Coachens vægt står i første sæt. Ret den, hvis dagen siger noget andet.'
      : 'Start dagens pas øverst. Første sæt står klar til ét tryk.'))
  const repeatYesterday = async () => {
    if (copy?.running || copy?.undoing || !copyList.length) return
    const list = copyList, withIds = !!planNames
    clearTimeout(undoTimer.current)
    setCopy({ running: true, saved: 0, total: list.length })
    const result = await copyYesterdayMeals({ athleteId, today, meals: list, client: latest.current.u5Client, withIds })
    // Fortryd gælder kun hele gruppen, ligesom "Alt fra i går" i Kost i dag; mangler et id, vises den ikke.
    const canUndo = withIds && result.saved === result.total && result.ids?.length === result.total
    setCopy({ running: false, ...result, undo: canUndo })
    if (canUndo) undoTimer.current = setTimeout(() => setCopy(current => current?.undo ? { ...current, undo: false } : current), props.u5UndoMs ?? UNDO_MS)
  }
  const undoCopy = async () => {
    if (!copy?.undo || copy.undoing) return
    clearTimeout(undoTimer.current)
    const ids = copy.ids
    setCopy({ ...copy, undo: false, undoing: true })
    const removed = await undoCopiedMeals({ athleteId, today, ids, client: latest.current.u5Client })
    setCopy(current => ({ ...current, undoing: false, undone: removed, undoResult: removed === ids.length ? 'ok' : 'partial' }))
  }
  const go = route => () => latest.current.setTab?.(route)
  const planText = plan?.athleteId === athleteId && plan?.day === today
    ? (plan.planned > 1 && mealData?.today > 0 ? plan.line + ' ' + (mealData.planLogged ?? mealData.today) + ' af ' + plan.planned + ' logget.' + (mealData.free > 0 ? ' + ' + mealData.free + ' fri.' : '') : plan.line) : null
  // Fortryd står også, når kopien lukkede Mad-rækken (alt logget), så den altid kan nås i vinduet.
  const undoRow = () => copy?.undo ? h('div', { key: 'meal-undo', role: 'status', 'data-u5-meal-undo': '',
    style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center', marginTop: 8 } },
  h('p', { style: { ...s.text, margin: 0 } }, `${copy.saved} ${copy.saved === 1 ? 'måltid' : 'måltider'} fra i går gemt.`),
  h('button', { type: 'button', style: { ...s.secondary, marginTop: 0 }, onClick: undoCopy }, 'Fortryd')) : null
  const undoResultLine = () => copy?.undoResult === 'ok'
    ? h('p', { key: 'meal-undone', role: 'status', style: hint }, `${copy.ids.length} måltider fra i går er fortrudt.`)
    : copy?.undoResult === 'partial' ? h('p', { key: 'meal-undone', role: 'alert', style: hint }, `${copy.undone} af ${copy.ids.length} måltider fra i går blev fortrudt. Resten er stadig gemt; se Kost.`) : null
  // Ordre 2370 (fund 3 og 5): kostklientens Hjem har allerede Åbn kost i kortet over; Log mad var kun en vejviser dertil.
  const mealVejviserSkjult = props.kortDagsform === true && !copyList.length
  const mealRow = () => mealVejviserSkjult && !copy && !(planText && mealData?.today > 0) ? null : h('div', { key: 'meal', style: row, 'data-u5-meal': '' },
    h('p', { style: label }, 'Mad'),
    copyList.length && !copy?.undoResult
      ? h('button', { type: 'button', style: primary, disabled: copy?.running || copy?.undoing, onClick: repeatYesterday },
        copy?.running ? `Logger ${copy.saved + 1} af ${copy.total}…`
          : `Jeg spiste som i går (${copyList.length} ${copyList.length === 1 ? 'måltid' : 'måltider'})`)
      : mealVejviserSkjult ? null : h('button', { type: 'button', style: primary, disabled: typeof props.setTab !== 'function', onClick: go('kost') }, 'Log mad'),
    undoRow(),
    copy?.undoResult ? undoResultLine()
      : copy && !copy.running && copy.saved < copy.total
          ? h('p', { role: 'alert', style: hint }, `${copy.saved} af ${copy.total} måltider blev gemt. Log resten under Kost.`)
          : h('p', { style: hint, ...(planText ? { 'data-u5-meal-plan': '' } : {}) }, planText
            || (copyList.length ? 'Spiste du andet? Ret det under Kost.' : 'Søg eller vælg en favorit under Kost.')))

  const rows = { weight: weightRow, readiness: readinessRow, training: trainingRow, meal: mealRow }
  // U6 (kontrollens U5-bemærkning): Mad står øverst i kortet, så knappen ses over bundmenuen ved åbning
  // på 390 px (ordre 2078: pas-kortet ligger over, så Mad efter vægt og dagsform lå under menuen).
  // Træningsrækken er kun status; start sker i pas-kortet lige over.
  const mealFirst = u6Enabled('mealFirst', props.u6MealFirst)
  const shownOrder = keys => mealFirst ? ['meal', 'weight', 'readiness', 'training'].filter(key => keys.includes(key)) : keys
  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'I dag', 'data-u5-today': '' },
    h('p', { style: { ...s.eyebrow, margin: 0 } }, 'I dag'),
    h('h2', { style: { ...s.heading, fontSize: 20, margin: '4px 0 0' } }, model.headline),
    model.doneLine && h('p', { style: { ...hint, margin: '4px 0 0' } }, `${model.doneLine} ✓`),
    // 2359: Mad lukket af planmåltiderne, men der er også fri mad: vis den kort i samme linje.
    !model.missing.includes('meal') && model.free > 0 && h('p', { style: { ...hint, margin: '4px 0 0' }, 'data-u5-meal-free': '' }, `+ ${model.free} fri`),
    // 2353: lukkede kopien Mad-rækken, står Fortryd lige under overskriften, så den ses over folden på 390 px.
    !model.missing.includes('meal') && undoRow(),
    ...shownOrder(model.missing).map(key => rows[key]?.()))
}
