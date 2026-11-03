import './trainingFullscreenRegister.mjs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { default: TrainingFullscreen } = await import('./TrainingFullscreen.mjs')
import { mount } from './trainingFullscreenFake.mjs'
const { lavSaetSkrivning } = await import('./saetSkrivning.js')
import { loadOfflineSets } from '../offlineSetQueue.js'
import { loadRestPause } from '../restPause.js'
import { rel1101Enabled, DEFAULT_REL1101 } from '../rel1101.mjs'
const { createTrainingApproval, trainingInput } = await import('./trainingFullscreenModel.mjs')

const session = () => ({ id: 'session-fixture', title: 'Dagens styrke', exercises: [
  { id: 'squat-fixture', name: 'Squat', sets: 2, reps: '5', intensity: 'RPE 8', note: 'Hold brystet op. Pause 90 sek' },
  { id: 'row-fixture', name: 'Roning', sets: 1, reps: '8', recommended_weight: 20 },
] })
function fixture(t, override = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const storage = new Map()
  globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) }
  const week = { id: 'week-fixture', sessions: [session()] }
  const props = { allWeeks: [week], currentWeek: week, exerciseLogs: [], logInputs: {}, restPause: null, ...override }
  const runtime = mount(TrainingFullscreen, props)
  const noop = () => {}
  const set = key => value => { props[key] = typeof value === 'function' ? value(props[key]) : value; runtime.render() }
  const handlers = () => lavSaetSkrivning({ allWeeks: props.allWeeks, currentWeek: props.currentWeek,
    athlete: { id: 'synthetic-athlete' }, exerciseLogs: props.exerciseLogs, logInputs: props.logInputs,
    feedbackInputs: {}, lastLogByExerciseName: {},
    setExerciseLogs: set('exerciseLogs'), setLogInputs: set('logInputs'), setRestPause: set('restPause'),
    setLastLoggedSet: noop, setPendingSyncCount: noop, setSetConfirm: noop, showFlash: noop,
    setPrToast: noop, setPrToastFading: noop, fetchExerciseLogs: noop,
    setWriteRef: { current: {} } })
  props.setLogInputs = set('logInputs')
  const logCalls = []
  props.onLogSet = (...args) => { logCalls.push(args); return handlers().logDagensPasSet(...args) }
  runtime.render()
  const buttons = () => runtime.nodes(n => n.type === 'button')
  const click = text => {
    const node = buttons().find(n => n.children.includes(text)); assert.ok(node, text)
    assert.ok(!node.props.disabled, text+' disabled'); const value = node.props.onClick(); runtime.render(); return value
  }
  const fill = (index, value) => {
    runtime.nodes(n => n.type === 'input')[index].props.onChange({ target: { value } }); runtime.render()
  }
  t.after(() => { runtime.unmount(); delete globalThis.localStorage })
  return { props, runtime, click, fill, buttons, logCalls }
}

test('rel1101 accepts only boolean true or one exact query value; default OFF', () => {
  assert.equal(DEFAULT_REL1101, false)
  for (const value of [undefined, false, 1, '1', 'true', {}, null]) assert.equal(rel1101Enabled(value), false)
  assert.equal(rel1101Enabled(true), true)
  assert.equal(rel1101Enabled(false, '?rel1101=1'), true)
  for (const query of ['?rel1101=true', '?rel1101=01', '?rel1101=0', '?rel1101=1&rel1101=1', '?rel1101=1&rel1101=0', '?rel1030=1', '?rel1101=1%20']) {
    assert.equal(rel1101Enabled(false, query), false, query)
  }
})

