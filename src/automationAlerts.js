// ORDRE 301 · commit 1 — automatiseringsfejl i Indbakken (Coach Briefing).
// n8n's Error Monitor skriver en metadata-række i public.automation_alerts
// hver gang et produktions-workflow fejler. Rækken har ingen atlet, så den
// hører ikke til i atletsignal-/besked-/video-kilderne i coachPriority.js;
// den får sin egen række-type ('automation') i samme kø.
// Kun metadata (workflow, node, tidspunkt) - aldrig atletdata.

export const AUTOMATION_ALERT_LABEL = 'Automatisering fejlede'
export const AUTOMATION_ALERT_COLOR = '#d79a83'
export const RESOLVE_AUTOMATION_ALERT_RPC = 'resolve_automation_alert_v1'

export function filterOpenAutomationAlerts(rows) {
  return (rows || []).filter(row => row?.id && row.resolved_at == null)
}

// "for 2 timer siden" - dansk, relativt. Under et minut (og ur-skævhed, hvor
// tidspunktet ligger lidt i fremtiden) er "lige nu"; efter to måneder er en
// dato tydeligere end "for 70 dage siden".
export function formatRelativeTimeDa(value, now = Date.now()) {
  const then = value ? new Date(value).getTime() : NaN
  if (!Number.isFinite(then)) return ''
  const minutes = Math.floor((now - then) / 60000)
  if (minutes < 1) return 'lige nu'
  if (minutes < 60) return `for ${minutes} ${minutes === 1 ? 'minut' : 'minutter'} siden`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `for ${hours} ${hours === 1 ? 'time' : 'timer'} siden`
  const days = Math.floor(hours / 24)
  if (days < 60) return `for ${days} ${days === 1 ? 'dag' : 'dage'} siden`
  return new Date(then).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function automationAlertDetail(alert, now = Date.now()) {
  const node = alert?.failed_node ? `Node: ${alert.failed_node}` : ''
  return [node, formatRelativeTimeDa(alert?.occurred_at, now)].filter(Boolean).join(' · ')
}

// RPC'en ligger som fil under supabase/sql/ og koeres foerst efter Marcs ja.
// Indtil da svarer PostgREST "findes ikke" - det skal Marc kunne laese, ikke
// blot se en knap der ikke goer noget.
export function automationAlertResolveErrorMessage(error) {
  const text = String(error?.message || '')
  const missing = error?.code === 'PGRST202' || error?.code === '42883' ||
    /could not find the function|does not exist/i.test(text)
  if (missing) {
    return 'Kunne ikke markere som set: databasefunktionen findes ikke endnu. Fejlen står stadig i indbakken.'
  }
  return text ? `Kunne ikke markere som set: ${text}` : 'Kunne ikke markere som set. Prøv igen.'
}
