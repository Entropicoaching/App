import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { setDatabase } from './videoCoachNotes.appRev10.fake.mjs'
// Kun databasegrænsen erstattes. Produktionsmodulerne importeres uden omskrivning.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../supabase' || specifier === '../supabase.js')
    return { url: new URL('./videoCoachNotes.appRev10.fake.mjs', import.meta.url).href, shortCircuit: true }
  try { return next(specifier, context) } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier))
      return next(specifier + '.js', context)
    throw error
  }
}})
const { videoCoachFeedbackDraft: draft, videoCoachFeedbackPayload: payload } = await import('./coachVideoHjaelp.js')
const { lavVideoReviewHandlinger: handlers } = await import('./videoReviewHandlinger.js')
const feedback = () => ({ works: [{text: 'God ro', evidence_refs: ['ro']}], focus: [{text: 'Stangen driver frem', evidence_refs: ['drift']}], next_set: [{text: 'Pres fødderne ned', evidence_refs: ['cue']}] })
function fixture(patch = {}) {
  let row = { id: 'a1', athlete_id: 'at1', client_analysis_id: 'c1', status: 'coach_approved', athlete_feedback: feedback(), ...patch }
  const original = structuredClone(row), events = [], writes = []
  setDatabase({ from(table) {
    assert.equal(table, 'video_analyses')
    let values, filters = []
    const q = {
      update(v) { values = v; return q },
      eq(k,v) { filters.push([k,'eq',v]); return q },
      is(k,v) { filters.push([k,'is',v]); return q },
      filter(k,op,v) { filters.push([k,op,JSON.parse(v)]); return q },
      select() { return q },
      async single() {
        const matches = filters.every(([k,op,v]) => {
          assert.ok(['eq','is'].includes(op))
          return JSON.stringify(row[k]) === JSON.stringify(v)
        })
        if (!matches) return { data: null, error: { message: 'Analysen er ændret. Åbn den igen.' } }
        row = { ...row, ...structuredClone(values) }; writes.push(values)
        return { data: structuredClone(row), error: null }
      },
    }
    return q
  } })
  const options = {
    selectedAthlete: {id: 'at1'}, videoAnalysisFeedbackDraft: draft(original.athlete_feedback),
    videoBaselines: [], videoAnalysisBaselineFindingId: '',
    videoAnalysisFeedbackDirty: false, videoCoachPendingCompletionRef: {},
    fetchVideoCoachHistory: async () => {}, fetchVideoReviewQueue: () => {},
    showFlash: (text,kind) => events.push([kind,text]),
  }
  for (const name of ['setVideoAnalyses','setVideoAnalysisBaselineFindingId','setVideoAnalysisCloseWarning','setVideoAnalysisError','setVideoAnalysisFeedbackDirty','setVideoAnalysisFeedbackDraft','setVideoAnalysisReview','setVideoAnalysisReviewError','setVideoAnalysisReviewLoadingId','setVideoAnalysisUpdatingId'])
    options[name] = value => events.push([name,value])
  return { original, options, events, writes, get row() { return row }, change(p) { row = {...row,...structuredClone(p)} }, run() { return handlers(options) } }
}
test('F1 gamle strengnoter og tredje tekst bevares i udkastet', () => {
  assert.deepEqual(draft({works:['Ærlig ro', {text:'Øget spænding'}, {text:'Åben hånd'}]}).works, 'Ærlig ro\nØget spænding\nÅben hånd')
})
test('F1 for mange linjer afvises uden tavst tab', async () => {
  assert.throws(() => payload({}, {works:'En\nTo\nTre'}), /højst.*2/)
})
test('F1 handler afviser tredje linje og bevarer kladden', async () => {
  const f = fixture(); f.options.videoAnalysisFeedbackDraft.works = 'En\nTo\nTre'
  await f.run().saveVideoAnalysisFeedback(f.original)
  assert.equal(f.writes.length,0)
  assert.ok(f.events.some(([kind,text]) => kind === 'error' && /højst.*2/.test(text)))
  assert.ok(!f.events.some(([kind,v]) => kind === 'setVideoAnalysisFeedbackDirty' && v === false))
})
test('F2 slettet første linje flytter ikke dens evidens til anden linje', () => {
  const existing = {works:[{text:'En', evidence_refs:['første']}, {text:'To', evidence_refs:['anden'], confidence:0.9}]}
  assert.deepEqual(payload(existing,{works:'To'}).works, [existing.works[1]])
})
test('F2 redigeret tekst får coachens reference og ingen gammel målingsmetadata', () => {
  assert.deepEqual(payload({focus:[{text:'Før', evidence_refs:['måling'], confidence:0.9}]},{focus:'Efter æøå'}).focus, [{text:'Efter æøå',evidence_refs:['coach_review']}])
})
test('F3 samtidig feedback må ikke overskrives', async () => {
  const f = fixture(); f.change({athlete_feedback:{...feedback(), focus:[{text:'Ny fra anden coach'}]}})
  const before = structuredClone(f.row)
  await f.run().saveVideoAnalysisFeedback(f.original)
  assert.deepEqual(f.row,before); assert.equal(f.writes.length,0)
  assert.ok(!f.events.some(([kind,v]) => kind === 'setVideoAnalysisFeedbackDirty' && v === false))
})
test('F3 analyse som deles under redigering må ikke få ny feedback', async () => {
  const f = fixture(); f.change({status:'shared'})
  await f.run().saveVideoAnalysisFeedback(f.original)
  assert.equal(f.writes.length,0); assert.equal(f.row.status,'shared')
})
test('F3 gammel godkendelse må ikke dele ændret feedback', async () => {
  const f = fixture(); f.change({athlete_feedback:{...feedback(), focus:[]}})
  await f.run().reviewVideoAnalysis(f.original,'shared')
  assert.equal(f.row.status,'coach_approved'); assert.equal(f.writes.length,0)
})
test('F3 to gemninger fra samme gamle grundlag giver kun én skrivning', async () => {
  const f = fixture(); f.options.videoAnalysisFeedbackDraft.focus = 'Et andet fokus'
  const actions = f.run()
  await Promise.all([actions.saveVideoAnalysisFeedback(f.original),actions.saveVideoAnalysisFeedback(f.original)])
  assert.equal(f.writes.length,1)
})
test('tomme felter, danske tegn og 600 tegn gemmes uden mutation', async () => {
  const f = fixture(); const before = structuredClone(f.original)
  f.options.videoAnalysisFeedbackDraft = {works:'   ', focus:'ÆØÅ æøå'.padEnd(600,'ø'),next_set:''}
  await f.run().saveVideoAnalysisFeedback(f.original)
  assert.equal(f.writes.length,1); assert.equal(f.row.athlete_feedback.focus[0].text.length,600)
  assert.deepEqual(f.row.athlete_feedback.works,[]); assert.deepEqual(f.original,before)
})
test('601 tegn afvises og null feedback kan redigeres', async () => {
  const f = fixture({athlete_feedback:null}); f.options.videoAnalysisFeedbackDraft.focus = 'ø'.repeat(601)
  await f.run().saveVideoAnalysisFeedback(f.original); assert.equal(f.writes.length,0)
  f.options.videoAnalysisFeedbackDraft.focus = 'Bøj knæene'
  await f.run().saveVideoAnalysisFeedback(f.original); assert.equal(f.writes.length,1)
})
test('meget lang historisk tekst vises helt og afvises ved gemning', async () => {
  const text = 'Æøå'.repeat(10000), f = fixture({athlete_feedback:{focus:[{text}]}})
  assert.equal(f.options.videoAnalysisFeedbackDraft.focus,text)
  await f.run().saveVideoAnalysisFeedback(f.original); assert.equal(f.writes.length,0)
})
test('normal deling og tom samtidig erstatning er afgrænset', async () => {
  const f = fixture(); await f.run().reviewVideoAnalysis(f.original,'shared')
  assert.equal(f.row.status,'shared'); assert.equal(f.writes.length,1)
  const g = fixture({athlete_feedback:null}); g.change({athlete_feedback:{focus:[{text:'En anden'}]}})
  await g.run().saveVideoAnalysisFeedback(g.original); assert.equal(g.writes.length,0)
})

