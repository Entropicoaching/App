// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (linje 30-33 og 195-213
// før opdelingen, se docs/DASHBOARD-KORT.md): konstanter og ferie-hjælperne
// på coachens side.

// Valgfri fast ugedag pr. session (0=mandag .. 6=søndag). null = fleksibel (Træning 1/2/3).
const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

const statusLabels = { active: 'Aktiv', peaking: 'Peaking', offseason: 'Off-season', ferie: 'Ferie' }

// Ferie-status: returnerer { onHoliday, until } eller null hvis ikke på ferie.
// onHoliday = ingen slutdato eller slutdato >= i dag. Ellers er ferien slut (tilbage).
function holidayInfo(a) {
  if (a?.status !== 'ferie') return null
  const until = a.vacation_until || null
  const onHoliday = !until || until >= new Date().toISOString().slice(0, 10)
  return { onHoliday, until }
}
function ferieBadgeLabel(info) {
  if (info?.until) {
    const d = new Date(info.until + 'T12:00:00')
    return `Ferie til ${d.getDate()}/${d.getMonth() + 1}`
  }
  return 'Ferie'
}

// Maks. antal sæt-rækker hentet pr. atlet (Log-fane + AI-rapport). Hævet fra 500 så
// lange perioder ikke afkortes lydløst i rapporten; bruges også til afkortnings-advarsel.
const ATHLETE_LOGS_LIMIT = 2000

export { WEEKDAYS_SHORT, statusLabels, holidayInfo, ferieBadgeLabel, ATHLETE_LOGS_LIMIT }
