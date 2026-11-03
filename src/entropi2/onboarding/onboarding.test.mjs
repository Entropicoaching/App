import test from 'node:test';
import assert from 'node:assert/strict';
import { createOnboarding, ONBOARDING_STORAGE_KEY } from './Onboarding.mjs';
import { descendants, memoryStorage, syntheticDocument } from './syntheticDom.mjs';

function setup(options = {}) {
  const document = syntheticDocument();
  const storage = memoryStorage();
  const element = createOnboarding({ document, storage, ...options });
  return { document, storage, element, buttons: descendants(element, 'button') };
}

test('three steps: Hjem, Pas, Kost; finishing remembers completion once', () => {
  const results = [];
  const { element, storage, buttons, document } = setup({ onComplete: reason => results.push(reason) });
  const [next, skip] = buttons;
  const [heading] = descendants(element, 'h2');
  const [progress] = descendants(element, 'p');
  assert.equal(element.hidden, false);
  assert.equal(heading.textContent, 'Hjem');
  assert.equal(progress.textContent, 'Trin 1 af 3');
  assert.equal(next.textContent, 'Næste');
  assert.equal(skip.textContent, 'Spring over');
  assert.equal(document.activeElement, null);
  assert.equal(storage.writes.length, 0);
  next.click();
  assert.equal(heading.textContent, 'Pas');
  assert.equal(progress.textContent, 'Trin 2 af 3');
  assert.equal(document.activeElement, heading);
  next.click();
  assert.equal(heading.textContent, 'Kost');
  assert.equal(progress.textContent, 'Trin 3 af 3');
  assert.equal(next.textContent, 'Kom i gang');
  next.click();
  assert.equal(element.hidden, true);
  assert.deepEqual(results, ['completed']);
  assert.deepEqual(storage.writes, [[ONBOARDING_STORAGE_KEY, '1']]);
  next.click(); skip.click();
  assert.deepEqual(results, ['completed']);
  assert.equal(storage.writes.length, 1);
});

test('skip at every step is terminal and remembered on a new instance', () => {
  for (const step of [0, 1, 2]) {
    const results = [];
    const { element, storage, buttons, document } = setup({ onComplete: reason => results.push(reason) });
    for (let i = 0; i < step; i++) buttons[0].click();
    buttons[1].click();
    assert.equal(element.hidden, true);
    assert.deepEqual(results, ['skipped']);
    const again = createOnboarding({ document, storage, onComplete: () => assert.fail('no automatic callback') });
    assert.equal(again.hidden, true);
    assert.equal(descendants(again, 'button').length, 0);
    assert.equal(storage.writes.length, 1);
  }
});

test('completed flow stays hidden on reload; unknown stored values start at Hjem', () => {
  const { storage, buttons, document } = setup();
  buttons[0].click(); buttons[0].click(); buttons[0].click();
  assert.equal(createOnboarding({ document, storage }).hidden, true);
  for (const value of ['', '0', 'true', '{broken', '2']) {
    const fixture = setup({ storage: memoryStorage({ [ONBOARDING_STORAGE_KEY]: value }) });
    assert.equal(fixture.element.hidden, false);
    assert.equal(descendants(fixture.element, 'h2')[0].textContent, 'Hjem');
  }
});

test('storage read and write failures never block next, skip or callbacks', () => {
  for (const skip of [false, true]) {
    let reads = 0; let writes = 0; let completed = 0;
    const storage = {
      getItem() { reads++; throw new Error('synthetic denied'); },
      setItem() { writes++; throw new Error('synthetic quota'); },
    };
    const { element, buttons } = setup({ storage, onComplete: () => completed++ });
    if (skip) buttons[1].click();
    else { buttons[0].click(); buttons[0].click(); buttons[0].click(); }
    assert.equal(element.hidden, true);
    assert.equal(reads, 1); assert.equal(writes, 1); assert.equal(completed, 1);
  }
});

test('null storage works; unfinished sessions restart without writing', () => {
  const { document, storage, buttons } = setup();
  buttons[0].click();
  assert.equal(descendants(createOnboarding({ document, storage }), 'h2')[0].textContent, 'Hjem');
  assert.equal(storage.writes.length, 0);
  const fixture = setup({ storage: null });
  fixture.buttons[1].click();
  assert.equal(fixture.element.hidden, true);
});

test('semantic controls, progress announcement and no unrelated storage writes', () => {
  const storage = memoryStorage({ 'unrelated-key': 'preserved' });
  const { element, buttons } = setup({ storage });
  assert.equal(element.tagName, 'section');
  assert.equal(element.getAttribute('aria-label'), 'Introduktion');
  assert.equal(descendants(element, 'h2')[0].getAttribute('tabindex'), '-1');
  assert.equal(descendants(element, 'p')[0].getAttribute('aria-live'), 'polite');
  assert.ok(buttons.every(button => button.type === 'button'));
  buttons[1].click();
  assert.equal(storage.getItem('unrelated-key'), 'preserved');
  assert.deepEqual(storage.writes, [[ONBOARDING_STORAGE_KEY, '1']]);
});
