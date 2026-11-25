import * as React from 'react'
import { NY_KOSTUGE_TEKST } from './nyKostuge.mjs'
import { foodPortion, unitsForFood } from '../../nutrition/controller.mjs'
import { statusLinje, hurtigeMaaltider, forslag, iGaarMedPlannavne, laesDetaljer, gemDetaljer } from './kostIDagModel.mjs'
import { andenMaengde } from './andenMaengdeModel.mjs'
import { loggetIDag, nyMaengde } from './retMaengdeModel.mjs'
import { scaledMeal } from './dayModel.mjs'
import WaterDayLog from './WaterDayLog.mjs'
import { readNextPlanStart } from './upcomingPlanModel.mjs'
import { FRI_STOERRELSER, friStatus, friPost, erFriRaekke } from '../friPulje.mjs'

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
  const [ret, setRet] = useState(null)
  const [friKcal, setFriKcal] = useState('')
  const queue = useRef(Promise.resolve())
  const mangdeRef = useRef(null)
  const groupRef = useRef(null)
  const planGruppeRef = useRef(null)
  const fjernRef = useRef(null)
  const seq = useRef(0)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const sources = [
    { subscribe: tracker?.subscribe, snapshot: tracker?.snapshot, ready: v => v?.loaded === true && readyPhase(v.phase) && !v.pending },
    ...(controller ? [{ subscribe: controller.subscribe, snapshot: controller.snapshot,
      ready: v => !v || v.mode !== 'plan' || (readyPhase(v.phase) && !v.pending) || v.phase === 'uncertain' }] : []),
  ]
  // Optimistisk: tallet og "Gemmer …" vises straks; trykkene gemmes i rækkefølge.
  const run = (navn, values, action, tekst = {}) => {
    const id = ++seq.current
    setPending(list => [...list, { id, navn, values }])
    setNote({ text: tekst.gemmer ?? `Gemmer ${navn}…` })
    queue.current = queue.current.then(async () => {
      const intent = `kost-i-dag:${date}:${Date.now()}:${id}`
      let result = false
      try { result = await whenReady(sources) ? await action(intent) : false } catch { result = false }
      const ok = result === true
      // Behold tallet som ventende, til kostloggen har hentet dagen igen, så linjen ikke blinker.
      if (ok) await whenReady(sources, 5000)
      if (!alive.current) return
      setPending(list => list.filter(item => item.id !== id))
      setNote(ok ? { text: tekst.gemt ?? `${navn} gemt.`, intent }
        : result?.note ?? { error: true, text: tekst.fejl ?? `${navn} blev ikke gemt. Tjek forbindelsen og prøv igen.`, retry: () => run(navn, values, action, tekst) })
    })
  }
  const busy = navn => pending.some(item => item.navn === navn)

  const planMeals = s?.mode === 'plan' && s.planId && Array.isArray(s.meals) ? s.meals : []
  const open = planMeals.filter(meal => !meal.eaten && !meal.blocked)
  const eaten = planMeals.filter(meal => meal.eaten)
  const blocked = planMeals.filter(meal => meal.blocked)
  const gentag = hurtigeMaaltider(log)
  const iGaar = log.loaded && (log.logs?.length ?? 0) === 0 && (log.yesterday?.length ?? 0) > 1 ? iGaarMedPlannavne(log.yesterday, planMeals.map(meal => meal.name)) : []
  const valg = forslag(log, query)
  const valgt = chosen && log.foods?.[chosen.index]?.name === chosen.name ? chosen : null
  const units = valgt ? unitsForFood(log.foods[valgt.index]) : []
  const portion = valgt ? foodPortion(log.foods[valgt.index], valgt.amount, valgt.unit) : null

  // 1921: mængdefeltet ligger under Nyt måltid; åbnes det af Ret g, rulles det på plads.
  useEffect(() => { if (chosen) mangdeRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [chosen?.index])
  const logMeal = meal => run(meal.meal, meal, intent => tracker.log(meal, intent))
  const friNu = s?.mode === 'plan' && s.friKcal > 0 ? s.friKcal : 0
  const friVentende = pending.filter(item => erFriRaekke({ meal: item.navn })).reduce((n, item) => n + (Number(item.values?.kcal) || 0), 0)
  const fri = friNu ? (status => ({ ...status, brugt: status.brugt + friVentende, tilbage: status.tilbage - friVentende,
    over: status.brugt + friVentende > status.pulje }))(friStatus({ friKcal: friNu, logs: log.logs })) : null
  const logFri = post => { if (!post) return; run(post.meal, post, intent => tracker.log(post, intent)); setFriKcal('') }
  const logFood = () => {
    if (!portion) return
    const { index, amount, unit } = valgt
    run(portion.meal, portion, intent => tracker.logFood(index, amount, unit, intent))
    setChosen(null); setQuery('')
  }
  // 1923: et logget fødevaremåltid i dag rettes i samme række (kostloggens egen update).
  const planRows = new Set(planMeals.flatMap(meal => meal.logId ? [meal.logId] : []))
  const planNames = new Set(planMeals.map(meal => meal.name))
  const logget = typeof tracker?.update === 'function'
    ? loggetIDag(log, row => planRows.has(row.id) || planNames.has(String(row.meal ?? '').trim())) : []
  const retItem = ret && logget.find(item => item.id === ret.id)
  const retNy = retItem ? nyMaengde(log, retItem, ret.amount) : null
  const gemRet = () => {
    if (!retNy) return
    const { id, row } = retItem, nyt = retNy
    // Kun forskellen vises som ventende, så dagens tal følger med straks.
    run(nyt.meal, { kcal: nyt.kcal - (Number(row.kcal) || 0), protein: nyt.protein - (Number(row.protein) || 0) },
      intent => tracker.update(id, nyt, intent))
    setRet(null)
  }
  // 1924: et spist planmåltid rettes til en ny samlet mængde i samme række; kostplanens
  // kvittering følger med, så måltidet stadig står som spist.
  const kanRettePlan = typeof controller?.adjustEaten === 'function' && typeof tracker?.update === 'function'
  const gramTotal = meal => meal.foods.reduce((sum, food) => sum + (Number(food.grams) || 0), 0)
  const retPlan = ret?.plan && kanRettePlan ? eaten.find(meal => meal.id === ret.plan && meal.logId) : null
  const planNy = retPlan ? scaledMeal(retPlan.foods, ret.amount) : null
  const gemPlan = () => {
    if (!planNy) return
    const meal = retPlan, nyt = planNy, navn = `${meal.name} · ${fmt(nyt.grams)} g`
    run(navn, { kcal: nyt.values.kcal - meal.values.kcal, protein: nyt.values.protein - meal.values.protein }, async intent => {
      if (await controller.adjustEaten(meal.id, nyt.grams, (rowId, value) => tracker.update(rowId, value, intent)) === true) return true
      const now = controller.snapshot()
      return now?.phase === 'uncertain' ? { note: { error: true, text: `${meal.name}: ${now.message} Se kostplanen under Vis detaljer.`,
        retry: () => { controller.load?.(); setNote(null) }, retryText: 'Hent dagen igen' } } : false
    })
    setRet(null)
  }
  // 1936: et forkert logget måltid fjernes direkte her med kostloggens egen sletning (samme remove som laget);
  // Fortryd lægger præcis rækken tilbage. Et planmåltid sættes tilbage som planlagt, hvis mængden ikke var rettet.
  const removable = new Set(log.removableIds ?? [])
  const fjernbare = typeof tracker?.remove === 'function' ? (log.logs ?? []).filter(row => removable.has(row.id)) : []
  const fjernbarIds = new Set(fjernbare.map(row => row.id))
  // 1940: hvert måltid står ét sted. Et spist planmåltid har Ret og Fjern i sin egen række under kostplanen;
  // alt andet står i én liste, Logget i dag, med Fjern i samme række.
  const planRaekker = new Set(kanRettePlan ? eaten.flatMap(meal => meal.logId ? [meal.logId] : []) : [])
  const redigerbare = new Set(logget.map(item => item.id))
  const listen = (log.logs ?? []).filter(row => !planRaekker.has(row.id) && (fjernbarIds.has(row.id) || redigerbare.has(row.id)))
  const fjern = row => {
    const navn = String(row.meal ?? '').trim()
    const planMeal = eaten.find(meal => meal.logId === row.id)
    const værdi = { kcal: -(Number(row.kcal) || 0), protein: -(Number(row.protein) || 0) }
    const gen = { meal: row.meal, kcal: row.kcal, protein: row.protein, carb: row.carb, fat: row.fat }
    run(navn, værdi, async intent => {
      if (await tracker.remove(row.id, intent) !== true) return false
      fjernRef.current = { intent, row: gen, planMeal: planMeal && planMeal.values.kcal === Number(row.kcal) && planMeal.values.protein === Number(row.protein) ? planMeal.id : null }
      return true
    }, { gemmer: `Fjerner ${navn}…`, gemt: `${navn} er fjernet.`, fejl: `${navn} blev ikke fjernet. Det er stadig gemt.` })
  }
  const fortrydFjern = async () => {
    const { row, planMeal } = fjernRef.current
    const navn = String(row.meal ?? '').trim()
    fjernRef.current = null
    setNote({ text: `Sætter ${navn} tilbage…` })
    let ok = false
    try {
      ok = planMeal && controller?.markEaten ? await controller.markEaten(planMeal) === true : await tracker.log(row, `kost-i-dag-fortryd-fjern:${date}:${Date.now()}`) === true
    } catch { ok = false }
    if (alive.current) setNote(ok ? { text: `${navn} er sat tilbage.` } : { error: true, text: `${navn} blev ikke sat tilbage. Log det igen under Nyt måltid.` })
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
      // 1933: Alt fra i går fortryder alle sine rækker, så længe den sidste rækkes fortrydelse (5 sekunder) gælder.
      note?.intent && groupRef.current?.intent === note.intent && log.undo?.token === groupRef.current.token && typeof tracker?.undoRows === 'function' && h('button', { type: 'button',
        style: { ...control, minHeight: 32, padding: '2px 10px', marginTop: 4 }, disabled: pending.length > 0,
        onClick: async () => {
          const { ids } = groupRef.current
          const antal = await tracker.undoRows(ids, `kost-i-dag-fortryd:${date}:${Date.now()}`)
          if (alive.current) setNote(antal === ids.length ? { text: `${ids.length} måltider fra i går er fortrudt.` }
            : { error: true, text: `${antal} af ${ids.length} måltider fra i går blev fortrudt. Resten er stadig gemt; se Vis detaljer.` })
        } }, 'Fortryd'),
      // 2156: Alt som planlagt fortryder alle sine planrækker (markEaten giver ingen kort fortrydelse; rækkeiderne læses fra kostplanen).
      note?.intent && planGruppeRef.current?.intent === note.intent && typeof tracker?.undoRows === 'function' && h('button', { type: 'button',
        style: { ...control, minHeight: 32, padding: '2px 10px', marginTop: 4 }, disabled: pending.length > 0,
        onClick: async () => {
          const { mealIds } = planGruppeRef.current
          const ids = (controller?.snapshot?.().meals ?? []).filter(meal => mealIds.includes(meal.id) && meal.logId).map(meal => meal.logId)
          planGruppeRef.current = null
          const antal = ids.length > 0 ? await tracker.undoRows(ids, `kost-i-dag-fortryd:${date}:${Date.now()}`) : 0
          if (alive.current) setNote(antal === mealIds.length ? { text: `${mealIds.length} planmåltider er fortrudt.` }
            : { error: true, text: `${antal} af ${mealIds.length} planmåltider blev fortrudt. Resten er stadig gemt; se Vis detaljer.` })
        } }, 'Fortryd'),
      note?.intent && fjernRef.current?.intent === note.intent && h('button', { type: 'button',
        style: { ...control, minHeight: 32, padding: '2px 10px', marginTop: 4 }, disabled: pending.length > 0, onClick: fortrydFjern }, 'Fortryd'),
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
      busy(meal.name) ? `Gemmer ${meal.name}…` : `${meal.name} som planlagt`)),
      // 2156: ét tryk for resten af dagens åbne planmåltider; samme markEaten pr. måltid, ét Fortryd for gruppen.
      open.length > 1 && h('button', { type: 'button', style: primary, disabled: pending.length > 0 || open.some(meal => meal.canSave === false),
        onClick: () => {
          // Prøv igen bruger samme gruppe; måltider, der allerede er gemt, logges ikke igen.
          const maaltider = open.map(meal => ({ id: meal.id, name: meal.name })), gemt = new Set()
          run(`${maaltider.length} planmåltider`, open.reduce((sum, meal) => ({ kcal: sum.kcal + meal.values.kcal, protein: sum.protein + meal.values.protein }), { kcal: 0, protein: 0 }),
            async intent => {
              for (const meal of maaltider) {
                if (gemt.has(meal.id)) continue
                if (await controller.markEaten(meal.id) !== true) {
                  // En uafklaret registrering kan være gemt; den må ikke prøves blindt igen.
                  const now = controller.snapshot()
                  return now?.phase === 'uncertain' ? { note: { error: true, text: `${meal.name}: ${now.message || 'Registreringen er uafklaret.'} Se kostplanen under Vis detaljer.`,
                    retry: () => { controller.load?.(); setNote(null) }, retryText: 'Hent dagen igen' } } : false
                }
                gemt.add(meal.id)
                // Næste måltid venter, til kostplanen har hentet dagen igen og rækken har fået sit rigtige id.
                const hentet = { subscribe: controller.subscribe, snapshot: controller.snapshot, ready: v => !!v?.meals?.find(item => item.id === meal.id)?.logId }
                if (!await whenReady([...sources, hentet])) return false
              }
              planGruppeRef.current = { intent, mealIds: maaltider.map(meal => meal.id) }
              return true
            }, { gemt: `${maaltider.length} planmåltider gemt som planlagt.` })
        } }, `Alt som planlagt (${open.length})`)),
    eaten.length > 0 && !kanRettePlan && h('p', { style: { margin: '8px 0 0' } }, `Spist: ${eaten.map(meal => meal.name).join(', ')}`),
    // 1924: tryk på et spist planmåltid åbner mængden udfyldt; Gem retter samme række.
    eaten.length > 0 && kanRettePlan && h('div', { style: row },
      ...eaten.map(meal => {
        const ret = h('button', { key: meal.id, type: 'button', style: control, disabled: !meal.logId || pending.length > 0,
          'aria-label': `Ret mængde: ${meal.name}`, 'aria-pressed': retPlan?.id === meal.id,
          onClick: () => setRet(retPlan?.id === meal.id ? null : { plan: meal.id, amount: String(Math.round(gramTotal(meal) * 10) / 10).replace('.', ',') }) },
        `Spist: ${meal.name} · ${fmt(gramTotal(meal))} g`)
        const raekke = fjernbare.find(item => item.id === meal.logId)
        // 1940: Fjern i samme række som planmåltidets Ret.
        return !raekke ? ret : h('span', { key: meal.id, style: { display: 'inline-flex', gap: 4 } }, ret,
          h('button', { type: 'button', style: control, disabled: pending.length > 0, 'aria-label': `Fjern måltid: ${String(raekke.meal ?? '').trim()}`,
            onClick: () => fjern(raekke) }, 'Fjern'))
      })),
    retPlan && h('div', { role: 'group', 'aria-label': `Ret mængde: ${retPlan.name}`, style: { ...row, alignItems: 'center' } },
      h('input', { type: 'text', inputMode: 'decimal', value: ret.amount, 'aria-label': `Ny mængde ${retPlan.name}`,
        style: { ...control, cursor: 'text', width: '5.5rem' }, onChange: event => setRet({ ...ret, amount: event.currentTarget.value }) }),
      h('span', null, 'g'),
      h('button', { type: 'button', style: primary, disabled: !planNy || pending.length > 0, 'aria-label': `Gem ${retPlan.name}`, onClick: gemPlan },
        planNy ? `Gem · ${fmt(planNy.values.kcal)} kcal` : 'Gem'),
      h('button', { type: 'button', style: { ...control, background: 'transparent' }, onClick: () => setRet(null) }, 'Fortryd')),
    blocked.length > 0 && h('p', { style: { margin: '8px 0 0' } }, `${blocked.map(meal => meal.name).join(', ')} skal kontrolleres under Vis detaljer.`),

    // 2137: fast base plus fri kcal-pulje. Kun når coachen har sat et niveau over 0 %; ellers vises intet nyt.
    fri && h('div', { 'data-kost-fri': fri.pulje, role: 'group', 'aria-label': 'Fri pulje i dag' },
      h('p', { style: label }, `Fri i dag: ${fmt(fri.pulje)} kcal`),
      h('p', { 'data-kost-fri-status': '', style: { margin: '4px 0 0' } },
        fri.over ? `Brugt ${fmt(fri.brugt)} kcal, ${fmt(-fri.tilbage)} over puljen.` : `Brugt ${fmt(fri.brugt)} kcal, ${fmt(fri.tilbage)} tilbage.`),
      h('div', { style: row },
        ...FRI_STOERRELSER.map(item => h('button', { key: item.id, type: 'button', style: control, disabled: busy(`Fri: ${item.id}`),
          'aria-label': `Fri mad ${item.navn.toLowerCase()}, ${item.kcal} kcal`, onClick: () => logFri(friPost(item.id)) },
        `${item.navn} · ${item.kcal} kcal`))),
      h('div', { style: { ...row, alignItems: 'center' } },
        h('input', { type: 'text', inputMode: 'numeric', value: friKcal, 'aria-label': 'Fri mad i kcal', placeholder: 'kcal',
          style: { ...control, cursor: 'text', width: '5.5rem' }, onChange: event => setFriKcal(event.currentTarget.value) }),
        h('button', { type: 'button', style: primary, disabled: !friPost(null, friKcal) || pending.length > 0, 'aria-label': 'Log fri mad',
          onClick: () => logFri(friPost(null, friKcal)) }, 'Log fri mad'))),

    (iGaar.length > 0 || gentag.length > 0) && h('p', { style: label }, 'Spist igen'),
    (iGaar.length > 0 || gentag.length > 0) && h('div', { style: row },
      iGaar.length > 0 && h('button', { type: 'button', style: primary, disabled: pending.length > 0,
        onClick: () => {
          // 1934: Prøv igen bruger samme gruppe; rækker, der allerede er gemt, logges ikke igen.
          const gruppe = { gemt: new Set(), ids: [] }
          run(`${iGaar.length} måltider fra i går`, iGaar.reduce((sum, meal) => ({ kcal: sum.kcal + meal.kcal, protein: sum.protein + meal.protein }), { kcal: 0, protein: 0 }),
            async intent => {
            // 1933: rækkeiderne gemmes, så ét Fortryd kan fjerne hele gruppen igen.
            for (const [i, meal] of iGaar.entries()) {
              if (gruppe.gemt.has(i)) continue
              if (await tracker.log(meal, `${intent}:${i}`) !== true) return false
              gruppe.gemt.add(i)
              if (!await whenReady(sources)) return false
              const undo = tracker.snapshot?.()?.undo
              if (undo?.token === `${intent}:${i}` && undo.rowId) gruppe.ids.push(undo.rowId)
            }
            if (gruppe.ids.length === iGaar.length) groupRef.current = { intent, token: `${intent}:${iGaar.length - 1}`, ids: gruppe.ids }
            return true
          })
        } },
      `Alt fra i går (${iGaar.length})`),
      ...gentag.map(meal => {
        const anden = andenMaengde(log, meal)
        const igen = h('button', { key: JSON.stringify([meal.meal, meal.kcal, meal.protein]), type: 'button', style: control,
          disabled: busy(meal.meal), 'aria-label': `Spist igen: ${meal.meal}`, onClick: () => logMeal(meal) }, meal.meal)
        // 1921: samme måltid med en anden mængde; felt og Log står straks åbne (3 tryk mod 4).
        return !anden ? igen : h('span', { key: JSON.stringify([meal.meal, meal.kcal, meal.protein]), style: { display: 'inline-flex', gap: 4 } }, igen,
          h('button', { type: 'button', style: control, disabled: busy(meal.meal), 'aria-label': `Anden mængde: ${meal.meal}`,
            onClick: () => { setChosen(anden); setQuery('') } }, 'Ret g'))
      })),

    // 1923: tryk på et logget måltid åbner mængden udfyldt; Gem retter samme række.
    // 1940: samme række har Fjern (1936, Fortryd i beskeden); ingen bekræftelsesdialog.
    listen.length > 0 && h('p', { style: label }, logget.length > 0 ? 'Logget i dag · tryk på navnet for at rette mængden' : 'Logget i dag'),
    listen.length > 0 && h('ul', { style: { listStyle: 'none', margin: '8px 0 0', padding: 0 } },
      ...listen.map(raekke => {
        const navn = String(raekke.meal ?? '').trim(), item = logget.find(x => x.id === raekke.id)
        return h('li', { key: raekke.id, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 } },
          item ? h('button', { type: 'button', style: { ...control, minWidth: 0, overflowWrap: 'anywhere', textAlign: 'left' }, disabled: pending.length > 0,
            'aria-label': `Ret mængde: ${item.row.meal}`, 'aria-pressed': retItem?.id === item.id,
            onClick: () => setRet(retItem?.id === item.id ? null : { id: item.id, amount: String(item.grams) }) }, item.row.meal)
            : h('span', { style: { minWidth: 0, overflowWrap: 'anywhere' } }, navn),
          fjernbarIds.has(raekke.id) && h('button', { type: 'button', style: control, disabled: pending.length > 0, 'aria-label': `Fjern måltid: ${navn}`,
            onClick: () => fjern(raekke) }, 'Fjern'))
      })),
    retItem && h('div', { role: 'group', 'aria-label': `Ret mængde: ${retItem.name}`, style: { ...row, alignItems: 'center' } },
      h('input', { type: 'text', inputMode: 'decimal', value: ret.amount, 'aria-label': `Ny mængde ${retItem.name}`,
        style: { ...control, cursor: 'text', width: '5.5rem' }, onChange: event => setRet({ ...ret, amount: event.currentTarget.value }) }),
      h('span', null, 'g'),
      h('button', { type: 'button', style: primary, disabled: !retNy || pending.length > 0, 'aria-label': `Gem ${retItem.name}`, onClick: gemRet },
        retNy ? `Gem · ${fmt(retNy.kcal)} kcal` : 'Gem'),
      h('button', { type: 'button', style: { ...control, background: 'transparent' }, onClick: () => setRet(null) }, 'Fortryd')),

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
  noPlanToday = false, client, onShowPlan, planSeen = false, onSeen, nyUge = false, children }) {
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
  // 1914: Se planen viser den sendte uge og tæller som set.
  const nyPlan = nextStart ? { date: nextStart, onOpen: () => { setDetails({ athleteId, open: true }); onShowPlan(nextStart); onSeen?.() } } : null
  // 1914: set-mærket, når dagens planmåltider står synligt (KostDayFrame giver planSeen),
  // eller når atleten åbner det gamle kostplankort bag "Vis detaljer".
  const seenNow = planSeen || (quick && detailsOpen)
  useEffect(() => { if (seenNow) onSeen?.() }, [seenNow, onSeen])
  // "Egne tal" åbner laget og derefter kostloggens eget felt (samme vej som Log mad).
  useEffect(() => {
    if (!custom || !layerOpen) return
    // Svigter åbningen (gem i gang, kostloggen ikke skrivbar), siges det; et nyt tryk prøver igen.
    setNotReady(!foodGate?.current || foodEntry?.openFoodLog?.(trackerFold?.current) !== true)
  }, [custom, layerOpen])
  const waterLog = h(WaterDayLog, { ...water, compact: quick && !layerOpen })
  return h('div', { style: { textAlign: 'left' } },
    // Ordre 2145: kostklient, hul efter sidste sendte dag. Står over alt andet, så Kost ikke ser tom ud.
    nyUge && h('section', { 'data-ny-kostuge': '', role: 'status', 'aria-label': NY_KOSTUGE_TEKST, style: card },
      h('h2', { style: { margin: '0 0 8px', fontSize: '1.15rem' } }, NY_KOSTUGE_TEKST),
      h('p', { style: { margin: 0 } }, 'Du kan stadig logge mad og vægt her, indtil den er sendt.')),
    quick && h(KostIDag, { customNote: notReady ? 'Kostloggen er ikke klar. Prøv igen om lidt.' : null, tracker: checkin, controller, athleteId, date, weight, water: layerOpen ? null : waterLog, nyPlan,
      onCustom: () => { if (!layerOpen) setOpen(true); setCustom(n => n + 1) } }),
    quick && h('div', { style: { padding: '0 16px 8px' } },
      h('button', { type: 'button', style: control, 'aria-expanded': layerOpen, 'aria-controls': `kost-detaljer-${athleteId}`,
        onClick: () => setOpen(!detailsOpen) }, layerOpen ? 'Skjul detaljer' : 'Vis detaljer'),
      !layerOpen && h('p', { style: { margin: '8px 0 0', opacity: 0.85 } }, 'Makroer, gram, fødevaresøgning, skabeloner, uge og indkøb.')),
    layerOpen && waterLog,
    h('div', { id: `kost-detaljer-${athleteId}`, hidden: !layerOpen, 'data-kost-detaljer': layerOpen ? 'aaben' : 'lukket' }, children))
}
