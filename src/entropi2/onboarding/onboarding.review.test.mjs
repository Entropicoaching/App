// Separate review probes, executed in a fresh foreground Node process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { descendants, memoryStorage, syntheticDocument } from './syntheticDom.mjs';

test('import is inert; default localStorage getter failures are contained', async () => {
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  let reads = 0;
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, get() { reads++; throw new Error('synthetic security denial'); },
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true, get() { assert.fail('import must not access document'); },
    });
    const { createOnboarding } = await import('./Onboarding.mjs');
    assert.equal(reads, 0);
    let reason;
    const document = syntheticDocument();
    const root = createOnboarding({ document, onComplete: value => { reason = value; } });
    assert.equal(reads, 1);
    assert.equal(root.hidden, false);
    descendants(root, 'button')[1].click();
    assert.equal(root.hidden, true);
    assert.equal(reason, 'skipped');
    assert.equal(reads, 1);
  } finally {
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else delete globalThis.localStorage;
    if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument);
    else delete globalThis.document;
  }
});

test('default browser storage persists; instances have independent progression', async () => {
  const { createOnboarding, ONBOARDING_STORAGE_KEY } = await import('./Onboarding.mjs');
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = memoryStorage();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    const document = syntheticDocument();
    const first = createOnboarding({ document });
    const second = createOnboarding({ document, storage: null });
    descendants(first, 'button')[0].click();
    assert.equal(descendants(second, 'h2')[0].textContent, 'Hjem');
    descendants(first, 'button')[1].click();
    assert.equal(storage.getItem(ONBOARDING_STORAGE_KEY), '1');
    assert.equal(createOnboarding({ document }).hidden, true);
    assert.equal(second.hidden, false);
  } finally {
    if (prior) Object.defineProperty(globalThis, 'localStorage', prior);
    else delete globalThis.localStorage;
  }
});

test('completion is terminal before a callback re-enters the component', async () => {
  const { createOnboarding } = await import('./Onboarding.mjs');
  let calls = 0;
  let buttons;
  const storage = memoryStorage();
  const root = createOnboarding({ document: syntheticDocument(), storage, onComplete() {
    calls++;
    assert.equal(root.hidden, true);
    buttons[0].click(); buttons[1].click();
  } });
  buttons = descendants(root, 'button');
  buttons[1].click();
  assert.equal(calls, 1);
  assert.equal(storage.writes.length, 1);
});
