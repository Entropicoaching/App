import test from 'node:test'
import assert from 'node:assert/strict'
import { videoCoachPersonalBaselineOptions as options, withVideoCoachPersonalBaseline as withBaseline,
 videoCoachPersonalBaselineForAnalysis as forAnalysis, videoCoachPersonalBaselineAthleteText as athleteText } from './videoCoachPersonalFeedback.js'

function fixture() {
 const baseline={lift:'squat',variation:'competition_squat',metric_key:'rom',metric_method:'synthetic',
  n_analyses:5,median:40,baseline_version:'v1'}
 const analysis={id:'analysis',athlete_id:'athlete',lift:'squat',variation:'competition_squat',low_conf_pct:5,
  metrics:{rom:{value:42,method:'synthetic',confidence:0.9,eligible_for_baseline:true}},
  findings:[{id:'baseline_rom',summary:'OBS: ROM over atletens median',evidence_refs:['rom'],confidence:0.8}],
  session_context:{baseline_snapshot:[{...baseline}]}}
 return {baseline,analysis}
}
function text(f) {
 const choices=options([f.baseline],f.analysis,'athlete')
 const selected=forAnalysis(withBaseline({},choices[0]),f.analysis,'athlete')
 return {choices,text:athleteText(selected)}
}
function reject(f) {
 const before=structuredClone(f)
 assert.deepEqual(text(f),{choices:[],text:''})
 assert.deepEqual(f,before)
}
for (const [label,change] of [
 ['K-F1a tom liste som maaling',f=>{f.analysis.metrics.rom.value=[]}],
 ['K-F1b confidence over en',f=>{f.analysis.metrics.rom.confidence=1.01}],
 ['K-F1c negativ kvalitetsprocent',f=>{f.analysis.low_conf_pct=-1}],
 ['K-F1d finding confidence over en',f=>{f.analysis.findings[0].confidence=1.01}],
]) test(label,()=>{const f=fixture();change(f);reject(f)})

test('K-F1 numeriske felter afviser coercede objekter og ikke endelige tal',()=>{
 const setters=[(f,v)=>{f.analysis.metrics.rom.value=v},(f,v)=>{f.analysis.metrics.rom.confidence=v},
  (f,v)=>{f.analysis.low_conf_pct=v},(f,v)=>{f.baseline.median=v},
  (f,v)=>{f.baseline.n_analyses=v},(f,v)=>{f.analysis.session_context.baseline_snapshot[0].n_analyses=v},
  (f,v)=>{f.analysis.findings[0].confidence=v}]
 for(const set of setters) for(const value of [[],[1],[5],{},true,false,'',' ',null,undefined,NaN,Infinity,-Infinity]) {
  const f=fixture();set(f,value);reject(f)
 }
})
test('K-F1 kvalitetsgraenser og positive kontroller bevares',()=>{
 for(const confidence of [0.75,1,'0.75','1']) for(const value of [0,'0',42,'42']) {
  const f=fixture();f.analysis.metrics.rom.confidence=confidence;f.analysis.metrics.rom.value=value
  f.analysis.low_conf_pct='0';f.analysis.findings[0].confidence='1'
  const before=structuredClone(f),result=text(f)
  assert.equal(result.choices.length,1);assert.equal(result.text,'ROM over din median');assert.deepEqual(f,before)
 }
 for(const confidence of [-1,0.749,1.01,2]) {const f=fixture();f.analysis.metrics.rom.confidence=confidence;reject(f)}
 for(const confidence of [-1,0.649,1.01,2]) {const f=fixture();f.analysis.findings[0].confidence=confidence;reject(f)}
 for(const pct of [-1,15.01,100]) {const f=fixture();f.analysis.low_conf_pct=pct;reject(f)}
 const f=fixture();f.analysis.low_conf_pct=15;f.analysis.findings[0].confidence=0.65
 assert.equal(text(f).choices.length,1)
})
