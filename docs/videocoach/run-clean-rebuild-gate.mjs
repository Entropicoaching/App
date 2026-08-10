// VIDEOCOACH-CLEAN-REBUILD-001 — commitlokal, browsernær A/B-gate.
// Samme genererede video/upload og samme manuelle start bruges mod live 8b80f75
// og kandidaten. Ingen atletdata, netværksupload eller produktwrites.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = '8b80f75b1f572ca7040baff0e76a0d19c7f5e035';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const candidateHtml = readFileSync(join(root, 'public', 'videocoach.html'), 'utf8');
const baselineHtml = execFileSync('git', ['show', `${BASE}:public/videocoach.html`],
  {cwd:root,encoding:'utf8',maxBuffer:20_000_000});
const runtimeModules = join(homedir(), '.cache', 'codex-runtimes',
  'codex-primary-runtime', 'dependencies', 'node', 'node_modules');
const require = createRequire(import.meta.url);
const { chromium } = require(join(runtimeModules, 'playwright'));
const fail = (condition, message) => { if (!condition) throw new Error(message); };

for (const marker of ['freezeRawAcquisition','rawImmutable:true','path.reviewStartTime = raw.start;',
  'path.reviewEndTime = raw.end;','drawCleanBarPath','recoveryJump<=maxJump',
  'manualCorrections','vcRepSelector','vcPhaseLegend','exportPreview','Velocity','ROM','Tempo',
  "lift === 'deadlift'","lift === 'bench'","lift === 'squat'"])
  fail(candidateHtml.includes(marker), `kilden mangler clean rebuild-markør: ${marker}`);
const cleanAnalysis = candidateHtml.slice(candidateHtml.indexOf('function analyzeCleanPath'),
  candidateHtml.indexOf('function analyzePathLegacy8b80f75'));
fail(cleanAnalysis && !/path\.(pts|times|valid|confidence)\s*=\s*path\.\1\.slice/.test(cleanAnalysis),
  'clean interpretation må ikke slice eller mutere raw acquisition');

const deadliftGate = spawnSync(process.execPath, [join(here, 'run-deadlift-gate.mjs')],
  {cwd:root,encoding:'utf8'});
if (deadliftGate.status !== 0) {
  process.stderr.write(deadliftGate.stdout + deadliftGate.stderr);
  process.exit(deadliftGate.status || 1);
}

function startServer(html) {
  const server = createServer((request, response) => {
    if (request.url?.startsWith('/videocoach.html')) {
      response.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      response.end(html); return;
    }
    if (request.url === '/sw.js') {
      response.writeHead(200, {'content-type':'text/javascript','cache-control':'no-store'});
      response.end('self.addEventListener("fetch",()=>{});'); return;
    }
    response.writeHead(204); response.end();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({server,url:`http://127.0.0.1:${address.port}/videocoach.html?benchmark=1`});
    });
  });
}

