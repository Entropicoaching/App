import { painFromNotes, painFromVoices, soreness, readinessDrop, checkinStopped } from '../coach/coachAttention.mjs'
import { formatNumber, shortDate } from '../u3/format.mjs'
import { painFromDaily, sleepFromDaily } from '../u7/coachData.mjs'

// U6 del 2: ét konkret udkast pr. række under "Kræver dit blik". Rene funktioner.
// Udkastet bygger kun på det, rækken selv bygger på (readiness_logs, exercise_logs.note,
// weeks.session_voices, programkalenderen og kostlinjen), som findes i produktion i dag.
// Smertenoter citeres aldrig. Intet sendes: coachen trykker "Skriv", retter og sender selv.
// Står en ulæst besked eller en video øverst, bygges udkastet på atletens næste datagrund
// (smerte, readiness, check-in); findes ingen, får rækken intet udkast, og coachen svarer i tråden.

const firstName = name => typeof name === 'string' && name.trim() ? name.trim().split(/\s+/)[0] : ''
const whole = value => String(Math.round(value))
const greet = athlete => firstName(athlete?.name) ? `Hej ${firstName(athlete.name)}.` : 'Hej.'

function u3Text(kind, attention, weeks, day, athlete) {
  if (kind === 'readiness') {
    const found = attention && readinessDrop(attention.readiness, day)
    if (!found) return null
    return `Jeg kan se, at din readiness de sidste 3 dage ligger på ${whole(found.current)} i snit mod ${whole(found.mean)} i ugerne før. ` +
      'Hvordan har du det? Er det søvn, travlhed eller kroppen, så vi kan tage højde for det i træningen?'
  }
  if (kind === 'pain') {
    const scored = Array.isArray(attention?.daily) && painFromDaily(attention.daily, day)
    if (scored) return `Du har meldt smerte ${scored.pain}/10${scored.location ? ` i ${scored.location}` : ''} ${shortDate(scored.date)}. ` +
      'Hvordan har det udviklet sig? Skriv gerne, ved hvilke øvelser det mærkes, så justerer jeg.'
    const note = attention && painFromNotes(attention.notes, day)
    if (note) return `Jeg så, at du nævnte smerte i din log ${shortDate(note.date)}. Hvordan har det udviklet sig? ` +
      'Skriv gerne, hvor det sidder, og ved hvilke øvelser det mærkes, så justerer jeg.'
    const voice = painFromVoices(weeks, day)
    if (voice) return `Jeg så, at du nævnte smerte i en kommentar${Number.isSafeInteger(voice.week) ? ` i uge ${voice.week}` : ''}. ` +
      'Hvordan har det udviklet sig? Skriv gerne, hvor det sidder, og ved hvilke øvelser det mærkes, så justerer jeg.'
    const sore = attention && soreness(attention.readiness, day)
    if (sore) return `Du har meldt ømhed på 4 eller mere ${sore.days} af de sidste 7 dage. Hvor sidder det, ` +
      'og bliver det bedre eller værre i løbet af passet?'
    return null
  }
  if (kind === 'sleep') {
    const found = Array.isArray(attention?.daily) && sleepFromDaily(attention.daily, day)
    if (!found) return null
    return `Din søvn har ligget på ${formatNumber(found.mean, 1)} ud af 5 i snit de sidste 3 dage. Hvordan sover du? ` +
      'Skal vi tage lidt af i træningen, til det bliver bedre?'
  }
  if (kind === 'checkin') {
    const found = attention && checkinStopped(attention.readiness, day, athlete)
    if (!found) return null
    return `Jeg har ikke fået din dagsform den sidste uge, efter ${found.before} check-ins i ugerne før. Hvordan går det? ` +
      'Ét tryk på energi i appen om morgenen er nok.'
  }
  if (kind === 'protein') return 'Dit protein har ligget under målet de seneste dage. Er der noget, der driller? ' +
    'Skriv, hvad du typisk spiser, så finder vi et par nemme proteinkilder.'
  return null
}

// row er en række fra coachHomeModel.actions. attention er L1 for netop denne atlet (attentionFor), eller null.
export function attentionDraft({ row, attention = null, weeks = null, day } = {}) {
  if (!row?.athlete?.id) return null
  let body = null
  if (row.item) body = ['pain', 'readiness', 'sleep', 'checkin'].map(kind => u3Text(kind, attention, weeks, day, row.athlete)).find(Boolean) ?? null
  else if (row.u3) body = u3Text(row.u3, attention, weeks, day, row.athlete)
  else if (typeof row.key === 'string' && row.key.startsWith('program-')) {
    const left = /slutter om (\d+) dag/.exec(row.reason ?? '')
    body = left ? `Dit program slutter om ${left[1]} ${left[1] === '1' ? 'dag' : 'dage'}. ` : row.reason === 'Programmet er udløbet' ? 'Dit program er kørt til ende. ' : null
    if (body) body += 'Hvordan har blokken føltes? Er der noget, du vil have mere eller mindre af i den næste?'
  } else if (typeof row.key === 'string' && row.key.startsWith('logs-')) {
    const week = /programuge (\d+)/.exec(row.reason ?? '')
    body = `Jeg kan ikke se nogen log fra ${week ? `uge ${week[1]}` : 'den seneste programuge'}. Fik du trænet? ` +
      'Skriv bare kort, hvordan ugen gik, så tilpasser jeg den næste.'
  }
  return body ? { athleteId: row.athlete.id, text: `${greet(row.athlete)} ${body}`, requiresCoachReview: true } : null
}