test('OFF integration reconstructs exact base; only current Hjem entry changes', () => {
  let candidate = readFileSync(new URL('../AthleteView.jsx', import.meta.url), 'utf8')
  // Entropi 2-koblingen (flaget entropi2, slukket som standard) er et eksplicit, separat delta.
  // Hver tilføjet linje fjernes præcist og skal findes nøjagtigt én gang; derefter gælder
  // den oprindelige Home-entry-inversion og begge SHA-vagter uændret.
  // Marc 3. nov.: genvejen 'Film et saet' paa Entropi 2-hjem er en del af det samme delta (onFilmSet).
  const entropi2Delta = [
    ["import { entropi2Enabled, loadEntropi2Styles, HomeSession, Entropi2Kost, ConversationEntry, Entropi2Mobility, Entropi2Analysis, useEntropi2Dag, LOCAL_FOODS } from './entropi2/athleteEntry.mjs'\n", ''],
    ['hjemoevKompakt = false, rel1101 = false, entropi2 = false})', 'hjemoevKompakt = false, rel1101 = false})'],
    ['  const e2 = entropi2Enabled(entropi2) === true\n', ''],
    // E2-OVERSKRIFT1: Entropi 2-stilen indlæses, så snart flaget er tændt; atletens ramme markeres kun med e2Atlet.
    ['  useEffect(() => { if (e2) loadEntropi2Styles() }, [e2])\n', ''],
    [" {...(e2Atlet ? { 'data-entropi2-athlete': '' } : {})} style={s.wrap}>", ' style={s.wrap}>'],
    // Runde 3: samtale-ref til upload-broen og eksplicit OFF-grænse om de gamle mobilitetsgrene.
    [`  // Entropi 2: samtalen får besked om bekræftede indsendelser fra upload-broen.
  const e2ConversationRef = useRef(null)
`, ''],
    ['    conversationRef: e2ConversationRef,\n', ''],
    ['    conversationHandover: e2,\n', ''],
    ["        {!e2Atlet && compactHomework && tab === 'mobilisering' && mobilityMode === 'hjemmeoevelser' && (", "        {compactHomework && tab === 'mobilisering' && mobilityMode === 'hjemmeoevelser' && ("],
    ["        {!e2Atlet && tab === 'mobilisering' && !(compactHomework && mobilityMode === 'hjemmeoevelser') && (", "        {tab === 'mobilisering' && !(compactHomework && mobilityMode === 'hjemmeoevelser') && ("],
    [`  // Entropi 2: stabile props, så skærmene ikke monteres om ved hver gengivelse.
  const e2Day = today()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- nyt tidspunkt kun ved dagsskifte eller atletskift
  const e2MobilityNow = useMemo(() => new Date(), [e2Day, athlete?.id])
  const e2SetTabRef = useRef(setTab)
  useEffect(() => { e2SetTabRef.current = setTab })
  const e2GoProgram = useMemo(() => () => e2SetTabRef.current('program'), [])
  const e2Foods = useMemo(() => [...(Array.isArray(customFoods) ? customFoods : []), ...(Array.isArray(LOCAL_FOODS) ? LOCAL_FOODS : [])], [customFoods])
`, ''],
    // Runde 9: dagsur, kostdato og samtale ved dagsskifte samt mobilitetens dagskontrol.
    [`  // Entropi 2: dagsur. Ved dagsskifte gengives skærmene igen, kostens dato følger med, hvis den stod
  // på dagen før, og samtalen hentes igen, så tidsangivelserne passer.
  const e2Dag = useEntropi2Dag({ enabled: e2, today }) ?? {}
  const e2ForrigeDag = useRef(e2Dag.day)
  useEffect(() => {
    const forrige = e2ForrigeDag.current
    e2ForrigeDag.current = e2Dag.day
    if (!e2 || forrige === e2Dag.day) return
    setKostDate(dato => dato === forrige ? e2Dag.day : dato)
    void e2ConversationRef.current?.refresh?.()
  }, [e2, e2Dag.day])
  // Entropi 2: mobiliteten må kun starte et pas for den dag, skærmen blev beregnet for.
  const e2MobilityCurrent = useMemo(() => () => today() === e2Day, [e2Day])
`, ''],
    // Kostkobling (APP-KOST-START1): vægtlog hentes kun med flaget tændt, når kostfanen er åben.
    [`  // Entropi 2: kostskærmen viser vægten; hent den eksisterende vægtlog, når kostfanen åbnes.
  const e2KostAaben = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id && visKost && tab === 'kost'
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchWeightLogs er ren ift. atlet-id'et, som er i deps
  useEffect(() => { if (e2KostAaben) fetchWeightLogs(athlete.id) }, [e2KostAaben, athlete?.id])
`, ''],
    [`  // Entropi 2: atletens egen forside erstatter den gamle hjem-visning og passtart.
  const e2Atlet = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id
  const e2Home = e2Atlet && tab === 'hjem'
`, ''],
    [`        {e2Home && (
          <HomeSession key={athlete.id} enabled={true} athlete={athlete} messages={messages} formatMsgTime={formatMsgTime}
            setTab={setTab} allWeeks={allWeeks} currentWeek={currentWeek} exerciseLogs={exerciseLogs} onHoliday={onHoliday}
            programError={programError} offlineSnapshotAt={offlineSnapshotAt} logInputs={logInputs} setLogInputs={setLogInputs}
            onLogSet={logDagensPasSet} parsePlannedRpe={parsePlannedRpe} setConfirm={setConfirm}
            pendingSyncKeys={pendingSyncKeys} parkedSets={parkedSets} restPause={restPause}
            onFilmSet={() => { if (!athlete?.id) return; setAthleteVideoCoachInstant(true); setAthleteVideoCoachOpen(true) }} />
        )}
        {!e2Home && tab === 'hjem' && !onHoliday`, "        {tab === 'hjem' && !onHoliday"],
    ["        {!e2Home && (!enkelOn || ['traening', 'uge', 'dagsform', 'alle'].includes(route)) && <HjemIndgang", "        {(!enkelOn || ['traening', 'uge', 'dagsform', 'alle'].includes(route)) && <HjemIndgang"],
    [`        {e2Atlet && visKost && tab === 'kost' && (
          <Entropi2Kost enabled={true} athlete={athlete} date={kostDate} client={inboxDatabase} foods={e2Foods}
            onNavigate={route => setTab(route === 'analyse' ? 'fremgang' : route)} onCoach={() => setTab('beskeder')}
            weightLogs={weightLogs} weightInput={weightInput} savingWeight={savingWeight}
            {...(kostDate === e2Dag.day || kostDate === e2Day ? { onWeightInput: setWeightInput, logWeight, currentDay: today, onDayChanged: e2Dag.refresh } : {})} />
        )}
        {!e2Atlet && visKost && tab === 'kost' && (`, "        {visKost && tab === 'kost' && ("],
    [`        {e2Atlet && tab === 'beskeder' && (
          <ConversationEntry enabled={true} role="athlete" controllerRef={e2ConversationRef} getEntry={() => ({
            enabled: true, session, athlete, coachAthleteId, inboxDatabase,
            setAthleteVideoCoachInstant, setAthleteVideoCoachOpen, setOpenSharedVideoId, renderSharedFeedbackCards,
            storage: () => localStorage,
          })} />
        )}
        {!e2Atlet && tab === 'beskeder' && (`, "        {tab === 'beskeder' && ("],
    [`        {e2Atlet && tab === 'mobilisering' && (
          <Entropi2Mobility enabled={true} athlete={athlete} allWeeks={allWeeks} currentWeek={currentWeek}
            exerciseLogs={exerciseLogs} now={e2MobilityNow} homeworkEnabled={mobilitetHjemme === true}
            coachEnabled={mobilitetCoach === true} storage={typeof localStorage === 'undefined' ? undefined : localStorage}
            onProgram={e2GoProgram} isCurrentDay={e2MobilityCurrent} onStaleDay={e2Dag.refresh} />
        )}
`, ''],
    // E2-ATLET-LAEST1: med flaget tændt kører den gamle automatiske læst-markering ikke ved åbning af Beskeder.
    [`  // Entropi 2: samtalen kvitterer selv ved eksplicit åbning; den gamle automatiske læst-markering må ikke køre.
  const e2SelvKvittering = e2 && role === 'athlete' && !coachAthleteId && !onExitPreview && !!athlete?.id
`, ''],
    ["  useEffect(() => { if (tab === 'beskeder' && athlete?.id) enterContact({ enabled: contactLatest, fetchMessages: fetchAthleteMessages, markRead: e2SelvKvittering ? () => {} : markTrackRead, fetchVideos: fetchSharedVideoAnalyses, track: msgTrack }) }, [tab, athlete?.id, msgTrack, contactLatest, e2SelvKvittering])",
      "  useEffect(() => { if (tab === 'beskeder' && athlete?.id) enterContact({ enabled: contactLatest, fetchMessages: fetchAthleteMessages, markRead: markTrackRead, fetchVideos: fetchSharedVideoAnalyses, track: msgTrack }) }, [tab, athlete?.id, msgTrack, contactLatest])"],
    // Analysen (R2-ENTROPI2-ANALYSE) øverst i fremgang-fanen, kun med flaget tændt.
    [`        {e2Atlet && tab === 'fremgang' && (
          <Entropi2Analysis entropi2={true} athlete={athlete} currentWeek={currentWeek} exerciseLogs={exerciseLogs}
            fremgangLogs={fremgangLogs} fremgangLoading={fremgangLoading} setTab={setTab} />
        )}
`, ''],
    // Ret1: med flaget tændt skjules den gamle analyse i fremgangsvisningen; resten af fremgang er uændret.
    ['            componentProps={{ ...(e2Atlet ? { entropi2Analyse: true } : {}), ...repRecords === true ? (fremgangFokus', '            componentProps={repRecords === true ? (fremgangFokus'],
    ['exerciseLogs, currentWeek }}}\n', 'exerciseLogs, currentWeek }}\n'],
  ]
  for (const [added, original] of entropi2Delta) {
    const exact = added.replaceAll('\n', '\r\n')
    assert.equal(candidate.split(exact).length, 2, 'Entropi 2-delta skal findes præcis én gang: ' + added.slice(0, 80))
    candidate = candidate.replace(exact, original.replaceAll('\n', '\r\n'))
  }
  assert.doesNotMatch(candidate, /entropi2|e2Home|e2Atlet/i)
  // Invert only this explicit Home-entry delta, then retain both original SHA guards.
  candidate = candidate
    .replace("  const homeRo2 = rel1101Enabled(rel1101, typeof window === 'undefined' ? '' : window.location.search)\r\n", '')
    .replace("  const HjemIndgang = homeRo2 ? (enkelOn ? Ro2EnkelHjemTab : Ro2HjemTab) : HjemVisning\r\n", '')
    .replace("homeRo2 && tab === 'hjem' && (!enkelOn || route !== 'mere') ? null : renderHomeworkEntry(", 'renderHomeworkEntry(')
    .replace('<NytIAppen rel1101={rel1101} search=', '<NytIAppen search=')
    .replace('{!homeRo2 && (<>\r\n        {!compactHomework && (<>', '{!compactHomework && (<>')
    .replace('        </>)}\r\n        {renderMobilityShortcut(', '        {renderMobilityShortcut(')
    .replace('<HjemIndgang\r\n', '<HjemVisning\r\n')
    .replace('          homeRo2={homeRo2}\r\n', '')
  candidate = candidate.replace("// RO2: presentation-only Home entry. Original Home/lazy modules remain intact.\r\nfunction homeRo2Order(tree, enabled) {\r\n  if (enabled !== true) return tree\r\n  let chips\r\n  function move(node) {\r\n    if (Array.isArray(node)) return node.map(move)\r\n    if (!node || typeof node !== 'object' || !node.props) return node\r\n    if (Object.hasOwn(node.props, 'data-sekundaer')) { chips = node; return null }\r\n    if (!Object.hasOwn(node.props, 'children')) return node\r\n    const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children]\r\n    return createElement(node.type, { ...node.props, ...(node.key == null ? {} : { key: node.key }) }, ...children.map(move))\r\n  }\r\n  const body = move(tree)\r\n  return chips ? createElement(tree.type, null, chips, body) : tree\r\n}\r\nfunction Ro2HjemTab(props) {\r\n  return homeRo2Order(HjemTab(props), !props.onHoliday)\r\n}\r\nconst ro2EnkelHjemFactory = () => enkelHjemFactory().then(module => ({\r\n  default: homeProps => homeRo2Order(module.default(homeProps), !homeProps.onHoliday),\r\n}))\r\nfunction Ro2EnkelHjemTab(props) {\r\n  return createElement(LazyBoundary, { factory: ro2EnkelHjemFactory, label: 'Hjem', componentProps: props })\r\n}\r\n\r\n", '')
  const base = 'da7f60d30d71209bb716c5d953ceb52a92f3e082edf619a53f366e607b8df46b'
  assert.ok(candidate.includes("tab === 'hjem' && !onHoliday && role === 'athlete' && !coachAthleteId && athlete?.id"))
  const entry = candidate.slice(candidate.indexOf("        {tab === 'hjem' && !onHoliday && role === 'athlete'"), candidate.indexOf("        <NytIAppen search="))
  assert.ok(entry.includes('onLogSet={logDagensPasSet} restPause={restPause}'))
  assert.ok(entry.includes('rel1101Enabled(rel1101,'))
  assert.ok(entry.includes("(!enkelOn || ['traening', 'alle'].includes(route))"))
  candidate = candidate.replace(entry, '').replace("import TrainingFullscreen from './athlete/TrainingFullscreen.mjs'\r\nimport { rel1101Enabled } from './rel1101.mjs'\r\n", '')
    .replace('hjemoevKompakt = false, rel1101 = false})', 'hjemoevKompakt = false})')
  assert.equal(createHash('sha256').update(candidate).digest('hex'), base)
  const handler = readFileSync(new URL('./saetSkrivning.js', import.meta.url), 'utf8')
    .replace('{ localFallback = false, inputOverride, preserveMissingRpe = false } = {})', '{ localFallback = false, inputOverride } = {})')
    .replace('(preserveMissingRpe === true || dataEnoughEnabled() ? null : parseInputNumber(plannedRpe))', '(dataEnoughEnabled() ? null : parseInputNumber(plannedRpe))')
    .replace('plannedRpe, inputOverride, { preserveMissingRpe = false } = {}) {', 'plannedRpe, inputOverride) {')
    .replace('{ localFallback: true, inputOverride, preserveMissingRpe })', '{ localFallback: true, inputOverride })')
  assert.equal(createHash('sha256').update(handler).digest('hex'), '987db32267587375d33052c0d716291483a10ff328e1f40587241015dfcd23ba')
})

