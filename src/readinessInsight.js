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
