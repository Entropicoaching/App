// ORDRE 100 — "parathed der svarer igen": parathedsloggen har hidtil ikke
// spejlet noget tilbage til atleten — gemt log, ingen reaktion. Denne fil er
// den rene sammenligningslogik (dagens score mod atletens eget snit for de
// sidste 14 dage), adskilt fra AthleteView.jsx så den kan enhedstestes uden
// en mountet komponent — samme mønster som readinessDraft.js.
//
// Grænserne for "under/som/over" sættes ud fra spredningen i atletens egen
// historik (0,5 × standardafvigelse), ikke faste tal — se ordreteksten. Er
// spredningen ~0 (atleten scorer stort set identisk hver dag) bruges et
// minimalt fast tærskelpunkt (3 point) i stedet, så en helt stabil historik
// ikke gør enhver bitte udsving til "under"/"over".
const MIN_HISTORY_FOR_COMPARISON = 5
const FALLBACK_THRESHOLD = 3

export function compareReadiness(todayScore, historyScores) {
  const hist = (historyScores || []).filter(v => typeof v === 'number' && !Number.isNaN(v))
  if (todayScore == null || hist.length < MIN_HISTORY_FOR_COMPARISON) {
    return { status: 'insufficient', mean: null, sd: null, diff: null }
  }
  const n = hist.length
  const mean = hist.reduce((s, v) => s + v, 0) / n
  const variance = hist.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const sd = Math.sqrt(variance)
  const threshold = sd > 0.0001 ? sd * 0.5 : FALLBACK_THRESHOLD
  const diff = todayScore - mean
  const status = diff <= -threshold ? 'under' : diff >= threshold ? 'over' : 'normal'
  return { status, mean, sd, diff }
}

export function readinessComparisonText(status) {
  switch (status) {
    case 'under': return 'Lidt under dit normale niveau de sidste to uger.'
    case 'over': return 'Over dit normale.'
    case 'normal': return 'Som du plejer.'
    default: return 'Log nogle flere dage, så begynder appen at kunne sammenligne.'
  }
}

// Ingen programændring, ingen medicinsk anbefaling — kun en tone at læse
// dagen i, samme princip som den eksisterende autoregulerings-cue.
export function readinessTrainingNote(status) {
  switch (status) {
    case 'under': return 'Overvej at tage det lidt roligere i dag, hvis du kan mærke det.'
    case 'over': return 'Godt tidspunkt til at give den lidt ekstra, hvis du har lyst.'
    case 'normal': return 'Kør din plan som den er lagt.'
    default: return null
  }
}

// ORDRE 267 · commit 2 — "atleten kan se at det blev brugt": samme regnestykke
// som coachens "Parathed — nøgletal"-kort (src/dashboard/AnalyseTab.jsx),
// men genimplementeret her (ikke genbrugt derfra) — Dashboard*/dashboard/-
// filerne er fredet i denne ordre (Bhishak arbejder der samtidig). Kører kun
// på det atleten selv har adgang til: dagens log + op til 14 forudgående dage
// (samme datasæt som `readinessHistory`/`readinessLog` i AthleteView.jsx),
// IKKE coachens fulde historik — se rapportens "Ærlige grænser".
const LOW_READINESS_THRESHOLD = 50

export function summarizeReadinessForCoach(entries) {
  const list = (entries || []).filter(e => e && e.logged_date)
  if (!list.length) return null
  const sleepEntries = list.filter(e => e.sleep_hours != null)
  const avgSleep = sleepEntries.length > 0
    ? Math.round(sleepEntries.reduce((sum, e) => sum + e.sleep_hours, 0) / sleepEntries.length * 10) / 10
    : null
  const soreMap = {}
  for (const e of list) for (const zone of (e.sore_zones || [])) soreMap[zone] = (soreMap[zone] || 0) + 1
  const topZone = Object.entries(soreMap).sort((a, b) => b[1] - a[1])[0] || null
  const sorted = [...list].sort((a, b) => b.logged_date.localeCompare(a.logged_date))
  let lowStreak = 0
  for (const e of sorted) {
    if (e.readiness_score == null || e.readiness_score >= LOW_READINESS_THRESHOLD) break
    lowStreak++
  }
  return { logsCount: list.length, avgSleep, topZone, lowStreak }
}

// "Sidste gang et check-in førte til en ændring": ingen tabel knytter et
// check-in til en efterfølgende programrettelse, så dette er en tidsmæssig
// korrelation, ikke en gemt årsagskæde — en lav parathedsscore (< 50) efterfulgt,
// inden for et kort vindue, af en ny uge med en coach-note. Kun ægte, allerede
// gemt data bruges (readiness_logs + weeks.start_date/coach_note); INTET
// opfindes — findes ingen match, returneres null, og skærmen viser intet
// (se ordreteksten: "hvis det findes i data").
const CHANGE_WINDOW_DAYS = 9

export function lastCheckinDrivenChange(readinessEntries, weeks) {
  const lowLogs = (readinessEntries || [])
    .filter(e => e && e.logged_date && e.readiness_score != null && e.readiness_score < LOW_READINESS_THRESHOLD)
    .sort((a, b) => b.logged_date.localeCompare(a.logged_date))
  const notedWeeks = (weeks || []).filter(w => w && w.start_date && w.coach_note)
  for (const log of lowLogs) {
    const candidates = notedWeeks
      .filter(w => w.start_date > log.logged_date && daysBetweenDates(log.logged_date, w.start_date) <= CHANGE_WINDOW_DAYS)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
    if (candidates.length) {
      return { checkinDate: log.logged_date, weekStartDate: candidates[0].start_date, note: candidates[0].coach_note }
    }
  }
  return null
}

function daysBetweenDates(fromStr, toStr) {
  const a = new Date(fromStr + 'T12:00:00Z')
  const b = new Date(toStr + 'T12:00:00Z')
  return Math.round((b - a) / 86400000)
}
