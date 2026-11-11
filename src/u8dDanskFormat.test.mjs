// u8d (ordre 89): tal og tider til mennesker står med dansk komma i resten af appen.
// Gemte værdier, AI-prompts og tekst der parses igen beholder punktum.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { komma, decimaler, feltKomma, feltPunktum } from './danskTal.mjs'
import { videoSetQueueDetail } from './athlete/videoSetSelection.mjs'
import { markerReplyContent, parseMarkerReply } from './videoMarkerReplies.mjs'
import { log2Defaults } from './athlete/appLog2.mjs'
import { defaultSetWeight, stepWeight } from './setLogDefaults.js'

const src = name => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8')

test('u8d: den fælles regel giver dansk komma og lader tekst være', () => {
  assert.equal(komma(87.5), '87,5')
  assert.equal(komma('102.25'), '102,25')
  assert.equal(komma(100), '100')
  assert.equal(komma('~85'), '~85')
  assert.equal(komma(null), '')
  assert.equal(decimaler(1.664, 2), '1,66')
  assert.equal(decimaler(-0.25), '-0,3')
  assert.equal(feltKomma('87.'), '87,')
  assert.equal(feltPunktum('87,5'), '87.5')
})

// Lukkede prøve-loadere tillader ingen ny import i disse filer. Kopierne skal være ordret ens med danskTal.mjs.
const KOPIER = {
  komma: String.raw`const komma = value => String(value ?? '').replace(/(\d)\.(\d)/, '$1,$2')`,
  decimaler: String.raw`const decimaler = (value, digits = 1) => value.toFixed(digits).replace('.', ',')`,
  feltKomma: String.raw`const feltKomma = value => String(value ?? '').replace('.', ',')`,
}
const LOKALE = {
  'athlete/DagensPasCard.jsx': ['komma', 'feltKomma'], 'athlete/ProgramTab.jsx': ['komma', 'feltKomma'],
  'athlete/TrainingFullscreen.mjs': ['komma', 'feltKomma'], 'athlete/HjemTab.jsx': ['komma'],
  'athlete/EnkelHjemTab.jsx': ['komma'], 'athlete/MeetDayPlanner.jsx': ['komma'],
  'athlete/videoSetSelection.mjs': ['komma'], 'athlete/athleteAnalysisBefore.jsx': ['komma'],
  'athlete/beskederOgVaegt.jsx': ['komma'], 'athlete/contactBaseFactory.jsx': ['komma'],
  'athlete/videoFeedbackPlayback.mjs': ['decimaler'], 'dashboard/AnalyseTab.jsx': ['komma', 'decimaler'],
  'dashboard/VideoReviewModal.jsx': ['komma'], 'dashboard/LogTab.jsx': ['komma'], 'dashboard/ProgramTab.jsx': ['komma'],
  'dashboard/StaevneTab.jsx': ['komma'], 'dashboard/profileWeekSummary.mjs': ['komma'],
  'dashboard/analyseSamlet.mjs': ['komma'], 'dashboard/coachVideoHjaelp.js': ['komma'],
  'dashboard/analyseSammenlign.mjs': ['decimaler'], 'videoMarkerReplies.mjs': ['decimaler'],
  'videoOptag2.mjs': ['decimaler'], 'fridayPreviewMarkers.mjs': ['decimaler'], 'vaMark2Page.mjs': ['decimaler'],
}
test('u8d: hver lokal kopi er ordret samme regel som danskTal.mjs', () => {
  const fælles = src('danskTal.mjs')
  for (const [navn, linje] of Object.entries(KOPIER)) assert.ok(fælles.includes(linje.replace('const ', 'export const ')), navn)
  for (const [fil, navne] of Object.entries(LOKALE)) {
    const tekst = src(fil)
    for (const navn of navne) assert.ok(tekst.includes(KOPIER[navn]), `${fil}: ${navn}`)
  }
})

test('u8d: ingen skærmtekst bruger toFixed uden dansk komma i de rettede filer', () => {
  const raa = /\$\{[^${}]*\.toFixed\(\d\)\}|\.toFixed\(\d\)\s*\+\s*'/
  for (const fil of ['coachBriefingRules.js', 'athlete/videoFeedbackPlayback.mjs', 'fridayPreviewMarkers.mjs', 'videoOptag2.mjs',
    'dashboard/analyseSammenlign.mjs', 'vaMark2Page.mjs', 'dashboard/AnalyseTab.jsx']) {
    assert.doesNotMatch(src(fil), raa, fil)
  }
  // Undtagelse: videosvarets gemte beskedhoved parses igen ordret og beholder punktum.
  const gemt = src('videoMarkerReplies.mjs').split('\n').filter(l => raa.test(l))
  assert.equal(gemt.length, 2)
  assert.ok(gemt.every(l => l.includes('${prefix} (${ref.start.toFixed(2)} s)')))
})

test('u8d: coachens briefing viser frafald, stagnation og RPE med komma', () => {
  const kilde = src('coachBriefingRules.js')
  assert.ok(kilde.includes('`${dec(perWeek)} sæt/uge nu mod'))
  assert.ok(kilde.includes('`${dec(perWeek)} sæt/uge (norm'))
  assert.ok(kilde.includes('kg (${dec(pct)} %)`'))
  assert.ok(kilde.includes('snit-afvigelse ${dec(drift, 2)} RPE'))
  assert.ok(kilde.includes('`afvigelse ${dec(drift, 2)} RPE'))
  // Det gemte måltal bevarer punktum.
  assert.ok(kilde.includes('recent_per_week: Number(rpw)'))
})