test('linjeslut ændrer ikke payload eller dansk tekst', () => {
  const values = ['\n','\r\n','\r'].map(nl => payload({}, {works:` Ærlig ro ${nl} Øget spænding `}))
  assert.deepEqual(values[0],values[1]); assert.deepEqual(values[0],values[2])
  assert.deepEqual(values[0].works.map(v=>v.text),['Ærlig ro','Øget spænding'])
})
test('uændrede gamle noter beholder metadata uden at dele evidenslisten', () => {
  const existing = feedback(), before = structuredClone(existing), result = payload(existing,draft(existing))
  assert.deepEqual(result,existing); result.focus[0].evidence_refs.push('ændring')
  assert.deepEqual(existing,before)
})
const noteApi = await import('../videoCoachNote.mjs')
function noteRequest() {
  const measurement = {
    schema:'va-k4-synthetic/v1',status:'synthetic_only',lift:'squat',setup_id:'syntetisk',
    units:{time:'s',position:'px_x_anterior_y_down',angle:'deg_inner_0_180',scale:'cm_per_px'},
    phase:{name:'concentric',start:0,end:1},cm_per_px:1,
    uncertainty:{x_px:0,y_px:0,body_y_px:0,knee_deg:0,scale_cm_per_px:0,time_s:0},
    samples:[0,1].map(i=>({t_s:i,valid:true,bar_x_px:i*4,bar_y_px:100-i,hip_y_px:null,shoulder_y_px:null,knee_deg:null})),
  }
  const batch = {schema:'va-k5-batch/v1',status:'synthetic_only',clips:[{clip_id:'syntetisk',measurement}]}
  return {schema:'va-k6-request/v1',status:'synthetic_only',target:{athlete_id:'atlet',session_id:'pas'},
    review:{schema:'va-k5-review/v1',status:'synthetic_only',ruleset:noteApi.RULESET,basis:noteApi.canonical(batch),batch,
      answers:[{clip_id:'syntetisk',finding_id:'BAR_FORWARD',decision:'kommentar',comment:'Ærlig vurdering af øget spænding'}],
      physical_vc_pass:false,technique_acceptance:false,five_real_clips_accepted:false},
    clip_id:'syntetisk',finding_ids:['BAR_FORWARD'],cue:'Pres fødderne ned'}
}
test('kommentar alene giver ingen tekniknote og tom kommentar afvises', () => {
  const q = noteRequest()
  assert.throws(()=>noteApi.approvalBasis(q),TypeError)
  q.review.answers[0].decision = 'enig'; q.review.answers[0].comment = ''
  assert.equal(typeof noteApi.approvalBasis(q),'string')
  q.review.answers.push({...q.review.answers[0],decision:'kommentar',comment:'   '})
  assert.throws(()=>noteApi.approvalBasis(q),TypeError)
})
test('2000 danske kommentartegn og 160 cue tegn bevares, større afvises', () => {
  const q = noteRequest(); q.review.answers[0].decision='enig'; q.review.answers[0].comment='ø'.repeat(2000); q.cue='å'.repeat(160)
  const before=structuredClone(q), receipt={schema:'va-k6-direct-approval/v1',status:'synthetic_only',actor:'Marc',method:'direct',decision:'enig',basis:noteApi.approvalBasis(q)}
  const note=noteApi.createCoachNote(q,receipt)
  assert.equal(noteApi.noteForSession([note],q.target),note.text); assert.deepEqual(q,before)
  q.review.answers[0].comment+='æ'; assert.throws(()=>noteApi.approvalBasis(q),TypeError)
  q.review.answers[0].comment=''; q.cue+='ø'; assert.throws(()=>noteApi.approvalBasis(q),TypeError)
})
test('gammel godkendelse kan ikke genbruges efter ændret kommentar', () => {
  const q = noteRequest(); q.review.answers[0].decision='enig'
  const receipt={schema:'va-k6-direct-approval/v1',status:'synthetic_only',actor:'Marc',method:'direct',decision:'enig',basis:noteApi.approvalBasis(q)}
  q.review.answers[0].comment='En nyere vurdering'
  assert.throws(()=>noteApi.createCoachNote(q,receipt),TypeError)
})