test('empty and rest-day programs offer no write action or invented session', t => {
  const week = { id: 'rest', sessions: [{ id: 'rest-session', weekday: 5, exercises: [] }] }
  const f = fixture(t, { allWeeks: [week], currentWeek: week })
  assert.equal(f.buttons()[0].props.disabled, true)
  assert.match(f.runtime.text(), /Intet pas i dag/)
  assert.equal(f.runtime.nodes(n => n.type === 'dialog').length, 0)
  f.runtime.render({ currentWeek: null, allWeeks: [] })
  assert.equal(f.buttons()[0].props.disabled, true)
})

test('missing weights require explicit input; RPE is never fabricated from planned intensity', async t => {
  const f = fixture(t)
  f.click('Start dagens pas')
  assert.equal(f.runtime.nodes(n => n.type === 'input')[0].props.value, '')
  assert.equal(f.runtime.nodes(n => n.type === 'input')[2].props.value, '')
  assert.match(f.runtime.text(), /Coachkommentar:.*Hold brystet op/)
  await f.click('Godkendt')
  assert.equal(f.props.exerciseLogs.length, 0)
  assert.match(f.runtime.text(), /Skriv vægt og hele reps/)
  f.fill(0, '42,5')
  await f.click('Godkendt'); f.runtime.render()
  assert.equal(f.props.exerciseLogs[0].weight, 42.5)
  assert.equal(f.props.exerciseLogs[0].reps_completed, 5)
  assert.equal(f.props.exerciseLogs[0].rpe_actual, null)
  assert.equal(f.props.exerciseLogs[0].rpe_planned, 8)
  const queued = loadOfflineSets('synthetic-athlete')
  assert.equal(queued['squat-fixture_1'].payload.weight, 42.5)
  assert.equal(queued['squat-fixture_1'].payload.rpe_actual, null)
  assert.equal(loadRestPause('synthetic-athlete').durationSeconds, 90)
  assert.match(f.runtime.text(), /Sæt 2 af 2/)
})

