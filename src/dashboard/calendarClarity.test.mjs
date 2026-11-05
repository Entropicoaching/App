import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installCalendarClarityLoader, calendarFixture, athlete, weeks, longBlock } from './calendarClarityFixture.mjs'
import { mount, nodes, text } from './coachCalendarDom.mjs'
const hooks = installCalendarClarityLoader()
test.after(() => hooks.deregister())
const { default: Calendar } = await import('./KalenderView.jsx')
const render = extra => mount(Calendar, calendarFixture(extra)).render()
const buttons = tree => nodes(tree, n => n.type === 'button')
const blockButtons = tree => buttons(tree).filter(n => n.props['aria-label']?.startsWith('Rediger blok:'))
const cellButtons = tree => buttons(tree).filter(n => n.props['aria-label']?.startsWith('Opret uge '))

test.before(() => mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-05T12:00:00Z') }))
test.after(() => mock.timers.reset())

for (const isMobile of [false, true]) {
  const width = isMobile ? 390 : 1280
  test(`${width}: loading, roster failure, calendar failure, ready empty and data are distinct`, () => {
    for (const extra of [{ loading: true, athletes: [] }, { loading: undefined, athletes: [] }, { calendarStatus: 'loading' },
      { calendarStatus: undefined }, { calendarReady: false }, { tasksOnly: true, calendarReady: false }]) {
      const tree = render({ isMobile, calendarWeeks: {}, ...extra })
      assert.match(text(tree), /Indlæser kalender/)
      assert.equal(nodes(tree, n => n.props.role === 'status').length, 1)
      assert.doesNotMatch(text(tree), /Ingen atleter|Intet program|Alle planer har luft|Kræver din opmærksomhed/)
      assert.equal(nodes(tree, n => n.props['data-calendar-today']).length, 0)
    }
    for (const extra of [{ loadError: true }, { calendarStatus: 'error' }]) {
      let retries = 0
      const tree = render({ isMobile, calendarWeeks: {}, ...extra, onRetry: () => retries++ })
      assert.equal(nodes(tree, n => n.props.role === 'alert').length, 1)
      assert.match(text(tree), extra.loadError ? /Atleterne kunne ikke indlæses/ : /Kalenderen kunne ikke indlæses/)
      assert.doesNotMatch(text(tree), /Intet program|Ingen atleter|Alle planer har luft/)
      const retry = buttons(tree).find(n => text(n) === 'Prøv igen')
      assert.equal(retry.props.style.minHeight, 44)
      retry.props.onClick(); assert.equal(retries, 1)
    }
    assert.match(text(render({ isMobile, athletes: [], calendarReady: false })), /Ingen synlige atleter/)
    assert.match(text(render({ isMobile, calendarWeeks: {} })), /Intet program/)
    assert.equal(blockButtons(render({ isMobile })).length, 1)
  })

  test(`${width}: refresh and failed refresh keep mounted track, manual scroll and open disclosure`, () => {
    const props = calendarFixture({ isMobile })
    // Reconcile the two stateful native nodes by their full element ancestry,
    // retaining null child slots like React. An absent node is unmounted.
    let mounted = new Map()
    const commit = extra => {
      const tree = Calendar({ ...props, ...extra }), next = new Map()
      const visit = (node, path = '') => {
        if (!node || typeof node !== 'object') return
        const route = `${path}/${String(node.type)}:${node.props.key ?? ''}`
        if (node.props['aria-label'] === 'Kalenderens tidslinje' || node.props['data-calendar-board']) {
          const host = mounted.get(route) || { clientWidth: 100, scrollWidth: 1000, scrollLeft: 0, open: false }
          if (Object.hasOwn(node.props, 'open')) host.open = node.props.open
          node.props.ref?.(host)
          next.set(route, host)
        }
        node.props.children.forEach((child, index) => visit(child, `${route}/${index}`))
      }
      visit(tree); mounted = next
      return [...mounted.values()]
    }
    const [track, board] = commit({})
    assert.ok(track.scrollLeft > 0)
    track.scrollLeft = 400; board.open = true
    const edit = { athleteId: athlete.id, name: athlete.name, block: longBlock, weeks, firstStartIso: '2026-11-02' }
    for (const extra of [
      { calendarStatus: 'loading', calendarReady: false },
      { loading: true, calendarStatus: 'loading', calendarReady: false },
      { calendarStatus: 'error', calendarReady: false },
      { loadError: true, calendarReady: false },
      { calendarReady: false },
      { calendarStatus: 'ready', calendarReady: true },
    ]) {
      const state = { ...extra, timelineEdit: edit }
      const [nextTrack, nextBoard] = commit(state)
      assert.equal(nextTrack, track, 'track native node must survive refresh')
      assert.equal(nextBoard, board, 'disclosure native node must survive refresh')
      assert.equal(track.scrollLeft, 400)
      assert.equal(board.open, true)
      const tree = render({ isMobile, ...state })
      assert.equal(blockButtons(tree).length, 1)
      assert.equal(nodes(tree, n => n.props['data-calendar-today'] === '2026-11-05').length, 1)
      assert.ok(text(tree).includes('Rediger blok:'))
      assert.doesNotMatch(text(tree), /Indlæser kalender/)
      if (extra.calendarStatus === 'error' || extra.loadError) {
        assert.equal(nodes(tree, n => n.props.role === 'alert').length, 1)
        assert.ok(buttons(tree).some(n => text(n) === 'Prøv igen'))
      } else if (extra.calendarReady === false) assert.match(text(tree), /Opdaterer…/)
    }
  })

  test(`${width}: a completed empty week list survives refresh; unrelated data cannot bypass first load`, () => {
    for (const calendarStatus of ['loading', 'error']) {
      const tree = render({ isMobile, calendarWeeks: { [athlete.id]: [] }, calendarStatus, calendarReady: false })
      assert.equal(nodes(tree, n => n.props['data-calendar-board']).length, 1)
      assert.match(text(tree), /Intet program/)
      assert.doesNotMatch(text(tree), /Indlæser kalender/)
    }
    const tree = render({ isMobile, calendarWeeks: { foreign: weeks }, calendarStatus: 'loading', calendarReady: false })
    assert.match(text(tree), /Indlæser kalender/)
    assert.equal(nodes(tree, n => n.props['data-calendar-board']).length, 0)
  })

  test(`${width}: readable dates, native 44px actions, full selected block and unchanged edit callbacks`, () => {
    let selected
    const writes = []
    const props = calendarFixture({ isMobile, setTimelineEdit: next => { selected = typeof next === 'function' ? next(selected) : next },
      setBlockStartDate: (...args) => writes.push(args) })
    const view = mount(Calendar, props), tree = view.render()
    const [block] = blockButtons(tree)
    assert.equal(block.props.type, 'button')
    assert.ok(block.props.style.minHeight >= 44)
    assert.ok(block.props.style.height >= 44)
    assert.ok(block.props['aria-label'].includes(longBlock))
    assert.match(block.props['aria-label'], /Uge 1–2/)
    assert.equal(nodes(block, n => n.type === 'span' && text(n) === longBlock)[0].props.style.fontSize, 14)
    const headers = nodes(tree, n => n.props['aria-current'] === 'date')
    assert.equal(headers.length, 1)
    assert.equal(headers[0].props.style.fontSize, 12)
    const todayBanner = nodes(tree, n => n.type === 'div' && n.props.style?.fontSize === 12 && text(n).startsWith('I dag'))[0]
    assert.equal(todayBanner.props.style.color, '#c4c0b5')
    const headerRow = nodes(tree, n => n.props.style?.height === 32 && n.props.style?.display === 'flex')[0]
    assert.ok(nodes(headerRow, n => n.props.style?.color === '#c4c0b5').length > 0)
    assert.equal(writes.length, 0)
    block.props.onClick()
    assert.equal(selected.athleteId, athlete.id)
    assert.deepEqual(selected.weeks, weeks)
    assert.equal(selected.weeks[0], weeks[0])
    const edited = view.render({ ...props, timelineEdit: selected })
    assert.match(text(edited), new RegExp(longBlock))
    const date = nodes(edited, n => n.type === 'time' && n.props.dateTime === '2026-11-02')[0]
    assert.ok(date, 'selected block date is visible below the track')
    const panel = nodes(edited, n => n.props.style?.overflowWrap === 'anywhere' && text(n).startsWith('Rediger blok:'))[0]
    assert.equal(panel.props.style.fontSize, 14)
    assert.ok(text(panel).includes(longBlock))
    assert.match(text(panel), /Uge 1–2/)
    assert.equal(writes.length, 0, 'selection only opens the existing editor')
    const input = nodes(edited, n => n.props['aria-label'] === 'Blokkens startdato')[0]
    input.props.onChange({ target: { value: '2026-11-16' } })
    assert.deepEqual(writes, [[athlete.id, weeks, '2026-11-16']])
    buttons(edited).find(n => text(n) === 'Luk').props.onClick()
    assert.equal(selected, null)
  })

  test(`${width}: permanent plus calls existing confirmation and never creates on focus or selection`, () => {
    let pending
    const created = []
    const tree = render({ isMobile, askConfirm: (label, callback) => { pending = { label, callback } },
      createCalendarWeek: (...args) => created.push(args) })
    const cells = cellButtons(tree)
    assert.equal(cells.length, 1, 'week zero and covered slots have no creation action')
    const [cell] = cells
    assert.equal(cell.props.type, 'button')
    assert.ok(cell.props.style.minHeight >= 44 && cell.props.style.height >= 44 && cell.props.style.width >= 44)
    assert.equal(text(cell), '+')
    assert.match(cell.props['aria-label'], /Opret uge 3.*16. november 2026/)
    assert.equal(cell.props.onFocus, undefined)
    assert.deepEqual(created, [])
    cell.props.onClick()
    assert.match(pending.label, /Opret uge.*16. november/)
    assert.deepEqual(created, [], 'cancel/dismiss leaves the callback uncalled')
    pending.callback()
    assert.deepEqual(created, [[athlete.id, 3, '2026-11-16']])
  })

  test(`${width}: 20 athletes and their legend are in one initially closed native disclosure; tasks remain outside`, () => {
    const athletes = Array.from({ length: 20 }, (_, i) => ({ id: `synthetic-${i}`, name: `Syntetisk ${i}` }))
    const calls = []
    const tree = render({ isMobile, athletes, calendarWeeks: {}, athleteLastLogs: { 'synthetic-0': '2026-11-04' },
      openProfile: (...args) => calls.push(args) })
    const [board] = nodes(tree, n => n.props['data-calendar-board'])
    assert.equal(board.type, 'details')
    assert.equal(board.props.open, undefined)
    const [summary] = nodes(board, n => n.type === 'summary')
    assert.equal(text(summary), 'Alle atleter (20)')
    assert.equal(summary.props.style.minHeight, 44)
    assert.equal(nodes(board, n => typeof n.props.onClick === 'function').length, 20)
    for (const a of athletes) assert.ok(text(board).includes(a.name))
    assert.match(text(board), /Ingen uger oprettet.*I dag.*Intet program/)
    assert.ok(text(board).includes('Prikken = sidst loggede træning.'))
    assert.doesNotMatch(text(board), /Kræver din opmærksomhed|Åbn plan|Udsæt \d/)
    assert.match(text(tree).replace(text(board), ''), /Kræver din opmærksomhed \(20\)/)
    nodes(board, n => typeof n.props.onClick === 'function')[0].props.onClick()
    assert.deepEqual(calls, [[athletes[0], 'program']])
  })

  test(`${width}: all three profile shortcuts are native buttons with one existing program callback`, () => {
    const undated = { id: 'synthetic-undated', name: 'Syntetisk navn '.repeat(30) }
    const calls = []
    const tree = render({ isMobile, athletes: [athlete, undated],
      calendarWeeks: { [athlete.id]: weeks, [undated.id]: [{ ...weeks[0], start_date: null }] },
      openProfile: (...args) => calls.push(args) })
    const shortcuts = nodes(tree, n => n.props.className === 'entropi2-calendar-profile')
    assert.equal(shortcuts.length, 4, 'timeline name, undated name and two board rows')
    for (const shortcut of shortcuts) {
      assert.equal(shortcut.type, 'button')
      assert.equal(shortcut.props.type, 'button')
      assert.ok(shortcut.props.style.minHeight >= 44)
      assert.equal(shortcut.props.tabIndex, undefined, 'native Tab order')
      assert.equal(shortcut.props.onKeyDown, undefined, 'native activation has no duplicate keyboard handler')
      assert.equal(nodes(shortcut, n => n !== shortcut && ['button', 'a', 'input', 'select', 'div'].includes(n.type)).length, 0)
      const before = calls.length
      shortcut.props.onClick()
      assert.equal(calls.length, before + 1)
      assert.equal(calls.at(-1)[1], 'program')
    }
    assert.deepEqual(calls.map(c => c[0]), [athlete, undated, athlete, undated])
    assert.equal(shortcuts[0].props.style.width, '100%')
    assert.equal(shortcuts[1].props.style.maxWidth, '100%')
    assert.equal(shortcuts[1].props.style.textOverflow, 'ellipsis')
    for (const row of shortcuts.slice(2)) {
      const name = nodes(row, n => n.props.style?.fontSize === '0.9rem')[0]
      assert.equal(name.props.style.maxWidth, '100%')
      assert.equal(name.props.style.textOverflow, 'ellipsis')
    }
    assert.match(text(nodes(tree, n => n.type === 'style')[0]), /\.entropi2-calendar-profile:focus-visible.*outline: 2px solid #f1c675/)
  })

  test(`${width}: twenty timeline names stay aligned with their track rows`, () => {
    const athletes = Array.from({ length: 20 }, (_, i) => ({
      id: `synthetic-row-${i}`, name: `Syntetisk ${i} ${'langt navn '.repeat(20)}`,
    }))
    const calendarWeeks = Object.fromEntries(athletes.map(a => [a.id, weeks]))
    const tree = render({ isMobile, athletes, calendarWeeks })
    const [track] = nodes(tree, n => n.props['aria-label'] === 'Kalenderens tidslinje')
    const rows = nodes(track, n => n.props.style?.position === 'relative' &&
      n.props.style.height === 56 && n.props.style.borderBottom)
    const names = nodes(tree, n => n.props.className === 'entropi2-calendar-profile' &&
      n.props.style.height === 56)
    assert.equal(rows.length, 20)
    assert.equal(names.length, 20)
    // Compare border-box totals, not just declared height or minimum tap size.
    const outerHeight = ({ props: { style } }) => style.height +
      (style.boxSizing === 'border-box' ? 0 : Number.parseFloat(style.borderBottom))
    let nameBottom = 0, trackBottom = 0
    for (let i = 0; i < names.length; i++) {
      assert.equal(text(names[i]), athletes[i].name)
      assert.equal(outerHeight(names[i]), outerHeight(rows[i]), `row ${i + 1} total height`)
      nameBottom += outerHeight(names[i]); trackBottom += outerHeight(rows[i])
      assert.equal(nameBottom, trackBottom, `row ${i + 1} bottom edge`)
    }
  })

  test(`${width}: completed empty or hidden roster shows one open precise state without calendar sections`, () => {
    for (const extra of [{ athletes: [] }, { hiddenAthleteIds: new Set([athlete.id]) }]) {
      for (const tasksOnly of [false, true]) {
        const tree = render({ isMobile, ...extra, tasksOnly, coachCalendarEvents: true })
        assert.equal(nodes(tree, n => n.props.role === 'status').length, 1)
        assert.equal(text(nodes(tree, n => n.props.role === 'status')[0]), 'Ingen synlige atleter')
        assert.doesNotMatch(text(tree), /sæt en startdato|Tidslinje|Alle atleter|Alle planer har luft|Stævnedatoer|har du husket/)
        assert.equal(buttons(tree).length, 0)
        assert.equal(nodes(tree, n => n.type === 'details' || n.type === 'select').length, 0)
      }
    }
    const undated = render({ isMobile, calendarWeeks: { [athlete.id]: [{ ...weeks[0], start_date: null }] } })
    assert.match(text(undated), /Ingen atleter med datoer endnu.*Sæt startdato/)
    assert.doesNotMatch(text(undated), /Ingen synlige atleter/)
    for (const extra of [{ loading: true }, { loadError: true }, { calendarStatus: 'error' },
      { calendarStatus: 'loading', calendarReady: false }]) {
      assert.doesNotMatch(text(render({ isMobile, hiddenAthleteIds: new Set([athlete.id]), ...extra })), /Ingen synlige atleter/)
    }
  })
}

test('today, manual scroll, hidden scope, invalid dates and tasks-only retain existing behavior in ON', () => {
  const tree = render()
  assert.equal(nodes(tree, n => n.props['data-calendar-today'] === '2026-11-05').length, 1)
  const [track] = nodes(tree, n => n.props['aria-label'] === 'Kalenderens tidslinje')
  const node = { clientWidth: 100, scrollWidth: 1000, scrollLeft: 0 }
  track.props.ref(node); assert.ok(node.scrollLeft > 0)
  node.scrollLeft = 400; track.props.ref(null); track.props.ref(node)
  assert.equal(node.scrollLeft, 400)
  assert.equal(blockButtons(render({ hiddenAthleteIds: new Set([athlete.id]) })).length, 0)
  const invalid = render({ calendarWeeks: { [athlete.id]: [{ week_number: 1, start_date: '2026-02-30' }] } })
  assert.match(text(invalid), /Startdato kunne ikke vises/)
  assert.equal(cellButtons(invalid).length, 0)
  assert.equal(nodes(render({ tasksOnly: true }), n => n.props['data-calendar-today']).length, 0)
})

test('only boolean ON changes the calendar; OFF ignores the new read props', () => {
  for (const entropi2 of [undefined, false, 0, 1, 'true', {}]) for (const isMobile of [false, true]) {
    const tree = render({ entropi2, isMobile, loading: true, loadError: true, calendarStatus: 'error', calendarReady: false })
    assert.equal(nodes(tree, n => n.props.role === 'status' || n.props.role === 'alert').length, 0)
    assert.equal(nodes(tree, n => n.props['data-calendar-board']).length, 0)
    assert.equal(blockButtons(tree).length, 0)
    assert.equal(nodes(tree, n => n.props.className === 'entropi2-calendar-profile' || n.type === 'style').length, 0)
    assert.equal(nodes(tree, n => n.props['aria-current'] === 'date')[0].props.style.fontSize, '0.42rem')
  }
})

test('Dashboard only adds status props in ON and retries through the existing reader', async () => {
  const source = readFileSync(new URL('../Dashboard.jsx', import.meta.url), 'utf8')
  const expression = source.match(/\.\.\.\((e2 \? \{ entropi2: true,[\s\S]*?onRetry:[\s\S]*?\} : \{\})\),/)?.[1]
  assert.ok(expression)
  const calls = []
  const args = [true, false, true, { calendar: 'error' }, undefined,
    async () => calls.push('roster'), async () => calls.push('refresh'), value => calls.push(['loading', value])]
  const wire = new Function('e2', 'loading', 'loadError', 'coachActionsStatus', 'e2ReadContext', 'fetchAthletes', 'refreshCoachInbox', 'setLoading', 'return ' + expression)
  assert.deepEqual(wire(false, ...args.slice(1)), {})
  const failed = wire(...args)
  assert.equal(failed.calendarStatus, 'error')
  assert.equal(failed.calendarReady, false)
  await failed.onRetry(); assert.deepEqual(calls, [['loading', true], 'roster', 'refresh'])
  calls.length = 0
  const ready = wire(true, false, false, { calendar: 'ready' }, { athleteIds: [athlete.id] }, ...args.slice(5))
  assert.equal(ready.calendarReady, true)
  await ready.onRetry(); assert.deepEqual(calls, ['refresh'])
})

test('actual calendar reader retains displayed rows while context disappears on refresh and failure', async () => {
  // Existing reader fixture intercepts only service dependencies; import the actual reader.
  await import('./testLoader.mjs')
  const { state } = await import('./synthetic.mjs')
  const { lavLaesninger } = await import('./laesninger.js')
  const { entropi2CalendarRead, entropi2ReadContext } = await import('../entropi2/coachReadContext.mjs')
  state.responses.length = 0; state.calls.length = 0
  let calendarWeeks = {}, status = {}
  const session = { user: { id: 'synthetic-coach' } }
  const reader = lavLaesninger({ session, coachActions: true, entropi2CalendarRead,
    setCalendarWeeks: value => { calendarWeeks = value },
    setCoachActionsStatus: update => { status = update(status) } })
  const snapshot = () => ({ calendarWeeks, calendarStatus: status.calendar,
    calendarReady: !!entropi2ReadContext({ enabled: true, loading: false, loadError: false,
      coachId: session.user.id, athletes: [athlete], calendarWeeks, coachActionsStatus: status, coachMorningData: {} }) })
  const rows = weeks.map((week, i) => ({ ...week, id: `synthetic-w${i}`, athlete_id: athlete.id,
    sessions: [{ id: `synthetic-s${i}`, exercises: [{ sets: 3, reps: '5' }] }] }))
  state.responses.push({ data: rows })
  await reader.fetchCalendarWeeks([athlete.id])
  assert.equal(snapshot().calendarReady, true)
  const shown = calendarWeeks
  let finish
  state.responses.push(new Promise(resolve => { finish = resolve }))
  const refresh = reader.fetchCalendarWeeks([athlete.id])
  assert.equal(snapshot().calendarStatus, 'loading')
  assert.equal(snapshot().calendarReady, false)
  assert.equal(calendarWeeks, shown)
  let tree = render(snapshot())
  assert.equal(blockButtons(tree).length, 1)
  assert.match(text(tree), /Opdaterer…/)
  finish({ data: null, error: { message: 'synthetic error' } })
  await refresh
  assert.equal(snapshot().calendarStatus, 'error')
  assert.equal(calendarWeeks, shown)
  tree = render(snapshot())
  assert.equal(blockButtons(tree).length, 1)
  assert.match(text(tree), /Kalenderen kunne ikke indlæses/)
  assert.doesNotMatch(text(tree), /synthetic error|Indlæser kalender/)
  state.responses.push({ data: rows })
  await reader.fetchCalendarWeeks([athlete.id])
  assert.equal(snapshot().calendarReady, true)
  assert.notEqual(calendarWeeks, shown)
  assert.doesNotMatch(text(render(snapshot())), /Opdaterer|kunne ikke indlæses/)
  assert.equal(state.calls.length, 3)
  assert.ok(state.calls.every(call => call.table === 'weeks'))
})
