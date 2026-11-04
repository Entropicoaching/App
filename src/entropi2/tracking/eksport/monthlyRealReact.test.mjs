import test from 'node:test'
import assert from 'node:assert/strict'

// Runs as real React in npm test at integration. No synthetic fallback here.
let h, render, Export, Content, unavailable = false
try {
  const react = await import('react')
  const server = await import('react-dom/server')
  const module = await import('./CoachMonthlyExport.mjs')
  h = react.createElement; render = server.renderToStaticMarkup
  Export = module.default; Content = module.MonthlyExportContent
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package '(react|react-dom)'/.test(error.message)) throw error
  unavailable = true
}
const options = { skip: unavailable ? 'Pinned hermetic bundle has no React packages; real React is a Dhurva integration gate.' : false }

test('real React: export is visible, folded, accessible and OFF is empty', options, () => {
  assert.equal(render(h(Export, { enabled: false })), '')
  const html = render(h(Content, { onExport() {} }))
  assert.match(html, /Eksportér 4 uger \(CSV\/JSON\)/)
  assert.match(html, /Hent CSV/); assert.match(html, /Hent JSON/)
  assert.match(html, /<details/); assert.doesNotMatch(html, /<details open/)
})
test('real React: empty data has an explicit neutral message', options, () => {
  const html = render(h(Content, { state: { status: 'empty', message: 'Ingen registreringer i perioden. Filen viser manglende data.' } }))
  assert.match(html, /Ingen registreringer/); assert.match(html, /role="status"/)
  assert.doesNotMatch(html, /role="alert"/)
})
test('real React: loading disables both downloads; error remains retryable', options, () => {
  const loading = render(h(Content, { state: { status: 'loading' } }))
  assert.equal((loading.match(/disabled=""/g) || []).length, 2)
  const error = render(h(Content, { state: { status: 'error', message: 'Eksporten kunne ikke hentes komplet. Prøv igen.' } }))
  assert.match(error, /role="alert"/); assert.match(error, /Prøv igen/)
  assert.doesNotMatch(error, /disabled/)
})
