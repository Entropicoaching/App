import { coachTekstData } from './coachTekstData.js'

function tekstSituationer(summary) {
  if (!summary) return []
  const pas = summary.pas || []
  const r = summary.rpe || {}
  const done = pas.reduce((n, p) => n + (Number(p.gennemfoertSaet) || 0), 0)
  const keys = []
  if (summary.status === 'fuld') keys.push('fuld_uge')
  if (summary.status === 'delvis') keys.push('delvis_uge')
  if (summary.status === 'sprunget_over') keys.push('sprunget_over')
  if (summary.status === 'delvis' && pas.some(p => p.manglendeOevelser?.length)) keys.push('manglende_oevelse')
  if (done > 0 && (Number(r.saetUdenRpe) || 0) + (Number(r.ugyldigeRpe) || 0) > 0) keys.push('manglende_rpe')
  if (done > 0 && r.gennemsnit != null && r.gennemsnit >= 9) keys.push('hoej_rpe')
  return keys
}

function tekstVaerdier(summary, navne = {}) {
  const pas = summary?.pas || []
  const r = summary?.rpe || {}
  return {
    gennemfoert: pas.reduce((n, p) => n + (Number(p.gennemfoertSaet) || 0), 0),
    planlagt: pas.reduce((n, p) => n + (Number(p.planlagtSaet) || 0), 0),
    oevelser: [...new Set(pas.flatMap(p => p.manglendeOevelser || []))].join(', '),
    antal: (Number(r.saetUdenRpe) || 0) + (Number(r.ugyldigeRpe) || 0),
    gns: r.gennemsnit == null ? '' : String(r.gennemsnit).replace('.', ','),
    atlet: navne.atlet,
    coach: navne.coach,
  }
}

function udfyldTekst(tekst, vaerdier) {
  const mangler = []
  const udfyldt = tekst.replace(/\{(\w+)\}/g, (match, key) => {
    const value = Object.hasOwn(vaerdier, key) ? vaerdier[key] : undefined
    if (value === undefined || value === null || value === '') {
      if (!mangler.includes(key)) mangler.push(key)
      return match
    }
    return String(value)
  })
  return { tekst: udfyldt, mangler }
}

function lavTekstForslag(skabeloner, summary, navne = {}) {
  const vaerdier = tekstVaerdier(summary, navne)
  return tekstSituationer(summary).map(situation => {
    const t = skabeloner.situationer[situation]
    return { situation, navn: t.navn, ...udfyldTekst(t.tekst + '\n\n' + skabeloner.afslutning, vaerdier) }
  })
}

export function coachTekstForslag(summary, navne = {}) {
  return lavTekstForslag(coachTekstData, summary, navne)
}
