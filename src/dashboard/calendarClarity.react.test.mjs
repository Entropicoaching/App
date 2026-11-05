// Mandatory app npm test: actual React and ReactDOM, no skip or substitute.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { installCalendarClarityLoader, calendarFixture, athlete, weeks, longBlock } from './calendarClarityFixture.mjs'
const hooks = installCalendarClarityLoader(true)
test.after(() => hooks.deregister())
const { default: Calendar } = await import('./KalenderView.jsx')
const render = extra => renderToStaticMarkup(h(Calendar, calendarFixture(extra)))

for (const isMobile of [false, true]) {
  test(`real React ${isMobile ? 390 : 1280}: honest read states and initially closed board`, () => {
    const loading = render({ isMobile, loading: true, athletes: [] })
    assert.match(loading, /role="status".*Indlæser kalender/)
    assert.doesNotMatch(loading, /Ingen atleter|Intet program/)
    const error = render({ isMobile, calendarWeeks: {}, calendarStatus: 'error' })
    assert.match(error, /role="alert".*Kalenderen kunne ikke indlæses/)
    assert.match(error, /<button type="button"[^>]*>Prøv igen<\/button>/)
    assert.doesNotMatch(error, /Intet program/)
    assert.match(render({ isMobile, athletes: [] }), /Ingen synlige atleter/)
    const athletes = Array.from({ length: 20 }, (_, i) => ({ id: `synthetic-${i}`, name: `Syntetisk ${i}` }))
    const html = render({ isMobile, athletes, calendarWeeks: {} })
    const board = /<details\b([^>]*data-calendar-board[^>]*)>([\s\S]*?)<\/details>/.exec(html)
    assert.ok(board)
    assert.doesNotMatch(board[1], /\bopen(?:=|\s|$)/)
    assert.match(board[2], /<summary[^>]*>Alle atleter \(20\)<\/summary>/)
    for (const a of athletes) assert.ok(board[2].includes(a.name))
    assert.ok(board[2].includes('Prikken = sidst loggede træning.'))
    assert.match(html.replace(board[0], ''), /Kræver din opmærksomhed \(20\)/)
  })

  test(`real React ${isMobile ? 390 : 1280}: existing track and disclosure remain visible during refresh and errors`, () => {
    for (const extra of [
      { calendarStatus: 'loading', calendarReady: false },
      { loading: true, calendarStatus: 'loading', calendarReady: false },
      { calendarStatus: 'error', calendarReady: false },
      { loadError: true, calendarReady: false },
      { calendarReady: false },
    ]) {
      const html = render({ isMobile, ...extra })
      assert.match(html, /aria-label="Kalenderens tidslinje"/)
      assert.match(html, /data-calendar-board/)
      assert.match(html, /data-calendar-today=/)
      assert.match(html, /aria-current="date"/)
      assert.ok(html.includes(longBlock))
      assert.doesNotMatch(html, /Indlæser kalender/)
      if (extra.calendarStatus === 'error' || extra.loadError) assert.match(html, /role="alert"/)
      else assert.match(html, /role="status".*Opdaterer…/)
    }
    const empty = render({ isMobile, calendarWeeks: { [athlete.id]: [] }, calendarStatus: 'loading', calendarReady: false })
    assert.match(empty, /data-calendar-board/)
    assert.match(empty, /Intet program/)
    assert.match(empty, /Opdaterer…/)
  })

  test(`real React ${isMobile ? 390 : 1280}: native actions, readable dates and full selected label`, () => {
    const html = render({ isMobile, timelineEdit: { athleteId: athlete.id, name: athlete.name,
      block: longBlock, weeks, firstStartIso: '2026-11-02' } })
    assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Opret uge/)
    const block = /<button[^>]*aria-label="Rediger blok:[^"]*"[^>]*>/.exec(html)?.[0]
    assert.ok(block)
    assert.ok(block.includes('min-height:44px'))
    assert.ok(html.includes('font-size:12px'))
    assert.ok(html.includes('font-size:14px'))
    assert.ok(html.includes(longBlock + ' · ' + athlete.name + ' · Uge 1–2'))
    assert.match(html, /<time dateTime="2026-11-02">2026-11-02<\/time>/)
    assert.match(html, /data-calendar-today=/)
    assert.match(html, /aria-current="date"/)
  })

  test(`real React ${isMobile ? 390 : 1280}: twenty name and track rows share the same total height`, () => {
    const athletes = Array.from({ length: 20 }, (_, i) => ({
      id: `synthetic-row-${i}`, name: `Syntetisk ${i} ${'langt navn '.repeat(20)}`,
    }))
    const html = render({ isMobile, athletes,
      calendarWeeks: Object.fromEntries(athletes.map(a => [a.id, weeks])) })
    const names = [...html.matchAll(/<button\b[^>]*class="entropi2-calendar-profile"[^>]*style="([^"]*height:56px[^"]*)"/g)]
    const rows = [...html.matchAll(/<div\b[^>]*style="(position:relative;height:56px;[^"]*)"/g)]
    assert.equal(names.length, 20)
    assert.equal(rows.length, 20)
    for (const [, style] of [...names, ...rows]) {
      assert.match(style, /(?:^|;)box-sizing:border-box(?:;|$)/)
      assert.match(style, /(?:^|;)height:56px(?:;|$)/)
      assert.match(style, /(?:^|;)border-bottom:1px solid /)
    }
  })

  test(`real React ${isMobile ? 390 : 1280}: profile controls use valid native button content`, () => {
    const undated = { id: 'synthetic-undated', name: 'Syntetisk langt navn '.repeat(20) }
    const html = render({ isMobile, athletes: [athlete, undated],
      calendarWeeks: { [athlete.id]: weeks, [undated.id]: [{ ...weeks[0], start_date: null }] } })
    const shortcuts = [...html.matchAll(/<button\b([^>]*class="entropi2-calendar-profile"[^>]*)>([\s\S]*?)<\/button>/g)]
    assert.equal(shortcuts.length, 4)
    for (const [, attrs, content] of shortcuts) {
      assert.match(attrs, /type="button"/)
      assert.match(attrs, /min-height:44px/)
      assert.doesNotMatch(attrs, /tabindex="-1"/)
      assert.doesNotMatch(content, /<(?:button|a|input|select|div)\b/)
    }
    assert.match(html, /\.entropi2-calendar-profile:focus-visible/)
    assert.match(html, /text-overflow:ellipsis/)
    for (const extra of [{ athletes: [] }, { hiddenAthleteIds: new Set([athlete.id]) }]) {
      const empty = render({ isMobile, ...extra })
      assert.match(empty, /role="status"[^>]*>Ingen synlige atleter/)
      assert.doesNotMatch(empty, /data-calendar-board|Kalenderens tidslinje|sæt en startdato/)
    }
  })
}
