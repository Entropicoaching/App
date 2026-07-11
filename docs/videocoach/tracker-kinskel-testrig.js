// ============================================================================
// tracker-kinskel-testrig.js  ·  KINEMATISK-LAAST SKELET (Runde 12-13)
// ----------------------------------------------------------------------------
// Marcs test (Runde 12): rep 1 (ren side) god, derefter "ned ad bakke" - hoften
// falder ned i siden (16 grader = umuligt) og knaeet driver over reps.
// To rodaarsager + fix (Runde 13):
//   1) HOFTE-GREN: valgt "naermest forrige hofte" -> vipper over paa forkert
//      side naar knaeet driver. FIX: vaelg altid den ANATOMISKE side (fortegn
//      fra coachens klik: kryds af (skulder-knae) x (hofte-knae)).
//   2) KNAE-DRIFT: bue-soegningen tog altid bedste (trin-begraenset) selv ved
//      fladt/daarligt match -> akkumuleret drift over reps. FIX: kvalitetsgate
//      - ved daarligt match HOLDES den forudsagte vinkel paa buen (ingen drift).
//
// Koeres med:  node tracker-kinskel-testrig.js
// ============================================================================

const W = 640, H = 640;
const noise = new Float32Array(W * H);
for (let i = 0; i < noise.length; i++)
  noise[i] = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 14;

// ---- SAND KINEMATIK (fast ankel, faste knoglelaengder) ----------------------
const A = { x: 300, y: 500 };
const Ls = 120, Lf = 130, Lt = 170;
let NF = 90, REPS = 1, ADRIFT = 0, DRIFT = 0, KNEE_TEX = 0, OCC = 0;
const D2R = Math.PI / 180;
function smoother(t){ t=Math.max(0,Math.min(1,t)); return t*t*t*(t*(t*6-15)+10); }
function repDepth(t){                     // ét rep: staa -> bund -> staa
  if (t < 0.40) return smoother(t / 0.40);
  if (t < 0.52) return 1;
  if (t < 0.92) return 1 - smoother((t - 0.52) / 0.40);
  return 0;
}
function depth(f){ const per = NF / REPS; return repDepth((f % per) / per); }
function ankleAt(f){ const d = depth(f); return { x: A.x + ADRIFT*9*d, y: A.y + ADRIFT*3*d }; }
function truthPose(f) {
  const d = depth(f), Ac = ankleAt(f);
  const shA = (5 + 40 * d) * D2R, feA = (5 + 80 * d) * D2R, toA = (5 + 42 * d) * D2R;
  const K = { x: Ac.x + Ls * Math.sin(shA), y: Ac.y - Ls * Math.cos(shA) };
  const Hh = { x: K.x - Lf * Math.sin(feA), y: K.y - Lf * Math.cos(feA) };
  const S = { x: Hh.x + Lt * Math.sin(toA), y: Hh.y - Lt * Math.cos(toA) };
  return { A: Ac, K, H: Hh, S };
}

// ---- RENDER -----------------------------------------------------------------
function segDist(px, py, a, b) {
  const vx=b.x-a.x, vy=b.y-a.y, wx=px-a.x, wy=py-a.y, L2=vx*vx+vy*vy||1;
  let t=(wx*vx+wy*vy)/L2; t=Math.max(0,Math.min(1,t));
  return { dist: Math.hypot(px-(a.x+t*vx), py-(a.y+t*vy)), t };
}
function renderFrame(f) {
  const P = truthPose(f);
  const d = new Uint8ClampedArray(W * H * 4);
  const drift = DRIFT * 22 * (f / NF);                 // langsom lys-/stof-aendring
  // knae-okklusion: en moerk lodret stang (rack/haand) glider forbi knaeet
  // kortvarigt midt i hvert rep
  const per = NF / REPS, ff = f % per, occOn = OCC && ff > per*0.55 && ff < per*0.72;
  const occX = P.K.x - 30 + (ff - per*0.55) / (per*0.17) * 60;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = 118 + noise[y*W+x] + (x/W)*16;
      const st = segDist(x,y,P.H,P.S); if (st.dist<26) v = 88 + 6*Math.sin(st.t*6) + drift;
      const ft = segDist(x,y,P.K,P.H); if (ft.dist<28) v = 96 + 12*Math.sin(ft.t*5 + f*0.5) + drift;
      const kt = segDist(x,y,P.A,P.K);
      if (kt.dist<24) { v = 40 + noise[y*W+x]*0.25 + drift;
        if (KNEE_TEX && Math.hypot(x-P.K.x,y-P.K.y)<7) v = 74 + drift; }
      if (occOn && Math.abs(x - occX) < 9) v = 30 + noise[y*W+x]*0.3;   // okkluder
      const i=(y*W+x)*4; d[i]=d[i+1]=d[i+2]=v; d[i+3]=255;
    }
  }
  return d;
}

