// Ordre 1547: coachens sider er lette at læse og har temavalg. Marc 11. nov.: "nem oversigt", coachvisningen
// "lidt rodet"; 13. nov.: ingen tekst under 11 px; 16. nov. kl. 21:15: selv vælge hvid eller mørk tema.
// Kun syntetiske data.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { CoachView, reasonParts, GRUND_TO_LINJER } from './CoachScreen.mjs'
import { productionFixture, day, athleteId } from './coachProductionFixture.mjs'
import { CoachTemaValg, COACH_TEMA_NOEGLE } from '../../dashboard/coachMenuMore.mjs'
import { TEMA_NOEGLE } from '../../tema/temaValg.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const read = path => readFileSync(join(root, path), 'utf8')

test('grunden: kort grund står hel i rækken; lang grund deles, og resten står i folden én gang', () => {
  assert.deepEqual(reasonParts('Atlet S', 'Programmet slutter om 6 dage'), { head: 'Programmet slutter om 6 dage', rest: null })
  const lang = 'Spørg atleten først (squat står stille, 1 sprunget sæt i uge 45)'
  assert.ok(`Atlet S · ${lang}`.length > GRUND_TO_LINJER)
  assert.deepEqual(reasonParts('Atlet S', lang), { head: 'Spørg atleten først', rest: 'Squat står stille, 1 sprunget sæt i uge 45' })
  assert.deepEqual(reasonParts('Atlet S', 'Squat står stille 3 uger: overvej deload, og en meget lang forklaring her'),
    { head: 'Squat står stille 3 uger', rest: 'Overvej deload, og en meget lang forklaring her' })

  const p = productionFixture()
  p.u3Data = true
  p.calendarWeeks[athleteId] = ['2026-11-02', '2026-11-09', '2026-11-16'].map((start_date, i) => ({ start_date, week_number: 45 + i, session_count: 1, exercise_count: 1 }))
  const nested = (date, extra = {}) => ({ athlete_id: athleteId, logged_at: `${date}T10:00:00Z`, weight: 130, reps_completed: 5, skipped: false,
    exercises: { name: 'Squat', session_id: `s-${date}`, sessions: { weeks: { week_number: 45, block_name: 'Opbygning' } } }, ...extra })
  const logs = ['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'].map(d => nested(d)).concat(nested('2026-10-28', { skipped: true, reps_completed: null }))
  const signal = { o_athlete_id: athleteId, o_detector: 'stagnation', o_severity: 'alert', o_metrics: { lift: 'Squat', stalled_weeks: 3 } }
  p.u3Attention = { day, ids: [athleteId], complete: true, readiness: [], notes: [], stagnation: { [athleteId]: { signal, logs } } }
  const html = render(h(CoachView, { ...p, today: day }))
  const row = html.match(/<button[^>]*data-coach-action="[^"]*"(?:(?!<\/button>)[\s\S])*?Spørg atleten først[\s\S]*?<\/button>/)?.[0]
  assert.ok(row, 'stilstandens række findes')
  assert.match(row, /Spørg atleten først<\/span>/)
  assert.match(row, /-webkit-line-clamp:2/)
  assert.match(html, /data-coach-hel-grund="true"[^>]*>Squat står stille, 1 sprunget sæt i uge 45</)
  assert.equal(html.split('pørg atleten først').length - 1, 1, 'grunden står én gang')
  assert.equal(html.split('står stille, 1 sprunget').length - 1, 1)
})

test('tom indbakke siger noget roligt, ikke "0 af 0"', () => {
  const p = productionFixture()
  for (const tab of ['home', 'inbox']) {
    const html = render(h(CoachView, { ...p, tab, today: day, athletes: p.athletes, inboxLimit: 10 }))
    assert.doesNotMatch(html, /0 af 0|0 opgaver i alt/)
  }
})

// Lille DOM-attrap: kun det, CoachTemaValg bruger.
function fakeDoc(start) {
  const attrs = start ? { 'data-tema': start } : {}
  const meta = { content: '#1e1912', setAttribute(k, v) { this[k] = v } }
  const store = new Map()
  return {
    store, meta, attrs,
    storage: { setItem: (k, v) => store.set(k, v), getItem: k => store.get(k) ?? null },
    documentElement: { getAttribute: k => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v }, removeAttribute: k => { delete attrs[k] } },
    querySelector: sel => (sel === 'meta[name="theme-color"]' ? meta : null),
  }
}