test('actual imported handler progresses across exercises; close/reopen keeps completed logs', async t => {
  const f = fixture(t)
  f.click('Start dagens pas'); f.fill(0, '40'); f.fill(2, '7,5')
  await f.click('Godkendt'); f.runtime.render()
  assert.equal(f.props.exerciseLogs[0].rpe_actual, 7.5)
  // The actual handler deliberately does not carry inputOverride weight to next set.
  f.fill(0, '40'); f.fill(1, '5'); await f.click('Godkendt'); f.runtime.render()
  assert.match(f.runtime.text(), /Roning/)
  assert.equal(f.runtime.nodes(n => n.type === 'input')[0].props.value, 20)
  await f.click('Godkendt'); f.runtime.render()
  assert.equal(f.props.exerciseLogs.length, 3)
  assert.equal(f.props.restPause, null)
  assert.equal(loadRestPause('synthetic-athlete'), null)
  assert.match(f.runtime.text(), /Passet er færdigt/)
  const close = f.buttons().find(n => n.props['aria-label'] === 'Luk dagens pas').props.ref.current
  close.fire('click'); f.runtime.render()
  assert.equal(f.runtime.nodes(n => n.type === 'dialog').length, 0)
  f.click('Åbn dagens pas')
  assert.match(f.runtime.text(), /Passet er færdigt/)
  assert.match(f.runtime.text(), /Squat, sæt 1: 40 kg, 5 reps, RPE 7.5/)
  assert.equal(f.props.exerciseLogs.length, 3)
  assert.equal(f.runtime.nodes(n => n.children.includes('Godkendt')).length, 0)
})

