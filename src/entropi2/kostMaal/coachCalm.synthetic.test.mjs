// Actual copied component with the existing synthetic hook fixture; no DOM claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mount, nodes, text } from '../kostplan/coach/portal.fixture.mjs'

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react' && context.parentURL === new URL('./KostMaal.mjs', import.meta.url).href)
    return { url: new URL('../kostplan/coach/portal.fixture.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const { default: KostMaal } = await import('./KostMaal.mjs')
hooks.deregister()

const summary = node => text(node.props.children.find(child => child?.type === 'summary'))
const fold = (tree, name) => nodes(tree).find(node => node.type === 'details' && summary(node) === name)
const visible = node => !node || typeof node !== 'object' ? text(node)
  : (node.type === 'details' && !node.props.open
    ? node.props.children.filter(child => child?.type === 'summary') : node.props.children).map(visible).join(' ')
function fixture() {
  return { enabled: true, athlete: { id: 'synthetic-a', kcal_target: 2400, protein_target: 160, bodyweight: 90 },
    today: '2026-11-02', weightState: 'ready',
    weightLogs: [['2026-10-20', 88], ['2026-10-26', 86], ['2026-10-27', 82], ['2026-11-02', 80]]
      .map(([logged_at, weight]) => ({ logged_at, weight })),
    startEdit() {}, setEditData() {}, setEditing() {}, saveEdit() {} }
}

test('goals, latest dated weighing and documented trend stay visible; basis and help start folded', () => {
  const p = fixture(), original = structuredClone({ athlete: p.athlete, weightLogs: p.weightLogs })
  const tree = mount(KostMaal, p).render(), shown = visible(tree)
  for (const expected of ['2.400 kcal', '160 g', 'Seneste vejning 80 kg · 2026-11-02', 'Trend · mod de foregående 7 dage -6 kg'])
    assert.ok(shown.includes(expected), expected)
  assert.doesNotMatch(shown, /Kropsvægt i profilen|Ugegennemsnit|Forslag:|Trenden kræver/)
  const basis = fold(tree, 'Vægtgrundlag'), help = fold(tree, 'Hjælp til kostmål')
  assert.ok(basis); assert.ok(help); assert.equal(basis.props.open, undefined); assert.equal(help.props.open, undefined)
  assert.match(text(basis), /Kropsvægt i profilen 90 kg/)
  assert.match(text(basis), /Ugegennemsnit · seneste 7 dage 81 kg · 2 vejedage/)
  assert.match(text(basis), /Grundlag til og med 2026-11-02/)
  assert.match(text(help), /ud fra 81 kg/)
  assert.deepEqual({ athlete: p.athlete, weightLogs: p.weightLogs }, original)
  for (const node of nodes(tree).filter(n => n.type === 'summary')) assert.ok(node.props.style.minHeight >= 44)
})

test('editing opens only the help fold, applies a draft suggestion and leaves save/cancel explicit', async () => {
  const p = fixture(); let saves = 0
  p.editData = { kcal_target: '2400', protein_target: '160' }
  p.setEditData = update => { p.editData = update(p.editData) }
  p.setEditing = value => { p.editing = value }
  p.startEdit = (mode, draft) => { p.editing = mode; p.editData = draft }
  p.saveEdit = () => { saves++; return false }
  const screen = mount(KostMaal, p)
  nodes(screen.render()).find(n => n.type === 'button' && text(n) === 'Rediger').props.onClick()
  let tree = screen.render(p)
  assert.equal(fold(tree, 'Vægtgrundlag').props.open, undefined)
  assert.equal(fold(tree, 'Hjælp til kostmål').props.open, true)
  const apply = nodes(tree).find(n => n.type === 'button' && text(n) === 'Brug forslag')
  apply.props.onClick(); assert.deepEqual(p.editData, { kcal_target: 2400, protein_target: 155 }); assert.equal(saves, 0)
  tree = screen.render(p)
  await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} })
  assert.equal(saves, 1); assert.match(visible(screen.render(p)), /Målene blev ikke gemt/)
  nodes(screen.render(p)).find(n => n.type === 'button' && text(n) === 'Annuller').props.onClick()
  tree = screen.render(p)
  assert.equal(fold(tree, 'Hjælp til kostmål').props.open, undefined)
  assert.equal(nodes(tree).some(n => n.type === 'form'), false)
})

test('empty, invalid date, weight loading/error and nutrition errors remain outside folds', () => {
  const p = fixture(); let retries = 0
  for (const [patch, expected] of [
    [{ athlete: { id: 'synthetic-a' }, weightLogs: [] }, /Ingen vejninger endnu/],
    [{ today: '2026-02-30' }, /Vælg en gyldig dagsdato/],
    [{ weightState: 'loading' }, /Indlæser vægtgrundlag/],
    [{ weightState: 'error', retryWeight: () => retries++ }, /Vægtgrundlaget kunne ikke hentes/],
    [{ loadError: true }, /Kostgrundlaget kunne ikke hentes/],
  ]) {
    const tree = mount(KostMaal, { ...p, ...patch }).render()
    assert.match(visible(tree), expected)
    if (patch.weightState) assert.doesNotMatch(visible(tree), /Ingen vejninger|Seneste vejning|Trend ·/)
    if (patch.weightState === 'error') {
      nodes(tree).find(n => n.type === 'button' && text(n) === 'Hent vægt igen').props.onClick()
      assert.equal(retries, 1)
    }
  }
  const empty = mount(KostMaal, { ...p, athlete: { id: 'synthetic-a' }, weightLogs: [] }).render()
  assert.doesNotMatch(text(empty), /0 kcal|0 kg|Trend ·|Ugegennemsnit/)
})
