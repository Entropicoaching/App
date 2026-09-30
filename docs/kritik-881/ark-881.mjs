import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const [,, out, cols, ...files]=process.argv;
const html='<body style="margin:0;background:#222;display:grid;grid-template-columns:repeat('+cols+',1fr);gap:4px">'+files.map(f=>'<div style="color:#fff;font:11px sans-serif"><img style="width:100%" src="data:image/png;base64,'+fs.readFileSync(f).toString('base64')+'">'+f.split(/[\\/]/).pop()+'</div>').join('')+'</body>';
const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new'});
const p=await b.newPage(); await p.setViewport({width:1600,height:900}); await p.setContent(html); await p.screenshot({path:out,fullPage:true}); await b.close();