test('double approve and stale events never submit the same set twice', async () => {
  let resolve, calls = 0
  const s = session(), expected = { exercise: s.exercises[0], setNumber: 1 }
  const state = { exerciseLogs: [], onLogSet: async () => { calls++; await new Promise(r => { resolve = r }) } }
  const approval = createTrainingApproval(() => state, () => {})
  const first = approval.approve(s, expected, { weight: '0', reps: '5' })
  assert.equal(await approval.approve(s, expected, { weight: '0', reps: '5' }), false)
  state.exerciseLogs.push({ exercise_id: 'squat-fixture', set_number: 1 })
  resolve(); assert.equal(await first, true)
  assert.equal(await approval.approve(s, expected, { weight: '0', reps: '5' }), false)
  assert.equal(calls, 1)
})

test('invalid numbers and ambiguous prescriptions never silently produce logged numbers', () => {
  for (const input of [{ weight: '', reps: '5' }, { weight: 'NaN', reps: '5' }, { weight: '-1', reps: '5' },
    { weight: '10', reps: 'AMRAP' }, { weight: '10', reps: '5.2' }, { weight: '10', reps: '0' },
    { weight: '10', reps: '5', rpe: '11' }, { weight: '10', reps: '5', rpe: '-1' }]) assert.equal(trainingInput(input), null)
  assert.equal(trainingInput({ weight: '0', reps: '1', rpe: '' }).weight, '0')
})

