import puppeteer from 'puppeteer-core';
const UD='outputs/kritik-864',H='http://127.0.0.1:8864',w=1280;
const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'});
const p=await b.newPage(); await p.setViewport({width:w,height:900,deviceScaleFactor:1});
await p.setRequestInterception(true); p.on('request',q=>q.url().startsWith(H)||q.url().startsWith('data:')?q.continue():q.abort());
await p.goto(H+'/demo/baenk.html',{waitUntil:'load'}); await new Promise(r=>setTimeout(r,800));
for (const tx of ['Lille','Stor']) { await p.evaluate(t=>{[...document.querySelectorAll('button')].find(e=>e.textContent.trim().startsWith(t))?.click()},tx);
 for(let i=0;i<12;i++){ await new Promise(r=>setTimeout(r,220)); const c=await p.$('#bench-canvas'); await c.screenshot({path:`${UD}/B864-${tx}-${String(i).padStart(2,'0')}.png`}); } }
await b.close();
