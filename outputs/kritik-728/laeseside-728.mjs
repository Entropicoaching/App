import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'});
const U='file:///C:/Users/Entropi/Desktop/Til%20Marc/LAES-MODELLER-3.html',r={};
for(const [w,h,t] of [[390,844,true],[1280,900,false]]){const p=await b.newPage();const x=r[w]={fejl:[],net:[]};
 p.on('pageerror',e=>x.fejl.push(String(e)));await p.setRequestInterception(true);p.on('request',q=>q.url().startsWith('file:')||q.url().startsWith('data:')?q.continue():(x.net.push(q.url()),q.abort()));
 await p.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:t,hasTouch:t});await p.goto(U);await new Promise(a=>setTimeout(a,800));
 x.billeder=await p.evaluate(()=>document.images.length+document.querySelectorAll('svg').length);x.sidelaens=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 await p.screenshot({path:`outputs/kritik-728/L728-${w}-laeseside.png`,fullPage:true});await p.close();}
await b.close();console.log(JSON.stringify(r));
