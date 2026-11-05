import { createElement as h, useEffect, useRef, useState } from 'react'
import { calendarDay } from '../../../calendarDate.js'
import { suggestBlock } from './blockPlan.mjs'
import BlockPlanView from './BlockPlanView.mjs'
import CompareWeeksView from '../sammenlign/CompareWeeksView.mjs'
import { createProgramTemplate } from '../../program/skabeloner/programTemplates.mjs'
import { templateFromWeek, readTemplateLibrary } from '../../program/skabeloner/portalTemplates.mjs'
import ProgramTemplatesView from '../../program/skabeloner/ProgramTemplatesView.mjs'
import { programReadMessage, readBlockBasis, readComparison, programDraftKey, saveProgramDraft } from './programData.mjs'

const control = { minHeight: 44, maxWidth: '100%', boxSizing: 'border-box' }
const storage = () => globalThis.localStorage

// No hook, clock, storage, client or data access while OFF. Athlete switches
// remount the enabled body, so drafts and pending results cannot cross athletes.
export default function CoachProgramTools(props) {
  if (props.enabled !== true) return null
  if (!props.athleteId) return null
  return h(Tools, { ...props, key: props.athleteId })
}

export function BlockToolContent({ result, today, edits, onChange, onSave, message }) {
  if (!result) return h('p', { role: 'status' }, 'Åbn værktøjet for at hente grundlaget.')
  if (result.state === 'loading') return h('p', { role: 'status' }, 'Henter blokgrundlag…')
  if (result.state === 'error') return h('p', { role: 'alert' }, programReadMessage(result))
  const model = suggestBlock(result.snapshot, today, { edits })
  return h('div', null, h(BlockPlanView, { enabled: true, embedded: true, snapshot: result.snapshot, today, edits, onChange }),
    model.state !== 'unknown' && h('button', { type: 'button', style: control, disabled: model.state !== 'ready', onClick: onSave }, 'Gem blokudkast lokalt'),
    h('p', null, 'Gem opbevarer et lokalt coachudkast i denne browser. Det opretter ingen uger eller pas hos atleten.'),
    message && h('p', { role: 'status' }, message))
}

export function CompareToolContent({ result, today }) {
  if (!result) return h('p', { role: 'status' }, 'Vælg to uger og tryk Sammenlign.')
  if (result.state === 'loading') return h('p', { role: 'status' }, 'Henter de to uger…')
  if (result.state === 'error') return h('p', { role: 'alert' }, programReadMessage(result))
  return h(CompareWeeksView, { enabled: true, embedded: true, snapshot: result.snapshot, today })
}

