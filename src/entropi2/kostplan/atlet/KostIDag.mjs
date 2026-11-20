import * as React from 'react'
import { foodPortion, unitsForFood } from '../../nutrition/controller.mjs'
import { statusLinje, hurtigeMaaltider, forslag, laesDetaljer, gemDetaljer } from './kostIDagModel.mjs'
import { andenMaengde } from './andenMaengdeModel.mjs'
import WaterDayLog from './WaterDayLog.mjs'
import { readNextPlanStart } from './upcomingPlanModel.mjs'

// 1899 (Marc 19. nov.): Kost skal være "rigtig simpelt og overskueligt at indtaste";
// detaljerne er et lag, man åbner. Kortet bruger kostloggens egen log og
// dagsplanens egen "Spist som planlagt", så alt gemmes præcis som før.
const h = React.createElement
const { useEffect, useRef, useState, useSyncExternalStore } = React
const card = { margin: 16, padding: 16, borderRadius: 12, background: '#24241f', border: '1px solid #414139', color: '#edeae2' }
const control = { minHeight: 44, minWidth: 44, maxWidth: '100%', font: 'inherit', whiteSpace: 'normal', boxSizing: 'border-box',
  background: '#1c1c18', color: '#edeae2', border: '1px solid #414139', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }
const primary = { ...control, background: '#edeae2', color: '#16160f', border: 0, fontWeight: 600 }
const row = { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }
const label = { margin: '12px 0 0', fontWeight: 600 }
const none = Object.freeze({ loaded: false })
const noSubscribe = () => () => {}
const idleState = Object.freeze({ phase: 'idle' })
const idle = () => idleState
const noneState = () => none
const fmt = value => new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
const readyPhase = phase => ['ready', 'saved', 'save-error'].includes(phase)
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']
// "fredag 20. november": ugedag og dato uden Intl's "den".
const ugedagDato = day => {
  const d = new Date(day + 'T00:00:00Z')
  return `${WEEKDAYS[d.getUTCDay()]} ${new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d)}`
}

// Venter, til både kostloggen og dagsplanen er klar (fx efter en genhentning),
// så et hurtigt tryk lige efter et andet ikke afvises.
function whenReady(sources, ms = 10000) {
  const ok = () => sources.every(({ snapshot, ready }) => ready(snapshot?.()))
  if (ok()) return Promise.resolve(true)
  return new Promise(resolve => {
    const stops = []
    const done = value => { clearTimeout(timer); stops.forEach(stop => stop?.()); resolve(value) }
    const timer = setTimeout(() => done(ok()), ms)
    for (const { subscribe } of sources) stops.push(subscribe?.(() => { if (ok()) done(true) }))
  })
}