async function makeDeadliftVideo(browser) {
  const page = await browser.newPage({viewport:{width:640,height:360}});
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    const type = ['video/webm;codecs=vp8','video/webm'].find(MediaRecorder.isTypeSupported.bind(MediaRecorder));
    if (!type) throw new Error('MediaRecorder mangler WebM-support');
    const recorder = new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:2_500_000});
    const chunks = [];
    recorder.ondataavailable = event => event.data.size && chunks.push(event.data);
    const stopped = new Promise(resolve => recorder.onstop = resolve);
    const duration = 5.2, started = performance.now();
    const yAt = t => t < .55 ? 266
      : t < 2.35 ? 266 - (t - .55) / 1.80 * 112
      : t < 2.85 ? 154
      : t < 4.65 ? 154 + (t - 2.85) / 1.80 * 112 : 266;
    recorder.start(250);
    await new Promise(resolve => {
      const draw = now => {
        const t = Math.min(duration,(now-started)/1000), x = 246, y = yAt(t);
        ctx.fillStyle = '#171715'; ctx.fillRect(0,0,640,360);
        ctx.strokeStyle = '#272723'; ctx.lineWidth = 1;
        for (let gx=20;gx<640;gx+=40) { ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,360);ctx.stroke(); }
        for (let gy=20;gy<360;gy+=40) { ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(640,gy);ctx.stroke(); }
        ctx.fillStyle = '#2c2921'; ctx.fillRect(80,38,22,285);
        ctx.fillStyle = '#4a4539'; ctx.fillRect(430,70,80,24);
        ctx.strokeStyle = '#b9b3a8'; ctx.lineWidth = 8;
        ctx.beginPath();ctx.moveTo(90,y);ctx.lineTo(405,y);ctx.stroke();
        // Flade farvefelter overlever WebM-encoding stabilt; gradient-bånd gav
        // codec-afhængige identity-fejl og gjorde A/B-fixturen flaky.
        ctx.fillStyle='#ad4937';ctx.beginPath();ctx.arc(x,y,64,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#f4ead6';ctx.lineWidth=6;ctx.stroke();
        ctx.strokeStyle='#7a604d';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,43,0,Math.PI*2);ctx.stroke();
        ctx.strokeStyle='#7a604d';ctx.lineWidth=3;
        for(let a=0;a<8;a++){const q=a*Math.PI/4;ctx.beginPath();ctx.moveTo(x+Math.cos(q)*20,y+Math.sin(q)*20);ctx.lineTo(x+Math.cos(q)*53,y+Math.sin(q)*53);ctx.stroke();}
        // Fast, asymmetrisk hjørnetekstur på selve skiven: optisk flow får
        // unik konsensus gennem ascent, lockout-pause og retur.
        ctx.fillStyle='#b7a98d';ctx.fillRect(x-18,y-17,36,34);
        ctx.fillStyle='#625448';ctx.fillRect(x-14,y-13,9,21);
        ctx.fillRect(x-14,y+7,20,7);ctx.fillRect(x+5,y-11,8,8);
        ctx.fillStyle='#8e3b2b';ctx.fillRect(x+3,y,11,13);
        ctx.fillStyle='#d6a956';ctx.fillRect(x-2,y-13,4,8);
        ctx.fillStyle='#d6a956';ctx.font='16px sans-serif';ctx.fillText('ENTROPI TEST',470,330);
        if (t >= duration) { resolve(); return; }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });
    recorder.stop(); await stopped;
    return Array.from(new Uint8Array(await new Blob(chunks,{type}).arrayBuffer()));
  });
  await page.close();
  return Buffer.from(bytes);
}

async function overflowState(page) {
  return page.evaluate(() => ({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth,
    hud:document.getElementById('barPathHUD')?.getBoundingClientRect().toJSON(),
    consoleDebugVisible:[...document.querySelectorAll('[id*="Debug"],[class*="debug"]')]
      .some(element => element.offsetParent !== null)
  }));
}

