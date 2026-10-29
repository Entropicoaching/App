import test from 'node:test'
import assert from 'node:assert/strict'
import { contactModules, nodes, text } from './contactHarness.mjs'
import { install } from './athleteAnalysisConclusionLoader.mjs'
install()
const { lavBeskederOgVaegt } = await contactModules()
const { default: Headline } = await import('./athleteAnalysisConclusion.mjs')
const { analyseConclusion, analyseConclusionEnabled, DEFAULT_ANALYSE_CONCLUSION } = await import('../dashboard/analyseConclusion.mjs')
const { lavBeskederOgVaegt: Before } = await import('./athleteAnalysisBefore.jsx')
const { createRegistry, wrapRegistryHooks } = await import('../testModuleRegistry.mjs')
const row = (extra = {}) => ({ id: 'review', athlete_id: 'demo', lift: 'squat', status: 'shared',
  analyzed_at: '2026-10-20T12:00:00Z', athlete_seen_at: '2026-10-21',
  athlete_feedback: { focus: [{ text: 'Hold spændingen. En anden sætning.' }] }, ...extra })
const fail = () => { throw Error('Unexpected IO or handler') }
const base = { athlete: { id: 'demo' }, openSharedVideoId: 'review', sharedVideoAnalyses: [row()],
 setOpenSharedVideoId: fail, setTab: fail, setMsgTrack: fail, setMessageInput: fail }
const snap = x => JSON.stringify(x, (k,v) => typeof v === 'function' ? '[handler]' : v)
function render(search = '', extra = {}, options) {
 globalThis.window = { location: { search } }
 return lavBeskederOgVaegt({ ...base, ...extra }).renderSharedFeedbackCards(undefined, options)
}
const headlines = tree => nodes(tree).filter(n => n.props?.['aria-label'] === 'Konklusion')

test('same approved coach sentence, date and lift at top of actual open analysis', () => {
 for (const status of ['shared', 'coach_approved']) for (const search of ['?analyseConclusion=1', '?rel1030=1']) {
  const analysis = row({ status }); const before = structuredClone(analysis)
  const tree = render(search, { sharedVideoAnalyses: [analysis] })
  const [headline] = headlines(tree)
  assert.equal(headlines(tree).length, 1)
  assert.equal(text(headline), analyseConclusion({ athleteId: 'demo', analyses: [analysis], liftFilter: 'squat' }))
  assert.equal(text(headline), 'Godkendt videoreview (Squat, 2026-10-20): Hold spændingen.')
  const parent = nodes(tree).find(n => n.children?.includes(headline))
  assert.equal(parent.children[0], headline)
  assert.deepEqual(analysis, before)
 }
})

test('empty, draft, invalid date, missing scope and other athlete never get headline', () => {
 for (const analysis of [row({ status: 'draft' }), row({ status: 'awaiting_review' }), row({ status: 'invalid' }),
  row({ athlete_id: 'other' }), row({ athlete_id: undefined }), row({ analyzed_at: '2026-02-30' }),
  row({ analyzed_at: 'bad' }), row({ athlete_feedback: {} }), row({ lift: '' })]) {
  assert.equal(headlines(render('?analyseConclusion=1', { sharedVideoAnalyses: [analysis] })).length, 0)
 }
 assert.equal(headlines(render('?analyseConclusion=1', { sharedVideoAnalyses: [] })).length, 0)
 assert.equal(headlines(render('?analyseConclusion=1', { athlete: null })).length, 0)
})

test('each viewed analysis uses its own lift and date; explicit wrong lift rejected', () => {
 const a = row(), b = row({ id: 'bench', lift: 'bench', analyzed_at: '2026-10-01', athlete_feedback: { focus: [{ text: 'Bevar pausen' }] } })
 const tree = render('?analyseConclusion=1', { sharedVideoAnalyses: [a,b] }, { expanded: true })
 assert.deepEqual(headlines(tree).map(text), ['Godkendt videoreview (Squat, 2026-10-20): Hold spændingen.', 'Godkendt videoreview (Bænkpres, 2026-10-01): Bevar pausen.'])
 assert.equal(Headline({ athleteId: 'demo', analysis: a, liftFilter: 'bench', search: '?analyseConclusion=1' }), null)
 assert.equal(headlines(render('?analyseConclusion=1', { openSharedVideoId: null })).length, 0)
})

