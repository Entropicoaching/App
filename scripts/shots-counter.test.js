import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { motifs, domStep, captureMotif, main } from './friday-shots.mjs'
import { fakePage, element as el, withDom } from './shotsFake.mjs'

test('modprøve: alle planlagte klik skal ramme synlig entydig DOM og handler', () => {
  const labels = ['Mere', 'Mit program', 'Næste uge →']
  let stage = 0
  for (const step of motifs[1].steps) {
    const active = el('button', labels[stage], { onClick() { stage++ } })
    const duplicate = el('button', labels[stage], { style: { visibility: 'hidden' } })
    withDom(el('div', '', {}, [duplicate, active]), () => assert.ok(domStep(step, 'click')))
  }
  assert.equal(stage, 3)
})

test('modprøve: et forkert motivnavn i previewbanner kan ikke opfylde overskrift', () => {
  const aside = el('aside', '', {}, [el('h2', 'Coachens analyse samlet'), el('details', '', { open: true }, [el('summary', 'Skærmliste')])])
  withDom(el('div', '', {}, [aside, el('h2', 'Videoanalyse')]), () => assert.equal(domStep(motifs[7].title), false))
})

test('modprøve: lukket menu og lav opacitet tæller ikke som korrekt side', () => {
  for (const attrs of [{ style: { opacity: '0' } }, { noRect: true }, { hidden: true }]) {
    withDom(el('div', '', {}, [el('h2', 'Videokø', attrs)]), () => assert.equal(domStep(motifs[8].title), false))
  }
})

test('modprøve: manglende overskrift og screenshotfejl giver motivfejl', async () => {
  for (const failure of ['title', 'shot']) {
    const page = fakePage('coach-atletprofil')
    if (failure === 'title') page.find = async () => { throw new Error('Timeout') }
    else page.shot = async () => { throw new Error('FS fuld') }
    const result = await captureMotif(page, motifs[6], 'out')
    assert.equal(result.ok, false); assert.ok(result.error.includes('coach-atletprofil'))
  }
})

test('modprøve: setupfejl lukker siden, prøver næste motiv og lukker browser', async () => {
  let opened = 0, closed = 0, browserClosed = false
  const result = await main(['--browser', path.resolve('fake.exe'), '--out', 'shots'], {
    fs: { stat: async () => ({ isFile: () => true, isDirectory: () => true }), mkdir: async () => {} },
    puppeteer: { launch: async () => ({ newPage: async () => { opened++; return {
      setViewport: async () => { throw new Error('Setupfejl') }, close: async () => { closed++ },
    } }, close: async () => { browserClosed = true } }) },
  })
  assert.equal(opened, 16); assert.equal(closed, 16); assert.equal(browserClosed, true)
  assert.equal(result.results.filter(r => !r.ok).length, 16)
})
