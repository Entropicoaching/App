import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { mountFridaPortal } from './frida55.normal.fixture.mjs'
import { memoryStorage } from './portal.fixture.mjs'

// Ordinary product ESM and actual ReactDOM/StrictMode, without a production client.
const boundary = registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context)
  if (result.url.endsWith('/supabase.js')) throw Error('Production client forbidden in synthetic test')
  return result
} })
test.after(() => boundary.deregister())
const props = { enabled: true, today: '2026-11-08',
  athlete: { id: 'row-layout-athlete', age: 34, bodyweight: 77, goal: 'maintain' },
  session: { user: { id: 'row-layout-coach' } },
  client: { from() { throw Error('Synthetic offline client') } } }
const field = (ui, name) => ui.host.querySelectorAll('input,select,textarea').find(n => (n.name ?? n.getAttribute('name')) === name)
const edit = (ui, name, value) => ui.invoke(field(ui, name), 'onChange', { currentTarget: { value } })
const choices = (ui, mi = 0, ii = 0) => field(ui, `draft-food-${mi}-${ii}`).querySelectorAll('option').map(n => [n.value, n.textContent])
const row = (ui, mi = 0, ii = 0) => ui.host.querySelectorAll('div').find(n => n.getAttribute('role') === 'group'
  && n.getAttribute('aria-label') === `Fødevare ${ii + 1} i måltid ${mi + 1}`)
const noWrites = storage => assert.equal(storage.calls.some(([action]) => action === 'set'), false)

test('pinned layout lead: actual normal named row groups search/feedback separately from food, grams and compact removal', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.openRaw()
    const group = row(ui)
    assert.ok(group, 'Ingredient row needs an accessible group with two fluid sections; pinned four-column row stretches removal')
    const search = field(ui, 'draft-search-0-0'), food = field(ui, 'draft-food-0-0'), grams = field(ui, 'draft-grams-0-0')
    const clear = ui.find('button', 'Ryd søgning for fødevare 1 i måltid 1')
    const remove = ui.find('button', 'Fjern fødevare 1 fra måltid 1')
    assert.equal(group.children.length, 2)
    const [searchGroup, valuesGroup] = group.children
    const feedback = searchGroup.querySelectorAll('p').find(n => n.getAttribute('id') === search.getAttribute('aria-describedby'))
    assert.ok(searchGroup.contains(search)); assert.ok(searchGroup.contains(clear)); assert.ok(feedback)
    assert.equal(feedback.getAttribute('role'), 'status'); assert.equal(feedback.getAttribute('aria-live'), 'polite')
    assert.ok(valuesGroup.contains(food)); assert.ok(valuesGroup.contains(grams)); assert.ok(valuesGroup.contains(remove))
    assert.equal(search.getAttribute('aria-controls'), food.getAttribute('id'))
    assert.equal(food.getAttribute('aria-describedby'), feedback.getAttribute('id'))
    assert.equal(valuesGroup.style.display, 'flex'); assert.equal(valuesGroup.style.flexWrap, 'wrap')
    assert.equal(valuesGroup.style.alignItems, 'flex-end'); assert.equal(remove.style.alignSelf, 'flex-end')
    assert.equal(clear.parentElement.style.flexWrap, 'wrap'); assert.equal(clear.style.alignSelf, 'flex-end')
    assert.deepEqual(group.querySelectorAll('input,select,button'), [search, clear, food, grams, remove], 'Native reading and keyboard order')
    for (const target of [search, clear, food, grams, remove]) {
      assert.ok(parseFloat(target.style.minHeight) >= 44)
      assert.equal(target.getAttribute('tabindex'), null)
      assert.equal(target.style.maxWidth, '100%')
    }
    for (const label of group.querySelectorAll('label')) {
      assert.equal(label.style.minWidth, '0'); assert.equal(label.style.maxWidth, '100%')
      assert.equal(label.style.overflowWrap, 'anywhere')
    }
    assert.equal(group.style.gridTemplateColumns, 'minmax(0, 1fr)')
    assert.equal(group.style.minWidth, '0')
    assert.equal(remove.getAttribute('type'), 'button'); assert.equal(clear.getAttribute('type'), 'button')
    assert.equal(remove.style.height, undefined, 'Compact through alignment, never a clipped fixed height')
    assert.equal(choices(ui).length, 201)
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})