test('handler rejection unlocks the set for a genuine retry', async () => {
  const s = session(), expected = { exercise: s.exercises[0], setNumber: 1 }
  const errors = [], state = { exerciseLogs: [], onLogSet: async () => { throw Error('fixture rejection') } }
  const approval = createTrainingApproval(() => state, text => { if (text) errors.push(text) })
  assert.equal(await approval.approve(s, expected, { weight: 10, reps: 5 }), false)
  assert.equal(approval.pending.size, 0)
  state.onLogSet = async () => { state.exerciseLogs.push({ exercise_id: 'squat-fixture', set_number: 1 }) }
  assert.equal(await approval.approve(s, expected, { weight: 10, reps: 5 }), true)
  assert.equal(errors.length, 1)
})


test('legacy handler without new explicit option still stores the planned fallback', async t => {
  const f = fixture(t)
  await f.props.onLogSet(f.props.currentWeek.sessions[0].exercises[0], 1, 2, 5, 8, { weight: '40', reps: '5', rpe: '' })
  assert.equal(f.props.exerciseLogs[0].rpe_actual, 8)
  assert.equal(f.props.exerciseLogs[0].rpe_planned, 8)
})

// Context regressions import the real component and lavSaetSkrivning above.
function contextWeek(id, exerciseId, sessionId = 'session-' + id) {
  return { id, sessions: [{ id: sessionId, title: 'Pas ' + id,
    exercises: [{ id: exerciseId, name: 'Oevelse ' + id, sets: 1, reps: '5', recommended_weight: 20 }] }] }
}
function closeTraining(f) {
  f.buttons().find(n => n.props['aria-label'] === 'Luk dagens pas').props.ref.current.fire('click')
  f.runtime.render()
}
function approveEvent(f) {
  return f.buttons().find(n => n.children.includes('Godkendt')).props.onClick
}

