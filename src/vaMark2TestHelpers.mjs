export {angleDeg,angles} from './vaMark2.mjs';
import {fixtures} from './vaMark2Fixtures.mjs';
export function fixturesForTest(deg) {
  const f=fixtures()[0];
  f.frames.forEach(q=>{
    const truth={shoulder:{x:200,y:100},hip:{x:300,y:100},knee:{x:300,y:200},ankle:{x:400,y:200},toe:{x:400,y:300},elbow:{x:200,y:200}};
    q.truth=truth;q.model=JSON.parse(JSON.stringify(truth));
    const r=deg*Math.PI/180;
    q.model.elbow={x:200+100*Math.sin(r),y:100+100*Math.cos(r)};
  });
  return f;
}
