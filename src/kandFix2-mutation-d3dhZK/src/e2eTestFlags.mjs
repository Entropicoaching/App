// APP-E2E2: kun eksplicit lokal integrationstest. Ingen lagring.
export function fridayTestEnabled(mode, href = '') {
  if (mode !== 'e2e') return false
  try {
    const url = new URL(href)
    const flags = url.searchParams.getAll('appE2E2')
    return url.protocol === 'http:' && !url.username && !url.password
      && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      && flags.length === 1 && flags[0] === '1'
  } catch { return false }
}