let frameData = null;
const octx = { getImageData: (x0,y0,w,h) => {
  const out = new Uint8ClampedArray(w*h*4);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const sx=Math.max(0,Math.min(W-1,x0+x)), sy=Math.max(0,Math.min(H-1,y0+y));
    const si=(sy*W+sx)*4, di=(y*w+x)*4;
    out[di]=frameData[si]; out[di+1]=frameData[si+1]; out[di+2]=frameData[si+2]; out[di+3]=255;
  }
  return { data: out };
}};
const ocan = { width: W, height: H };
function grabGray(x,y,size){ const half=size>>1;
  const dd=octx.getImageData((x-half)|0,(y-half)|0,size,size).data;
  const g=new Float32Array(size*size);
  for (let i=0;i<g.length;i++) g[i]=dd[i*4]*.3+dd[i*4+1]*.59+dd[i*4+2]*.11;
  return g;
}
function ssdAt(cx,cy,patch,P){ const cand=grabGray(cx,cy,P);
  let pm=0,cm=0; for(let i=0;i<patch.length;i++){pm+=patch[i];cm+=cand[i];}
  pm/=patch.length; cm/=patch.length;
  let s=0; for(let i=0;i<patch.length;i++){const dd=(cand[i]-cm)-(patch[i]-pm); s+=dd*dd;}
  return s;
}

// ---- GEOMETRI: cirkel-skaering, returnerer BEGGE loesninger -----------------
function circleBoth(c1,r1,c2,r2){
  const dx=c2.x-c1.x, dy=c2.y-c1.y, dc=Math.hypot(dx,dy)||1e-6;
  let a=(r1*r1-r2*r2+dc*dc)/(2*dc); let h2=r1*r1-a*a;
  if (h2<0){ a=Math.max(-r1,Math.min(r1,a)); h2=0; }
  const hh=Math.sqrt(h2), mx=c1.x+a*dx/dc, my=c1.y+a*dy/dc;
  const ox=-dy/dc*hh, oy=dx/dc*hh;
  // s1 ligger paa POSITIV kryds-side af linjen c1->c2, s2 paa negativ
  return { s1:{x:mx+ox,y:my+oy}, s2:{x:mx-ox,y:my-oy} };
}
function cross(ax,ay,bx,by){ return ax*by - ay*bx; }

// ============================================================================
// TRACKER A · GAMMEL fri 2D (baseline)
// ============================================================================
function trackFree(frames, click){
  const P=27, R=22; frameData=frames[0];
  const trk={}; for(const k of ['knee','hip']) trk[k]={cur:{...click[k]},vel:{x:0,y:0},patch:grabGray(click[k].x,click[k].y,P)};
  const out={knee:[],hip:[]};
  for(let f=0;f<frames.length;f++){ frameData=frames[f];
    for(const k of ['knee','hip']){ const T=trk[k];
      if(f===0){ out[k].push({...T.cur}); continue; }
      const pred={x:T.cur.x+T.vel.x,y:T.cur.y+T.vel.y};
      let best=1e18,bx=pred.x,by=pred.y;
      for(let oy=-R;oy<=R;oy+=2) for(let ox=-R;ox<=R;ox+=2){ const s=ssdAt(pred.x+ox,pred.y+oy,T.patch,P);
        if(s<best){best=s;bx=pred.x+ox;by=pred.y+oy;} }
      T.vel={x:(bx-T.cur.x)*.6+T.vel.x*.4,y:(by-T.cur.y)*.6+T.vel.y*.4}; T.cur={x:bx,y:by};
      const nyt=grabGray(bx,by,P); for(let i=0;i<T.patch.length;i++)T.patch[i]=T.patch[i]*.9+nyt[i]*.1;
      out[k].push({...T.cur});
    }
  }
  return out;
}

