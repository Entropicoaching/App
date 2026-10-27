import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { motifs, motifUrl, parseArgs, captureMotif, main, pageAdapter, domStep } from './friday-shots.mjs'
import { fakePage, routes, element as el, withDom } from './shotsFake.mjs'
const canonical = import.meta.url.endsWith('/scripts/friday-shots.test.js')
const preview = await import(canonical ? '../src/fridayPreview.mjs' : './fridayPreview.mjs')

test('direkte FRIDAY-SCREENS pin og fuld motivtabel, LF og CRLF', () => {
  const bytes = readFileSync(new URL(canonical ? '../docs/FRIDAY-SCREENS.md' : './FRIDAY-SCREENS.md', import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e92f7ba9047b0407f4d20a2d59af4b687e158a56225e18eaf111d96052dcd40b')
  for (const source of [bytes.toString().replace(/\r\n/g, '\n'), bytes.toString().replace(/\r?\n/g, '\r\n')]) {
    const links = [...source.matchAll(/\| \[([a-z-]+)\]\((http[^)]+)\)/g)]
    assert.equal(links.length, 9)
    assert.deepEqual(motifs.map(m => m.id), links.map(m => m[1]))
    for (const [, id, url] of links) assert.equal(motifUrl(id), url)
  }
  assert.deepEqual(Object.keys(routes), motifs.map(m => m.id))
  assert.deepEqual(preview.screens.map(m => m.id), motifs.map(m => m.id))
  for (const motif of motifs) assert.equal(motifUrl(motif.id), preview.previewUrl(motif.id))
  assert.ok(Object.isFrozen(motifs[1].steps))
  assert.throws(() => motifUrl('../escape'))
})

for (const motif of motifs) {
  test(`${motif.id}: fuld klikvej, overskrift, tilstand og filnavn`, async () => {
    const page = fakePage(motif.id)
    assert.deepEqual(await captureMotif(page, motif, 'shots'), { id: motif.id, ok: true })
    assert.deepEqual(page.files, [path.join('shots', `v2-${motif.id}-375.png`)])
    assert.deepEqual(page.calls.slice(0, 3), ['open', 'closeList', 'ready'])
    assert.deepEqual(page.calls.slice(-2), ['settle', 'shot'])
  })
  test(`${motif.id}: forkert overskrift giver motivfejl uden billede`, async () => {
    const page = fakePage(motif.id, { wrongTitle: true })
    const result = await captureMotif(page, motif, 'shots')
    assert.equal(result.ok, false)
    assert.ok(result.error.includes(motif.id) && result.error.includes('Forkert overskrift'))
    assert.deepEqual(page.files, [])
  })
}

test('manglende tilstand og afbrudt klikvej afviser billedet', async () => {
  for (const opts of [{ missingCheck: true }, { failClick: 1 }]) {
    const page = fakePage('atlet-program', opts)
    assert.equal((await captureMotif(page, motifs[1], 'shots')).ok, false)
    assert.deepEqual(page.files, [])
  }
})

test('argumenter valideres og ingen argumenter er OFF', async () => {
  assert.equal(parseArgs([]), null)
  const browser = path.resolve('fake-browser.exe')
  assert.deepEqual(parseArgs(['--out', 'billeder med mellemrum', '--browser', browser]), { browser, out: path.resolve('billeder med mellemrum') })
  for (const args of [ ['--browser'], ['--out', ''], ['--browser', 'relative'], ['--unknown', 'x'],
    ['--browser', browser], ['--out', 'shots'], ['--browser', browser, '--out', '--browser'],
    ['--browser', browser, '--out', 'https://example.test'], ['--browser', browser, '--out', 'x\0y'],
    ['--browser', browser, '--out', 'shots', '--out', 'again'] ]) assert.throws(() => parseArgs(args))
  assert.deepEqual(await main([], new Proxy({}, { get() { throw new Error('OFF må ikke tilgå afhængigheder') } })), { off: true, results: [] })
})

test('CLI med syntetisk FS og browseropsætning, motivfejl fortsætter og oprydning', async () => {
  const calls = [], browserPath = path.resolve('fake-browser.exe'), out = path.resolve('shots')
  let index = 0
  const deps = {
    fs: { async stat(p) { calls.push(['stat', p]); return { isFile: () => p === browserPath, isDirectory: () => p === out } },
      async mkdir(p, opts) { assert.equal(p, out); assert.equal(opts.recursive, true) } },
    puppeteer: { async launch(opts) {
      assert.equal(opts.executablePath, browserPath); assert.equal(opts.headless, true)
      return { async newPage() {
        const id = motifs[index++].id
        return { id, async setViewport(v) { assert.deepEqual(v, { width: 375, height: 900, deviceScaleFactor: 1 }) },
          async emulateTimezone(v) { assert.equal(v, 'Europe/Copenhagen') },
          async setExtraHTTPHeaders(v) { assert.equal(v['Accept-Language'], 'da-DK') },
          async evaluateOnNewDocument(fn) { assert.equal(typeof fn, 'function') },
          async close() { calls.push(['close', id]) } }
      }, async close() { calls.push(['browser-close']) } }
    } },
    adapter: page => fakePage(page.id, { wrongTitle: page.id === 'atlet-hjem' }),
  }
  const result = await main(['--browser', browserPath, '--out', out], deps)
  assert.equal(result.results.length, 9)
  assert.equal(result.results.filter(r => r.ok).length, 8)
  assert.equal(calls.filter(c => c[0] === 'close').length, 9)
  assert.deepEqual(calls.at(-1), ['browser-close'])
  await assert.rejects(main(['--browser', browserPath, '--out', out], { fs: { stat: async () => ({ isFile: () => false }) } }), /ikke en fil/)
  await assert.rejects(main(['--browser', browserPath, '--out', out], { fs: { stat: async () => ({ isFile: () => true, isDirectory: () => false }), mkdir: async () => {} } }), /ikke en mappe/)
})

test('Puppeteer-adapter bruger rigtig domStep, ventetid, fullPage og PNG', async () => {
  const title = { role: 'heading', name: '^Coach\\.$' }, calls = []
  const page = { async waitForFunction(fn, opts, query, action) { assert.equal(fn, domStep); assert.equal(opts.timeout, 42); calls.push(action); return { jsonValue: async () => ({ name: 'Coach.' }), dispose: async () => calls.push('dispose') } },
    async evaluate(fn, query, action) { assert.equal(fn, domStep); assert.equal(query, title); return action === 'click' },
    async screenshot(opts) { assert.deepEqual(opts, { path: 'shot.png', fullPage: true, type: 'png' }) } }
  const adapter = pageAdapter(page, 42)
  await adapter.find(title); await adapter.click(title); await adapter.shot('shot.png')
  assert.deepEqual(calls, ['find', 'dispose', 'find', 'dispose'])
})

test('DOM: entydig synlig overskrift, forkert, skjult, dublet og previewbanner', () => {
  const title = { role: 'heading', name: '^Coach\\.$' }
  const hidden = el('h1', 'Coach.', { style: { display: 'none' } })
  const shown = el('h1', 'Coach.')
  withDom(el('div', '', {}, [hidden, shown]), () => assert.deepEqual(domStep(title), { name: 'Coach.' }))
  for (const children of [[el('h1', 'Forkert')], [hidden], [shown, el('h2', 'Coach.')],
    [el('aside', '', {}, [el('h1', 'Coach.'), el('details', '', {}, [el('summary', 'Skærmliste')])])]]) {
    withDom(el('div', '', {}, children), () => assert.equal(domStep(title), false))
  }
})

test('DOM: rigtige handlers, aria-navn, pressed, disabled og lukkede details', () => {
  const item = el('button', '⋯', { 'aria-label': 'Konto' })
  const hidden = el('button', 'Konto')
  const summary = el('summary', 'Skærmliste')
  const details = el('details', '', {}, [summary, hidden])
  const pressed = el('button', 'Rekorder', { 'aria-pressed': 'true' })
  withDom(el('div', '', {}, [item, details, pressed]), () => {
    assert.ok(domStep({ role: 'button', name: '^Konto$' }, 'click'))
    assert.equal(item.clicks, 1); assert.equal(hidden.clicks, 0)
    item.disabled = true
    assert.equal(domStep({ role: 'button', name: '^Konto$' }, 'click'), false)
    assert.equal(domStep({ role: 'button', name: '^Rekorder$', pressed: false }), false)
    assert.ok(domStep({ role: 'button', name: '^Rekorder$', pressed: true }))
    details.open = true; domStep(null, 'closeList'); assert.equal(details.open, false)
  })
})

test('DOM: teksttitel, indlejret atletknap og indlæsningsventen', () => {
  const title = el('div', 'Uge 6 · dato', {}, [el('span', '· planlagt')])
  const row = el('div', 'T', { role: 'button' }, [el('span', 'Testatlet'), el('span', 'Uge 5')])
  const loading = el('div', 'Indlæser…')
  withDom(el('div', '', {}, [title, row, loading]), () => {
    assert.ok(domStep(motifs[1].title)); assert.ok(domStep(motifs[6].steps[0], 'click')); assert.equal(row.clicks, 1)
    assert.equal(domStep(null, 'ready'), false)
    loading.hidden = true; assert.equal(domStep(null, 'ready'), true)
  })
})
