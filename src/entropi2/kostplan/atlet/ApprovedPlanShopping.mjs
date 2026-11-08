import { createElement as h, useLayoutEffect, useMemo, useState } from 'react'
import { createApprovedShopping } from './approvedShoppingController.mjs'
import { upcomingDates } from './upcomingPlanModel.mjs'
import { grossLabel, shoppingNumber, shoppingItemText, maxShoppingText } from './approvedShoppingModel.mjs'

const control = { minHeight: 44, font: 'inherit', maxWidth: '100%', whiteSpace: 'normal' }
const currentDayMatches = scope => {
  try { return !scope.currentDay || scope.currentDay() === scope.today } catch { return false }
}

export default function ApprovedPlanShopping(props) {
  if (props.enabled !== true || props.readOnly === true) return null
  return h(ShoppingSession, props)
}

function ShoppingSession({ athleteId, today, client, currentDay, clipboard, storage }) {
  const scope = useMemo(() => ({ athleteId, today, client, currentDay, storage }), [athleteId, today, client, currentDay, storage])
  const [record, setRecord] = useState(null)
  useLayoutEffect(() => {
    let active = true, controller
    try {
      controller = createApprovedShopping({ enabled: true, athleteId, today, client, storage,
        isCurrent: () => active && currentDayMatches(scope) })
    } catch { setRecord({ scope, controller: null }); return undefined }
    const update = () => setRecord({ scope, controller, snapshot: controller.snapshot() })
    const unsubscribe = controller.subscribe(update)
    update(); void controller.load()
    return () => { active = false; unsubscribe(); controller.dispose() }
  }, [scope, athleteId, today, client, storage])
  const matches = record?.scope === scope && currentDayMatches(scope)
  const controller = matches ? record.controller : null, s = controller ? record.snapshot : null
  const dates = upcomingDates(today)
  return h('section', { 'aria-label': 'Indkøb fra kostplanen', style: { padding: 16, width: '100%', maxWidth: '42rem', boxSizing: 'border-box', overflowWrap: 'anywhere' } },
    h('h2', null, 'Indkøb fra kostplanen'),
    h('p', null, grossLabel),
    h('p', null, 'Vælg kalenderdage. Alle godkendte måltider og portioner for hver valgt dag tælles med. Mængderne gælder den angivne tilberedning; der omregnes ikke til råvarer.'),
    h('fieldset', null, h('legend', null, 'Dage til indkøb'),
      ...dates.map(date => h('label', { key: date, style: { display: 'block', minHeight: 44 } },
        h('input', { type: 'checkbox', 'aria-label': `Indkøb ${date}`, checked: s?.dates.includes(date) ?? false,
          disabled: !controller,
          onChange: event => {
            const before = controller?.snapshot().dates ?? []
            const selected = event.currentTarget.checked ? [...new Set([...before, date])] : before.filter(d => d !== date)
            void controller?.choose(selected)
          } }), date))),
    !s && h('p', { role: 'status' }, 'Indkøbsgrundlaget er ikke tilgængeligt for den aktuelle atlet og dag.'),
    s && h('div', { 'aria-live': 'polite', 'data-shopping-complete': String(s.complete) },
      h('p', null, `Valgte datoer: ${s.dates.join(', ') || 'ingen'}.`),
      s.phase === 'loading' && h('p', { role: 'status' }, 'Henter godkendte planer… Listen er ufuldstændig.'),
      s.phase === 'empty-selection' && h('p', null, 'Vælg mindst én dag.'),
      s.affected.length > 0 && h('div', { role: s.phase === 'loading' ? 'status' : 'alert' },
        h('p', null, 'Listen er ufuldstændig. Berørte datoer:'),
        h('ul', null, ...s.affected.map(d => h('li', { key: d.date }, `${d.date}: ${d.reason}.`)))),
      h('button', { type: 'button', style: control, onClick: () => controller.load() }, 'Hent indkøbsgrundlag igen'),
      s.complete && h('div', null,
        h('p', null, 'Alle valgte datoer er læst fra godkendte versioner. Listen angiver grambehov, ikke dokumenteret næringsdækning.'),
        h('details', null,
          h('summary', { style: { ...control, cursor: 'pointer' } }, 'Dage, versioner og måltider'),
          ...s.result.days.map(d => h('p', { key: d.date },
            `${d.date}: version ${d.versionNumber} (${d.versionId}), gældende fra ${d.effectiveFrom}. Måltider: ${d.mealNames.join(', ')}.`))),
        h('p', null, 'Købt-markeringer er kun lokale i denne browser på denne enhed. De registrerer ikke spist mad, bekræfter ikke lager, reducerer ikke grambehov og synkroniseres ikke til coachen.'),
        h('p', { role: 'status' }, s.purchases.persistent
          ? 'Markeringer gemmes lokalt ved ændring. Kopiering medtager altid hele bruttolisten.'
          : 'Lokal lagring er ikke tilgængelig eller kunne ikke bekræftes. Markeringer gælder kun i denne åbne visning. Kopiering medtager altid hele bruttolisten.'),
        h('p', { role: 'status' }, `Mangler at købe: ${s.result.items.length - s.purchases.bought.length} af ${s.result.items.length} varer.`),
        h('ul', { 'aria-label': 'Samlet bruttobehov' }, ...s.result.items.map((item, index) => {
          const checked = s.purchases.bought.includes(index)
          return h('li', { key: item.key, style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBlock: 8 } },
            h('button', { type: 'button', role: 'checkbox', 'aria-checked': checked,
              'aria-label': `Købt: ${shoppingItemText(item)}`, style: { ...control, minWidth: 44 },
              onClick: () => controller.markBought(index, !checked, s.result) }, checked ? '☑ Købt' : '☐ Ikke købt'),
            h('div', { style: { flex: '1 1 16rem', minWidth: 0, maxWidth: '100%' } },
              h('span', null, `${item.names.join(' / ')}: ${shoppingNumber(item.grams)} g. Tilberedning: ${item.preparation}.`),
              h('details', null,
                h('summary', { 'aria-label': `Kilde og varegrundlag: ${shoppingItemText(item)}`,
                  style: { ...control, cursor: 'pointer' } }, 'Kilde og varegrundlag'),
                h('p', null, shoppingItemText(item)))))
        })),
        h('button', { type: 'button', style: control, disabled: s.copyPending, onClick: () => controller.copy(clipboard, s.result) }, 'Kopiér indkøbsliste'),
        h('button', { type: 'button', style: control, disabled: s.copyPending,
          onClick: () => controller.copyCompact(clipboard, s.result) }, 'Kopiér kort indkøbsliste'),
        h('p', null, 'Den korte liste indeholder datoer, varer, gram og tilberedning. Kopiér indkøbsliste ovenfor medtager også alle kilder og godkendte versioner.'),
        s.compactCopyStatus === 'pending' && h('p', { role: 'status' }, 'Kopierer kort indkøbsliste…'),
        s.compactCopyStatus === 'copied' && h('p', { role: 'status' }, 'Kort indkøbsliste kopieret.'),
        s.compactCopyStatus === 'failed' && h('div', null,
          h('p', { role: 'alert' }, 'Kopiering af den korte liste kunne ikke bekræftes. Markér og kopiér den korte tekst nedenfor.'),
          h('label', null, 'Kort indkøbsliste til manuel kopiering',
            h('textarea', { readOnly: true, value: s.compactCopyText, rows: 8, maxLength: maxShoppingText,
              onFocus: event => event.currentTarget.select?.(),
              style: { width: '100%', maxHeight: '16rem', boxSizing: 'border-box' } }))),
        s.copyStatus === 'pending' && h('p', { role: 'status' }, 'Kopierer…'),
        s.copyStatus === 'copied' && h('p', { role: 'status' }, 'Kopieret.'),
        s.copyStatus === 'failed' && h('div', null,
          h('p', { role: 'alert' }, 'Kopiering kunne ikke bekræftes. Prøv igen, eller markér og kopiér teksten nedenfor.'),
          h('label', null, 'Indkøbsliste til manuel kopiering',
            h('textarea', { readOnly: true, value: s.copyText, rows: 8, maxLength: maxShoppingText,
              onFocus: event => event.currentTarget.select?.(),
              style: { width: '100%', maxHeight: '16rem', boxSizing: 'border-box' } }))))))
}