async function runAthleteCase(browser, testCase, videoBuffer) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  // Baseline har ingen synlig athlete-liftvælger. Brug dens eksisterende,
  // brugerbestemte localStorage-præference på begge friske origins; kandidaten
  // bekræfter derefter samme værdi gennem sin faktiske synlige ATHLETE-kontrol.
  await context.addInitScript(() => localStorage.setItem('vc_lift','Dødløft'));
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(testCase.url,{waitUntil:'domcontentloaded'});
  await page.locator('#fileInput').setInputFiles({name:'same-deadlift-fixture.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await page.waitForFunction(() => !document.getElementById('canvas').hidden &&
    document.querySelector('video')?.duration > 5,{timeout:15_000});
  if (testCase.candidate) {
    await page.locator('#vcAthleteLift').selectOption({label:'Dødløft'});
  }
  // Samme synlige frame-scrub væk fra WebM-containerens første decode-seam.
  // Det svarer til brugerens normale "spol til lige før løftet"-handling.
  for (let frame = 0; frame < 9; frame++) await page.locator('#fwdS').click();
  await page.waitForFunction(() => document.getElementById('video').currentTime > .2);
  await page.locator('#athleteMarkStartBtn').click();
  await page.locator('#allBtn').click();
  const canvasBox = await page.locator('#canvas').boundingBox();
  fail(canvasBox, `${testCase.name}: canvas mangler`);
  await page.mouse.click(canvasBox.x + canvasBox.width * 246 / 640,
    canvasBox.y + canvasBox.height * 266 / 360);
  await page.waitForFunction(() => document.body.dataset.athleteState === 'confirm',null,{timeout:8_000});
  await page.locator('#allBtn').click();
  await page.waitForFunction(() => window.__vcTrackerBenchmarkLast?.outcome === 'completed',null,{timeout:60_000});
  try {
    await page.waitForFunction(() => document.body.dataset.athleteState === 'done',null,{timeout:10_000});
  } catch {
    const state = await page.evaluate(() => ({state:document.body.dataset.athleteState,
      banner:document.getElementById('banner').textContent,
      audit:window.__vcCleanRebuildAudit || null,tracker:window.__vcTrackerBenchmarkLast}));
    throw new Error(`${testCase.name}: tracking afsluttede uden done-state: ${JSON.stringify(state)}; ${errors.join(' | ')}`);
  }
  const mobile = await overflowState(page);
  let audit = null, preview = null, liftControls = null;
  if (testCase.candidate) {
    await page.waitForFunction(() => window.__vcCleanRebuildAudit?.raw?.frozen === true,null,{timeout:8_000});
    audit = await page.evaluate(() => structuredClone(window.__vcCleanRebuildAudit));
    liftControls = await page.evaluate(() => ['squat','bench'].map(lift => {
      const count = 61, times = Array.from({length:count},(_,index)=>index/30);
      const y = times.map((_,index) => index < 6 ? 100
        : index <= 25 ? 100 + (index-5)/20*120
        : index <= 30 ? 220
        : index <= 50 ? 220 - (index-30)/20*120 : 100);
      const session = Object.freeze({schema:1,lift,trackingStart:times[0],
        trackingEnd:times.at(-1),bounds:'manual',rawImmutable:true});
      const path = {type:'path',pts:y.map((value,index)=>({x:245+(index%3),y:value})),
        times,valid:times.map(()=>true),confidence:times.map(()=>1),startFrame:0,
        analysisSession:session};
      freezeRawAcquisition(path,session);
      analyzeCleanPath(path);
      return {lift,rawFrozen:Object.isFrozen(path.raw)&&Object.isFrozen(path.raw.pts),
        rawCount:path.raw.pts.length,phases:[...new Set(path.analysis.phases.map(item=>item.kind))],
        metricValid:path.analysis.reps.some(rep=>rep.validRatio>=.8&&Number.isFinite(rep.mcv)&&
          Number.isFinite(rep.romCm)&&Number.isFinite(rep.conS))};
    }));
    await page.evaluate(() => {
      const audit = window.__vcCleanRebuildAudit;
      const video = document.querySelector('video');
      video.pause(); video.currentTime = Math.max(audit.raw.start,audit.raw.end-.05);
    });
    await page.waitForTimeout(200);
    await page.locator('#exportBtn').click();
    await page.waitForFunction(() => !document.getElementById('exportPreview').hidden);
    preview = await page.evaluate(() => ({
      visible:!document.getElementById('exportPreview').hidden,
      width:document.getElementById('exportPreviewCanvas').width,
      height:document.getElementById('exportPreviewCanvas').height,
      text:document.getElementById('exportPreviewText').textContent
    }));
    await page.locator('#cancelExportBtn').click();
  }
  await page.setViewportSize({width:1440,height:900});
  await page.waitForTimeout(150);
  const desktop = await overflowState(page);
  const tracker = await page.evaluate(() => structuredClone(window.__vcTrackerBenchmarkLast));
  await context.close();
  return {tracker,audit,preview,liftControls,mobile,desktop,errors};
}