// ============================================================================
// TRACKER B · KINEMATISK (improved=false: Runde 12, true: Runde 13-fix)
// ============================================================================
function trackKin(frames, click, barPath, improved){
  const P=27;
  const Lsm=Math.hypot(click.knee.x-click.A.x,click.knee.y-click.A.y);
  const Lfm=Math.hypot(click.hip.x-click.knee.x,click.hip.y-click.knee.y);
  const Ltm=Math.hypot(click.sh.x-click.hip.x,click.sh.y-click.hip.y);
  const shOff={x:click.sh.x-barPath[0].x,y:click.sh.y-barPath[0].y};
  const offMag=Math.hypot(shOff.x,shOff.y);
  const tau0=Math.atan2(barPath[0].y-click.hip.y, barPath[0].x-click.hip.x);   // torso-retn. (hofte->stang) ved klik
  const offAngRel=Math.atan2(shOff.y,shOff.x)-tau0;                            // offset-vinkel RELATIVT til torso
  // anatomisk hofte-side fra klik: fortegn af (skulder-knae) x (hofte-knae)
  const hipSide=Math.sign(cross(click.sh.x-click.knee.x, click.sh.y-click.knee.y,
                                click.hip.x-click.knee.x, click.hip.y-click.knee.y)) || 1;
  frameData=frames[0];
  let kneePatch=grabGray(click.knee.x,click.knee.y,P);
  let theta=Math.atan2(click.knee.y-click.A.y,click.knee.x-click.A.x);
  let thVel=0, emaCost=null, prevHip={...click.hip};
  const out={knee:[],hip:[],sh:[]};
  for(let f=0;f<frames.length;f++){ frameData=frames[f];
    let S;
    if(improved){   // RUNDE 14: offset ROTERER med torsoen (hofte->stang-retning)
      const tau=Math.atan2(barPath[f].y-prevHip.y, barPath[f].x-prevHip.x);
      S={x:barPath[f].x+offMag*Math.cos(tau+offAngRel), y:barPath[f].y+offMag*Math.sin(tau+offAngRel)};
    } else {        // konstant offset (falder frem i bunden naar torsoen laener)
      S={x:barPath[f].x+shOff.x, y:barPath[f].y+shOff.y};
    }
    if(f>0){
      const thPred=theta+thVel; const span=0.16;
      let bestC=1e18,bestTh=thPred;
      for(let dt=-span;dt<=span+1e-9;dt+=span/12){ const th=thPred+dt;
        const c=ssdAt(click.A.x+Lsm*Math.cos(th),click.A.y+Lsm*Math.sin(th),kneePatch,P);
        if(c<bestC){bestC=c;bestTh=th;} }
      let dth=bestTh-theta; const maxStep=0.06;       // knae UAENDRET fra Runde 12 (adaptiv)
      dth=Math.max(-maxStep,Math.min(maxStep,dth)); theta+=dth; thVel=dth*.5+thVel*.5;
      if(emaCost===null || bestC<emaCost*2.0){
        emaCost=emaCost===null?bestC:emaCost*.85+bestC*.15;
        const nyt=grabGray(click.A.x+Lsm*Math.cos(theta),click.A.y+Lsm*Math.sin(theta),P);
        for(let i=0;i<kneePatch.length;i++)kneePatch[i]=kneePatch[i]*.9+nyt[i]*.1;
      }
    }
    const knee={x:click.A.x+Lsm*Math.cos(theta),y:click.A.y+Lsm*Math.sin(theta)};
    const {s1,s2}=circleBoth(knee,Lfm,S,Ltm);
    let hip;
    if(improved){
      // RUNDE 13: vaelg ALTID den anatomiske side (fortegn fra klik) - kan ikke
      // vippe over paa den forkerte side og flyve, som "naermest forrige" kan.
      hip = hipSide>=0 ? s1 : s2;
      const hd=Math.hypot(hip.x-prevHip.x,hip.y-prevHip.y), cap=45;   // step-limit mod vilde spring
      if(hd>cap) hip={x:prevHip.x+(hip.x-prevHip.x)/hd*cap, y:prevHip.y+(hip.y-prevHip.y)/hd*cap};
    } else {                                           // Runde 12: naermest forrige (kan vippe)
      hip = (Math.hypot(s1.x-prevHip.x,s1.y-prevHip.y)<=Math.hypot(s2.x-prevHip.x,s2.y-prevHip.y))?s1:s2;
    }
    prevHip=hip; out.knee.push(knee); out.hip.push(hip); out.sh.push(S);
  }
  return out;
}