test('context: completed week A never replaces current week B when both remain in program', async t => {
  const a = contextWeek('A', 'ex-A'), b = contextWeek('B', 'ex-B')
  const f = fixture(t, { allWeeks: [a, b], currentWeek: a })
  f.click('Start dagens pas'); await f.click('Godkendt'); f.runtime.render()
  assert.match(f.runtime.text(), /Passet er færdigt/)
  closeTraining(f); f.click('Åbn dagens pas')
  assert.match(f.runtime.text(), /Oevelse A, sæt 1: 20 kg/)
  closeTraining(f)
  f.runtime.render({ currentWeek: b })
  f.buttons()[0].props.onClick(); f.runtime.render()
  assert.match(f.runtime.text(), /Oevelse B/)
  assert.doesNotMatch(f.runtime.text(), /Oevelse A/)
  await f.click('Godkendt'); f.runtime.render()
  assert.deepEqual(f.props.exerciseLogs.map(l => l.exercise_id), ['ex-A', 'ex-B'])
})

test('context: removed program rejects reopen and retained approval with old input draft', async t => {
  const a = contextWeek('A', 'ex-A')
  const f = fixture(t, { allWeeks: [a], currentWeek: a })
  f.click('Start dagens pas'); f.fill(0, '37')
  const staleApprove = approveEvent(f), staleStart = f.buttons()[0].props.onClick
  closeTraining(f)
  f.runtime.render({ allWeeks: [], currentWeek: null })
  staleStart(); f.runtime.render()
  assert.equal(f.runtime.nodes(n => n.type === 'dialog').length, 0)
  assert.equal(f.buttons()[0].props.disabled, true)
  assert.equal(await staleApprove(), false)
  assert.equal(f.logCalls.length, 0)
  assert.equal(f.props.logInputs['ex-A_1'].weight, '37')
  assert.deepEqual(f.props.exerciseLogs, [])
  assert.deepEqual(loadOfflineSets('synthetic-athlete'), {})
})

