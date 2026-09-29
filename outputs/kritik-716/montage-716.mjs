// Ordre 716: laegger flere skaermbilleder i en raekke (kun til at se paa dem hurtigere).
import puppeteer from 'puppeteer-core'; import fs from 'node:fs';
const [ud, w, ...filer] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage(); await p.setViewport({ width: +w, height: 700 });
const html = '<body style="margin:0;background:#000;display:flex;gap:4px">' + filer.map(f => `<img style="height:660px" src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}">`).join('') + '</body>';
await p.setContent(html); await p.screenshot({ path: ud, fullPage: true }); await b.close();
