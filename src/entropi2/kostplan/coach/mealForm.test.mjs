import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyMealForm, addFormMeal, addFormLine, loadMealForm, serializeMealForm, lineCount } from './mealDraftForm.mjs'
import { FOODS } from '../foedevarer/index.mjs'
import { parseMealDraft } from './mealDraft.mjs'
const scope = { coachId:'synthetic-coach',athleteId:'synthetic-athlete',date:'2026-11-07' }
const valid=()=>{const d=emptyMealForm(); Object.assign(d.meals[0],{name:'Morgenmad',time:'07:30'});Object.assign(d.meals[0].items[0],{foodId:FOODS[0].id,grams:'123,456789012345'});return d}
const serialize=d=>serializeMealForm(d,scope,FOODS)
test('form emits only strict schema, preserves number precision and stable IDs; same names are valid',()=>{
 let d=valid(); const raw=serialize(d);assert.deepEqual(raw.errors,[])
 const data=JSON.parse(raw.source);assert.deepEqual(Object.keys(data),['schema','coachId','athleteId','date','meals'])
 assert.equal(data.meals[0].name,'07:30 Morgenmad');assert.equal(data.meals[0].items[0].grams,123.456789012345)
 assert.equal(parseMealDraft(raw.source,scope,FOODS)[0].items[0].grams,123.456789012345)
 d=addFormMeal(d);Object.assign(d.meals[1],{name:'Morgenmad',time:'07:30'});Object.assign(d.meals[1].items[0],{foodId:FOODS[0].id,grams:'5'})
 assert.equal(serialize(d).errors.length,0);assert.notEqual(d.meals[0].id,d.meals[1].id)
 const loaded=loadMealForm(parseMealDraft(serialize(d).source,scope,FOODS))
 assert.deepEqual(JSON.parse(serialize(loaded).source),JSON.parse(serialize(d).source))
})
test('all raw invalid values survive validation, with no arithmetic expressions or units accepted',()=>{
 for(const grams of ['','NaN','Infinity','1e2','1/2','100 g','1.234,5','1,234.5','-1','0','10000.000001','9'.repeat(400)]){
  const d=valid();d.meals[0].items[0].grams=grams;const before=structuredClone(d)
  assert.ok(serialize(d).errors.length,grams);assert.deepEqual(d,before)
 }
 for(const name of ['',' leading','trailing ','a\nb','a\u007fb','x'.repeat(201)]){
  const d=valid();d.meals[0].name=name;assert.ok(serialize(d).errors.length);assert.equal(d.meals[0].name,name)
 }
 const d=valid();d.meals[0].time='24:00';assert.match(serialize(d).errors.join(' '),/tidspunkt/)
 d.meals[0].time='';d.meals[0].items[0].foodId='unknown';assert.match(serialize(d).errors.join(' '),/kendt/)
 d.meals[0].items=[];assert.match(serialize(d).errors.join(' '),/1–30/)
})
test('duplicate food and duplicate IDs fail; boundaries 12 / 30 / 100 are enforced without dropping rows',()=>{
 let d=valid();d=addFormLine(d,d.meals[0].id);Object.assign(d.meals[0].items[1],d.meals[0].items[0]);assert.match(serialize(d).errors.join(' '),/én gang/)
 d=valid();for(let n=1;n<12;n++)d=addFormMeal(d)
 assert.equal(d.meals.length,12);assert.equal(addFormMeal(d),d)
 for(const m of d.meals)while(m.items.length<30&&lineCount(d)<100){d=addFormLine(d,m.id);Object.assign(m,d.meals.find(n=>n.id===m.id))}
 assert.equal(lineCount(d),100);assert.equal(addFormLine(d,d.meals[0].id),d)
 d=valid();for(let n=1;n<30;n++)d=addFormLine(d,d.meals[0].id)
 assert.equal(d.meals[0].items.length,30);assert.equal(addFormLine(d,d.meals[0].id),d)
 const bad=valid();bad.meals.push(structuredClone(bad.meals[0]));assert.match(serialize(bad).errors.join(' '),/Gentaget/)
})

test('explicit current-plan load keeps sub-microgram precision and reports oversized raw names',()=>{
 const d=valid();d.meals[0].items[0].grams='0,000000000000123456789'
 const meals=parseMealDraft(serialize(d).source,scope,FOODS),loaded=loadMealForm(meals)
 assert.equal(Number(loaded.meals[0].items[0].grams),meals[0].items[0].grams)
 assert.equal(serialize(loaded).source,serialize(d).source)
 d.meals[0].name='x'.repeat(33000);assert.match(serialize(d).errors.join(' '),/for stor/);assert.equal(d.meals[0].name.length,33000)
})
