import test from 'node:test'
import assert from 'node:assert/strict'
import { mountEatingOut } from './EatingOutView.mjs'
import { viewHost } from './viewFixture.mjs'

test('strict default OFF never reads host', () => {
  const host = new Proxy({}, { get() { throw new Error('OFF touched host') } })
  mountEatingOut(host)()
  for (const enabled of [undefined, false, null, 0, 1, 'true', {}]) mountEatingOut(host, { enabled })()
})

test('actual mount exposes labelled selectors, uncertainty and no implicit estimate', () => {
  const host = viewHost()
  mountEatingOut(host, { enabled: true })
  assert.equal(host.querySelectorAll('section')[0].getAttribute('aria-label'), 'Skøn for mad spist ude')
  const labels = host.querySelectorAll('label')
  assert.equal(labels.length, 2)
  assert.equal(labels[0].querySelectorAll('select').length, 1)
  assert.equal(labels[1].querySelectorAll('select').length, 1)
  assert.equal(host.querySelectorAll('select')[0].querySelectorAll('option').length, 9)
  assert.match(host.textContent, /ikke en måling/)
  assert.match(host.textContent, /Intet bliver gemt/)
  assert.match(host.textContent, /Vælg en ret og en portion/)
  assert.doesNotMatch(host.textContent, /Ca. \d+ kcal/)
  assert.equal(host.querySelectorAll('[role]')[0].getAttribute('aria-live'), 'polite')
})

test('real change handlers update both choices and clear stale invalid estimates', async () => {
  const host = viewHost()
  mountEatingOut(host, { enabled: true })
  const [dish, portion] = host.querySelectorAll('select')
  dish.value = 'pizza'; await dish.fire('change')
  assert.match(host.textContent, /Ca. 1000 kcal og 40 g protein/)
  assert.match(host.textContent, /700–1300 kcal/)
  assert.match(host.textContent, /Mellem portion svarer her til/)
  portion.value = 'small'; await portion.fire('change')
  assert.match(host.textContent, /Ca. 700 kcal og 30 g protein/)
  portion.value = 'large'; await portion.fire('change')
  assert.match(host.textContent, /Ca. 1400 kcal og 55 g protein/)
  dish.value = 'sushi'; await dish.fire('change')
  assert.match(host.textContent, /Sushi · stor portion · skøn/)
  assert.match(host.textContent, /Ca. 900 kcal og 40 g protein/)
  dish.value = '<img src=x>'; await dish.fire('change')
  assert.match(host.textContent, /Vælg en ret og en portion/)
  assert.doesNotMatch(host.textContent, /Ca. \d+ kcal/)
  assert.equal(host.querySelectorAll('img').length, 0)
})

test('disposal removes only owned subtree and listeners; mounts stay independent', async () => {
  const host = viewHost(), sibling = host.ownerDocument.createElement('p')
  sibling.textContent = 'Bevar'; host.append(sibling)
  const first = mountEatingOut(host, { enabled: true })
  const second = mountEatingOut(host, { enabled: true })
  const [oldSelect] = host.querySelectorAll('select')
  const secondDish = host.querySelectorAll('select')[2]
  secondDish.value = 'pizza'; await secondDish.fire('change')
  first(); first()
  assert.equal(oldSelect.events.change.length, 0)
  assert.equal(host.querySelectorAll('section').length, 1)
  assert.match(host.textContent, /Ca. 1000 kcal/)
  second(); second()
  assert.deepEqual(host.children, [sibling])
})