test('default OFF including duplicate flags preserves entire actual renderer tree', () => {
 assert.equal(DEFAULT_ANALYSE_CONCLUSION, false)
 const baseline = snap(Before(base).renderSharedFeedbackCards())
 assert.equal(snap(render('')), baseline)
 for (const search of ['', '?analyseConclusion=0', '?analyseConclusion=true', '?analyseConclusion=1&analyseConclusion=0', '?analyseConclusion=1&analyseConclusion=1']) {
  assert.equal(analyseConclusionEnabled(search), false)
  assert.equal(snap(render(search)), baseline)
 }
 const off = Headline({ search: '', get analysis() { return row() } })
 assert.equal(off, null)
})

test('literal text, scope switch and retained follow-up handler', () => {
 const analysis = row({ athlete_feedback: { focus: [{ text: '<img src=x onerror=alert(1)>. Next.' }] } })
 const tree = render('?analyseConclusion=1', { sharedVideoAnalyses: [analysis] })
 assert.ok(text(headlines(tree)[0]).includes('<img src=x onerror=alert(1)>.'))
 assert.equal(nodes(tree).filter(n => n.type === 'img' || n.props?.dangerouslySetInnerHTML).length, 0)
 assert.equal(headlines(render('?analyseConclusion=1', { athlete: { id: 'other' } })).length, 0)
 const calls = []
 const actionTree = render('?analyseConclusion=1', { setMessageInput: v => calls.push(v), setMsgTrack: v => calls.push(v), setTab: v => calls.push(v) })
 nodes(actionTree).find(n => n.type === 'button' && text(n) === 'Spørg om denne feedback').props.onClick()
 assert.ok(calls.length > 0)
})

test('actual layout registry admits exact additions and rejects wrong importer and case', () => {
 const registry = createRegistry(); const root = new URL('../../', import.meta.url)
 const loader = 'src/athlete/contactHarness.mjs'
 const parent = new URL('src/athlete/beskederOgVaegt.jsx', root).href
 assert.equal(registry.lookup(loader, './athleteAnalysisConclusion.mjs', parent).url, new URL('src/athlete/athleteAnalysisConclusion.mjs', root).href)
 assert.equal(registry.lookup(loader, './AthleteAnalysisConclusion.mjs', parent), null)
 assert.equal(registry.lookup(loader, './athleteAnalysisConclusion.mjs', new URL('src/athlete/BeskederTab.jsx',root).href), null)
 const shared = new URL('src/approvedAnalysisConclusion.mjs', root).href
 assert.equal(registry.lookup(loader, './supabase.js', shared), null)
})

test('closed registry wrapper denies unlisted dependencies after admitting a module', () => {
 const loader = new URL('./contactHarness.mjs', import.meta.url).href
 const parent = new URL('./beskederOgVaegt.jsx', import.meta.url).href
 const hooks = wrapRegistryHooks(loader, { resolve() { throw Error('Host fallback forbidden') } })
 const match = hooks.resolve('./athleteAnalysisConclusion.mjs', { parentURL: parent })
 for (const specifier of ['node:fs', '../supabase.js', 'https://example.invalid/module.js', './other.mjs'])
  assert.throws(() => hooks.resolve(specifier, { parentURL: match.url }), /Closed registry import/)
})

test('coach fallback and approved ordering retain the saved semantics', () => {
 const rows = [row(), row({ id: 'draft', status: 'draft', analyzed_at: '2026-10-28', athlete_feedback: { focus: [{ text: 'DRAFT' }] } })]
 assert.equal(analyseConclusion({ athleteId: 'demo', analyses: rows }), 'Godkendt videoreview (Squat, 2026-10-20): Hold spændingen.')
 assert.match(analyseConclusion({ athleteId: 'demo', analyses: [] }), /Der mangler et godkendt videoreview/)
 assert.match(analyseConclusion({ athleteId: 'demo', analyses: rows, loading: true }), /Afvent/)
 assert.match(analyseConclusion({ athleteId: 'demo', analyses: rows, error: true }), /kunne ikke indlæses/)
})
