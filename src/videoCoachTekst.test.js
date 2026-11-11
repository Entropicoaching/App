import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FILM_GUIDE_HTML, FILM_GUIDE_KEY, mountUploadFilmGuide } from '../public/videoFilmGuide.mjs'
import { createVideoReviewStatusHandler } from './dashboard/videoReviewStatus.mjs'
import { videoCoachFeedbackQuality } from './videoCoachFeedbackQuality.js'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')
const DASH = /[–—]/

class Element {
  constructor() { this.hidden = false; this.attributes = {}; this.listeners = new Map(); this.children = [] }
  setAttribute(k, v) { this.attributes[k] = v }
  addEventListener(k, f) { if (!this.listeners.has(k)) this.listeners.set(k, new Set()); this.listeners.get(k).add(f) }
  removeEventListener(k, f) { this.listeners.get(k)?.delete(f) }
  click() { for (const fn of this.listeners.get('click') || []) fn({ stopPropagation() {} }) }
  set innerHTML(value) { this.html = value; this.button = new Element(); this.panel = new Element(); this.arrow = new Element() }
  querySelector(id) { return { '#film-guide-toggle': this.button, '#film-guide-panel': this.panel, '#film-guide-arrow': this.arrow }[id] }
  insertBefore(node) { this.children.unshift(node) }
}
function memoryStorage() {
  const values = new Map()
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }
}
const visibleText = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

test('filmguiden er kort, har seks punkter og kan stadig foldes sammen', () => {
  assert.equal((FILM_GUIDE_HTML.match(/<li>/g) || []).length, 6)
  assert.ok(visibleText(FILM_GUIDE_HTML).split(' ').length <= 130)
  assert.ok(!DASH.test(FILM_GUIDE_HTML))
  const storage = memoryStorage()
  const drop = new Element()
  const doc = { getElementById: id => id === 'dropHint' ? drop : null, createElement: () => new Element() }
  const dispose = mountUploadFilmGuide(doc, () => storage)
  const host = drop.children[0]
  assert.equal(host.panel.hidden, false)
  host.button.click()
  assert.equal(host.panel.hidden, true)
  assert.equal(host.button.attributes['aria-expanded'], 'false')
  assert.equal(storage.getItem(FILM_GUIDE_KEY), '1')
  dispose()
})

test('filmguiden siger det, atleten skal gøre, i Marcs enkle sprog', () => {
  const text = visibleText(FILM_GUIDE_HTML)
  for (const part of ['Gælder squat, bænkpres og dødløft', 'Stil telefonen ved siden af dig', 'Stå 3 til 4 meter væk',
    'zoom ikke', 'Godt lys', 'Stabil telefon', 'Hele løftet', 'at du har sat den tilbage', 'et skøn', 'ikke et facit']) assert.ok(text.includes(part), part)
  for (const gammelt of ['knæbøjning', 'vinkelret', 'Som praktisk råd', 'Vi lover ikke']) assert.ok(!text.includes(gammelt), gammelt)
})

test('samme filmguide står i modulet, i videocoach.html og på protokolsiden', () => {
  assert.ok(read('../public/videocoach.html').includes(JSON.stringify(FILM_GUIDE_HTML)))
  const protocol = read('../public/VIDEO-FILMPROTOKOL.html')
  const panel = /<div id="film-guide-panel">([\s\S]*?)<\/div>/.exec(protocol)[1]
  const wanted = /<div id="film-guide-panel">([\s\S]*?)<\/div>$/.exec(FILM_GUIDE_HTML)[1]
  assert.equal(panel.replace(/\s+/g, ' ').trim(), wanted.replace(/\s+/g, ' ').trim())
})

test('uploadtekster i videocoach.html fortæller hvad der sker og hvad næste skridt er', () => {
  const html = read('../public/videocoach.html')
  const nye = [
    'Send dit sæt til din coach',
    'Vælg videoen, vælg løft, og tryk Send til coach.',
    'Videoen sendes først, når du selv trykker Send video til coach.',
    'Din coach sporer og gennemgår videoen bagefter. Svaret kommer i Beskeder under Teknik &amp; løft.',
    'Sender video (${mb} MB). Bliv på skærmen, til den er sendt.',
    // U9 (Marc 11. nov.): kvitteringen står i statuskortet med klokkeslæt; fejl hedder "Ikke sendt · Prøv igen".
    "sent: ['Sendt til Marc ✓'",
    'Din coach gennemgår den. Feedbacken kommer i Beskeder under Teknik & løft.',
    'Annulleret. Intet er sendt, og videoen er stadig valgt.',
    'Ikke sendt · Prøv igen. ${error.message}. Videoen er stadig valgt.',
    'Gemt på telefonen. Den sendes af sig selv, når du har forbindelse igen.',
    'Start finder stangbanen og sender videoen. Vis mig nu giver dig et hurtigt kig, og videoen sendes bagefter.',
    'Din video ligger klar til din coach. Feedbacken finder du i Beskeder under Teknik & løft.',
  ]
  for (const tekst of nye) { assert.ok(html.includes(tekst), tekst); assert.ok(!DASH.test(tekst), tekst) }
  for (const gammelt of ['Afvent coachens feedback', 'resten klarer vi', 'når han åbner den',
    "Video modtaget ✓',\n        VC_ATHLETE_INSTANT", 'Din måling ligger klar']) assert.ok(!html.includes(gammelt), gammelt)
  // Knapper og flag er uændrede: knappen hedder stadig det samme, og instant er stadig eget flow.
  for (const uaendret of ['Send til coach', 'Send video til coach', 'Åbn video', 'Optag eller vælg video', 'VC_ATHLETE_INSTANT']) assert.ok(html.includes(uaendret), uaendret)
})

