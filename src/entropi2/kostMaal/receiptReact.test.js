// Runs with real React in the app; hermetic public copies may lack dependencies.
import test from 'node:test'
import assert from 'node:assert/strict'

let React, renderToStaticMarkup
try {
  React = await import('react')
  ;({ renderToStaticMarkup } = await import('react-dom/server'))
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package 'react(?:-dom)?'/.test(error.message)) throw error
}

test('real React renders honest receipt states and retains valid meals', {
  skip: !React || !renderToStaticMarkup ? 'Pinned public copy has no React dependencies; run in app at merge' : false,
}, async () => {
  const { default: KostMaal } = await import('./KostMaal.mjs')
  const props = { enabled: true, today: '2026-11-02',
    athlete: { id: 'synthetic-a', kcal_target: 2400, protein_target: 150 },
    weightLogs: [{ logged_at: '2026-11-02', weight: 80 }],
    session: { user: { id: 'synthetic-coach' } },
    readContext: { coachId: 'synthetic-coach', day: '2026-11-02', athleteIds: ['synthetic-a'] },
    coachNutrition: { coachId: 'synthetic-coach', day: '2026-11-02', athleteIds: ['synthetic-a'],
      state: 'ready', complete: true, from: '2026-10-27', through: '2026-11-02', targets: [],
      rows: ['2026-11-02', '2026-11-01', '2026-10-31', '2026-10-30'].map((date, i) => ({
        id: `synthetic-${i}`, athlete_id: 'synthetic-a', date, meal: 'Synthetic meal', kcal: 2400, protein: 150,
      })) } }
  const render = p => renderToStaticMarkup(React.createElement(KostMaal, p))
  for (const [change, expected] of [
    [{ loading: true }, /endnu ikke indlæst/],
    [{ coachNutrition: undefined }, /endnu ikke indlæst/],
    [{ readContext: undefined }, /endnu ikke indlæst/],
    [{ loadError: true }, /kunne ikke hentes/],
    [{ coachNutrition: { ...props.coachNutrition, state: 'error', complete: false } }, /kunne ikke hentes/],
    [{ coachNutrition: { ...props.coachNutrition, state: 'partial', complete: false } }, /ufuldstændigt/],
  ]) {
    const html = render({ ...props, ...change, editing: 'setup' })
    assert.match(html, expected)
    assert.doesNotMatch(html, /mindst 4 loggede dage|Typisk indtag:|Seneste 7 dage: gns\.|Brug forslag til energimål/)
  }
  props.coachNutrition.rows.push({ ...props.coachNutrition.rows[0], id: 'synthetic-invalid', protein: null })
  const before = structuredClone(props), html = render({ ...props, editing: 'setup' })
  assert.match(html, /Seneste 7 dage: gns\. 2\.400 kcal/)
  assert.match(html, /Typisk indtag: 2\.400 kcal på 4 loggede dage/)
  assert.match(html, /1 ugyldigt måltid er udeladt/)
  assert.deepEqual(props, before)
  assert.equal(render({ enabled: false }), '')
})

test('real React sparse coach tab preserves independent goals and draft during a weight error', {
  skip: !React || !renderToStaticMarkup ? 'Pinned public copy has no React dependencies; REQUIRED at app merge' : false,
}, async () => {
  const { default: CoachKostMaal } = await import('../kostMaalKobling.mjs')
  const props = { enabled: true, today: '2026-11-02', athlete: { id: 'synthetic-a', kcal_target: 2200 },
    session: { user: { id: 'synthetic-coach' } },
    weightStatus: { athleteId: 'synthetic-a', state: 'error', retry() {} } }
  const render = p => renderToStaticMarkup(React.createElement(CoachKostMaal, p))
  const html = render(props)
  assert.match(html, /2\.200 kcal/)
  assert.match(html, /role="alert"[^>]*>Vægtgrundlaget kunne ikke hentes/)
  assert.match(html, /Hent vægt igen/)
  assert.match(html, /<summary[^>]*>Kostplan/)
  assert.doesNotMatch(html, /Ingen vejninger|Typisk indtag|Ingen mål endnu|Ugegennemsnit|Trend ·/)
  const empty = render({ ...props, athlete: { id: 'synthetic-a' },
    weightStatus: { athleteId: 'synthetic-a', state: 'ready', rows: [] } })
  assert.match(empty, /Sæt kostmål/)
  assert.equal((empty.match(/Ingen vejninger endnu/g) ?? []).length, 1)
  assert.doesNotMatch(empty, /Ingen kropsvægt|Ingen vejninger i perioden|Flere vejninger nødvendige/)
})

test('real React keeps goals and trend outside native folds and opens help during target editing', {
  skip: !React || !renderToStaticMarkup ? 'Pinned public copy has no React dependencies; REQUIRED at app merge' : false,
}, async () => {
  const { default: KostMaal } = await import('./KostMaal.mjs')
  const props = { enabled: true, today: '2026-11-02',
    athlete: { id: 'synthetic-a', kcal_target: 2400, protein_target: 160, bodyweight: 90 },
    weightLogs: [['2026-10-20', 88], ['2026-10-26', 86], ['2026-10-27', 82], ['2026-11-02', 80]]
      .map(([logged_at, weight]) => ({ logged_at, weight })) }
  const render = patch => renderToStaticMarkup(React.createElement(KostMaal, { ...props, ...patch }))
  const html = render(), basis = html.match(/<details><summary[^>]*>Vægtgrundlag<\/summary>([\s\S]*?)<\/details>/)
  assert.ok(basis); assert.match(basis[1], /Kropsvægt i profilen[\s\S]*90 kg/)
  assert.match(basis[1], /Ugegennemsnit[\s\S]*81 kg/)
  assert.match(html.slice(0, basis.index), /Seneste vejning[\s\S]*80 kg · 2026-11-02/)
  assert.match(html.slice(0, basis.index), /Trend · mod de foregående 7 dage[\s\S]*-6 kg/)
  assert.match(html, /<details><summary[^>]*>Hjælp til kostmål/)
  assert.match(render({ editing: 'setup' }), /<details open=""><summary[^>]*>Hjælp til kostmål/)
})
