// Kun eksplicit, lokal e2e-mode. Ingen lagring eller produktionsaktivering.
export function release3TestFlags(mode, href = '') {
  const off = { athlete: {}, coach: {} }
  if (mode !== 'e2e') return off
  try {
    const url = new URL(href)
    const values = url.searchParams.getAll('appRel3')
    if (url.protocol !== 'http:' || url.username || url.password ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      values.length !== 1 || values[0] !== '1') return off
    return { athlete: { fremgangFokus: true, naesteTraening: true, staevnedagFokus: true },
      coach: { coachTemplateMessages: true } }
  } catch { return off }
}
