import { ingredientKey } from '../indkoeb/ingredients.mjs'
import { formatShoppingSnapshot, shoppingIncompleteWarning } from '../indkoeb/export.mjs'
import { printShoppingList } from '../indkoeb/print.mjs'
import { createElement as h, useLayoutEffect, useMemo, useReducer, useState } from 'react'
import { createWeekPlan } from './model.mjs'

const number = value => new Intl.NumberFormat('da-DK', { maximumSignificantDigits: 12 }).format(value)
const buttonStyle = { minHeight: 44, maxWidth: '100%', whiteSpace: 'normal' }
const alwaysCurrent = () => true

function metricText(value, target, unit) {
  return `${number(value)} ${unit}${target === null ? '' : ` / ${number(target)} ${unit}`}`
}

// Memoize an immutable API; only effects and events change its private state.
// The scope includes model identity even when two owners export identical text.
function createExportLifetime(scope, isCurrent = alwaysCurrent) {
  let active = false, pending = false
  const isActive = () => active && isCurrent()
  return Object.freeze({
    scope: Object.freeze(scope),
    activate() {
      active = true
      return () => { active = false }
    },
    begin() {
      if (!isActive() || pending) return false
      pending = true
      return true
    },
    isActive,
    finish() { pending = false },
  })
}

function ShoppingExport({ snapshot, context, clipboard, isCurrent }) {
  const text = formatShoppingSnapshot(snapshot)
  const lifetime = useMemo(() => createExportLifetime({ context, text, clipboard }, isCurrent), [context, text, clipboard, isCurrent])
  const [result, setResult] = useState(null)
  useLayoutEffect(() => lifetime.activate(), [lifetime])
  const status = result?.lifetime === lifetime ? result.status : ''
  const copy = async () => {
    if (!lifetime.begin()) return
    setResult({ lifetime, status: 'pending' })
    try {
      // Resolve the browser adapter only inside this explicit user action.
      // An injected null deliberately represents an unavailable clipboard.
      const adapter = lifetime.scope.clipboard === undefined ? globalThis.navigator?.clipboard : lifetime.scope.clipboard
      if (typeof adapter?.writeText !== 'function') throw new Error('Clipboard unavailable')
      await adapter.writeText(lifetime.scope.text)
      if (lifetime.isActive()) setResult({ lifetime, status: 'copied' })
    } catch {
      if (lifetime.isActive()) setResult({ lifetime, status: 'failed' })
    } finally {
      lifetime.finish()
    }
    // A write already requested by the user cannot be undone by unmounting.
    // Cleanup only invalidates callbacks and acknowledgement in the old view.
  }
  const print = () => {
    if (!lifetime.isActive()) return
    const { shopping, week } = snapshot
    const ok = !shopping.error && printShoppingList({ title: 'Ugens indkøbsliste',
      subtitle: [`Ugen fra ${week}.`, shoppingIncompleteWarning(shopping)].filter(Boolean).join(' '),
      items: shopping.items.filter(item => item.netPurchase > 0)
        .map(item => ({ name: item.name, text: `${item.name}: ${number(item.netPurchase)} ${item.unit}` })) })
    setResult({ lifetime, status: ok ? 'printed' : 'print-failed' })
  }
  return h('div', null,
    h('button', { type: 'button', style: buttonStyle, onClick: print }, 'Print indkøbsliste'),
    status === 'print-failed' && h('p', { role: 'alert' }, 'Listen kunne ikke åbnes til print. Brug Kopiér indkøbsliste i stedet.'),
    h('button', { type: 'button', style: buttonStyle, onClick: copy, disabled: status === 'pending' }, 'Kopiér indkøbsliste'),
    status === 'pending' && h('p', { role: 'status' }, 'Kopierer…'),
    status === 'copied' && h('p', { role: 'status' }, 'Kopieret.'),
    status === 'failed' && h('div', null,
      h('p', { role: 'alert' }, 'Kopiering kunne ikke bekræftes. Prøv igen, eller markér og kopiér teksten nedenfor.'),
      h('label', null, 'Indkøbsliste til manuel kopiering',
        h('textarea', { readOnly: true, value: text, rows: 8,
          style: { width: '100%', boxSizing: 'border-box' } }))))
}