test('u8d: videosæt i coachens kø står med komma', () => {
  const video = { session_context: { video_set: { exercise_name: 'Squat', set_number: 2, load_kg: 102.5, reps: 3 } } }
  assert.equal(videoSetQueueDetail(video), 'Squat · sæt 2 · 102,5 kg · 3 gentagelser')
})

test('u8d: videosvarets gemte tekst beholder punktum og kan stadig læses', () => {
  const scope = { athleteId: 'a1', analysisId: 'v1' }
  const content = markerReplyContent(scope, { id: 'm1', start: 4.25 }, 'Hej')
  assert.ok(content.startsWith('Svar til videomarkering (4.25 s)\nHej'))
  const svar = parseMarkerReply({ sender_role: 'athlete', category: 'teknik', athlete_id: 'a1', content })
  assert.equal(svar.start, 4.25)
  assert.match(src('videoMarkerReplies.mjs'), /ved \$\{decimaler\(reply\.start, 2\)\} s:/)
  assert.match(src('videoMarkerReplies.mjs'), /el\('option', `\$\{decimaler\(marker\.start, 2\)\} s:/)
})

test('u8d: rå vægte foran kg står med komma på atlet- og coachskærme', () => {
  const skal = {
    'athlete/DagensPasCard.jsx': ['{komma(suggestion.weight)} kg', '{komma(last.weight)} kg', '${komma(lastPrior.weight)} kg', '${komma(log.weight)} kg', 'RPE ${komma(log.rpe_actual)}'],
    'athlete/HjemTab.jsx': ['Logget i dag · {komma(todayLog.weight)} kg', '{komma(b.weight)} kg'],
    'athlete/EnkelHjemTab.jsx': ['Logget i dag · {komma(todayLog.weight)} kg', '{komma(b.weight)} kg'],
    'athlete/FremgangTab.jsx': ['{kgTal(punkter[0].weight)} kg × {punkter[0].reps}'],
    'athlete/EnkelFremgangTab.jsx': ['{kgTal(punkter[0].weight)} kg × {punkter[0].reps}'],
    'athlete/ProgramTab.jsx': ['Anbefalet: {komma(ex.recommended_weight)}kg', '`+${komma(diff)}`', 'Forslag: {komma(s.weight)} kg', '{komma(ws.weight)}kg', '{komma(logged.weight)}kg'],
    'athlete/MeetDayPlanner.jsx': ['{komma(row.weight)} kg'],
    'athlete/athleteAnalysisBefore.jsx': ['${komma(analysis.load_kg)} kg'],
    'athlete/beskederOgVaegt.jsx': ['${komma(analysis.load_kg)} kg'],
    'athlete/contactBaseFactory.jsx': ['${komma(analysis.load_kg)} kg'],
    'athlete/TrainingFullscreen.mjs': ['${komma(present(log.weight))} kg', 'RPE ${komma(present(log.rpe_actual))}'],
    'dashboard/AnalyseTab.jsx': ['${komma(analysis.load_kg)} kg', '{komma(pr.weight)} kg', 'e1RM-trend ${decimaler(regression.slope, 2)} kg pr. dag'],
    'dashboard/VideoReviewModal.jsx': ['${komma(analysis.load_kg)} kg'],
    'dashboard/LogTab.jsx': ['{komma(set.weight)}kg'],
    'dashboard/ProgramTab.jsx': ['Anbefalet: {komma(ex.recommended_weight)}kg', 'Sidst logget: {komma(last.weight)}kg'],
    'dashboard/StaevneTab.jsx': ['{komma(pr.weight)} kg'],
    'dashboard/profileWeekSummary.mjs': ['${komma(best.weight)} kg'],
    'dashboard/analyseSamlet.mjs': ['${komma(selected.kg)} kg'],
    'dashboard/coachVideoHjaelp.js': ['${komma(video.load_kg)} kg'],
  }
  for (const [fil, stykker] of Object.entries(skal)) {
    const tekst = src(fil)
    for (const stykke of stykker) assert.ok(tekst.includes(stykke), `${fil}: ${stykke}`)
    assert.doesNotMatch(tekst, /[{$]\{?(?:[a-z]+\.)?(?:weight|load_kg|recommended_weight)\}\s?kg/i, fil)
  }
})

test('u8d: vægtfelterne viser komma, mens feltets state beholder punktum', () => {
  // Feltets state er et maskintal: det parses ved gem og sammenlignes med forudfyldningen.
  assert.equal(log2Defaults({ recommended_weight: 82.5, reps: '5' }, null, null).weight, '82.5')
  assert.equal(defaultSetWeight('', { coachWeight: 87.5 }), '87.5')
  assert.equal(stepWeight('85', 2.5), '87.5')
  // Skærmen viser samme tal med komma, og en tastet komma bliver punktum i state.
  assert.equal(feltKomma(log2Defaults({ recommended_weight: 82.5, reps: '5' }, null, null).weight), '82,5')
  const dagens = src('athlete/DagensPasCard.jsx')
  assert.ok(dagens.includes('placeholder="kg" value={feltKomma(input.weight)}'))
  assert.ok(dagens.includes('inputMode="decimal" value={feltKomma(editInput.weight)}'))
  assert.equal(dagens.split("const v = e.target.value.replace(',', '.')").length - 1, 2)
  const program = src('athlete/ProgramTab.jsx')
  assert.ok(program.includes('placeholder="kg" value={feltKomma(input.weight)}'))
  assert.ok(program.includes("const v = e.target.value.replace(',', '.')"))
  assert.ok(src('athlete/TrainingFullscreen.mjs').includes("value: name === 'reps' ? value : feltKomma(value),"))
})
