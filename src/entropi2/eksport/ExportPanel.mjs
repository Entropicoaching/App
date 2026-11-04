import { createElement as h, useEffect, useRef, useState } from 'react'
import { loadAthleteExport } from './loadAthleteExport.mjs'
import { createAthleteExportFiles, buildAthleteExport } from './athleteExport.mjs'
import { downloadAthleteExport } from './downloadExport.mjs'
import { profileStyles as s } from '../profile/profileStyles.mjs'

export function ExportPanel({ enabled = false, client, getScope }) {
  const [state, setState] = useState({ status: 'idle' })
  const busy = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  if (enabled !== true) return null
  async function prepare() {
    if (busy.current || !alive.current) return
    busy.current = true; setState({ status: 'loading' })
    try {
      const input = await loadAthleteExport({ client, getScope })
      const data = buildAthleteExport(input)
      const files = [...createAthleteExportFiles(input, 'json'), ...createAthleteExportFiles(input, 'csv')]
      if (alive.current) setState({ status: 'ready', files, athleteId: input.athleteId,
        ownerId: input.ownerId, empty: Object.values(data.datasets).every(rows => rows.length === 0) })
    } catch {
      if (alive.current) setState({ status: 'error' })
    } finally { busy.current = false }
  }
  function download(file) {
    const scope = getScope()
    if (!alive.current || scope.enabled !== true || scope.athleteId !== state.athleteId ||
        scope.ownerId !== state.ownerId || scope.athleteUserId !== scope.ownerId) return
    try { downloadAthleteExport(file) }
    catch { setState({ status: 'error' }) }
  }
  return h(ExportPanelView, { state, onPrepare: prepare, onDownload: download })
}

export function ExportPanelView({ state, onPrepare, onDownload }) {
  const labels = ['Hent alle data (JSON)', 'Hent træning (CSV)', 'Hent kost (CSV)', 'Hent vægt (CSV)']
  return h('details', { style: s.card }, h('summary', { style: { ...s.heading, minHeight: 44 } }, 'Eksportér mine data'),
    h('p', { style: s.label }, 'Dine gemte trænings-, kost- og vægtdata. Filerne hentes lokalt på din enhed. Usendte registreringer er ikke med.'),
    h('button', { type: 'button', style: s.button, disabled: state.status === 'loading', onClick: onPrepare },
      state.status === 'loading' ? 'Henter data…' : 'Klargør eksport'),
    state.status === 'loading' && h('p', { role: 'status' }, 'Henter alle dine data…'),
    state.status === 'error' && h('p', { role: 'alert' }, 'Eksporten kunne ikke klargøres eller hentes. Prøv igen.'),
    state.status === 'ready' && h('div', null,
      h('p', { role: 'status' }, state.empty ? 'Du har ingen gemte data endnu. Filerne er tomme med kolonneoverskrifter i CSV.' : 'Dine filer er klar.'),
      ...state.files.map((file, i) => h('button', { key: file.filename, type: 'button', style: s.button,
        onClick: () => onDownload(file) }, labels[i]))))
}
