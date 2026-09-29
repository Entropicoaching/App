// Ordre 684: squat-figurerne (low bar, high bar) fra loeftmodellens main (git archive, kun laest), headless, 390 og 1280, uden net.
import puppeteer from 'puppeteer-core';
const UD = 'outputs/kritik-684';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const res = {};
for (const [w, h, touch] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage(); const fejl = [], net = [];
  p.on('pageerror', e => fejl.push(String(e)));
  await p.setRequestInterception(true);
  p.on('request', r => { if (r.url().startsWith('file:') || r.url().startsWith('data:')) r.continue(); else { net.push(r.url()); r.abort(); } });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch });
  await p.goto('file:///C:/Users/Entropi/AppData/Local/Temp/claude/C--Users-Entropi-Desktop-entropi-app-kritik/36e9ef46-0fb6-4491-8b11-ef8adf64a570/scratchpad/lm/dist/tre-loeft/index.html', { waitUntil: 'load' });
  for (const st of ['lowbar', 'highbar']) for (const stil of ['bund', 'sticking', 'lockout']) {
    await p.click('[data-loeft=squat]'); await p.click('[data-stang=' + st + ']'); await p.click('[data-stilling=' + stil + ']');
    await new Promise(r => setTimeout(r, 400));
    const svg = await p.evaluateHandle(() => [...document.querySelectorAll('svg,canvas')].sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0] || document.body);
    await svg.asElement().screenshot({ path: UD + '/S684-' + w + '-' + st + '-' + stil + '.png' });
  }
  await p.screenshot({ path: UD + '/S684-side-' + w + '.png', fullPage: true });
  res[w] = { fejl, net }; await p.close();
}
await b.close(); console.log(JSON.stringify(res));
