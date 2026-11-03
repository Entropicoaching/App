import { createElement as h, useEffect, useRef, useState } from 'react'
import { homeModel, startHomeSession } from './homeModel.mjs'
import { homeStyles as s } from './homeStyles.mjs'
import { nutritionTodayModel } from './nutritionTodayModel.mjs'
import { weekSummary } from './weekSummary.mjs'
import HomeOnboarding from './HomeIntroduction.mjs'

const clock = () => new Date()
const MONTHS = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.']
const danishDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${MONTHS[Number(m[2]) - 1]}` : String(iso) }
const labels = { holiday: 'Du er på ferie', missing: 'Programdata mangler', 'no-program': 'Intet program endnu',
  'no-next': 'Intet kommende pas planlagt', done: 'Dagens pas er klaret' }

// Only an explicit enabled=true renders this opt-in component. No flag reader.
export default function AthleteHome(props) {
  const { enabled = false, athlete, messages = [], formatMsgTime, setTab, onStartSession, onFilmSet, getNow = clock } = props
  const [tick, setTick] = useState(0)
  const headingRef = useRef(null)
  const latest = useRef(props)
  latest.current = props
  useEffect(() => {
    if (enabled !== true) return
    // Recompute Copenhagen calendar date while mounted.
    const id = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(id)
  }, [enabled])
  if (enabled !== true) return null
  void tick
  const now = props.now ?? getNow()
  const model = homeModel({ ...props, now })
  const weekText = weekSummary({ ...props, now })
  const nutrition = nutritionTodayModel(props.nutritionToday, model.today)
  const target = model.target
  // Runde 12: Hjem kan have flyttet sig til en ny kalenderuge, mens appens indlæste uge er den
  // gamle. Registrering kræver samme uge; ellers bedes atleten genindlæse, ikke registrere forgæves.
  const staleWeek = Boolean(target && props.currentWeek && target.week.id !== props.currentWeek.id)
  const coach = [...messages].reverse().find(m => m.sender_role === 'coach')
  const go = route => () => latest.current.setTab?.(route)
  const start = () => {
    const current = latest.current
    return startHomeSession(current, model, current.getNow ? current.getNow() : current.now ?? clock())
  }
  const link = (route, text) => h('button', { key: route, type: 'button', style: s.secondary,
    disabled: typeof setTab !== 'function', onClick: go(route) }, text)
  return h('main', { style: s.page, 'aria-label': 'Hjem', 'data-entropi2-home': '' },
    // Marc 3. nov.: datoen stod tre gange (topbjaelke, her og i kortet). Topbjaelken viser datoen;
    // her kun ugen, og kortet siger "I dag" eller en dansk dato.
    (target?.week || props.currentWeek)?.week_number != null && h('p', { style: s.eyebrow }, `Uge ${(target?.week || props.currentWeek).week_number}`),
    // Marc 3. nov.: overskriften maa ikke spoerge til et pas, der allerede er klaret.
    h('h1', { ref: headingRef, tabIndex: -1, style: s.title }, model.kind === 'done' ? (athlete?.name ? `Godt arbejde i dag, ${athlete.name}` : 'Godt arbejde i dag')
      : athlete?.name ? `Klar til dit pas, ${athlete.name}?` : 'Klar til dit pas?'),
    h(HomeOnboarding, { enabled, athleteId: athlete?.id, storage: props.storage, headingRef }),
    h('section', { style: s.card, 'aria-label': 'Dit næste pas' },
      h('p', { style: s.eyebrow }, target ? model.kind === 'today' ? 'Dagens pas' : 'Næste træning' : 'Dit program'),
      h('h2', { style: s.heading }, target?.session.title || (target ? 'Træning' : labels[model.kind] || labels.missing)),
      target ? h('div', null,
        h('p', { style: s.text }, model.date ? (model.date === model.today ? 'I dag' : danishDate(model.date)) : `Dag ikke fastlagt · uge ${target.week.week_number ?? 'ikke angivet'}`),
        h('ul', { style: { ...s.text, listStylePosition: 'inside', paddingInlineStart: 0 } }, ...target.session.exercises.map(e => h('li', { key: e.id }, e.name || 'Øvelse uden navn'))),
        h('p', { style: s.text }, model.logged == null ? 'Sætstatus hentes, når passet åbnes.' : `${model.logged} af ${model.total} sæt klaret`),
        ...target.session.exercises.filter(e => e.note).map(e => h('p', { key: e.id, style: s.text }, `Coach · ${e.name || 'Øvelse'}: ${e.note}`)),
        h('button', { type: 'button', style: s.primary, disabled: typeof onStartSession !== 'function' || staleWeek, onClick: start },
          model.kind === 'today' ? 'Start dagens pas' : 'Start næste pas'),
        staleWeek ? h('p', { role: 'status', style: s.text }, 'En ny uge er startet. Genindlæs siden for at registrere passet.')
          : typeof onStartSession !== 'function' && h('p', { role: 'status', style: s.text }, 'Passtart er ikke tilgængelig endnu.'))
        : h('p', { role: 'status', style: s.text }, model.kind === 'holiday' ? 'Din træning venter, når du er tilbage.' : 'Se programmet eller kontakt din coach.'),
      link('program', 'Se mit program')),
    weekText && h('p', { style: { ...s.text, marginTop: 0 }, 'data-week-sessions': '' }, weekText),
    // Marc 3. nov.: videocoachen skal kunne naas direkte fra startsiden.
    h('button', { type: 'button', style: { ...s.secondary, marginTop: 0, marginBottom: 20 }, 'data-film-set': '',
      disabled: typeof onFilmSet !== 'function', onClick: () => latest.current.onFilmSet?.() }, 'Film et sæt til videocoach'),
    nutrition && h('button', { type: 'button',
      style: { ...s.secondary, marginTop: 0, marginBottom: 20, textAlign: 'left' },
      disabled: typeof setTab !== 'function', onClick: go('kost') }, nutrition.text),
    h('section', { style: s.card, 'aria-label': 'Fra din coach' },
      h('p', { style: s.eyebrow }, 'Fra din coach'),
      h('h2', { style: s.heading }, 'Seneste besked'),
      h('p', { style: s.text }, coach?.content || (coach ? 'Besked uden tekst' : 'Ingen beskeder endnu.')),
      coach?.created_at && typeof formatMsgTime === 'function' && h('p', { style: s.text }, formatMsgTime(coach.created_at)),
      link('beskeder', 'Se besked og video')),
    h('h2', { style: s.heading }, 'Resten af din dag'),
    h('nav', { style: s.links, 'aria-label': 'Genveje' },
      link('fremgang', 'Analyse'), link('kost', 'Kost'), link('mobilisering', 'Mobilitet'), link('beskeder', 'Din coach')))
}
