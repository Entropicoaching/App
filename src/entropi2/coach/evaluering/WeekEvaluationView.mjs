import { antalOrd } from '../../antalOrd.mjs'
import { createElement as h } from 'react'
import { weekEvaluation } from './evaluationModel.mjs'

const format = value => value === null || value === undefined ? 'data mangler' :
  new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 }).format(value)
const date = day => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`
const line = (label, value) => h('p', { key: label, style: { marginBlock: 10 } }, h('strong', null, `${label}: `), value)
const status = state => state === 'unknown' ? h('p', { role: 'status' }, 'Data er ikke tilgængelige for hele den valgte uge.')
  : state === 'partial' ? h('p', { role: 'status' }, 'Ufuldstændige data. Tallene omfatter kun de entydige registreringer.') : null
const section = (title, ...children) => h('details', { key: title,
  style: { border: '1px solid currentColor', borderRadius: 12, padding: '0 16px', marginBlock: 12 } },
  h('summary', { style: { minHeight: 48, paddingBlock: 12, boxSizing: 'border-box', cursor: 'pointer', fontWeight: 700 } }, title),
  ...children)

// Deliberately unconnected. OFF reads only the opt-in flag, with no callbacks,
// fetching, effects or storage. The host supplies already authorized snapshots.
export default function WeekEvaluation(props = {}) {
  if (props.enabled !== true) return null
  const model = weekEvaluation(props.input)
  if (model.state !== 'ready') return h('p', { role: 'status' }, 'Vælg en atlet og en afsluttet uge med gyldige datoer.')
  const { training: t, nutrition: n, weights: w, notes } = model
  const metric = (v, unit) => v === null || v === undefined ? 'data mangler' : `${format(v)} ${unit}`
  return h('article', { 'aria-label': `Ugeevaluering · ${model.athleteName}`,
    'data-coach-week-evaluation': true,
    style: { width: '100%', maxWidth: 720, minWidth: 0, boxSizing: 'border-box', marginInline: 'auto',
      padding: 16, overflowWrap: 'anywhere', font: 'inherit' } },
    h('h1', null, `Ugeevaluering · ${model.athleteName}`),
    h('p', null, h('time', { dateTime: model.start }, date(model.start)), ' til ', h('time', { dateTime: model.end }, date(model.end))),
    section('Træning', status(t.state), t.state !== 'unknown' && h('div', null,
      line('Pas gennemført', `${format(t.done)} af ${format(t.planned)} planlagt`),
      line('Sæt', `${format(t.sets)} bekræftet af ${format(t.plannedSets)} planlagt · ${format(t.skipped)} sprunget over`),
      line('Gennemsnitlig RPE', `${format(t.rpe)} · ${format(t.rpeCount)} ${antalOrd(t.rpeCount, 'atletregistrering', 'atletregistreringer')}`),
      ...t.lifts.map(lift => line(`Top-e1RM · ${lift.lift}`, metric(lift.value, 'kg'))),
      h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Et pas tæller som gennemført, når alle planlagte sæt er logget eller sprunget over. RPE er gennemsnit pr. bekræftet sæt med eget svar. e1RM bruger sammenlignelige tunge hovedløft; lette sæt og deload er udeladt.')))),
    section('Kost', status(n.state), n.state !== 'unknown' && h('div', null,
      line('Loggede dage', `${format(n.days)} af 7`),
      line('Gennemsnitlig kcal', `${metric(n.kcal, 'kcal')} · Aktuelt mål: ${metric(n.kcalTarget, 'kcal')}`),
      line('Gennemsnitligt protein', `${metric(n.protein, 'g')} · Aktuelt mål: ${metric(n.proteinTarget, 'g')}`),
      h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Gennemsnit pr. logget dag. En logget dag kan være ufuldstændig. Tidligere mål kan have været anderledes.')))),
    section('Kropsvægt', status(w.state), w.state !== 'unknown' && h('div', null,
      line('Ugegennemsnit', metric(w.average, 'kg')),
      line('Dage med vejning', format(w.days)),
      line('Ugen før', `${metric(w.previous, 'kg')} · ${format(w.previousDays)} ${antalOrd(w.previousDays, 'dag', 'dage')}`),
      line('Ændring fra ugen før', w.delta === null ? 'data mangler' : `${w.delta > 0 ? '+' : ''}${format(w.delta)} kg`),
      h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Gennemsnit af dagsgennemsnit; hver dag vejer lige meget. En ændring kræver vejninger i begge uger.')))),
    section('Noter og beskeder',
      line('Pasnoter', notes.trainingState === 'ready' ? 'Indlæst' : notes.trainingState === 'partial' ? 'Ufuldstændige data' : 'Data mangler'),
      line('Beskeder', notes.messageState === 'ready' ? 'Indlæst' : notes.messageState === 'partial' ? 'Ufuldstændige data' : 'Data mangler'),
      notes.entries.length === 0 && h('p', null, notes.trainingState === 'ready' && notes.messageState === 'ready'
        ? 'Ingen noter eller beskeder i den valgte uge.' : 'Ingen tilgængelige noter. Datagrundlaget er ufuldstændigt.'),
      ...notes.entries.map(entry => h('div', { key: entry.key, style: { marginBlock: 16 } },
        h('h2', { style: { fontSize: '1em', marginBlock: 8 } }, entry.title,
          entry.day && h('time', { dateTime: entry.day }, ` · ${date(entry.day)}`)),
        entry.marks.length > 0 && h('strong', null, entry.marks.join(' · ')),
        h('p', { style: { whiteSpace: 'pre-wrap' } }, entry.text))),
      h('details', { 'data-u9-forklaring': '' }, h('summary', { style: { cursor: 'pointer', minHeight: 44 } }, 'Forklaring'), h('p', null, 'Smerte og stop markeres ud fra ordene i noterne og beskederne. Coachen vurderer betydningen.'))))
}