test('atletens feedbackkort og hjemkort bruger de nye tekster', () => {
  const hjem = read('./athlete/HjemTab.jsx'), enkel = read('./athlete/EnkelHjemTab.jsx')
  for (const kilde of [hjem, enkel]) {
    assert.ok(kilde.includes('Film dit løft og send det til din coach'))
    assert.ok(kilde.includes('Åbn VideoCoach →'))
    assert.ok(!kilde.includes('mål stanghastighed'))
  }
  const beskeder = read('./athlete/BeskederTab.jsx')
  assert.ok(beskeder.includes('Ingen feedback endnu. Har du sendt en video, dukker feedbacken op her, når din coach har gennemgået og delt den.'))
  const kort = read('./athlete/beskederOgVaegt.jsx')
  assert.ok(kort.includes("'Se feedback'") && kort.includes('Din coach har delt stangbanen uden en tekstkommentar.'))
})

test('coachens feedbackskærm forklarer hvad atleten ser og hvad næste skridt er', () => {
  const modal = read('./dashboard/VideoReviewModal.jsx')
  for (const tekst of ['Det atleten ser, når du deler', 'Ét cue til næste sæt. Hvad skal atleten gøre?',
    'Der er ingen tekstfeedback. Atleten ser kun stangbanen, når du deler.', 'Del feedback med atlet']) assert.ok(modal.includes(tekst), tekst)
})

function statusFixture() {
  const flashes = []
  const analysis = { id: 'a1', athlete_id: 'x1', status: 'coach_approved', client_analysis_id: 'c1', athlete_feedback: null }
  let status
  const query = {
    update(payload) { status = payload.status; return this }, eq() { return this }, is() { return this },
    filter() { return this }, select() { return this },
    async single() { return { data: { id: 'a1', athlete_id: 'x1', status }, error: null } },
  }
  const handler = createVideoReviewStatusHandler({
    selectedAthlete: { id: 'x1' }, videoBaselines: [], videoAnalysisUpdatingId: null, videoAnalysisFeedbackDirty: false,
    videoCoachFeedbackQuality: () => ({ canShare: true }), videoCoachPersonalBaselineOptions: () => [],
    videoCoachPersonalBaselineSelection: () => true, openVideoAnalysisReview: async () => {},
    setVideoAnalysisReviewError: () => {}, showFlash: (...args) => flashes.push(args),
    setVideoAnalysisUpdatingId: () => {}, setVideoAnalysisError: () => {},
    supabase: { from: () => query }, fetchVideoCoachHistory: async () => {}, fetchVideoReviewQueue: () => {},
    setVideoAnalysisReview: () => {},
  })
  return { handler, analysis, flashes }
}

test('statusbeskeder til coachen siger hvad der skete og hvad der kommer nu', async () => {
  const draft = statusFixture()
  draft.analysis.status = 'draft'
  await draft.handler(draft.analysis, 'coach_approved')
  const [godkendt] = draft.flashes[0]
  assert.match(godkendt, /Atleten ser intet endnu/)
  assert.match(godkendt, /tryk Del feedback med atlet/)
  const shared = statusFixture()
  await shared.handler(shared.analysis, 'shared')
  assert.deepEqual(shared.flashes, [['Feedback delt. Atleten kan se den i appen.', 'success']])
  for (const [tekst] of [...draft.flashes, ...shared.flashes]) assert.ok(!DASH.test(tekst))
})

test('feedbackkvalitet: nye titler, uændrede krav til deling', () => {
  const klar = videoCoachFeedbackQuality({ works: ['Bunden sidder fint'], focus: ['Stangen driver frem i bunden'], next_set: ['Pres gulvet væk og hold stangen over midtfoden'] })
  assert.equal(klar.canShare, true)
  assert.equal(klar.title, 'Klar til at dele med atleten')
  assert.match(klar.detail, /Du kan dele den nu/)
  const udenPositiv = videoCoachFeedbackQuality({ focus: ['Stangen driver frem i bunden'], next_set: ['Pres gulvet væk og hold stangen over midtfoden'] })
  assert.equal(udenPositiv.canShare, true)
  assert.equal(udenPositiv.title, 'Næsten klar. Tjek formuleringen')
  const mangler = videoCoachFeedbackQuality({ works: ['Fint'] })
  assert.equal(mangler.canShare, false)
  assert.equal(mangler.title, 'Feedbacken mangler retning')
  assert.match(mangler.detail, /ét tydeligt fokus og én handling til næste sæt, før du kan dele\./)
  const flere = videoCoachFeedbackQuality({ focus: ['A'], next_set: ['Hold', 'Pres'] })
  assert.match(flere.detail, /prioriteret cue/)
})

test('analyseskaermens titel følger stadig flaget, kun strengene er nye', () => {
  const html = read('../public/videocoach.html')
  const m = /analyzing: \[(VC_ATHLETE_INSTANT \? '[^']*' : '[^']*'),/.exec(html)
  assert.ok(m, 'betingelsen på analyzing-titlen skal være bevaret')
  const titel = (flag) => new Function('VC_ATHLETE_INSTANT', `return ${m[1]}`)(flag)
  assert.equal(titel(true), 'Sporer sættet')
  assert.equal(titel(false), 'Sporer og sender sættet')
  // Intet er modtaget under sporingen, så titlen må ikke være kvitteringen.
  assert.notEqual(titel(false), 'Video modtaget ✓')
  assert.ok(!DASH.test(titel(false)))
})
