// ORDRE 2441v: fremgang under sendingen og "Nettet er langsomt" ved stilstand. Browserprøven ligger i
// e2e/video-send-2441v.spec.mjs (langsomt net via CDP og stilstand, som atlet og som coach).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSendFremgang, mbTekst, sendFremgangTekst, VC_SEND_LANGSOMT_TEKST, VC_SEND_STILLE_MS } from './vcSendFremgang.mjs'

const MB = 1024 * 1024

// Falsk ur: now() styres, og intervallet kører, når uret stilles frem.
function opstil({ total = 14.1 * MB } = {}) {
  let tid = 100000
  const vist = []
  const intervaller = []
  const fremgang = createSendFremgang({
    total, vis: tekst => vist.push({ tid, tekst }), now: () => tid,
    setInterval: (fn, ms) => { intervaller.push({ fn, ms }); return 7 },
    clearInterval: id => { intervaller.length = 0; assert.equal(id, 7) },
  })
  const frem = ms => { for (let i = 0; i < ms; i += 1000) { tid += 1000; for (const it of intervaller) it.fn() } }
  return { fremgang, vist, frem, intervaller, total }
}

test('2441v: MB med dansk komma og én decimal', () => {
  assert.equal(mbTekst(14.1 * MB), '14,1')
  assert.equal(mbTekst(6.25 * MB), '6,3')
  assert.equal(mbTekst(0), '0,0')
  assert.equal(mbTekst(NaN), '0,0')
  assert.equal(sendFremgangTekst(6.2 * MB, 14.1 * MB), 'Sender video: 6,2 af 14,1 MB')
})

test('2441v: teksterne er danske uden tankestreger', () => {
  assert.equal(VC_SEND_LANGSOMT_TEKST, 'Nettet er langsomt. Videoen sendes stadig, bliv på skærmen.')
  assert.doesNotMatch(VC_SEND_LANGSOMT_TEKST + sendFremgangTekst(1, 2), /[–—]/)
  assert.doesNotMatch(VC_SEND_LANGSOMT_TEKST, /network|upload|slow/i)
  assert.equal(VC_SEND_STILLE_MS, 20000)
})

test('2441v: målt fremgang vises som MB sendt, højst én gang i sekundet, og den sidste altid', () => {
  const { fremgang, vist, total } = opstil()
  assert.equal(vist.length, 0, 'intet før første måling')
  fremgang.onProgress({ loaded: 0.5 * MB, total })
  assert.deepEqual(vist.map(v => v.tekst), ['Sender video: 0,5 af 14,1 MB'])
  // Samme sekund: ikke vist igen.
  fremgang.onProgress({ loaded: 0.6 * MB, total })
  fremgang.onProgress({ loaded: 0.7 * MB, total })
  assert.equal(vist.length, 1)
  // Hele klippet: vises straks, selv i samme sekund.
  fremgang.onProgress({ loaded: total, total })
  assert.deepEqual(vist.map(v => v.tekst), ['Sender video: 0,5 af 14,1 MB', 'Sender video: 14,1 af 14,1 MB'])
  assert.equal(fremgang.status().langsomt, false)
  fremgang.stop()
})

test('2441v: fremgangen vises igen efter et sekund, og tal uden total ignoreres', () => {
  const { fremgang, vist, frem, total } = opstil()
  fremgang.onProgress({ loaded: 1 * MB, total })
  frem(1000)
  fremgang.onProgress({ loaded: 2 * MB, total })
  frem(1000)
  fremgang.onProgress({ loaded: 3 * MB, total })
  assert.deepEqual(vist.map(v => v.tekst), ['Sender video: 1,0 af 14,1 MB', 'Sender video: 2,0 af 14,1 MB', 'Sender video: 3,0 af 14,1 MB'])
  fremgang.onProgress({ loaded: 4 * MB, total: 0 })
  fremgang.onProgress({ loaded: -1, total })
  fremgang.onProgress(null)
  assert.equal(vist.length, 3, 'ikke-målte tal viser intet')
  fremgang.stop()
})

test('2441v: uden målinger står der efter 20 s, at nettet er langsomt, og kun én gang', () => {
  const { fremgang, vist, frem, intervaller } = opstil()
  assert.equal(intervaller[0].ms, 1000, 'uret tjekker hvert sekund')
  frem(19000)
  assert.equal(vist.length, 0)
  frem(1000)
  assert.deepEqual(vist.map(v => v.tekst), [VC_SEND_LANGSOMT_TEKST])
  frem(30000)
  assert.equal(vist.length, 1, 'ikke gentaget')
  assert.equal(fremgang.status().langsomt, true)
  fremgang.stop()
})

test('2441v: under 1 % fremgang i 20 s giver "Nettet er langsomt"; over 1 % holder fremgangen i live', () => {
  const { fremgang, vist, frem, total } = opstil()
  // 400 kbit/s (2437 c): ca. 50 KB/s, dvs. ca. 0,35 % pr. sekund, 1 % på under 3 s: aldrig langsomt.
  let sendt = 0
  for (let s = 0; s < 60; s++) { sendt += 50 * 1024; fremgang.onProgress({ loaded: sendt, total }); frem(1000) }
  assert.equal(vist.some(v => v.tekst === VC_SEND_LANGSOMT_TEKST), false, 'ikke langsomt ved 400 kbit/s')
  assert.match(vist.at(-1).tekst, /^Sender video: 2,9 af 14,1 MB$/)
  // Nu kun 1 KB/s (under 1 % på 20 s): langsomt efter 20 s.
  const foer = vist.length
  for (let s = 0; s < 20; s++) { sendt += 1024; fremgang.onProgress({ loaded: sendt, total }); frem(1000) }
  assert.equal(vist.at(-1).tekst, VC_SEND_LANGSOMT_TEKST)
  assert.ok(vist.length > foer)
  // Kommer fremgangen igen (mindst 1 %), vises MB igen.
  sendt += 0.2 * MB
  fremgang.onProgress({ loaded: sendt, total })
  assert.match(vist.at(-1).tekst, /^Sender video: 3,1 af 14,1 MB$/)
  assert.equal(fremgang.status().langsomt, false)
  fremgang.stop()
})

test('2441v: stilstand ved 100 % (serveren svarer ikke) giver også "Nettet er langsomt"', () => {
  const { fremgang, vist, frem, total } = opstil()
  fremgang.onProgress({ loaded: total, total })
  frem(20000)
  assert.deepEqual(vist.map(v => v.tekst), ['Sender video: 14,1 af 14,1 MB', VC_SEND_LANGSOMT_TEKST])
  fremgang.stop()
})

test('2441v: efter stop() skrives intet, så "Sendt" og "Ikke sendt" aldrig overskrives', () => {
  const { fremgang, vist, frem, total, intervaller } = opstil()
  fremgang.onProgress({ loaded: 1 * MB, total })
  fremgang.stop()
  assert.equal(intervaller.length, 0, 'uret er ryddet')
  frem(60000)
  fremgang.onProgress({ loaded: total, total })
  assert.equal(vist.length, 1)
  assert.equal(fremgang.status().slut, true)
})