const baselineServer = await startServer(baselineHtml);
const candidateServer = await startServer(candidateHtml);
const browserExecutable = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find(existsSync);
fail(browserExecutable, 'lokal Chrome/Edge mangler til browser-gaten');
const browser = await chromium.launch({headless:true,executablePath:browserExecutable});
try {
  const video = await makeDeadliftVideo(browser);
  fail(video.length > 20_000, 'den genererede uploadfixture er tom eller for lille');
  const candidate = await runAthleteCase(browser,{name:'clean rebuild',
    url:`${candidateServer.url}&trackerProbe=1`,candidate:true},video);
  const baseline = await runAthleteCase(browser,{name:'live 8b80f75',url:baselineServer.url},video);
  const baseInvalid = baseline.tracker.invalidFrames / Math.max(1,baseline.tracker.frames);
  const candidateInvalid = candidate.tracker.invalidFrames / Math.max(1,candidate.tracker.frames);
  // rVFC-sampling varierer lidt mellem to realtidsafspilninger. Stabilitet
  // afgøres af invalid-andelen; 85% frame-cadence er kun en drop-vagt.
  fail(candidate.tracker.frames >= baseline.tracker.frames * .85,
    `A/B: kandidaten mistede frames (${candidate.tracker.frames} mod ${baseline.tracker.frames})`);
  const rejectReasons = (candidate.tracker.frameProbe || []).filter(frame => !frame.accepted)
    .reduce((counts,frame) => ({...counts,[frame.rejectGate]:(counts[frame.rejectGate]||0)+1}),{});
  const rejectSample = (candidate.tracker.frameProbe || []).filter(frame => !frame.accepted).slice(0,3);
  fail(candidateInvalid <= baseInvalid + .02,
    `A/B: kandidaten er mindre stabil (${candidateInvalid} mod ${baseInvalid}; `+
    `radius ${candidate.tracker.plateRadius}/${baseline.tracker.plateRadius}; `+
    `modes ${candidate.tracker.trackerMode}/${baseline.tracker.trackerMode}; `+
    `${JSON.stringify(rejectReasons)}; ${JSON.stringify(rejectSample)})`);
  fail(candidate.audit.raw.count === candidate.audit.raw.times &&
    candidate.audit.raw.count === candidate.audit.raw.confidence &&
    candidate.audit.raw.count === candidate.audit.raw.valid,
    'raw pts/times/confidence/valid skal være alignet');
  fail(candidate.audit.raw.count === candidate.tracker.frames && candidate.audit.raw.frozen,
    'raw acquisition skal være fuld og immutable');
  fail(candidate.audit.raw.end - candidate.audit.raw.start > 4.7,
    'auto-cut: raw review mangler slutningen af den manuelt afgrænsede video');
  fail(Math.abs(candidate.audit.raw.last.y - candidate.audit.raw.first.y) < 35,
    'fuld retur: sidste raw punkt er ikke tilbage ved gulvet');
  fail(candidate.audit.raw.last.y < 330, 'bundhop: sidste output er kastet mod canvas-bunden');
  const phaseKinds = new Set(candidate.audit.phases.map(item => item.kind));
  for (const kind of ['setup','concentric','lockout','return'])
    fail(phaseKinds.has(kind), `deadlift mangler separat ${kind}-fase`);
  const rep = candidate.audit.reps[0];
  fail(rep && rep.validRatio >= .8 && Number.isFinite(rep.mcv) && Number.isFinite(rep.romCm) &&
    Number.isFinite(rep.conS) && Number.isFinite(rep.eccS) && Number.isFinite(rep.pauseS),
    'velocity/ROM/tempo må kun vises fra et gyldigt rep-signal');
  const squat = candidate.liftControls.find(item=>item.lift==='squat');
  const bench = candidate.liftControls.find(item=>item.lift==='bench');
  for (const control of [squat,bench])
    fail(control?.rawFrozen && control.rawCount===61 && control.metricValid,
      `${control?.lift || 'ikke-deadlift'}-kontrol muterede raw eller mistede valide metrics`);
  for (const kind of ['eccentric','transition','concentric','lockout'])
    fail(squat.phases.includes(kind), `squat mangler ${kind}-fase`);
  for (const kind of ['eccentric','pause','concentric','lockout'])
    fail(bench.phases.includes(kind), `bench mangler ${kind}-fase`);
  fail(candidate.preview?.visible && candidate.preview.width > 0 &&
    /fuld raw bane/.test(candidate.preview.text), 'exportpreview mangler full-path-bevis');
  for (const [label,state] of [['390',candidate.mobile],['1440',candidate.desktop]]) {
    fail(state.scrollWidth <= state.width + 1 && state.bodyWidth <= state.width + 1,
      `${label}px har horisontalt overflow`);
    fail(!state.consoleDebugVisible, `${label}px viser debug-krom`);
  }
  fail(candidate.errors.length === 0, `kandidaten har konsolfejl: ${candidate.errors.join(' | ')}`);
  console.log(`GRØN: A/B samme video — live ${baseline.tracker.frames} frames/${baseline.tracker.invalidFrames} invalid; `+
    `candidate ${candidate.tracker.frames}/${candidate.tracker.invalidFrames}.`);
  console.log(`GRØN: immutable raw ${candidate.audit.raw.count} pts/times/confidence; `+
    `fuld ${Math.round((candidate.audit.raw.end-candidate.audit.raw.start)*10)/10}s retur til y=${candidate.audit.raw.last.y.toFixed(1)}.`);
  console.log(`GRØN: deadlift faser ${[...phaseKinds].join(', ')}; valide velocity/ROM/tempo; exportpreview.`);
  console.log(`GRØN: lift-kontrol — squat ${squat.phases.join(', ')}; bench ${bench.phases.join(', ')}; raw uændret.`);
  console.log('GRØN: ATHLETE uploadflow på friske localhost-origins; 390/1440 uden overflow, konsolfejl eller debug-krom.');
} finally {
  await browser.close();
  await new Promise(resolve => baselineServer.server.close(resolve));
  await new Promise(resolve => candidateServer.server.close(resolve));
}
