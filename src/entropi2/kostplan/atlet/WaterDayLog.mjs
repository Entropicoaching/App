import * as React from 'react'
const { useLayoutEffect, useMemo, useRef, useState } = React
import { createWaterDayLog, waterLimits, waterQuantity } from './waterDayLogModel.mjs'

const control = { minHeight: 44, minWidth: 44, font: 'inherit', maxWidth: '100%', boxSizing: 'border-box' }
const time = new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' })

export default function WaterDayLog({ enabled = false, athleteId, date, client, currentDay, storage, gateRef }) {
  const scope = useMemo(() => ({ enabled, athleteId, date, client, currentDay, storage, gateRef }),
    [enabled, athleteId, date, client, currentDay, storage, gateRef])
  const live = useRef(null)
  const [record, setRecord] = useState(null)
  const [quantity, setQuantity] = useState('')
  const [error, setError] = useState('')
  const [edit, setEdit] = useState(null)
  const pendingEdit = useRef(null)
  useLayoutEffect(() => {
    let active = true
    live.current = scope
    if (gateRef) gateRef.current = enabled === true ? { athleteId, date, client, preview: false } : null
    const controller = createWaterDayLog({ enabled, athleteId, date, storage, currentDay,
      isCurrent: () => active && live.current === scope && (!gateRef ||
        (gateRef.current?.athleteId === athleteId && gateRef.current.date === date
          && gateRef.current.client === client && gateRef.current.preview === false)) })
    setRecord(controller ? { scope, controller, snapshot: controller.snapshot() } : null)
    setQuantity(''); setError(''); setEdit(null); pendingEdit.current = null
    return () => {
      active = false
      pendingEdit.current = null
      if (live.current === scope) live.current = null
      if (gateRef) gateRef.current = null
      controller?.dispose()
    }
  }, [scope, enabled, athleteId, date, client, storage, currentDay, gateRef])
  const matches = enabled === true && record?.scope === scope
  const controller = matches ? record.controller : null, s = matches ? record.snapshot : null
  if (enabled !== true) return null
  const update = action => {
    if (live.current !== scope || !controller?.isCurrent()) return false
    const changed = action(), snapshot = controller.snapshot()
    setRecord({ scope, controller, snapshot })
    setError(changed ? '' : snapshot.status === 'conflict'
      ? 'Registreringen er ændret eller fjernet i den lokale lagring. Rettelsen er ikke gemt. Genåbn visningen for at læse den aktuelle log.'
      : snapshot.status === 'unconfirmed'
        ? 'Rettelsen kunne ikke bekræftes. Dit udkast er bevaret. Prøv Gem rettelse igen eller vælg Annuller.'
        : 'Registreringen kunne ikke ændres. Kontrollér mængden og at du stadig viser i dag.')
    return changed
  }
  const editing = edit?.scope === scope && edit.controller === controller ? edit : null
  return React.createElement('details', { style: { padding: 16, overflowWrap: 'anywhere' } },
    React.createElement('summary', { style: { ...control, cursor: 'pointer', padding: 12 } }, 'Væske i dag'),
    React.createElement('p', null, 'Registrér kun vand, du har drukket. Portionerne er mængdevalg.'),
    React.createElement('p', null, 'Kun lokal lagring på denne enhed. Deles ikke med din coach.'),
    !s && React.createElement('p', { role: 'status' }, 'Væskeloggen er kun tilgængelig for den aktuelle atlet og i dag.'),
    s && React.createElement('div', null,
      React.createElement('p', { role: 'status', 'aria-live': 'polite' }, s.entries.length ? `Registreret vand i dag: ${s.totalMl} ml.` : 'Intet vand registreret i dag.'),
      React.createElement('label', null, 'Drukket vand (ml)',
        React.createElement('input', { type: 'number', inputMode: 'numeric', min: 1, max: waterLimits.ml, step: 1,
          'aria-label': 'Drukket vand i milliliter', style: control, value: quantity,
          onChange: event => { if (live.current === scope) { setQuantity(event.currentTarget.value); setError('') } } })),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBlock: 8 } },
        ...[250, 500].map(ml => React.createElement('button', { key: ml, type: 'button', style: control,
          'aria-label': `Vælg portion på ${ml} ml vand`,
          onClick: () => { if (live.current === scope) { setQuantity(String(ml)); setError('') } } }, `${ml} ml portion`)),
        React.createElement('button', { type: 'button', style: control, disabled: waterQuantity(quantity) === null || s.entries.length >= waterLimits.entries,
          onClick: () => update(() => {
            const added = controller.add(quantity)
            if (added) setQuantity('')
            return added
          }) }, 'Tilføj drukket vand')),
      React.createElement('p', null, `Registrér hele ml fra 1 til ${waterLimits.ml} pr. post, højst ${waterLimits.entries} poster pr. dag (tekniske grænser).`),
      s.entries.length > 0 && React.createElement('ul', { 'aria-label': 'Registreringer af drukket vand' },
        ...s.entries.map(entry => React.createElement('li', { key: entry.id },
          React.createElement('span', null, `${entry.ml} ml · ${time.format(new Date(entry.at))}`),
          React.createElement('button', { type: 'button', style: control,
            'aria-label': `Ret mængde for vandregistrering ${entry.id}: ${entry.ml} ml klokken ${time.format(new Date(entry.at))}`,
            onClick: () => {
              if (live.current !== scope || !controller?.isCurrent() || !controller.snapshot().entries.includes(entry)) return
              const draft = { scope, controller, entry, value: String(entry.ml) }
              pendingEdit.current = draft; setEdit(draft); setError('')
            } }, 'Ret mængde'),
          React.createElement('button', { type: 'button', style: control,
            'aria-label': `Fjern vandregistrering ${entry.id}: ${entry.ml} ml klokken ${time.format(new Date(entry.at))}`,
            onClick: () => {
              if (update(() => controller.remove(entry.id)) && pendingEdit.current?.entry.id === entry.id) {
                pendingEdit.current = null; setEdit(null)
              }
            } }, 'Fjern registrering'),
          editing?.entry === entry && React.createElement('div', { role: 'group', 'aria-label': `Ret mængde for vandregistrering ${entry.id}` },
            React.createElement('label', null, 'Ret mængde (ml)',
              React.createElement('input', { type: 'number', inputMode: 'numeric', min: 1, max: waterLimits.ml, step: 1,
                'aria-label': `Ret vandmængde i milliliter for registrering ${entry.id}`, style: control, value: editing.value,
                onChange: event => {
                  if (live.current !== scope || !controller?.isCurrent() || pendingEdit.current !== editing) return
                  const draft = { ...editing, value: event.currentTarget.value }
                  pendingEdit.current = draft; setEdit(draft); setError('')
                } })),
            waterQuantity(editing.value) === null && React.createElement('p', { role: 'status' }, `Angiv hele ml fra 1 til ${waterLimits.ml}.`),
            React.createElement('button', { type: 'button', style: control, disabled: waterQuantity(editing.value) === null,
              onClick: () => {
                if (pendingEdit.current !== editing) return
                if (update(() => controller.update(editing.entry, editing.value))) { pendingEdit.current = null; setEdit(null) }
              } }, 'Gem rettelse'),
            React.createElement('button', { type: 'button', style: control,
              onClick: () => {
                if (live.current !== scope || !controller?.isCurrent() || pendingEdit.current !== editing) return
                pendingEdit.current = null; setEdit(null); setError('')
              } }, 'Annuller'))))),
      React.createElement('p', { role: 'status' }, s.status === 'saved' ? 'Gemt på denne enhed. Deles ikke med din coach.'
        : s.status === 'ready' ? 'Ændringer gemmes kun på denne enhed, når du tilføjer, retter eller fjerner en registrering.'
          : s.status === 'unreadable' ? 'Lokal lagring kunne ikke læses sikkert. Nye ændringer vises kun her, indtil visningen lukkes; tidligere data overskrives ikke.'
            : 'Lagringen kunne ikke bekræftes. Listen vises kun her, indtil visningen lukkes; genåbning kan vise andre registreringer.')),
    error && React.createElement('p', { role: 'alert' }, error))
}
