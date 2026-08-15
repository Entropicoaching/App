import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { sanitizeVideoCoachFeedbackEvidence } from '../src/videoCoachFeedbackEvidence.js'
import { videoCoachFeedbackQuality } from '../src/videoCoachFeedbackQuality.js'
import { sanitizeVideoCoachPersonalBaseline, videoCoachPersonalBaselineAthleteText, videoCoachPersonalBaselineForAnalysis, videoCoachPersonalBaselineOptions, videoCoachPersonalBaselineSelection, withVideoCoachPersonalBaseline } from '../src/videoCoachPersonalFeedback.js'

const personalAnalysis = {
  id: 'analysis-01', athlete_id: 'athlete-01', lift: 'bench', variation: 'slingshot',
  low_conf_pct: 4,
  metrics: {
    bar_drift_cm: { value: 2.4, method: 'tracked_path_calibrated_v1',
      eligible_for_baseline: true, confidence: 0.9 },
  },
  findings: [{ id: 'baseline_bar_drift_cm', kind: 'works',
    summary: 'Stangbanen var mere stabil end din normale Slingshot-bænk.',
    evidence_refs: ['bar_drift_cm'], confidence: 0.88 }],
  session_context: { baseline_snapshot: [{ metric_key: 'bar_drift_cm',
    metric_method: 'tracked_path_calibrated_v1', baseline_version: 'approved_median_mad_v1',
    n_analyses: 5 }] },
}
const personalBaselines = [{ lift: 'bench', variation: 'slingshot',
  metric_key: 'bar_drift_cm', metric_method: 'tracked_path_calibrated_v1',
  baseline_version: 'approved_median_mad_v1', median: 4.1, n_analyses: 5 }]
const personalOptions = videoCoachPersonalBaselineOptions(personalBaselines,
  personalAnalysis, 'athlete-01')
assert.equal(personalOptions.length, 1)
assert.equal(personalOptions[0].evidence_ref.metric_method, 'tracked_path_calibrated_v1')
assert.equal(personalOptions[0].evidence_ref.n_analyses, 5)

assert.equal(videoCoachPersonalBaselineOptions(personalBaselines,
  personalAnalysis, 'another-athlete').length, 0, 'Atletidentiteten skal matche')
assert.equal(videoCoachPersonalBaselineOptions([{ ...personalBaselines[0], n_analyses: 2 }],
  personalAnalysis, 'athlete-01').length, 0, 'Mindst tre analyser er påkrævet')
assert.equal(videoCoachPersonalBaselineOptions(personalBaselines, {
  ...personalAnalysis, low_conf_pct: 16,
}, 'athlete-01').length, 0, 'Eksisterende tracking-confidence gate skal gælde')
assert.equal(videoCoachPersonalBaselineOptions(personalBaselines, {
  ...personalAnalysis, low_conf_pct: null,
}, 'athlete-01').length, 0, 'Manglende tracking-confidence må ikke blive til perfekt kvalitet')
assert.equal(videoCoachPersonalBaselineOptions(personalBaselines, {
  ...personalAnalysis,
  metrics: { bar_drift_cm: { ...personalAnalysis.metrics.bar_drift_cm, confidence: 0.74 } },
}, 'athlete-01').length, 0, 'Eksisterende metric-confidence gate skal gælde')
assert.equal(videoCoachPersonalBaselineOptions(personalBaselines, {
  ...personalAnalysis,
  metrics: { bar_drift_cm: { ...personalAnalysis.metrics.bar_drift_cm, confidence: null } },
}, 'athlete-01').length, 0, 'Manglende metric-confidence må ikke tælle som sikker')
assert.equal(videoCoachPersonalBaselineOptions(personalBaselines, {
  ...personalAnalysis,
  findings: [{ ...personalAnalysis.findings[0], evidence_refs: [] }],
}, 'athlete-01').length, 0, 'Fundet skal have en evidencereference')
assert.equal(videoCoachPersonalBaselineOptions(personalBaselines, {
  ...personalAnalysis,
  metrics: { bar_drift_cm: { ...personalAnalysis.metrics.bar_drift_cm, value: null } },
}, 'athlete-01').length, 0, 'En tom måling må ikke blive til tallet nul')