function Tools({ athleteId, weeks: inputWeeks, client }) {
  const weeks = inputWeeks.filter(week => week.athlete_id === athleteId)
  const [open, setOpen] = useState({})
  const [basis, setBasis] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [edits, setEdits] = useState({})
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [name, setName] = useState('')
  const [library, setLibrary] = useState([])
  const [draft, setDraft] = useState(null)
  const [libraryState, setLibraryState] = useState('idle')
  const libraryReady = libraryState === 'ready'
  const [templateError, setTemplateError] = useState('')
  const [templateMessage, setTemplateMessage] = useState('')
  const [blockMessage, setBlockMessage] = useState('')
  const [blockError, setBlockError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const live = useRef(true)
  const compareGeneration = useRef(0)
  useEffect(() => { live.current = true; return () => { live.current = false; compareGeneration.current++ } }, [])
  // Read only when expanded. Cleanup rejects late responses, including retry.
  useEffect(() => {
    if (!open.block) return
    let current = true
    const today = calendarDay()
    setBasis({ state: 'loading' }); setEdits({}); setBlockMessage(''); setBlockError('')
    readBlockBasis({ enabled: true, client, athleteId, today }).then(snapshot => {
      if (!current) return
      setBasis({ state: 'ready', snapshot, today })
      try {
        const raw = storage().getItem(programDraftKey(athleteId, 'block'))
        if (!raw) return
        if (raw.length > 400000) throw Error('Ugyldigt lager')
        const saved = JSON.parse(raw), model = suggestBlock(snapshot, today, { edits: saved.edits })
        if (model.state === 'ready' && saved.today === today &&
            JSON.stringify(model.sourceBlock) === JSON.stringify(saved.model?.sourceBlock)) {
          setEdits(saved.edits); setBlockMessage('Gemt blokudkast hentet lokalt. Gennemgå før brug.')
        } else setBlockMessage('Det gemte blokudkast har et ældre grundlag. Et nyt forslag vises.')
      } catch { setBlockError('Det lokale blokudkast kunne ikke læses. Det nye forslag er ikke gemt.') }
    }, failure => { if (current) setBasis({ state: 'error', message: programReadMessage(failure) }) })
    return () => { current = false }
  }, [open.block, client, athleteId, attempt])
  const loadTemplates = () => {
    setTemplateError(''); setTemplateMessage(''); setLibraryState('loading'); setDraft(null)
    try {
      const nextLibrary = readTemplateLibrary(storage().getItem(programDraftKey(athleteId, 'templates')))
      const raw = storage().getItem(programDraftKey(athleteId, 'program'))
      let nextDraft = null
      if (raw) {
        if (raw.length > 400000) throw Error('Ugyldigt lager')
        const result = createProgramTemplate(JSON.parse(raw), { enabled: true })
        if (result.state !== 'ready') throw Error('Ugyldigt udkast')
        nextDraft = result.template
      }
      setLibrary(nextLibrary); setDraft(nextDraft); setLibraryState('ready')
      if (nextDraft) setTemplateMessage('Gemt programudkast hentet lokalt.')
    }
    catch { setLibraryState('error'); setTemplateError('Skabeloner kunne ikke læses. Prøv at hente dem igen. Eksisterende lager er ikke overskrevet.') }
  }
  const toggle = (kind, expanded) => {
    setOpen(previous => ({ ...previous, [kind]: expanded }))
    if (kind === 'templates' && expanded) loadTemplates()
    if (kind === 'compare' && !expanded) { compareGeneration.current++; setComparison(null) }
  }
  const dates = [...new Set(weeks.map(w => w.start_date).filter(value => typeof value === 'string' && calendarDay(value) === value))].sort()
  const selectDate = (label, value, change) => h('label', { style: { display: 'block' } }, label, ' ',
    h('select', { value, style: control, onChange: e => { compareGeneration.current++; setComparison(null); change(e.target.value) } },
      h('option', { value: '' }, 'Vælg uge'), ...dates.map(date => h('option', { key: date, value: date }, date))))
  const details = (kind, label, children) => h('details', { key: kind, onToggle: e => toggle(kind, e.currentTarget.open),
    style: { marginBlock: 16, minWidth: 0, maxWidth: '100%' } },
  h('summary', { style: { ...control, cursor: 'pointer', overflowWrap: 'anywhere' } }, label), open[kind] && children)
  const runComparison = async () => {
    const generation = ++compareGeneration.current, today = calendarDay()
    setComparison({ state: 'loading' })
    try {
      const snapshot = await readComparison({ enabled: true, client, athleteId, today, first, second })
      if (live.current && generation === compareGeneration.current) setComparison({ state: 'ready', snapshot, today })
    } catch (failure) {
      if (live.current && generation === compareGeneration.current) setComparison({ state: 'error', message: programReadMessage(failure) })
    }
  }
  const templateAction = action => {
    setTemplateError(''); setTemplateMessage('')
    try { action() } catch (failure) { setTemplateError(failure.message || 'Udkastet kunne ikke gemmes.') }
  }
  return h('section', { 'aria-label': 'Coachens programværktøjer', style: { minWidth: 0, maxWidth: '100%' } },
    details('block', 'Forslag til næste blok', h('div', null,
      h(BlockToolContent, { result: basis, today: basis?.today, edits,
        onChange: value => { setEdits(value); setBlockMessage(''); setBlockError('') }, message: blockMessage,
        onSave: () => {
          setBlockError(''); setBlockMessage('')
          try {
            const model = suggestBlock(basis?.snapshot, basis?.today, { edits })
            if (model.state !== 'ready') throw Error('Gennemgå grundlaget og rettelserne før gem.')
            saveProgramDraft(storage(), athleteId, 'block', { today: basis.today, model, edits })
            setBlockMessage('Blokudkast gemt lokalt. Atletens program er uændret.')
          } catch { setBlockError('Blokudkastet kunne ikke gemmes. Prøv igen.') }
        } }),
      blockError && h('p', { role: 'alert' }, blockError),
      h('button', { type: 'button', style: control, onClick: () => setAttempt(n => n + 1) }, 'Hent blokgrundlag igen'))),
    details('compare', 'Sammenlign to uger', h('div', null,
      dates.length < 2 && h('p', { role: 'status' }, 'Der mangler to daterede uger i ugeplanen.'),
      selectDate('Første uge', first, setFirst), selectDate('Anden uge', second, setSecond),
      h('button', { type: 'button', style: control, disabled: !first || !second || comparison?.state === 'loading', onClick: runComparison }, 'Sammenlign'),
      h(CompareToolContent, { result: comparison, today: comparison?.today }))),
    details('templates', 'Programskabeloner', h('div', null,
      !libraryReady && h('button', { type: 'button', style: control, onClick: loadTemplates }, 'Hent skabeloner igen'),
      h(ProgramTemplatesView, { weeks, libraryState, sourceId, name, library, draft, error: templateError, message: templateMessage,
        onSource: setSourceId, onName: setName,
        onCreate: () => templateAction(() => {
          if (!libraryReady || library.length >= 25) throw Error('Hent skabelonerne igen eller brug en eksisterende skabelon.')
          const template = templateFromWeek(weeks.find(w => String(w.id) === sourceId), name, athleteId)
          const next = [...library, template]
          saveProgramDraft(storage(), athleteId, 'templates', next)
          setLibrary(next); setTemplateMessage('Skabelon gemt lokalt. Vælg Brug som udkast for at genbruge den.')
        }),
        onUse: template => templateAction(() => {
          if (!libraryReady) throw Error('Hent skabelonerne igen eller brug en eksisterende skabelon.')
          const result = createProgramTemplate(template, { enabled: true })
          if (result.state !== 'ready') throw Error('Skabelonen er ugyldig.')
          setDraft(result.template)
        }),
        onSave: () => templateAction(() => {
          if (!libraryReady || !draft) throw Error('Hent skabelonerne og vælg en skabelon først.')
          saveProgramDraft(storage(), athleteId, 'program', draft)
          setTemplateMessage('Programudkast gemt lokalt. Atletens program er uændret.')
        }) }))))
}
