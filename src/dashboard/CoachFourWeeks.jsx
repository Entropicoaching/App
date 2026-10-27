import { createElement as h } from 'react'
import { buildFourWeeks } from './coachFourWeeks.mjs'

const box = { border: '1px solid #4a4844', padding: '1rem', borderRadius: '8px', minWidth: 0 }
const label = { weeks: 'Plan', logs: 'Træningslog', videos: 'Videoer' }
const signed = n => n > 0 ? `+${n}` : String(n)

export default function CoachFourWeeks({ athlete, reads = {}, today, onOpenVideo, onOpenAwaitingVideo, videoOpening, videoError }) {
  const model = buildFourWeeks({ athleteId: athlete.id, reads, today })
  const loaded = kind => reads[kind]?.athleteId === athlete.id && reads[kind]?.status === 'ready'
  return h('section', { 'aria-label': 'De seneste fire uger', style: { ...box, marginBottom: '1.5rem' } },
    h('h2', null, 'De seneste fire uger'),
    h('p', null, `${athlete.name}: ${model.start} til ${model.end}. Denne uge og de tre foregående kalenderuger.`),
    h('p', null, 'Planen gælder hele ugen. Log og videoer vises til og med i dag. Kun allerede hentede data vises; historikken kan være afkortet af appens hentegrænser.'),
    ...Object.keys(label).map(kind => {
      const source = reads[kind]
      const status = source?.athleteId === athlete.id ? source.status : null
      return status === 'ready' ? null : h('p', { key: kind, role: 'status' },
        `${label[kind]}: ${status === 'error' ? 'kunne ikke hentes. Åbn profilen igen for at prøve igen.' : 'afventer indlæsning.'}`)
    }),
    videoError && h('p', { role: 'alert' }, videoError),
    model.undated > 0 && h('p', null, `${model.undated} programuger uden gyldig startdato er ikke placeret i kalenderen.`),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '0.8rem' } },
      ...model.weeks.map(week => h('article', { key: week.start, style: box },
        h('h3', null, `${week.start} til ${week.end}`),
        h('p', null, !loaded('weeks') ? 'Planlagte sæt afventer data' : week.plans.length ? `${week.plannedSets} planlagte sæt` : 'Ingen dateret plan i de hentede data'),
        h('p', null, loaded('logs') ? `${week.completed} loggede sæt, ${week.skipped} sprunget over` : 'Loggede sæt afventer data'),
        loaded('logs') && h('p', null, `RPE: ${week.logs.filter(log => log.delta > 0).length} sæt over planen, ${week.logs.filter(log => log.delta < 0).length} under, ${week.logs.filter(log => log.delta === 0).length} som planlagt, ${week.logs.filter(log => log.delta === null && !log.skipped).length} ukendt.`),
        h('details', null, h('summary', null, 'Plan og sæt med RPE-afvigelse'),
          ...week.plans.map(plan => h('div', { key: plan.id }, h('strong', null, `Programuge ${plan.week_number}`),
            ...(plan.sessions || []).map(session => h('div', { key: session.id }, session.title || 'Pas',
              h('ul', null, ...(session.exercises || []).map(ex => h('li', { key: ex.id }, `${ex.name || 'Øvelse'}: ${ex.sets ?? '?'} sæt, ${ex.reps ?? '?'} gentagelser, ${ex.intensity || 'ingen planlagt intensitet'}`))))))),
          h('ul', null, ...week.logs.map((log, index) => h('li', { key: log.id || index },
            `${log.day} ${log.exercises?.name || 'Øvelse'}, sæt ${log.set_number ?? '?'}: ${log.skipped ? 'sprunget over' : `${log.weight ?? '?'} kg x ${log.reps_completed ?? '?'}`}. RPE-afvigelse ${log.delta === null ? 'ukendt' : signed(log.delta)}.`))),
        ),
        h('h4', null, 'Noter'),
        week.notes.length ? h('ul', null, ...week.notes.map((note, i) => h('li', { key: i, style: { overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' } }, `${note.source}: ${note.text}`))) : h('p', null, 'Ingen noter i de hentede data'),
        h('h4', null, 'Videoer'),
        week.videos.length ? h('ul', null, ...week.videos.map(video => h('li', { key: video.id },
          `${video.day} ${video.lift || 'Løft'}${video.variation ? ` (${video.variation})` : ''}: ${video.analysis_state === 'awaiting_analysis' ? 'Afventer sporing' : ({ draft: 'Kladde', coach_approved: 'Godkendt', shared: 'Delt', invalid: 'Udeladt' }[video.status] || 'Ukendt status')} `,
          (video.analysis_state === 'awaiting_analysis' ? onOpenAwaitingVideo : onOpenVideo) && h('button', { type: 'button', disabled: Boolean(videoOpening), onClick: () => video.analysis_state === 'awaiting_analysis' ? onOpenAwaitingVideo(video) : onOpenVideo(video), style: { minHeight: '44px' } }, video.analysis_state === 'awaiting_analysis' ? 'Åbn til sporing' : 'Åbn videoanalyse'),
        ))) : h('p', null, 'Ingen videoer i de hentede data'),
      )))
  )
}