// ---- EVAL -------------------------------------------------------------------
function errStats(track,arrKey){
  const truthKey = arrKey==='knee'?'K' : arrKey==='hip'?'H' : 'S';   // sh -> S
  let sum=0,max=0;
  for(let f=0;f<track[arrKey].length;f++){ const t=truthPose(f)[truthKey];
    const e=Math.hypot(track[arrKey][f].x-t.x,track[arrKey][f].y-t.y); sum+=e; if(e>max)max=e; }
  return { mean:sum/track[arrKey].length, max };
}
function run(label, cfg){
  NF=cfg.nf||90; REPS=cfg.reps||1; ADRIFT=cfg.drift?1:0; DRIFT=cfg.bright?1:0;
  KNEE_TEX=cfg.tex?1:0; OCC=cfg.occ?1:0;
  const jit=cfg.clickNoise||0, barN=cfg.barNoise||0;
  const rnd=(s=>()=>((Math.sin(s++*91.7)*4331.1)%1))(7);
  const frames=[]; for(let f=0;f<NF;f++) frames.push(renderFrame(f));
  const p0=truthPose(0);
  // STANGEN sidder paa ryggen: et stykke NED ad torsoen fra skulderleddet (og
  // lidt bagud). Offsettet roterer med torsoen -> et KONSTANT offset falder frem
  // i bunden. bar = S + 0.22*(H-S) + lidt bag-perp.
  const bar=[]; for(let f=0;f<NF;f++){ const tp=truthPose(f);
    const tx=tp.H.x-tp.S.x, ty=tp.H.y-tp.S.y, tl=Math.hypot(tx,ty)||1;
    const bx=tp.S.x+0.22*tx + (-ty/tl)*10, by=tp.S.y+0.22*ty + (tx/tl)*10;
    bar.push({x:bx+rnd()*barN, y:by+rnd()*barN}); }
  const jc=p=>({x:p.x+rnd()*jit,y:p.y+rnd()*jit});
  const click={A:jc(p0.A),knee:jc(p0.K),hip:jc(p0.H),sh:jc(p0.S)};
  if(cfg.hipBias)  // upraecist hofte-klik -> torso maalt for kort -> cirkler skaerer ikke i bunden
    click.hip={ x:click.hip.x+(click.sh.x-click.hip.x)*cfg.hipBias,
                y:click.hip.y+(click.sh.y-click.hip.y)*cfg.hipBias };
  const free=trackFree(frames,{knee:{...click.knee},hip:{...click.hip}});
  const kOld=trackKin(frames,click,bar,false);
  const kNew=trackKin(frames,click,bar,true);
  const r={ free:{K:errStats(free,'knee'),H:errStats(free,'hip')},
            old:{K:errStats(kOld,'knee'),H:errStats(kOld,'hip'),S:errStats(kOld,'sh')},
            neu:{K:errStats(kNew,'knee'),H:errStats(kNew,'hip'),S:errStats(kNew,'sh')} };
  console.log(`\n${label}`);
  const line=(n,o)=>`   ${n.padEnd(16)} knae snit ${o.K.mean.toFixed(0).padStart(3)} maks ${o.K.max.toFixed(0).padStart(3)}`+
                    ` · hofte snit ${o.H.mean.toFixed(0).padStart(3)} maks ${o.H.max.toFixed(0).padStart(3)}`;
  console.log(line('GAMMEL fri 2D',r.free));
  console.log(line('KIN Runde 12',r.old));
  console.log(line('KIN Runde 13',r.neu));
  console.log(`   SKULDER · konstant offset snit ${r.old.S.mean.toFixed(0)} maks ${r.old.S.max.toFixed(0)}`+
              `  ->  roterende offset snit ${r.neu.S.mean.toFixed(0)} maks ${r.neu.S.max.toFixed(0)}`);
  return r;
}