const feedbackWithBaseline = withVideoCoachPersonalBaseline({ focus: [] }, personalOptions[0])
assert.equal(Array.isArray(feedbackWithBaseline.personal_baseline), false,
  'Baselinevalget skal være ét objekt og aldrig en liste')
assert.equal(videoCoachPersonalBaselineSelection(feedbackWithBaseline, personalOptions),
  'baseline_bar_drift_cm')
assert.equal(videoCoachPersonalBaselineSelection(feedbackWithBaseline, [{
  ...personalOptions[0], evidence_ref: {
    ...personalOptions[0].evidence_ref, baseline_version: 'new-baseline-version',
  },
}]), '', 'En ny baselineversion kræver et nyt coach-review')
assert.equal(videoCoachPersonalBaselineForAnalysis(feedbackWithBaseline, personalAnalysis,
  'athlete-01')?.evidence_ref.finding_id, 'baseline_bar_drift_cm')
assert.equal(videoCoachPersonalBaselineAthleteText(personalOptions[0]),
  'Stangbanen var mere stabil end din normale Slingshot-bænk.')
assert.equal(videoCoachPersonalBaselineForAnalysis(feedbackWithBaseline, personalAnalysis,
  'another-athlete'), null, 'Athlete View skal også kontrollere atletidentiteten')
assert.equal(videoCoachPersonalBaselineForAnalysis(feedbackWithBaseline,
  { ...personalAnalysis, id: 'another-analysis' }, 'athlete-01'), null,
  'Athlete View skal også kontrollere analysereferencen')
assert.equal(sanitizeVideoCoachPersonalBaseline({ ...personalOptions[0],
  evidence_ref: { ...personalOptions[0].evidence_ref, n_analyses: 2 } }), null)
assert.equal(withVideoCoachPersonalBaseline(feedbackWithBaseline, null).personal_baseline, undefined,
  'Coachens valg af Ingen skal fjerne baselinefundet')

const strong = videoCoachFeedbackQuality({
  works: [{ text: 'Bundpositionen gentages fra rep til rep.' }],
  focus: [{ text: 'Overkroppen falder frem i starten af opstigningen.' }],
  next_set: [{ text: 'Bevar trykket gennem foden, mens hofte og skuldre rejser sig sammen.' }],
})
assert.equal(strong.level, 'strong')
assert.equal(strong.canShare, true)

const missingAction = videoCoachFeedbackQuality({ focus: 'Farten falder i den svære del.' })
assert.equal(missingAction.canShare, false)
assert.match(missingAction.detail, /handling til næste sæt/)

const repeated = videoCoachFeedbackQuality({
  focus: 'Hold stangen tæt og spænd lats',
  next_set: 'Hold stangen tæt og spænd lats',
})
assert.equal(repeated.canShare, false)
assert.match(repeated.detail, /omsætter observationen/)

const competingCues = videoCoachFeedbackQuality({
  focus: 'Stanglinjen flytter sig fra kroppen.',
  next_set: 'Hold stangen tæt.\nSkub gulvet væk.',
})
assert.equal(competingCues.canShare, false)
assert.match(competingCues.detail, /prioriteret cue/)

const review = videoCoachFeedbackQuality({
  focus: 'Farten falder i den svære del.',
  next_set: 'Et bedre opspænd ved 55% sticking point.',
})
assert.equal(review.canShare, true)
assert.equal(review.needsReview, true)
assert.equal(review.warnings.length, 3)