// Controlled real React view, also usable by another assembly/controller.
export function UgeplanView(props = {}) {
  if (props.enabled !== true) return null
  const { snapshot, onAdd, onRemove, onSetPortions, onConfirmStock, onRetry, embedded } = props
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
            onClick: () => onRemove?.(index, slot) }, 'Fjern'),
          h('form', { key: `${entry.templateId}:${entry.portions}`, onSubmit: event => {
            event.preventDefault(); onSetPortions?.(index, slot, event.currentTarget.elements.portions.value)
          } },
          h('label', null, 'Portioner', h('input', { name: 'portions', defaultValue: entry.portions,
            inputMode: 'decimal', required: true, disabled: readFailed,
            'aria-label': `Portioner af ${entry.name} på ${day.name}, måltid ${slot + 1}` })),
          h('button', { type: 'submit', style: buttonStyle, disabled: readFailed }, 'Gem portioner'))))),
      templates.length > 0 && h('label', null, `Tilføj måltid til ${day.name}`,
        h('select', { value: '', style: { ...buttonStyle, width: '100%' },
          'data-focus': `week-plan-add-${index}`,
          disabled: readFailed || templates.length === 0 || day.entries.length >= 20,
          onChange: event => { if (event.currentTarget.value) onAdd?.(index, event.currentTarget.value) } },
        h('option', { value: '' }, 'Vælg egen skabelon'),
        ...templates.map(template => h('option', { key: template.id, value: template.id }, template.name)))),
      day.entries.length >= 20 && h('p', null, 'Der er plads til 20 måltider pr. dag. Fjern et for at tilføje et nyt.'))]),
    (hasEntries || shopping.error) && h('details', null,
      h('summary', { style: buttonStyle }, `Ugens indkøbsliste${shopping.missingMeals.length + shopping.unavailableCount > 0 ? ' · ufuldstændig' : ''}`),
      h('p', null, 'Hver forekomst og dens portioner tælles med. Kun g/kg samles; rå/kogt, ml/g og styk holdes adskilt. Beholdning fratrækkes kun efter din bekræftelse og forbruges ikke ved læsning.'),
      h(ShoppingExport, { snapshot, context: props.exportContext, clipboard: props.clipboard, isCurrent: props.isCurrent }),
      shopping.error ? h('p', { role: 'alert' }, shopping.error) : h('div', null,
        shopping.missingMeals.length + shopping.unavailableCount > 0 && h('p', { role: 'status' },
          shoppingIncompleteWarning(shopping)),
        h('ul', null, ...shopping.items.map(item => h('li', { key: ingredientKey(item) },
          h('p', null, `${item.name}: ${number(item.quantity)} ${item.unit} (samlet behov). `,
            `Bekræftet beholdning: ${item.confirmedStock === null ? 'ikke angivet' : `${number(item.confirmedStock)} ${item.unit}`}. `,
            `Nettokøb: ${number(item.netPurchase)} ${item.unit}.`),
          h('p', null, `Tilberedning: ${item.preparation ?? 'ukendt'}. `,
            `Kilde: ${typeof item.source === 'string' ? item.source : item.source ? `${item.source.citation} (${item.source.verification})` : 'ukendt'}. `,
            item.foodId ? `Fødevare-id: ${item.foodId}.` : 'Fødevare-id ikke angivet.'),
          h('form', { key: String(item.confirmedStock), onSubmit: event => {
            event.preventDefault(); onConfirmStock?.(ingredientKey(item), event.currentTarget.elements.stock.value)
          } },
          h('label', null, `Beholdning af ${item.name} (${item.preparation ?? 'ukendt tilberedning'}) i ${item.unit}`,
            h('input', { name: 'stock', inputMode: 'decimal', defaultValue: item.confirmedStock ?? '', required: true, disabled: readFailed })),
          h('button', { type: 'submit', style: buttonStyle, disabled: readFailed }, 'Bekræft beholdning'))))))))

}

function UgeplanSession({ athleteId, date, templates, targets, storage, embedded, clipboard, isCurrent }) {
  const [, refresh] = useReducer(value => value + 1, 0)
  const [attempt, retry] = useReducer(value => value + 1, 0)
  const model = useMemo(() => {
    try { return createWeekPlan({ enabled: true, athleteId, date, templates, targets, storage }) }
    catch { return null }
  }, [athleteId, date, templates, targets, storage, attempt])
  // Also retire callbacks on model/owner/day changes in a directly mounted view.
  // The imperative island revokes isCurrent synchronously, before React cleanup.
  const lifetime = useMemo(() => createExportLifetime({ model }, isCurrent), [model, isCurrent])
  useLayoutEffect(() => lifetime.activate(), [lifetime])
  return h(UgeplanView, { enabled: true, embedded, clipboard, exportContext: model, isCurrent: lifetime.isActive,
    snapshot: model?.snapshot(), onRetry: () => { if (lifetime.isActive()) retry() },
    onSetPortions: (day, slot, value) => { if (lifetime.isActive()) { model.setPortions(day, slot, value); refresh() } },
    onConfirmStock: (key, value) => { if (lifetime.isActive()) { model.confirmStock(key, value); refresh() } },
    onAdd: (day, id) => { if (lifetime.isActive()) { model.add(day, id); refresh() } },
    onRemove: (day, slot) => { if (lifetime.isActive()) { model.remove(day, slot); refresh() } } })
}

// The nutrition screen supplies current-athlete inputs behind its strict gate.
// Still usable independently; no browser globals or persistence effects on mount.
export function Ugeplan(props = {}) {
  if (props.enabled !== true) return null
  if (props.templateError) return h('div', null,
    h('p', { role: 'alert' }, 'Ugeplanen kunne ikke åbnes. Egne skabeloner kunne ikke læses.'),
    props.onRetry && h('button', { type: 'button', style: buttonStyle,
      onClick: props.isCurrent ? () => { if (props.isCurrent()) props.onRetry() } : props.onRetry }, 'Hent skabeloner igen'))
  return h(UgeplanSession, props)
}
