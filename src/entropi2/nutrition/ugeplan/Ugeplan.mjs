import { createElement as h, useMemo, useReducer } from 'react'
import { createWeekPlan } from './model.mjs'

const number = value => new Intl.NumberFormat('da-DK', { maximumSignificantDigits: 12 }).format(value)
const buttonStyle = { minHeight: 44, maxWidth: '100%', whiteSpace: 'normal' }

function metricText(value, target, unit) {
  return `${number(value)} ${unit}${target === null ? '' : ` / ${number(target)} ${unit}`}`
}

// Controlled real React view, also usable by another assembly/controller.
export function UgeplanView(props = {}) {
  if (props.enabled !== true) return null
  const { snapshot, onAdd, onRemove, onRetry, embedded } = props
  if (!snapshot) return h('p', { role: 'alert' }, 'Ugeplanen kunne ikke åbnes. Tjek dato og egne skabeloner.')
  const { days, shopping, error, readFailed, saved, templates, week } = snapshot
  const hasEntries = days.some(day => day.entries.length > 0)
  return h('section', { className: 'e2-week-plan', 'aria-label': 'Ugeplan fra egne måltidsskabeloner', style: { maxWidth: '42rem', overflowWrap: 'anywhere' } },
    !embedded && h('h2', null, 'Ugeplan'),
    h('p', null, `Ugen fra ${week}. Planlagte måltider – ingen måltider bliver logget.`),
    saved && h('p', { role: 'status', 'aria-live': 'polite' }, 'Lokal kladde. Gemt på denne enhed.'),
    error && h('p', { role: 'alert' }, error),
    readFailed && onRetry && h('button', { type: 'button', style: buttonStyle, onClick: onRetry }, 'Prøv at læse ugekladden igen'),
    !readFailed && !hasEntries && templates.length === 0 && h('p', null,
      'Notér dine måltider i dagbogen. Måltider, der går igen, kan gemmes som egne skabeloner under Log hurtigt og bruges her.'),
    ...days.flatMap((day, index) => templates.length === 0 && day.entries.length === 0 ? [] : [h('section', { key: day.date, 'aria-label': `${day.name} ${day.date}` },
      h('h3', null, `${day.name} · ${day.date}`),
      day.entries.length > 0 && day.totals.kcal !== null && h('p', null, metricText(day.totals.kcal, day.targets.kcal, 'kcal')),
      day.entries.length > 0 && day.totals.protein !== null && h('p', null, metricText(day.totals.protein, day.targets.protein, 'g protein')),
      day.entries.length > 0 && h('ul', null,
        ...day.entries.map((entry, slot) => h('li', { key: slot },
          entry.name,
          h('button', { type: 'button', style: buttonStyle, disabled: readFailed,
            'data-focus': `week-plan-remove-${index}-${slot}`,
            'aria-label': `Fjern ${entry.name} fra ${day.name}, måltid ${slot + 1}`,
            onClick: () => onRemove?.(index, slot) }, 'Fjern')))),
      templates.length > 0 && h('label', null, `Tilføj måltid til ${day.name}`,
        h('select', { value: '', style: { ...buttonStyle, width: '100%' },
          'data-focus': `week-plan-add-${index}`,
          disabled: readFailed || templates.length === 0 || day.entries.length >= 20,
          onChange: event => { if (event.currentTarget.value) onAdd?.(index, event.currentTarget.value) } },
        h('option', { value: '' }, 'Vælg egen skabelon'),
        ...templates.map(template => h('option', { key: template.id, value: template.id }, template.name)))),
      day.entries.length >= 20 && h('p', null, 'Der er plads til 20 måltider pr. dag. Fjern et for at tilføje et nyt.'))]),
    (shopping.items.length > 0 || shopping.error) && h('details', null,
      h('summary', { style: buttonStyle }, 'Ugens indkøbsliste'),
      h('p', null, 'Hver planlagt portion tælles med. Kun ingredienser fra dine egne skabeloner.'),
      shopping.error ? h('p', { role: 'alert' }, shopping.error) : h('div', null,
        shopping.missingMeals.length + shopping.unavailableCount > 0 && h('p', { role: 'status' },
          `Listen er ufuldstændig: ${shopping.missingMeals.length + shopping.unavailableCount} måltider mangler ingredienser eller skabelon.`),
        h('ul', null, ...shopping.items.map((item, index) => h('li', { key: index },
          `${item.name}: ${number(item.quantity)} ${item.unit}`))))))
}

function UgeplanSession({ athleteId, date, templates, targets, storage, embedded }) {
  const [, refresh] = useReducer(value => value + 1, 0)
  const [attempt, retry] = useReducer(value => value + 1, 0)
  const model = useMemo(() => {
    try { return createWeekPlan({ enabled: true, athleteId, date, templates, targets, storage }) }
    catch { return null }
  }, [athleteId, date, templates, targets, storage, attempt])
  return h(UgeplanView, { enabled: true, embedded, snapshot: model?.snapshot(), onRetry: retry,
    onAdd: (day, id) => { model.add(day, id); refresh() },
    onRemove: (day, slot) => { model.remove(day, slot); refresh() } })
}

// The nutrition screen supplies current-athlete inputs behind its strict gate.
// Still usable independently; no browser globals or persistence effects on mount.
export function Ugeplan(props = {}) {
  if (props.enabled !== true) return null
  if (props.templateError) return h('div', null,
    h('p', { role: 'alert' }, 'Ugeplanen kunne ikke åbnes. Egne skabeloner kunne ikke læses.'),
    props.onRetry && h('button', { type: 'button', style: buttonStyle, onClick: props.onRetry }, 'Hent skabeloner igen'))
  return h(UgeplanSession, props)
}
