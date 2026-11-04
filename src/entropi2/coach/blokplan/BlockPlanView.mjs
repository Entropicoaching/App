import { createElement as h } from 'react'
import { suggestBlock, editBlockPlan } from './blockPlan.mjs'

const control = { minHeight: 44, maxWidth: '100%', boxSizing: 'border-box' }

// Parent owns local edits and must opt in explicitly; this view never saves.
export default function BlockPlanView(props) {
  if (props.enabled !== true) return null
  const model = suggestBlock(props.snapshot, props.today, { weekCount: props.weekCount, edits: props.edits })
  if (model.state === 'unknown') return h('section', { 'aria-label': 'Næste blok' },
    !props.embedded && h('h2', null, 'Forslag til næste blok'), h('p', { role: 'status' }, model.message))
  const editable = typeof props.onChange === 'function'
  const change = patch => props.onChange(editBlockPlan(props.edits ?? {}, patch))
  return h('section', { 'aria-label': 'Næste blok', style: { maxWidth: '100%', minWidth: 0, lineHeight: 1.6 } },
    !props.embedded && h('h2', null, 'Forslag til næste blok'), h('p', null, model.message),
    h('p', null, `Grundlag: ${model.sourceBlock.start} – ${model.sourceBlock.end}.`),
    h('ul', null, ...model.reasons.map(s => h('li', { key: s }, s))),
    model.omittedLifts.length > 0 && h('p', null, `Intet forslag uden registrerede sæt: ${model.omittedLifts.join(', ')}.`),
    !editable && h('p', null, 'Forhåndsvisning. Rettelser kræver en lokal onChange-adapter.'),
    model.errors.length > 0 && h('div', { role: 'alert' }, h('p', null, 'Udkastet har ugyldige rettelser:'),
      h('ul', null, ...model.errors.map((s, i) => h('li', { key: i }, s)))),
    ...model.weeks.map(w => h('fieldset', { key: w.week, style: { minWidth: 0, marginBlock: 16 } },
      h('legend', null, `Uge ${w.week}`),
      h('label', { style: { display: 'block', ...control } }, h('input', {
        type: 'checkbox', checked: props.edits?.[w.week]?.deload ?? w.deload, disabled: !editable,
        onChange: e => change({ week: w.week, field: 'deload', value: e.target.checked }) }), ' Deload'),
      ...w.lifts.map(l => h('div', { key: l.lift, style: { display: 'flex', flexWrap: 'wrap', gap: 16, marginBlock: 12 } },
        ...[['sets', 'Sæt', 0, 100, 1], ['targetRpe', 'Mål-RPE', 1, 9.5, 0.5]].map(([field, label, min, max, step]) =>
          h('label', { key: field }, `${l.lift} · ${label} · uge ${w.week} `,
            h('input', { type: 'number', min, max, step, style: control, disabled: !editable,
              value: props.edits?.[w.week]?.lifts?.[l.lift]?.[field] ?? l[field],
              onChange: e => change({ week: w.week, lift: l.lift, field,
                value: e.target.value === '' ? '' : Number(e.target.value) }) }))))))))
}