const html = fs.readFileSync(process.argv[2] || new URL('../public/videocoach.html', import.meta.url), 'utf8')
const modelMatch = html.match(/\/\/ COACH_FEEDBACK_MODEL_START([\s\S]*?)\/\/ COACH_FEEDBACK_MODEL_END/)
assert.ok(modelMatch, 'Det prioriterede feedbacklag skal kunne udtrækkes')
const cueMatch = html.match(/(function suggestCues\([\s\S]*?)\r?\n\r?\n\/\/ COACH_FEEDBACK_MODEL_START/)
assert.ok(cueMatch, 'Coachens cue-udkast skal kunne udtrækkes')
const context = {}
vm.runInNewContext(`${modelMatch[1]}; ${cueMatch[1]}; this.buildCoachFeedback = buildCoachFeedback; this.suggestCues = suggestCues`, context)

const evidenceMatch = html.match(/\/\/ COACH_FEEDBACK_EVIDENCE_START([\s\S]*?)\/\/ COACH_FEEDBACK_EVIDENCE_END/)
assert.ok(evidenceMatch, 'Feedbackens coach-only målegrundlag skal kunne udtrækkes')
vm.runInNewContext(`${evidenceMatch[1]}; this.vcV3FeedbackEvidence = vcV3FeedbackEvidence`, context)

const insightMatch = html.match(/(function vcV3BaselineInsights\([\s\S]*?)\r?\n\r?\nfunction vcV3CurrentBaselineInsights/)
assert.ok(insightMatch, 'Personlig baseline-sammenligning skal kunne udtrækkes')
vm.runInNewContext(`${insightMatch[1]}; this.vcV3BaselineInsights = vcV3BaselineInsights`, context)
const pathQualityMatch = html.match(/(function vcV3PathLowConfidencePct\([\s\S]*?)\r?\n\r?\nfunction vcV3Metrics/)
assert.ok(pathQualityMatch, 'Trackerens confidence-afledning skal kunne udtrækkes')
vm.runInNewContext(`${pathQualityMatch[1]}; this.vcV3PathLowConfidencePct = vcV3PathLowConfidencePct`, context)
assert.equal(context.vcV3PathLowConfidencePct({ pts: [{}, {}], valid: [true, true] }), 0,
  'Nul afviste frames skal gemmes som 0% og ikke som ukendt kvalitet')
assert.equal(context.vcV3PathLowConfidencePct({ pts: [{}, {}], valid: [true, false] }), 50)
assert.equal(context.vcV3PathLowConfidencePct({ pts: [{}, {}] }), null,
  'Manglende kvalitetsdata må fortsat være ukendt')
const insightBaseline = [{ lift: 'bench', variation: 'slingshot', metric_key: 'bar_drift_cm',
  metric_method: 'tracked_path_calibrated_v1', median: 4, mad: 0.5, n_analyses: 5 }]
const insightMetric = { bar_drift_cm: { value: 8, unit: 'cm', method: 'tracked_path_calibrated_v1',
  eligible_for_baseline: true, confidence: 0.9 } }
assert.equal(context.vcV3BaselineInsights(insightBaseline, 'bench', 'slingshot',
  insightMetric, null).comparedCount, 0, 'Ukendt tracking-kvalitet må ikke give personlig sammenligning')
assert.equal(context.vcV3BaselineInsights(insightBaseline, 'bench', 'slingshot',
  { bar_drift_cm: { ...insightMetric.bar_drift_cm, confidence: 0.74,
    eligible_for_baseline: false } }, 2).comparedCount, 0,
'En ukalibreret eller usikker metric må ikke sammenlignes med baseline')
assert.equal(context.vcV3BaselineInsights(insightBaseline, 'bench', 'slingshot',
  insightMetric, 16).comparedCount, 0, 'Lav tracker-confidence må ikke give personlig sammenligning')

const deadlift = context.buildCoachFeedback('Dødløft', {
  driftCm: 6.2,
  dipPct: 70,
  lossPct: 24,
  lowConfPct: 2,
})
assert.equal(deadlift.primary.title, 'Tydelig udtrætning over sættet')
assert.match(deadlift.athlete.next, /stoppe sættet|reducere reps|længere pause/)

const uncertain = context.buildCoachFeedback('Squat', { lowConfPct: 22, driftCm: 7 })
assert.equal(uncertain.primary.title, 'Kontrollér banen først')
assert.match(uncertain.athlete.next, /Kør analysen igen/)

assert.equal(context.suggestCues('Squat', { lowConfPct: 22, driftCm: 7.1 }).length, 0)

const normalConfidenceCues = context.suggestCues('Squat', { lowConfPct: 2, driftCm: 7.1 })
assert.ok(normalConfidenceCues.some(([, evidence]) => /drift/.test(evidence)))

const squat = context.buildCoachFeedback('Squat', {
  driftCm: 7.4,
  dipPct: 68,
  effPct: 82,
  lowConfPct: 2,
})
assert.equal(squat.primary.title, 'Stangen forlader den lodrette linje')
assert.match(squat.athlete.next, /midtfod/)
assert.equal(videoCoachFeedbackQuality({
  works: squat.athlete.works,
  focus: squat.athlete.focus,
  next_set: squat.athlete.next,
}).level, 'strong')

const squatEvidence = sanitizeVideoCoachFeedbackEvidence(context.vcV3FeedbackEvidence(squat))
assert.equal(squatEvidence.priority.title, 'Stangen forlader den lodrette linje')
assert.match(squatEvidence.priority.evidence, /7.4 cm/)

const hostileEvidence = sanitizeVideoCoachFeedbackEvidence({
  version: 'not-reviewed',
  priority: { title: ' Tydeligt fokus ', why: 'x'.repeat(900), evidence: ' 7 cm  drift ' },
  strength: [],
})
assert.equal(hostileEvidence.version, 'coach-feedback-unknown')
assert.equal(hostileEvidence.priority.why.length, 500)
assert.equal(hostileEvidence.priority.evidence, '7 cm drift')
assert.equal(hostileEvidence.strength, null)
assert.equal(sanitizeVideoCoachFeedbackEvidence({ priority: { title: 'Mangler evidens' } }), null)

const bench = context.buildCoachFeedback('Bænkpres', {
  benchTowardShoulderCm: -3.6,
  dipPct: 70,
  positionModelQualityPct: 8,
  lowConfPct: 1,
})
assert.equal(bench.primary.title, 'Stangen bevæger sig væk fra skulderlinjen')
assert.match(bench.athlete.next, /pressets retning/)
assert.equal(videoCoachFeedbackQuality({
  works: bench.athlete.works,
  focus: bench.athlete.focus,
  next_set: bench.athlete.next,
}).level, 'strong')

const reliableForearm = context.buildCoachFeedback('Bænkpres', {
  positionModelQualityPct: 8,
  foreDev: 16,
  lowConfPct: 1,
})
assert.equal(reliableForearm.primary.title, 'Underarmen er ikke under stangen')

const unreliableForearm = context.buildCoachFeedback('Bænkpres', {
  positionModelQualityPct: 26,
  foreDev: 16,
  lowConfPct: 1,
})
assert.notEqual(unreliableForearm.primary?.title, 'Underarmen er ikke under stangen')
assert.notEqual(unreliableForearm.strength?.title, 'Underarmen står stabilt')

assert.match(html, /const prioritizedFeedback = buildCoachFeedback/)
assert.doesNotMatch(html, /const cues = suggestCues\(lift, vals\)\.slice\(0, 2\)/)
assert.match(html, /feedback: 'coach-feedback-priority-v2-2026-07-27'/)
assert.match(html, /feedback_evidence: vcV3FeedbackEvidence\(prioritizedFeedback\)/)

const athleteView = fs.readFileSync(new URL('../src/AthleteView.jsx', import.meta.url), 'utf8')
assert.match(athleteView, /feedback_evidence:\s*sanitizeVideoCoachFeedbackEvidence\(/)
assert.match(athleteView, /v=\$\{VIDEOCOACH_BUILD_ID\}/)

const dashboard = fs.readFileSync(new URL('../src/Dashboard.jsx', import.meta.url), 'utf8')
assert.match(dashboard, /v=\$\{VIDEOCOACH_BUILD_ID\}/,
  'Coach- og atletversionen skal bruge samme versionskilde')
assert.match(dashboard, /Målegrundlag for feedbackudkastet/)
assert.match(dashboard, /Coach-only · automatisk udgangspunkt/)
assert.match(dashboard, /feedback_evidence:\s*sanitizeVideoCoachFeedbackEvidence\(\s*message\.row\.session_context\?\.feedback_evidence\)/)
assert.match(dashboard, /Vælg højst ét kvalitetssikret fund\. Intet deles automatisk\./)
assert.match(dashboard, /videoCoachPersonalBaselineOptions\(videoBaselines/)
assert.match(dashboard, /Den personlige sammenligning matcher ikke længere den aktuelle baseline/)
assert.match(athleteView, /videoCoachPersonalBaselineForAnalysis\(feedback, analysis,/)
assert.match(athleteView, /videoCoachPersonalBaselineAthleteText\(personalBaseline\)/)
assert.match(athleteView, /Sammenlignet med \{personalBaseline\.evidence_ref\.n_analyses\}/)

console.log('VideoCoach gemmer ét prioriteret, handlingsrettet cue og reviewet fanger svag feedback.')
