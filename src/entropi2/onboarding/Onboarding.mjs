export const ONBOARDING_STORAGE_KEY = 'entropi2:onboarding:v1';

const steps = [
  { title: 'Hjem', text: 'På Hjem får du overblik over din dag og dit næste skridt.' },
  { title: 'Pas', text: 'Under Pas finder du din træning. Tag én øvelse og ét sæt ad gangen.' },
  { title: 'Kost', text: 'Under Kost kan du følge dine kostmål og registrere dine måltider.' },
];

/**
 * Creates a detached, framework-free introduction. The caller owns mounting it.
 * No app wiring or storage access occurs on import. Pass storage: null to opt out
 * of persistence. Completion (including skip) is remembered per browser profile,
 * not per athlete. onComplete('completed' | 'skipped') runs only after a user action;
 * the caller should restore focus to its own screen when the introduction hides.
 */
export function createOnboarding(options = {}) {
  const document = options.document ?? globalThis.document;
  const root = document.createElement('section');
  root.setAttribute('aria-label', 'Introduktion');
  let storage;
  let finished = false;
  let index = 0;
  try {
    storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    finished = storage?.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    // Storage can be unavailable, denied or full. The introduction still works.
  }
  root.hidden = finished;
  if (finished) return root;

  const progress = document.createElement('p');
  progress.setAttribute('aria-live', 'polite');
  progress.setAttribute('aria-atomic', 'true');
  const heading = document.createElement('h2');
  heading.setAttribute('tabindex', '-1');
  const description = document.createElement('p');
  const next = document.createElement('button');
  const skip = document.createElement('button');
  next.type = skip.type = 'button';
  skip.textContent = 'Spring over';
  root.append(progress, heading, description, next, skip);

  function render() {
    progress.textContent = `Trin ${index + 1} af ${steps.length}`;
    heading.textContent = steps[index].title;
    description.textContent = steps[index].text;
    next.textContent = index === steps.length - 1 ? 'Kom i gang' : 'Næste';
  }

  function finish(reason) {
    if (finished) return;
    finished = true;
    root.hidden = true;
    next.disabled = skip.disabled = true;
    try { storage?.setItem(ONBOARDING_STORAGE_KEY, '1'); } catch {
      // Keep the current visit completed even when it cannot be remembered.
    }
    options.onComplete?.(reason);
  }

  next.addEventListener('click', () => {
    if (finished) return;
    if (index === steps.length - 1) finish('completed');
    else {
      index++;
      render();
      heading.focus();
    }
  });
  skip.addEventListener('click', () => finish('skipped'));
  render();
  return root;
}