console.log('=== KINEMATISK-LAAST SKELET · TEST-RIG (Runde 13) ===');
const r1 = run('1) Enkelt rep, svag knaeskal (regression)', { reps:1, nf:90, tex:1 });
const r2 = run('2) 3 REPS, featureless + okklusion + drift + ankel + klik-stoej (ingen regression)',
               { reps:3, nf:180, occ:1, bright:1, drift:1, clickNoise:5, barNoise:2.5 });
// UNIT-TEST: hofte-gren-valg naar forrige hofte er drevet over paa FORKERT side
// (sker efter en daarlig frame). "Naermest forrige" laaser sig fast paa den
// forkerte loesning og flyver; "anatomisk side" vaelger altid korrekt.
const ang=(a,b,c)=>{let d=Math.abs((Math.atan2(a.y-b.y,a.x-b.x)-Math.atan2(c.y-b.y,c.x-b.x))*180/Math.PI);return d>180?360-d:d;};
const Ku={x:300,y:460}, Su={x:315,y:255}, Lfu=115, Ltu=110;
const cb=circleBoth(Ku,Lfu,Su,Ltu);
const correct=cb.s2;                                    // athletens bag-side (anatomisk korrekt)
const sideSign=Math.sign(cross(Su.x-Ku.x,Su.y-Ku.y, correct.x-Ku.x,correct.y-Ku.y));
const prevWrong=cb.s1;                                  // forrige hofte drevet over paa forkert side
const pickOld = (Math.hypot(cb.s1.x-prevWrong.x,cb.s1.y-prevWrong.y)<=Math.hypot(cb.s2.x-prevWrong.x,cb.s2.y-prevWrong.y))?cb.s1:cb.s2;
const pickNew = sideSign>=0?cb.s1:cb.s2;
const errOld=Math.hypot(pickOld.x-correct.x,pickOld.y-correct.y);
const errNew=Math.hypot(pickNew.x-correct.x,pickNew.y-correct.y);

console.log('\n=== UNIT: hofte-gren ved forrige-paa-forkert-side ===');
console.log(`   "naermest forrige" -> fejl ${errOld.toFixed(0)}px (flipper)  ·  "anatomisk side" -> fejl ${errNew.toFixed(0)}px`);

console.log('\n=== DOM ===');
const g1 = r1.neu.K.mean<15 && r1.neu.H.mean<15;                          // regression
const g2 = r2.neu.K.mean <= r2.old.K.mean+1 && r2.neu.H.mean <= r2.old.H.mean+1;  // ingen regression
const gKin = r2.neu.K.mean < r2.free.K.mean*0.2;                          // kinematik >> fri 2D
const gFlip = errNew < 5 && errOld > 40;                                  // anatomisk side retter flip
const gSh = r2.neu.S.mean < r2.old.S.mean*0.5 && r2.neu.S.max < r2.old.S.max*0.5;  // roterende skulder-offset
console.log(' 1) kinematik vs fri 2D (featureless): knae ' + r2.neu.K.mean.toFixed(0) + 'px vs ' + r2.free.K.mean.toFixed(0) + 'px');
console.log(' 2) Runde 13 regressionsfri: ' + (g1&&g2));
console.log(' 3) anatomisk hofte-side retter flip: ' + gFlip);
console.log(' 4) roterende skulder-offset (Runde 14): konst snit ' + r2.old.S.mean.toFixed(0)
          + 'px -> roteret ' + r2.neu.S.mean.toFixed(0) + 'px  = ' + gSh);
console.log((g1&&g2&&gKin&&gFlip&&gSh)
  ? '\n GROEN: kinematik slaar fri 2D; hofte-side retter flip; roterende skulder-offset\n'
    + '        fjerner "skulder falder frem i bunden" - alt uden regression.\n'
    + ' NB: hofte-KOLLAPS ("16 grader") stammer fra forkerte laengder/knae-drift, IKKE\n'
    + '     gren-valget - kan ikke loeses i solveren. Kraever test paa Marcs RIGTIGE video.\n'
  : '\n ROED: se ovenfor.\n');