test('context: week switch while open rejects old approval before actual handler writes', async t => {
  const a = contextWeek('A', 'ex-A'), b = contextWeek('B', 'ex-B')
  const f = fixture(t, { allWeeks: [a, b], currentWeek: a })
  f.click('Start dagens pas'); const staleApprove = approveEvent(f)
  f.runtime.render({ currentWeek: b })
  assert.equal(await staleApprove(), false)
  assert.equal(f.logCalls.length, 0)
  assert.equal(f.runtime.nodes(n => n.type === 'dialog').length, 0)
  assert.deepEqual(f.props.exerciseLogs, [])
  assert.deepEqual(loadOfflineSets('synthetic-athlete'), {})
  f.buttons()[0].props.onClick(); f.runtime.render()
  await f.click('Godkendt'); f.runtime.render()
  assert.deepEqual(f.props.exerciseLogs.map(l => l.exercise_id), ['ex-B'])
})

test('context: same athlete new program cannot inherit selection even with shared session id', async t => {
  const a = contextWeek('old-program-week', 'old-ex', 'shared-session')
  const b = contextWeek('new-program-week', 'new-ex', 'shared-session')
  const f = fixture(t, { allWeeks: [a], currentWeek: a })
  f.click('Start dagens pas'); const staleApprove = approveEvent(f), staleStart = f.buttons()[0].props.onClick
  closeTraining(f)
  f.runtime.render({ allWeeks: [b], currentWeek: b })
  assert.equal(await staleApprove(), false)
  assert.equal(f.logCalls.length, 0)
  staleStart(); f.runtime.render()
  assert.match(f.runtime.text(), /Oevelse new-program-week/)
  await f.click('Godkendt'); f.runtime.render()
  assert.deepEqual(f.props.exerciseLogs.map(l => l.exercise_id), ['new-ex'])
  assert.equal(loadOfflineSets('synthetic-athlete')['old-ex_1'], undefined)
})

test('context: removed session rejects stale approval and start across mismatched snapshots', async t => {
  for (const removed of ['allWeeks', 'currentWeek']) {
    const a = contextWeek('A-' + removed, 'ex-' + removed)
    const f = fixture(t, { allWeeks: [a], currentWeek: a })
    f.click('Start dagens pas')
    const staleApprove = approveEvent(f), staleStart = f.buttons()[0].props.onClick
    const empty = { ...a, sessions: [] }
    f.runtime.render(removed === 'allWeeks' ? { allWeeks: [empty] } : { currentWeek: empty })
    assert.equal(await staleApprove(), false)
    assert.equal(f.logCalls.length, 0)
    staleStart(); f.runtime.render()
    assert.equal(f.runtime.nodes(n => n.type === 'dialog').length, 0)
    assert.deepEqual(f.props.exerciseLogs, [])
    assert.deepEqual(loadOfflineSets('synthetic-athlete'), {})
    f.runtime.unmount(); t.mock.timers.reset()
  }
})

test('context: refreshed current session is authoritative before a retained approval', async t => {
  const a = contextWeek('A', 'old-ex')
  const f = fixture(t, { allWeeks: [a], currentWeek: a })
  f.click('Start dagens pas'); const staleApprove = approveEvent(f)
  const refreshed = contextWeek('A', 'new-ex')
  f.runtime.render({ allWeeks: [refreshed], currentWeek: refreshed })
  assert.equal(await staleApprove(), false)
  assert.equal(f.logCalls.length, 0)
  assert.deepEqual(f.props.exerciseLogs, [])
  await f.click('Godkendt'); f.runtime.render()
  assert.deepEqual(f.props.exerciseLogs.map(l => l.exercise_id), ['new-ex'])
})
