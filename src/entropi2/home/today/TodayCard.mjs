import * as React from 'react'
import { homeStyles as s } from '../homeStyles.mjs'
import { formatKg, stepKg, latestWeight, weightDone, readinessDone, readinessSuggestion, todayItems, firstSetPrefill } from './todayModel.mjs'
import { readTodayMeals, copyYesterdayMeals, readLastWeights } from './todayRead.mjs'
import { u6Enabled } from '../../u6/flag.mjs'
import { planWeightLines, planWeightText, planFirstSetPrefill } from '../../u6/planWeight.mjs'

// Hooks hentes via navnerummet, som i U3's kort: lukkede prøveharnesser kan erstatte 'react'
// for forsiden. Kortet skriver kun gennem værtens eksisterende logWeight og saveReadiness:
// først udkastet, så gem, når værten har modtaget udkastet (samme mønster som QuickLogs).
const h = React.createElement
const GRACE_MS = 5000
const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const shortDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${MONTHS[Number(m[2]) - 1]}` : '' }

const row = { borderTop: '1px solid #2f2f29', paddingTop: 12, marginTop: 12 }
const label = { ...s.text, margin: '0 0 6px', color: '#edeae2', fontWeight: 600 }
const hint = { ...s.text, fontSize: 14, margin: '6px 0 0' }
const step = { ...s.secondary, marginTop: 0, minWidth: 0, padding: 0 }
const primary = { ...s.primary, marginTop: 0, minHeight: 48 }

export default function TodayCard(props) {
  const { athlete, today } = props
  const athleteId = athlete?.id
  const [kg, setKg] = React.useState(null)
  const [typed, setTyped] = React.useState('')
  const [pending, setPending] = React.useState(null)
  const [grace, setGrace] = React.useState(null)
  const timer = React.useRef(null)
  const sent = React.useRef(null)
  const latest = React.useRef(props)
  latest.current = props
  const [meals, setMeals] = React.useState(null)
  const [copy, setCopy] = React.useState(null)
  const [lastByName, setLastByName] = React.useState(null)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const showMeals = !props.sessionReadOnly && !!athleteId && !!today && props.visKost !== false
  const readMeals = props.u5ReadMeals ?? readTodayMeals
  React.useEffect(() => {
    if (!showMeals) return
    let active = true
    Promise.resolve(readMeals({ athleteId, today, client: latest.current.u5Client }))
      .then(data => { if (active) setMeals({ data, athleteId, day: today }) }, () => { if (active) setMeals({ status: 'error' }) })
    return () => { active = false }
  }, [showMeals, athleteId, today, readMeals])
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
  const mealData = meals?.athleteId === athleteId && meals?.day === today && meals.data?.status === 'ready'
    ? { ...meals.data, today: meals.data.today + (copy?.saved ?? 0) } : null
  const training = props.u5Training
  const model = todayItems({ weight: canWeight ? { done: wDone } : null, readiness: canReadiness ? { done: rDone } : null,
    training: training ? { ...training, today: true } : null, meal: showMeals ? mealData : null })
  if (!model.headline) return null
  const busy = Boolean(pending || props.savingWeight || props.savingReadiness)

  const last = latestWeight(props.weightLogs, athleteId, today)
  const shown = kg ?? last
  const saveWeight = value => {
    const text = formatKg(value)
    if (!text || busy || !canWeight) return
    latest.current.setWeightInput(text)
    setPending({ kind: 'weight', value: text })
  }
  const weightRow = () => h('div', { key: 'weight', style: row, 'data-u5-weight': '' },
    h('p', { style: label }, 'Vægt'),
    shown != null ? h('div', { style: { display: 'grid', gridTemplateColumns: '56px minmax(0, 1fr) 56px', gap: 8 } },
      h('button', { type: 'button', style: step, 'aria-label': '0,1 kg mindre', disabled: busy, onClick: () => setKg(stepKg(shown, -0.1) ?? shown) }, '−0,1'),
      h('button', { type: 'button', style: primary, disabled: busy, onClick: () => saveWeight(shown) },
        pending?.kind === 'weight' ? 'Gemmer…' : `Gem ${formatKg(shown)} kg`),
      h('button', { type: 'button', style: step, 'aria-label': '0,1 kg mere', disabled: busy, onClick: () => setKg(stepKg(shown, 0.1) ?? shown) }, '+0,1'))
      : h('form', { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 },
        onSubmit: event => { event.preventDefault(); saveWeight(typed) } },
      h('input', { type: 'text', inputMode: 'decimal', 'aria-label': 'Vægt i kg', placeholder: 'kg', value: typed, disabled: busy,
        style: { ...s.secondary, marginTop: 0, boxSizing: 'border-box', padding: 12, background: '#171814' },
        onChange: event => setTyped(event.target.value) }),
      h('button', { type: 'submit', style: primary, disabled: busy }, 'Gem vægt')),
    shown != null && h('p', { style: hint }, kg != null && kg !== last ? `Sidst ${formatKg(last)} kg` : 'Samme som sidst. Ret med ±0,1.'))

  const suggestion = readinessSuggestion({ athleteId, today, trackingData: props.trackingData,
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
        h('p', { style: hint }, 'Fire korte svar. Næste gang er det ét tryk.')))

  // Start bliver i "Dit næste pas" lige under kortet; her står kun status, så handlingen ikke findes to gange.
  const lines = planOn && trainingToday ? planWeightLines(exercises, lastByName) : []
  const planned = lines.some(line => line.source === 'plan')
  const trainingRow = () => h('div', { key: 'training', style: row, 'data-u5-training': '' },
    h('p', { style: label }, `Træning · ${training.logged ?? 0} af ${training.total ?? 0} sæt`),
    lines.length > 0 && h('ul', { 'data-u6-plan-weight': '', style: { ...hint, margin: '0 0 6px', paddingLeft: 18 } },
      ...lines.slice(0, 4).map(line => h('li', { key: line.id, 'data-u6-source': line.source }, planWeightText(line))),
      lines.length > 4 && h('li', { key: 'flere' }, `${lines.length - 4} øvelser mere i passet`)),
    h('p', { style: { ...hint, margin: 0 } }, planned
      ? 'Coachens vægt står i første sæt. Ret den, hvis dagen siger noget andet.'
      : 'Start dagens pas lige herunder. Første sæt står klar til ét tryk.'))
  const repeatYesterday = async () => {
    if (copy?.running || !mealData?.yesterday.length) return
    const list = mealData.yesterday
    setCopy({ running: true, saved: 0, total: list.length })
    const result = await copyYesterdayMeals({ athleteId, today, meals: list, client: latest.current.u5Client })
    setCopy({ running: false, ...result })
  }
  const go = route => () => latest.current.setTab?.(route)
  const mealRow = () => h('div', { key: 'meal', style: row, 'data-u5-meal': '' },
    h('p', { style: label }, 'Mad'),
    mealData.yesterday.length
      ? h('button', { type: 'button', style: primary, disabled: copy?.running, onClick: repeatYesterday },
        copy?.running ? `Logger ${copy.saved + 1} af ${copy.total}…`
          : `Jeg spiste som i går (${mealData.yesterday.length} ${mealData.yesterday.length === 1 ? 'måltid' : 'måltider'})`)
      : h('button', { type: 'button', style: primary, disabled: typeof props.setTab !== 'function', onClick: go('kost') }, 'Log mad'),
    copy && !copy.running && copy.saved < copy.total
      ? h('p', { role: 'alert', style: hint }, `${copy.saved} af ${copy.total} måltider blev gemt. Log resten under Kost.`)
      : h('p', { style: hint }, mealData.yesterday.length ? 'Spiste du andet? Ret det under Kost.' : 'Søg eller vælg en favorit under Kost.'))

  const rows = { weight: weightRow, readiness: readinessRow, training: trainingRow, meal: mealRow }
  // U6 (kontrollens U5-bemærkning): Mad står før træning, så knappen ses over bundmenuen ved åbning
  // på 390 px. Træningsrækken er kun status; start sker i pas-kortet lige under.
  const mealFirst = u6Enabled('mealFirst', props.u6MealFirst)
  const shownOrder = keys => mealFirst ? ['weight', 'readiness', 'meal', 'training'].filter(key => keys.includes(key)) : keys
  return h('section', { style: { ...s.card, padding: 16 }, 'aria-label': 'I dag', 'data-u5-today': '' },
    h('p', { style: { ...s.eyebrow, margin: 0 } }, 'I dag'),
    h('h2', { style: { ...s.heading, fontSize: 22, margin: '6px 0 0' } }, model.headline),
    model.doneLine && h('p', { style: { ...hint, margin: '4px 0 0' } }, `${model.doneLine} ✓`),
    ...shownOrder(model.missing).map(key => rows[key]?.()))
}