for (const explicit of [false, true]) test(`StrictMode normal consumer ${explicit ? 241 : 201}: exact catalogue, selection, comma grams and feedback survive layout interactions`, async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    if (explicit) await ui.open(); else await ui.openRaw()
    const original = choices(ui), selected = original[explicit ? 218 : 97]
    assert.equal(original.length, explicit ? 241 : 201)
    await edit(ui, 'draft-name-0', 'Rolig frokost')
    await edit(ui, 'draft-time-0', '12:35')
    await edit(ui, 'draft-food-0-0', selected[0])
    await edit(ui, 'draft-grams-0-0', '127,03125')
    await edit(ui, 'draft-search-0-0', 'zz-layout-no-match')
    const group = row(ui)
    assert.ok(group)
    assert.deepEqual(choices(ui), [original[0], selected])
    const feedback = group.querySelector('p')
    assert.match(feedback.textContent, /^Ingen fødevarer matcher søgningen\./)
    assert.match(feedback.textContent, /Dit valgte fødevarevalg bevares/)
    await ui.click('Ryd søgning for fødevare 1 i måltid 1')
    assert.deepEqual(choices(ui), original, 'Exact original order, identity and preparation after clear')
    assert.deepEqual(['draft-name-0', 'draft-time-0', 'draft-food-0-0', 'draft-grams-0-0'].map(n => field(ui, n).value),
      ['Rolig frokost', '12:35', selected[0], '127,03125'])
    assert.match(feedback.textContent, new RegExp(`^Alle ${explicit ? 240 : 200} fødevarer vises`))
    assert.notEqual(ui.find('button', 'Ryd søgning for fødevare 1 i måltid 1').getAttribute('disabled'), null)
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})

test('StrictMode multiple meals and rows retain native order, distinct names, stable fields and independent removal', async () => {
  const storage = memoryStorage()
  await mountFridaPortal(storage, props, async ui => {
    await ui.openRaw()
    await ui.click('Tilføj fødevare til måltid 1'); await ui.click('Tilføj måltid')
    const positions = [[0, 0], [0, 1], [1, 0]]
    const expected = ['havre', 'ris', 'ærter']
    for (let i = 0; i < positions.length; i++) {
      const [mi, ii] = positions[i]
      await edit(ui, `draft-search-${mi}-${ii}`, expected[i])
      await edit(ui, `draft-grams-${mi}-${ii}`, `${i + 1},03125`)
    }
    const ids = positions.map(([mi, ii]) => field(ui, `draft-food-${mi}-${ii}`).getAttribute('id'))
    const feedbackIds = positions.map(([mi, ii]) => field(ui, `draft-search-${mi}-${ii}`).getAttribute('aria-describedby'))
    assert.equal(new Set([...ids, ...feedbackIds]).size, 6)
    for (const [mi, ii] of positions) {
      const group = row(ui, mi, ii)
      assert.ok(group)
      assert.deepEqual(group.querySelectorAll('input,select,button').map(n => n.name || n.getAttribute('name') || n.textContent), [
        `draft-search-${mi}-${ii}`, `Ryd søgning for fødevare ${ii + 1} i måltid ${mi + 1}`,
        `draft-food-${mi}-${ii}`, `draft-grams-${mi}-${ii}`, `Fjern fødevare ${ii + 1} fra måltid ${mi + 1}`,
      ])
      for (const kind of ['search', 'food', 'grams']) {
        const control = field(ui, `draft-${kind}-${mi}-${ii}`)
        assert.equal(control.parentElement.tagName, 'LABEL')
        assert.ok(control.parentElement.textContent.includes(`fødevare ${ii + 1} i måltid ${mi + 1}`)
          || control.parentElement.textContent.includes(`Fødevare ${ii + 1} i måltid ${mi + 1}`))
      }
    }
    const firstRemoved = ui.handler(ui.find('button', 'Fjern fødevare 1 fra måltid 1'), 'onClick')
    const secondFood = field(ui, 'draft-food-0-1'), secondOptions = choices(ui, 0, 1), thirdOptions = choices(ui, 1, 0)
    await ui.click('Fjern fødevare 1 fra måltid 1')
    assert.equal(field(ui, 'draft-food-0-0'), secondFood, 'Stable keyed DOM survives renumbering')
    assert.equal(field(ui, 'draft-search-0-0').value, 'ris')
    assert.equal(field(ui, 'draft-grams-0-0').value, '2,03125')
    assert.deepEqual(choices(ui), secondOptions)
    assert.deepEqual(choices(ui, 1, 0), thirdOptions)
    await ui.act(() => firstRemoved())
    assert.ok(row(ui)); assert.ok(row(ui, 1, 0))
    await ui.click('Fjern måltid 1')
    assert.equal(field(ui, 'draft-search-0-0').value, 'ærter')
    assert.equal(field(ui, 'draft-grams-0-0').value, '3,03125')
    await ui.click('Tilføj fødevare til måltid 1')
    assert.equal(field(ui, 'draft-search-0-1').value, '')
    assert.equal(field(ui, 'draft-grams-0-1').value, '')
    assert.equal(choices(ui, 0, 1).length, 201)
    const retained = ui.handler(ui.find('button', 'Fjern fødevare 1 fra måltid 1'), 'onClick')
    await ui.render({ enabled: false }); await ui.act(() => retained())
    assert.equal(ui.host.textContent, '')
  }, '../../kostMaalKobling.mjs')
  noWrites(storage)
})