test('coachens menu: Mørk/Lys med samme nøgle og mærke som atletens Mig > Skærm', () => {
  assert.equal(COACH_TEMA_NOEGLE, TEMA_NOEGLE)
  assert.equal(CoachTemaValg({ doc: undefined }), null, 'uden browser tegnes intet (de låste menutræer er uændrede)')
  const doc = fakeDoc()
  const el = CoachTemaValg({ doc })
  const html = render(el)
  assert.match(html, /role="group" aria-label="Skærm" data-tema-valg=""/)
  assert.match(html, /<p[^>]*>Skærm<\/p>/)
  assert.match(html, /aria-pressed="true" data-tema-knap="moerk"[^>]*>Mørk</)
  assert.match(html, /aria-pressed="false" data-tema-knap="lys"[^>]*>Lys</)
  assert.match(html, /min-height:44px/)
  // Klik på Lys: data-tema, theme-color og localStorage som atletens valg; knapperne skifter.
  const buttons = el.props.children[1].props.children
  const knapper = ['moerk', 'lys'].map(v => ({ attrs: { 'data-tema-knap': v }, style: {}, getAttribute(k) { return this.attrs[k] }, setAttribute(k, x) { this.attrs[k] = x } }))
  const event = { currentTarget: { parentElement: { querySelectorAll: () => knapper } } }
  const storage = globalThis.localStorage
  globalThis.localStorage = doc.storage
  try { buttons[1].props.onClick(event) } finally { globalThis.localStorage = storage }
  assert.equal(doc.attrs['data-tema'], 'lys')
  assert.equal(doc.meta.content, '#f7f2e9')
  assert.equal(doc.store.get('entropi:tema'), 'lys')
  assert.deepEqual(knapper.map(k => k.attrs['aria-pressed']), ['false', 'true'])
  assert.match(render(CoachTemaValg({ doc })), /aria-pressed="true" data-tema-knap="lys"/)
})

test('menuen viser temavalget ved Log ud på mobil (begge menuark) og på desktop', () => {
  const mobil = read('src/dashboard/MobilNav.jsx'), side = read('src/dashboard/Sidebar.jsx')
  assert.equal((mobil.match(/<CoachTemaValg /g) || []).length, 2)
  assert.equal((side.match(/<CoachTemaValg /g) || []).length, 1)
  for (const src of [mobil, side]) assert.ok(src.indexOf('<CoachTemaValg ') > src.indexOf('Log ud'))
})

test('index.html sætter temaet før første tegning', () => {
  const html = read('index.html')
  const tema = html.indexOf('if(v==="lys"){')
  assert.ok(tema > 0 && tema < html.indexOf('<script type="module"'))
  assert.ok(tema < html.indexOf('</head>'))
})

test('coachens atletside: ugekortet står én gang, tal i grafen er 11 px, styrkekortets trykflade er 44 px', () => {
  const program = read('src/dashboard/ProgramTab.jsx')
  assert.doesNotMatch(program, /Gå til uge \$\{week\.week_number\}/)
  assert.doesNotMatch(program, /fontSize="[0-9]"/)
  assert.match(program, /data-uge-logget=\{week.week_number\}[^\n]*\{loggetProcent\(week, athleteLogs\)\}/)
  const hoved = read('src/dashboard/ProfilHoved.jsx')
  assert.match(hoved, /<summary style=\{\{[^}]*minHeight: 44/)
})

test('ingen tekst under 11 px på coachens sider: hver lille størrelse løftes af tema.css', () => {
  const css = read('src/tema/tema.css')
  const files = []
  const walk = p => statSync(join(root, p)).isDirectory()
    ? readdirSync(join(root, p)).forEach(n => walk(`${p}/${n}`))
    : /\.(jsx|mjs|js)$/.test(p) && !/\.test\./.test(p) && files.push(p)
  for (const p of ['src/dashboard', 'src/entropi2/coach', 'src/dashboardCharts.jsx', 'src/Dashboard.jsx', 'src/dashboardShared.js']) walk(p)
  const missing = new Set()
  for (const f of files) {
    const src = read(f)
    for (const m of src.matchAll(/fontSize:\s*'([0-9.]+)rem'/g)) {
      if (parseFloat(m[1]) * 16 < 11 && !css.includes(`[style*="font-size: ${m[1]}rem"]`)) missing.add(`${f} ${m[1]}rem`)
    }
    for (const m of src.matchAll(/fontSize:\s*'([0-9.]+)px'|fontSize:\s*([0-9.]+)\b/g)) {
      if (parseFloat(m[1] ?? m[2]) < 11) missing.add(`${f} ${m[0]}`)
    }
    for (const m of src.matchAll(/fontSize="([0-9.]+)"/g)) {
      if (parseFloat(m[1]) < 11 && !css.includes(`svg text[font-size="${m[1]}"]`)) missing.add(`${f} svg ${m[1]}`)
    }
  }
  assert.deepEqual([...missing], [])
})
