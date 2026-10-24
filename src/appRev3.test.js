import test from 'node:test'
import assert from 'node:assert/strict'
import { validateVideoCoachPayloadBounds as bounds, queueVideoCoachDraft as queue } from './videoCoachSubmission.js'
import { registerHooks } from 'node:module'
const bridgeURL = new URL('./athlete/videoCoachBro.js', import.meta.url)
const hook = registerHooks({ resolve(specifier, context, next) {
 if (context.parentURL === bridgeURL.href && ['../videoCoachSubmission', '../videoCoachVersion'].includes(specifier))
  return next(new URL(specifier + '.js', bridgeURL).href, context)
 return next(specifier, context)
} })
let bridgeModule
try { bridgeModule = await import(bridgeURL) } finally { hook.deregister() }
const { validateAthleteVideoCoachRow: bridge, athleteVideoPathPreview: preview } = bridgeModule
import { validateVideoUploadRequest as upload, buildVideoUploadPath as uploadPath, videoUploadExtForMime as ext } from './videoCoachUpload.js'
import { buildVideoCoachBaselineProfiles as profiles, videoCoachBaselineReviewImpact as impact } from './videoCoachBaselineProgress.js'

const row = () => ({ client_analysis_id: '00000000-0000-4000-8000-000000000001', athlete_id: 'athlete',
 schema_version: 3, schema_v: 3, status: 'draft', source_mode: 'athlete_submission', lift: 'squat', variation: 'competition_squat',
 reps_count: 1, reps: [1], metrics: {}, findings: [], rep_details: [{start_s: 0, end_s: 1, valid_ratio: 1, confidence: 0.9}] })
const rejected = value => assert.equal(typeof bounds(value), 'string')

test('F1: tomme og ikke numeriske felter er ikke nulmaalinger', () => {
 for (const value of ['', '  ', false, true, [], {}, [0]]) {
  for (const field of ['load_kg','rpe','low_conf_pct','position_quality_pct']) rejected({...row(), [field]: value})
  for (const field of ['start_s','end_s','valid_ratio','confidence']) {
   const r=row(); r.rep_details[0][field]=value; rejected(r)
  }
  const r=row(); r.metrics.rom={value, method:'synthetic', confidence:1}; rejected(r)
  rejected({...row(), bar_path:{x0:value,y0:0,dx:[1],dy:[1]}})
 }
 const r=row(); r.load_kg='100'; r.rpe=null
 assert.equal(bounds(r), null)
})

test('F2: repintervaller har positiv varighed og overlapper ikke', () => {
 for (const times of [[[1,1]], [[0,2],[1,3]], [[3,4],[0,1]]]) {
  const r=row(); r.reps_count=times.length
  r.rep_details=times.map(([start_s,end_s])=>({start_s,end_s})); rejected(r)
 }
 const r=row(); r.reps_count=2; r.rep_details=[{start_s:0,end_s:1},{start_s:1,end_s:3600}]
 assert.equal(bounds(r),null)
 for (const end_s of [3600.01, 1e100, Infinity, NaN, -1]) rejected({...row(),rep_details:[{start_s:0,end_s}]})
})

test('F3: manglende arrayelementer afvises foer indsendelse og lokal koe', () => {
 for (const field of ['rep_details','findings']) rejected({...row(), [field]:new Array(1)})
 const r=row(); r.reps=new Array(1)
 assert.equal(typeof bridge(r,'athlete'),'string')
 for (const field of ['dx','dy']) {
  const path={x0:0,y0:0,dx:[1],dy:[1]}; path[field]=new Array(1)
  rejected({...row(),bar_path:path})
 }
 let writes=0
 assert.equal(queue({...row(),rep_details:new Array(1)}, {setItem(){writes++}}),false)
 assert.equal(writes,0)
})

test('F4: manglende koordinater giver ingen opdigtet forhaandsvisning', () => {
 for (const x0 of [null, '', ' ', false, []])
  assert.equal(preview({x0,y0:0,dx:[1],dy:[1]}),null)
 const p=preview({x0:0,y0:0,dx:[2,-1],dy:[-2,1]})
 assert.deepEqual(p.end,{x:1,y:-1})
 assert.equal(preview({x0:0,y0:0,dx:Array(241).fill(1),dy:Array(241).fill(1)}),null)
})

const analysis=()=>({id:'a',lift:'squat',variation:'competition_squat',status:'shared',low_conf_pct:5,
 metrics:{rom:{value:40,method:'synthetic',confidence:0.9,eligible_for_baseline:true}}})
test('F5: tomme maalinger og ugyldig kvalitet giver ingen baseline', () => {
 for (const value of ['', ' ', false, [], [1]]) {
  const a=analysis(); a.metrics.rom.value=value
  assert.deepEqual(profiles([],[a]),[])
  assert.equal(impact([],[],{...a,status:'draft'}).kind,'blocked')
 }
 for (const value of [-1, '', ' ', false, [], 101]) {
  const a={...analysis(),low_conf_pct:value}
  assert.deepEqual(profiles([],[a]),[])
  assert.equal(impact([],[],{...a,status:'draft'}).kind,'blocked')
 }
 for (const confidence of [1.01, 2, true, [1]]) {
  const a=analysis(); a.metrics.rom.confidence=confidence
  assert.deepEqual(profiles([],[a]),[])
 }
 assert.equal(profiles([],[analysis()])[0].nAnalyses,1)
 assert.deepEqual(profiles([],[{...analysis(),metrics:{}}]),[])
 assert.deepEqual(profiles([],[]),[])
})

const uploadRequest = () => ({athleteId:'00000000-0000-4000-8000-000000000001',
 clientAnalysisId:'00000000-0000-4000-8000-000000000002',lift:'squat',variation:'competition_squat',
 mimeType:'video/mp4',fileSize:1024,loadKg:100,rpe:7})
test('F6: upload afviser ikke numeriske stoerrelser og maalinger', () => {
 for (const value of [true, false, [], [1], {}, '', ' ']) {
  for (const field of ['fileSize','loadKg','rpe'])
   assert.equal(typeof upload({...uploadRequest(),[field]:value}),'string')
 }
 assert.equal(upload({...uploadRequest(),loadKg:null,rpe:null}),null)
 assert.equal(upload({...uploadRequest(),fileSize:500*1024*1024}),null)
 assert.equal(typeof upload({...uploadRequest(),fileSize:500*1024*1024+1}),'string')
})
test('F7: nedarvede objektfelter er ikke videoformater', () => {
 const r=uploadRequest()
 for (const mime of ['toString','constructor','__proto__','unknown']) {
  assert.equal(ext(mime),null)
  assert.equal(uploadPath(r.athleteId,r.clientAnalysisId,mime),null)
 }
 assert.equal(ext('video/mp4'),'mp4')
})