export default function KostIDag({ tracker, controller, athleteId, date, weight = {}, water, onCustom, nyPlan, customNote }) {
  const t = useSyncExternalStore(tracker?.subscribe || noSubscribe, tracker?.snapshot || noneState, tracker?.snapshot || noneState)
  const s = useSyncExternalStore(controller?.subscribe || noSubscribe, controller?.snapshot || idle, controller?.snapshot || idle)
  const log = t?.athleteId === athleteId && t?.date === date ? t : none
  const [pending, setPending] = useState([])
  const [note, setNote] = useState(null)
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState(null)
  const [vaegt, setVaegt] = useState(null)
  const queue = useRef(Promise.resolve())
  const mangdeRef = useRef(null)
  const seq = useRef(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const sources = [
    { subscribe: tracker?.subscribe, snapshot: tracker?.snapshot, ready: v => v?.loaded === true && readyPhase(v.phase) && !v.pending },
    ...(controller ? [{ subscribe: controller.subscribe, snapshot: controller.snapshot,
      ready: v => !v || v.mode !== 'plan' || (readyPhase(v.phase) && !v.pending) || v.phase === 'uncertain' }] : []),
  ]
  // Optimistisk: tallet og "Gemmer …" vises straks; trykkene gemmes i rækkefølge.
  const run = (navn, values, action) => {
    const id = ++seq.current
    setPending(list => [...list, { id, navn, values }])
    setNote({ text: `Gemmer ${navn}…` })
    queue.current = queue.current.then(async () => {
      const intent = `kost-i-dag:${date}:${Date.now()}:${id}`
      let result = false
      try { result = await whenReady(sources) ? await action(intent) : false } catch { result = false }
      const ok = result === true
      // Behold tallet som ventende, til kostloggen har hentet dagen igen, så linjen ikke blinker.
      if (ok) await whenReady(sources, 5000)
      if (!alive.current) return
      setPending(list => list.filter(item => item.id !== id))
      setNote(ok ? { text: `${navn} gemt.`, intent }
        : result?.note ?? { error: true, text: `${navn} blev ikke gemt. Tjek forbindelsen og prøv igen.`, retry: () => run(navn, values, action) })
    })
  }
  const busy = navn => pending.some(item => item.navn === navn)

  const planMeals = s?.mode === 'plan' && s.planId && Array.isArray(s.meals) ? s.meals : []
  const open = planMeals.filter(meal => !meal.eaten && !meal.blocked)
  const eaten = planMeals.filter(meal => meal.eaten)
  const blocked = planMeals.filter(meal => meal.blocked)
  const gentag = hurtigeMaaltider(log)
  const iGaar = log.loaded && (log.logs?.length ?? 0) === 0 && (log.yesterday?.length ?? 0) > 1 ? log.yesterday : []
  const valg = forslag(log, query)
  const valgt = chosen && log.foods?.[chosen.index]?.name === chosen.name ? chosen : null
  const units = valgt ? unitsForFood(log.foods[valgt.index]) : []
  const portion = valgt ? foodPortion(log.foods[valgt.index], valgt.amount, valgt.unit) : null

  // 1921: mængdefeltet ligger under Nyt måltid; åbnes det af Ret g, rulles det på plads.
  useEffect(() => { if (chosen) mangdeRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [chosen?.index])
  const logMeal = meal => run(meal.meal, meal, intent => tracker.log(meal, intent))
  const logFood = () => {
    if (!portion) return
    const { index, amount, unit } = valgt
    run(portion.meal, portion, intent => tracker.logFood(index, amount, unit, intent))
    setChosen(null); setQuery('')
  }
  const choose = ({ index, food }) => {
    const units = unitsForFood(food), unit = units.length > 1 ? 1 : 0
    setChosen({ index, name: food.name, unit, amount: unit ? '1' : String(tracker?.foodAmount?.(index) ?? 100) })
  }

  // Vægt: ejerens logWeight rydder feltet ved succes og beholder det ved fejl.
  const { weightInput = '', onWeightInput, logWeight, savingWeight } = weight
  const kanVeje = typeof logWeight === 'function' && typeof onWeightInput === 'function'
  useEffect(() => {
    if (vaegt?.phase !== 'checking' || savingWeight === true) return undefined
    if (weightInput === '') { setVaegt({ phase: 'saved', value: vaegt.value }); return undefined }
    // Ejerens rydning kan komme en gengivelse senere; først derefter er det en fejl.
    const timer = setTimeout(() => setVaegt({ phase: 'error', value: vaegt.value }), 1500)
    return () => clearTimeout(timer)
  }, [vaegt, weightInput, savingWeight])
  const saveWeight = async event => {
    event.preventDefault()
    const value = String(weightInput).trim()
    if (!kanVeje || !value || savingWeight === true || vaegt?.phase === 'saving') return
    if (!(Number(value.replace(',', '.')) > 0)) { setVaegt({ phase: 'invalid', value }); return }
    setVaegt({ phase: 'saving', value })
    try { await logWeight() } catch { /* ejeren viser fejlen; feltet er bevaret */ }
    if (alive.current) setVaegt({ phase: 'checking', value })
  }
  const vaegtTekst = vaegt?.phase === 'saving' || vaegt?.phase === 'checking' ? `Gemmer ${vaegt.value} kg…`
    : vaegt?.phase === 'saved' ? `Vægt gemt: ${vaegt.value} kg.`
      : vaegt?.phase === 'error' ? 'Vægten blev ikke gemt. Prøv igen.'
        : vaegt?.phase === 'invalid' ? 'Skriv en vægt over 0 kg.' : ''

  return h('section', { 'aria-label': 'Kost i dag', 'data-kost-i-dag': '', style: card },
    h('h2', { style: { margin: '0 0 4px', color: '#edeae2' } }, 'Kost i dag'),
    h('p', { 'data-kost-i-dag-tal': '', style: { margin: 0, fontSize: '1.05em' } }, statusLinje(log, pending)),
    // 1916: en sendt uge, der starter senere, står som én linje; "Se planen" åbner den i laget.
    nyPlan && h('div', { 'data-kost-ny-plan': nyPlan.date, style: { ...row, alignItems: 'center' } },
      h('span', null, `Ny kostplan fra ${ugedagDato(nyPlan.date)}`),
      h('button', { type: 'button', style: { ...control, minHeight: 44 }, onClick: nyPlan.onOpen }, 'Se planen')),
    // Fast højde: beskeden skifter uden at flytte knapperne.
    h('div', { style: { minHeight: 48, marginTop: 4 } },
      note && h('p', { role: note.error ? 'alert' : 'status', 'aria-live': 'polite', style: { margin: 0, fontWeight: note.error ? 600 : 400 } }, note.text),
      note?.retry && h('button', { type: 'button', style: { ...control, minHeight: 32, padding: '2px 10px', marginTop: 4 }, onClick: note.retry }, note.retryText || 'Prøv igen'),
      // Kostloggens egen fortrydelse (5 sekunder) for et forkert tryk.
      note?.intent && log.undo?.token === note.intent && typeof tracker?.undoLog === 'function' && h('button', { type: 'button',
        style: { ...control, minHeight: 32, padding: '2px 10px', marginTop: 4 }, disabled: pending.length > 0,
        onClick: async () => {
          const navn = log.undo.meal
          const ok = await tracker.undoLog(note.intent, `kost-i-dag-fortryd:${date}:${Date.now()}`)
          if (alive.current) setNote(ok === true ? { text: `${navn} er fortrudt.` } : { error: true, text: `${navn} blev ikke fortrudt. Det er stadig gemt.` })
        } }, 'Fortryd')),

    (open.length > 0 || eaten.length > 0) && h('p', { style: label }, 'Fra din kostplan'),
    open.length > 0 && h('div', { style: row },
      ...open.map(meal => h('button', { key: meal.id, type: 'button', style: primary,
        disabled: busy(meal.name) || meal.canSave === false,
        'aria-label': `${meal.name}: spist som planlagt`,
        onClick: () => run(meal.name, meal.values, async () => {
          if (await controller.markEaten(meal.id) === true) return true
          // En uafklaret registrering kan være gemt; den må ikke prøves blindt igen.
          const now = controller.snapshot()
          return now?.phase === 'uncertain' ? { note: { error: true, text: `${meal.name}: ${now.message || 'Registreringen er uafklaret.'} Se kostplanen under Vis detaljer.`,
            retry: () => { controller.load?.(); setNote(null) }, retryText: 'Hent dagen igen' } } : false
        }) },
      busy(meal.name) ? `Gemmer ${meal.name}…` : `${meal.name} som planlagt`))),
    eaten.length > 0 && h('p', { style: { margin: '8px 0 0' } }, `Spist: ${eaten.map(meal => meal.name).join(', ')}`),
    blocked.length > 0 && h('p', { style: { margin: '8px 0 0' } }, `${blocked.map(meal => meal.name).join(', ')} skal kontrolleres under Vis detaljer.`),

    (iGaar.length > 0 || gentag.length > 0) && h('p', { style: label }, 'Spist igen'),
    (iGaar.length > 0 || gentag.length > 0) && h('div', { style: row },
      iGaar.length > 0 && h('button', { type: 'button', style: primary, disabled: pending.length > 0,
        onClick: () => run(`${iGaar.length} måltider fra i går`, iGaar.reduce((sum, meal) => ({ kcal: sum.kcal + meal.kcal, protein: sum.protein + meal.protein }), { kcal: 0, protein: 0 }),
          async intent => { for (const [i, meal] of iGaar.entries()) if (await tracker.log(meal, `${intent}:${i}`) !== true || !await whenReady(sources)) return false; return true }) },
      `Alt fra i går (${iGaar.length})`),
      ...gentag.map(meal => {
        const anden = andenMaengde(log, meal)
        const igen = h('button', { key: JSON.stringify([meal.meal, meal.kcal, meal.protein]), type: 'button', style: control,
          disabled: busy(meal.meal), 'aria-label': `Spist igen: ${meal.meal}`, onClick: () => logMeal(meal) }, meal.meal)
        // 1921: samme måltid med en anden mængde; felt og Log står straks åbne (3 tryk mod 7).
        return !anden ? igen : h('span', { key: JSON.stringify([meal.meal, meal.kcal, meal.protein]), style: { display: 'inline-flex', gap: 4 } }, igen,
          h('button', { type: 'button', style: control, disabled: busy(meal.meal), 'aria-label': `Anden mængde: ${meal.meal}`,
            onClick: () => { setChosen(anden); setQuery('') } }, 'Ret g'))
      })),

    water,

    h('p', { style: label }, h('label', { htmlFor: `kost-i-dag-nyt-${athleteId}` }, 'Nyt måltid')),
    h('input', { id: `kost-i-dag-nyt-${athleteId}`, type: 'search', value: query, autoComplete: 'off',
      placeholder: 'Skriv fx skyr, banan eller kylling', 'aria-label': 'Nyt måltid',
      style: { ...control, cursor: 'text', width: '100%', marginTop: 8 },
      onChange: event => { setQuery(event.currentTarget.value); setChosen(null) } }),
    query.trim().length >= 2 && !valgt && h('div', { role: 'group', 'aria-label': 'Forslag', style: row },
      ...valg.meals.map(meal => h('button', { key: 'm' + JSON.stringify([meal.meal, meal.kcal]), type: 'button', style: control,
        'aria-label': `Log ${meal.meal}`, onClick: () => { logMeal(meal); setQuery('') } }, meal.meal)),
      ...valg.foods.map(item => h('button', { key: 'f' + item.index, type: 'button', style: control,
        'aria-label': `Vælg ${item.food.name}`, onClick: () => choose(item) }, item.food.name)),
      h('button', { type: 'button', style: { ...control, background: 'transparent' }, onClick: () => onCustom?.() },
        valg.meals.length || valg.foods.length ? 'Egne tal' : 'Ikke fundet: notér med egne tal')),
    customNote && h('p', { role: 'status', style: { margin: '8px 0 0' } }, customNote),
    valgt && h('div', { ref: mangdeRef, role: 'group', 'aria-label': `Mængde: ${valgt.name}`, style: { ...row, alignItems: 'center' } },
      h('input', { type: 'text', inputMode: 'decimal', value: valgt.amount, 'aria-label': `Mængde ${valgt.name}`,
        style: { ...control, cursor: 'text', width: '5.5rem' },
        onChange: event => setChosen({ ...valgt, amount: event.currentTarget.value }) }),
      units.length > 1 ? h('select', { value: String(valgt.unit), 'aria-label': `Enhed ${valgt.name}`, style: control,
        onChange: event => setChosen({ ...valgt, unit: Number(event.currentTarget.value), amount: event.currentTarget.value === '0' ? String(tracker?.foodAmount?.(valgt.index) ?? 100) : '1' }) },
      ...units.map((unit, i) => h('option', { key: unit.label, value: String(i) }, unit.label))) : h('span', null, 'g'),
      h('button', { type: 'button', style: primary, disabled: !portion, 'aria-label': `Log ${valgt.name}`, onClick: logFood },
        portion ? `Log · ${fmt(portion.kcal)} kcal` : 'Log'),
      h('button', { type: 'button', style: { ...control, background: 'transparent' }, onClick: () => setChosen(null) }, 'Fortryd')),

    kanVeje && h('form', { onSubmit: saveWeight, style: { ...row, alignItems: 'center', marginTop: 12 } },
      h('label', { style: { fontWeight: 600 }, htmlFor: `kost-i-dag-vaegt-${athleteId}` }, 'Vægt'),
      h('input', { id: `kost-i-dag-vaegt-${athleteId}`, type: 'text', inputMode: 'decimal', value: weightInput, placeholder: 'kg',
        'aria-label': 'Vægt i kg', disabled: savingWeight === true, style: { ...control, cursor: 'text', width: '6rem' },
        onChange: event => { onWeightInput(event.currentTarget.value); if (vaegt && vaegt.phase !== 'saving' && vaegt.phase !== 'checking') setVaegt(null) } }),
      h('button', { type: 'submit', style: control, disabled: savingWeight === true }, 'Gem vægt'),
      vaegtTekst && h('span', { role: vaegt?.phase === 'error' || vaegt?.phase === 'invalid' ? 'alert' : 'status' }, vaegtTekst)))
}

const device = () => { try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null } }

// Laget "Vis detaljer": alt det gamle står uændret og monteret i children; det
// skjules kun. Valget huskes pr. atlet på enheden. Uden en skrivbar dag i dag
// (fremtidig dato, anden dag) vises laget åbent som før.
export function KostLag({ quick, preview, athleteId, date, checkin, controller, weight, foodEntry, foodGate, trackerFold, water,
  noPlanToday = false, client, onShowPlan, children }) {
  const [details, setDetails] = useState(() => ({ athleteId, open: laesDetaljer(device(), athleteId) }))
  const detailsOpen = details.athleteId === athleteId ? details.open : laesDetaljer(device(), athleteId)
  const [custom, setCustom] = useState(0)
  const [notReady, setNotReady] = useState(false)
  const setOpen = next => { gemDetaljer(device(), athleteId, next); setDetails({ athleteId, open: next }) }
  const layerOpen = !quick || detailsOpen || preview
  // 1916: læs den næste sendte uge kun, når Kost i dag er vist uden planmåltider.
  // Kun læsning; fejl eller ingen plan giver ingen linje.
  const wantNext = quick && noPlanToday && typeof onShowPlan === 'function'
  // Én læsning pr. atlet, dag og klient: StrictMode og et midlertidigt skjult Kost i dag læser ikke igen.
  const [next, setNext] = useState(null)
  const nextRead = useRef(null)
  useEffect(() => {
    if (!wantNext) return undefined
    let live = true
    const r = nextRead.current
    const read = r?.athleteId === athleteId && r?.date === date && r?.client === client ? r
      : (nextRead.current = { athleteId, date, client, promise: readNextPlanStart({ client, athleteId, today: date }) })
    void read.promise.then(start => { if (live) setNext({ athleteId, date, client, start }) })
    return () => { live = false }
  }, [wantNext, client, athleteId, date])
  const nextStart = wantNext && next?.athleteId === athleteId && next?.date === date && next?.client === client ? next.start : null
  // Laget åbnes kun for denne visning; atletens husket valg for "Vis detaljer" ændres ikke.
  const nyPlan = nextStart ? { date: nextStart, onOpen: () => { setDetails({ athleteId, open: true }); onShowPlan(nextStart) } } : null
  // "Egne tal" åbner laget og derefter kostloggens eget felt (samme vej som Log mad).
  useEffect(() => {
    if (!custom || !layerOpen) return
    // Svigter åbningen (gem i gang, kostloggen ikke skrivbar), siges det; et nyt tryk prøver igen.
    setNotReady(!foodGate?.current || foodEntry?.openFoodLog?.(trackerFold?.current) !== true)
  }, [custom, layerOpen])
  const waterLog = h(WaterDayLog, { ...water, compact: quick && !layerOpen })
  return h('div', { style: { textAlign: 'left' } },
    quick && h(KostIDag, { customNote: notReady ? 'Kostloggen er ikke klar. Prøv igen om lidt.' : null, tracker: checkin, controller, athleteId, date, weight, water: layerOpen ? null : waterLog, nyPlan,
      onCustom: () => { if (!layerOpen) setOpen(true); setCustom(n => n + 1) } }),
    quick && h('div', { style: { padding: '0 16px 8px' } },
      h('button', { type: 'button', style: control, 'aria-expanded': layerOpen, 'aria-controls': `kost-detaljer-${athleteId}`,
        onClick: () => setOpen(!detailsOpen) }, layerOpen ? 'Skjul detaljer' : 'Vis detaljer'),
      !layerOpen && h('p', { style: { margin: '8px 0 0', opacity: 0.85 } }, 'Makroer, gram, fødevaresøgning, skabeloner, uge og indkøb.')),
    layerOpen && waterLog,
    h('div', { id: `kost-detaljer-${athleteId}`, hidden: !layerOpen, 'data-kost-detaljer': layerOpen ? 'aaben' : 'lukket' }, children))
}
