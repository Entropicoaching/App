import puppeteer from 'puppeteer-core';
const UD='outputs/kritik-745',H='http://127.0.0.1:8745',w8=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'});
const ut={};
for(const [w,h,t] of [[390,844,true],[1280,900,false]]){
 const p=await b.newPage(); await p.setViewport({width:w,height:h,deviceScaleFactor:2,isMobile:t,hasTouch:t});
 await p.setRequestInterception(true); p.on('request',q=>q.url().startsWith(H)||q.url().startsWith('data:')?q.continue():(ut.net=(ut.net||[]).concat(q.url()),q.abort()));
 await p.goto(H+'/dist/tre-loeft/index.html'); await w8(600);
 const fig=async n=>{const f=await p.$('[data-rolle=figurer]'); await f.screenshot({path:`${UD}/F745-${w}-${n}.png`});};
 const kl=async tx=>p.evaluate(tx=>{const x=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===tx); x&&x.click();},tx);
 await p.click('[data-loeft=squat]'); await w8(300);
 for(const bar of ['lowbar','highbar']){ await p.click(`[data-krop][data-x],[data-loeft=squat]`).catch(()=>{}); await p.evaluate(bar=>document.querySelector(`button[data-stang=${bar}], button[data-loeft=${bar}]`)?.click(),bar);
  for(const st of ['bund','sticking','lockout']){ await p.click(`[data-stilling=${st}]`); await w8(250); await fig(`squat-${bar}-${st}`);} }
 await p.click('[data-loeft=doedloeft]'); await w8(300);
 const sl=async v=>p.evaluate(v=>{const s=[...document.querySelectorAll('input[type=range]')].find(x=>x.min==='1.6'||x.step&&x.max&&+x.min<2&&+x.max<3&&x.value==='1.6'); if(!s) return; s.value=v; s.dispatchEvent(new Event('input',{bubbles:true}));},v);
 for(const [n,tx,v] of [['konv','Konventionel',null],['sumo-smal','Sumo',1.6],['sumo-bred','Sumo',2.0]]){ await kl(tx); if(v) await sl(v); await w8(250);
  for(const st of ['opstilling','lockout']){ await p.click(`[data-stilling=${st}]`); await w8(250); await fig(`dl-${n}-${st}`);} }
 ut[w]=await p.evaluate(()=>[...document.querySelectorAll('input[type=range]')].map(s=>s.min+'-'+s.max+'='+s.value));
 await p.close();}
await b.close(); console.log(JSON.stringify(ut));

