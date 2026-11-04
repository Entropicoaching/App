import { createElement as h, useId } from 'react'
import { createWeeklyLetter } from './weeklyLetterModel.mjs'

const target = { minHeight: 44, padding: '10px 0', cursor: 'pointer' }

/** Unwired coach-only editor. Editing is local to the textarea; no send action. */
export default function WeeklyLetter(options = {}) {
  const editorId = useId()
  if (options?.enabled !== true) return null
  const m = createWeeklyLetter(options)
  const style = { color: '#f0f4f1', background: '#101815', padding: 12, borderRadius: 12,
    minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', fontFamily: 'inherit' }
  const heading = h('h2', null, 'Udkast til ugebrev')
  if (m.state === 'loading') return h('section', { style, 'aria-label': 'Ugebrev', 'aria-busy': true },
    heading, h('p', { role: 'status' }, 'Henter ugens grundlag …'))
  if (m.state === 'error') return h('section', { style, 'aria-label': 'Ugebrev' },
    heading, h('p', { role: 'alert' }, 'Udkastet kunne ikke dannes. Kontrollér, at hele perioden er hentet.'))
  if (m.state === 'empty') return h('section', { style, 'aria-label': 'Ugebrev' }, heading,
    h('p', null, 'Der er endnu ikke et sikkert grundlag for et ugebrev. Manglende registreringer er ikke nul.'))
  const b = m.evidence
  return h('section', { style, 'aria-label': 'Ugebrev' }, heading,
    h('p', null, `${m.from} – ${m.asOf} Â· opgjort til og med ${m.asOf}`),
    h('p', { id: `${editorId}-help` }, 'Redigér altid teksten før afsendelse i dit sædvanlige beskedflow. Dette udkast gemmes og sendes ikke her.'),
    h('label', { htmlFor: editorId, style: { display: 'block', paddingBottom: 8 } }, 'Ros, ét fokuspunkt og ét spørgsmål'),
    h('textarea', { id: editorId, 'aria-describedby': `${editorId}-help`,
      key: JSON.stringify([options.data.athleteId, m.from, m.asOf, m.text]), defaultValue: m.text, rows: 10,
      style: { width: '100%', minHeight: 220, boxSizing: 'border-box', resize: 'vertical',
        font: 'inherit', color: '#101815', background: '#fff', borderRadius: 8, padding: 12 } }),
    m.incomplete && h('p', null, 'Dele af datagrundlaget er utilstrækkelige. Teksten bygger kun på kendte registreringer.'),
    h('details', null, h('summary', { style: target }, 'Grundlag og mangler'),
      h('p', null, m.training ? `Bekræftede planlagte pas: ${m.training.completed}/${m.training.planned}. Ekstra pas: ${m.training.extra}.` : 'Ugens pas: ukendt grundlag.'),
      h('p', null, m.nutritionDays === null ? 'Ugens kost: ukendt grundlag.' : `Komplette kostdage med dateret proteinmål: ${m.nutritionDays}/7. Øvrige dage er ukendte.`),
      b ? h('section', { 'aria-label': 'Grundlag for fokus' },
        h('h3', null, b.title), h('p', null, `${b.from} – ${b.to} Â· ${b.sampleCount} observationer Â· minimum ${b.minimumSampleCount}.`),
        h('p', null, `Beregnet værdi: ${new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 }).format(b.value)}.`),
        h('p', null, `Regel: ${b.rule}.`), h('p', null, `Beregning: ${b.formula}.`))
        : h('p', null, 'Intet flag er valgt som fokus. Det er ikke en vurdering af atletens helbred.'),
      m.otherFlags > 0 && h('p', null, `${m.otherFlags} øvrige flag skal gennemgås i ugeevalueringen.`),
      h('p', null, 'Grundlaget er atletens egne registreringer. Coachen vælger og redigerer beskeden.')))
}
