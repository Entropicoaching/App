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

const LIVE_BASE = '8b80f75b1f572ca7040baff0e76a0d19c7f5e035';
const BASE = process.env.VC_AB_BASE || LIVE_BASE;
const BOTTOM_SEAM_FIXTURE = process.env.VC_BOTTOM_SEAM_FIXTURE === '1';
const ENTROPI_UX_ACCEPT = process.env.VC_ENTROPI_UX_ACCEPT === '1';
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
const BRIDGE_ATHLETE_ID = '11111111-1111-4111-8111-111111111111';

function bridgeHostHtml(mode) {
  const coach = mode === 'coach';
  const frameSrc = coach
    ? '/videocoach.html?coach=1&bridge=v3&benchmark=1&bridgeTest=1'
    : '/videocoach.html?mode=athlete&bridge=athlete-v1&benchmark=1&bridgeTest=1';
  const athleteName = coach ? 'Brotest Coach-atlet' : 'Brotest Profil-atlet';
  return `<!doctype html><html><body style="margin:0;background:#0f0e0b">
  <iframe id="vcBridgeFrame" src="${frameSrc}" style="display:block;width:100vw;height:100vh;border:0"></iframe>
  <script>
  const prefix='entropi:videocoach:v3';
  const athlete={id:'${BRIDGE_ATHLETE_ID}',name:${JSON.stringify(athleteName)}};
  window.bridgeAudit={ready:0,acks:0,baselines:0,saves:0,row:null};
  addEventListener('message',event=>{
    if(event.origin!==location.origin||!event.source)return;
    const message=event.data||{};
    if(message.type===prefix+':ready'){
      bridgeAudit.ready++;
      event.source.postMessage({type:prefix+':config',athletes:[athlete],
        selectedAthleteId:athlete.id,submissionMode:${JSON.stringify(coach ? 'coach' : 'athlete')}},event.origin);
      return;
    }
    if(message.type===prefix+':config-ack'){bridgeAudit.acks++;return;}
    if(message.type===prefix+':baseline-request'){
      bridgeAudit.baselines++;
      event.source.postMessage({type:prefix+':baseline-result',requestId:message.requestId,
        athleteId:message.athleteId,ok:true,baselines:[]},event.origin);
      return;
    }
    if(message.type===prefix+':save-draft'){
      bridgeAudit.saves++;bridgeAudit.row=message.row;
      event.source.postMessage({type:prefix+':save-result',requestId:message.requestId,ok:true,
        data:{id:'22222222-2222-4222-8222-222222222222',client_analysis_id:message.row.client_analysis_id,
          athlete_id:message.row.athlete_id,status:'draft'}},event.origin);
    }
  });
  <\/script></body></html>`;
}

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
    if (request.url?.startsWith('/bridge-host.html')) {
      const mode = new URL(request.url, 'http://127.0.0.1').searchParams.get('mode');
      response.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      response.end(bridgeHostHtml(mode)); return;
    }
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
      const origin = `http://127.0.0.1:${address.port}`;
      resolve({server,origin,url:`${origin}/videocoach.html?benchmark=1`});
    });
  });
}

async function makeDeadliftVideo(browser, {staticPlate = false} = {}) {
  const page = await browser.newPage({viewport:{width:640,height:360}});
  const bytes = await page.evaluate(async fixture => {
    const {bottomFixture, staticPlate} = fixture;
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
    const movingY = t => t < .55 ? 266
      : t < 2.35 ? 266 - (t - .55) / 1.80 * 112
      : t < 2.85 ? 154
      : t < 4.65 ? 154 + (t - 2.85) / 1.80 * 112 : 266;
    const yAt = t => staticPlate ? 266 : movingY(t);
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
        // Den udvidede bund-fixture fjerner kort den indre flow-tekstur på den
        // sene retur, men bevarer den stærke skiveidentitet. Det tvinger den
        // faktiske lost/recovery-seam uden at indføre et gættet home-punkt.
        const bottomSeam = bottomFixture && t>4.08 && t<4.46;
        if(!bottomSeam){
          ctx.fillStyle='#b7a98d';ctx.fillRect(x-18,y-17,36,34);
          ctx.fillStyle='#625448';ctx.fillRect(x-14,y-13,9,21);
          ctx.fillRect(x-14,y+7,20,7);ctx.fillRect(x+5,y-11,8,8);
          ctx.fillStyle='#8e3b2b';ctx.fillRect(x+3,y,11,13);
          ctx.fillStyle='#d6a956';ctx.fillRect(x-2,y-13,4,8);
        }else{
          ctx.fillStyle='#ad4937';ctx.beginPath();ctx.arc(x,y,38,0,Math.PI*2);ctx.fill();
        }
        ctx.fillStyle='#d6a956';ctx.font='16px sans-serif';ctx.fillText('ENTROPI TEST',470,330);
        if (t >= duration) { resolve(); return; }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });
    recorder.stop(); await stopped;
    return Array.from(new Uint8Array(await new Blob(chunks,{type}).arrayBuffer()));
  }, {bottomFixture:BOTTOM_SEAM_FIXTURE, staticPlate});
  await page.close();
  return Buffer.from(bytes);
}

async function overflowState(page) {
  return page.evaluate(() => ({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth,
    hud:document.getElementById('barPathHUD')?.getBoundingClientRect().toJSON(),
    consoleDebugVisible:[...document.querySelectorAll('[id*="Debug"],[class*="debug"]')]
      .some(element => element.offsetParent !== null),
    systemBar:document.getElementById('vcSystemBar')?.getBoundingClientRect().toJSON() || null,
    workspace:document.body.dataset.vcWorkspace || null,
    minTabHeight:Math.min(...[...document.querySelectorAll('#vcWorkspaceTabs button')]
      .filter(element=>element.offsetParent!==null).map(element=>element.getBoundingClientRect().height),Infinity)
  }));
}

async function runAthleteCase(browser, testCase, videoBuffer) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  // Baseline har ingen synlig athlete-liftvælger. Brug dens eksisterende,
  // brugerbestemte localStorage-præference på begge friske origins; kandidaten
  // bekræfter derefter samme værdi gennem sin faktiske synlige ATHLETE-kontrol.
  await context.addInitScript(candidate => {
    localStorage.setItem('vc_lift', candidate ? 'Sumo dødløft' : 'Dødløft');
    if (candidate) localStorage.setItem('vc_variation', 'Pause sumo');
  }, testCase.candidate);
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(testCase.url,{waitUntil:'domcontentloaded'});
  let liftSelection = null, startGate = null, publicMode = null;
  if (testCase.candidate) publicMode = await page.evaluate(() => ({
    athleteMode:document.body.classList.contains('athlete'),
    openVisible:document.getElementById('athleteOpenVideoBtn')?.offsetParent !== null,
    sendHidden:document.getElementById('athleteSendBtn')?.hidden === true,
    submitHidden:document.getElementById('athleteSubmitSheet')?.hidden === true,
    footerHidden:getComputedStyle(document.querySelector('footer')).display === 'none'
  }));
  await page.locator('#fileInput').setInputFiles({name:'same-deadlift-fixture.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await page.waitForFunction(() => !document.getElementById('canvas').hidden &&
    document.querySelector('video')?.duration > 5,{timeout:15_000});
  if (testCase.candidate) {
    await page.locator('#vcAthleteLift').selectOption({label:'Squat'});
    liftSelection = await page.evaluate(() => ({
      lift:document.getElementById('liftSel').value,
      athleteLift:document.getElementById('vcAthleteLift').value,
      variation:document.getElementById('variationSel').value,
      options:[...document.getElementById('variationSel').options].map(option => option.value)
    }));
    await page.locator('#vcAthleteLift').selectOption({label:'Dødløft'});
    Object.assign(liftSelection, await page.evaluate(() => ({
      deadliftVariation:document.getElementById('variationSel').value,
      deadliftOptions:[...document.getElementById('variationSel').options]
        .map(option => option.value)
    })));
  }
  // Samme synlige frame-scrub væk fra WebM-containerens første decode-seam.
  // Det svarer til brugerens normale "spol til lige før løftet"-handling.
  for (let frame = 0; frame < 9; frame++) await page.locator('#fwdS').click();
  await page.waitForFunction(() => document.getElementById('video').currentTime > .2);
  if (testCase.candidate) startGate = await page.evaluate(() => ({
    beforeDisabled:document.getElementById('allBtn').disabled,
    beforeLabel:document.getElementById('allBtn').dataset.label
  }));
  await page.locator('#athleteMarkStartBtn').click();
  if (testCase.candidate) Object.assign(startGate, await page.evaluate(() => ({
    afterDisabled:document.getElementById('allBtn').disabled,
    afterLabel:document.getElementById('allBtn').dataset.label
  })));
  await page.locator('#allBtn').click();
  const canvasBox = await page.locator('#canvas').boundingBox();
  fail(canvasBox, `${testCase.name}: canvas mangler`);
  // Seam-fixturen bruger samme realistiske manuelle markering seks syntetiske
  // pixels over detectorcentret i begge A/B-kørsler. Det gør den eksisterende
  // home-bias målbar og tvinger recovery til at forene koordinatdomænerne.
  const targetY = BOTTOM_SEAM_FIXTURE ? 260 : 266;
  await page.mouse.click(canvasBox.x + canvasBox.width * 246 / 640,
    canvasBox.y + canvasBox.height * targetY / 360);
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
  let audit = null, preview = null, liftControls = null, reviewUi = null;
  if (testCase.candidate) {
    await page.waitForFunction(() => window.__vcCleanRebuildAudit?.raw?.frozen === true,null,{timeout:8_000});
    audit = await page.evaluate(() => structuredClone(window.__vcCleanRebuildAudit));
    reviewUi = await page.evaluate(() => {
      const hud = document.getElementById('barPathHUD');
      const rect = hud.getBoundingClientRect(), display = getComputedStyle(hud).display;
      return {
      hudVisible:!hud.hidden && display !== 'none' && rect.width > 0 && rect.height > 0,
      hudHidden:hud.hidden,
      hudDisplay:display,
      workspace:document.body.dataset.vcWorkspace,
      athleteState:document.body.dataset.athleteState,
      phases:document.getElementById('vcPhaseLegend').textContent.trim(),
      metrics:document.getElementById('vcMetricCards').textContent.trim(),
      metricValues:[...document.querySelectorAll('#vcMetricCards b')].map(element => element.textContent.trim()),
      lift:document.getElementById('liftSel').value,
      variation:document.getElementById('variationSel').value
    }; });
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
    let preservedTime = null;
    if (testCase.entropiUx) {
      preservedTime = await page.evaluate(() => document.getElementById('video').currentTime);
      await page.locator('#vcTabVideo').click();
      await page.locator('#vcTabReview').click();
      const afterTabs = await page.evaluate(() => document.getElementById('video').currentTime);
      fail(Math.abs(afterTabs-preservedTime)<.05, 'Video/Bane-tab må ikke miste playback-position');
      await page.locator('#vcTabExport').click();
    } else await page.locator('#exportBtn').click();
    await page.waitForFunction(() => !document.getElementById('exportPreview').hidden);
    preview = await page.evaluate(() => ({
      visible:!document.getElementById('exportPreview').hidden,
      width:document.getElementById('exportPreviewCanvas').width,
      height:document.getElementById('exportPreviewCanvas').height,
      text:document.getElementById('exportPreviewText').textContent
    }));
    await page.locator('#cancelExportBtn').click();
    if (testCase.entropiUx) {
      fail(await page.locator('#vcTabReview').getAttribute('aria-selected') === 'true',
        'Tilbage fra eksport skal lande i Bane uden blindgyde');
    }
  }
  await page.setViewportSize({width:1440,height:900});
  await page.waitForTimeout(150);
  const desktop = await overflowState(page);
  const tracker = await page.evaluate(() => structuredClone(window.__vcTrackerBenchmarkLast));
  await context.close();
  return {tracker,audit,preview,liftControls,liftSelection,startGate,publicMode,
    reviewUi,mobile,desktop,errors};
}

async function runDesktopCalibrationCase(browser, url, videoBuffer) {
  const context = await browser.newContext({viewport:{width:1440,height:900}});
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${url}&desktop=1`,{waitUntil:'domcontentloaded'});
  const desktopLiftBefore = await page.evaluate(() => {
    const lift = document.getElementById('liftSel');
    const more = document.getElementById('desktopMoreBtn');
    return {parent:lift.parentElement?.id || '',visible:lift.offsetParent !== null,
      moreHidden:more.hidden && getComputedStyle(more).display === 'none'};
  });
  await page.locator('#fileInput').setInputFiles({name:'desktop-calibration.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await page.waitForFunction(() => !document.getElementById('canvas').hidden &&
    document.querySelector('video')?.duration > 5,{timeout:15_000});
  await page.locator('#vcLiftSlot #liftSel').selectOption({label:'Dødløft'});
  await page.evaluate(() => { document.querySelector('video').currentTime = .3; });
  await page.waitForFunction(() => document.querySelector('video').currentTime > .2);
  await page.locator('#trimInBtn').click();
  await page.locator('#allBtn').click();
  const canvasBox = await page.locator('#canvas').boundingBox();
  fail(canvasBox, 'desktop: canvas mangler');
  await page.mouse.click(canvasBox.x + canvasBox.width * 246 / 640,
    canvasBox.y + canvasBox.height * (BOTTOM_SEAM_FIXTURE ? 260 : 266) / 360);
  await page.waitForFunction(() => window.__vcCalibrationRingDrawn?.radius > 0 &&
    document.getElementById('allBtn').textContent === 'Start analyse');
  const setupRing = await page.evaluate(() => ({...window.__vcCalibrationRingDrawn}));
  const scaleX = canvasBox.width / 640, scaleY = canvasBox.height / 360;
  const startX = canvasBox.x + (setupRing.x + setupRing.radius) * scaleX;
  const startY = canvasBox.y + setupRing.y * scaleY;
  await page.mouse.move(startX,startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12 * scaleX,startY,{steps:4});
  await page.mouse.up();
  await page.locator('#allBtn').click();
  await page.waitForFunction(() => window.__vcTrackerBenchmarkLast?.outcome === 'completed',null,
    {timeout:60_000});
  await page.evaluate(() => {
    const path = window.__vcTrackerBenchmarkLast;
    document.querySelector('video').pause();
    document.querySelector('video').currentTime = path?.times?.[0] || 0;
  });
  await page.waitForFunction(() => Number.isFinite(window.__vcVelocityBarAudit?.value));
  const metricsVisibleBefore = await page.locator('#vcMetricCards').isVisible();
  await page.locator('#vcToggleMetrics').click();
  const metricsHiddenAfterClick = !(await page.locator('#vcMetricCards').isVisible());
  await page.locator('#vcToggleMetrics').click();
  const hudExpanded = await page.locator('#barPathHUD').boundingBox();
  await page.locator('#vcHudCollapse').click();
  const hudCollapsed = await page.locator('#barPathHUD').boundingBox();
  const collapsedState = await page.evaluate(() => ({
    collapsed:document.body.classList.contains('vcHudCollapsed'),
    expanded:document.getElementById('vcHudCollapse').getAttribute('aria-expanded'),
    metricsDisplay:getComputedStyle(document.getElementById('vcMetricCards')).display
  }));
  await page.locator('#vcHudCollapse').click();
  await page.locator('#desktopMoreBtn').click();
  const fordydState = await page.evaluate(() => ({
    trayVisible:getComputedStyle(document.getElementById('deskTray')).display !== 'none',
    hudHidden:getComputedStyle(document.getElementById('barPathHUD')).display === 'none',
    trayOpen:document.body.classList.contains('vcDeskTrayOpen')
  }));
  await page.locator('#desktopMoreBtn').click();
  await page.locator('#vcTabExport').click();
  await page.waitForFunction(() => !document.getElementById('exportPreview').hidden);
  // Efter en gennemført eksport er previewet lukket, mens workspace stadig er
  // Eksport. Her skal topbarens Tilbage føre ét trin tilbage til Bane.
  await page.evaluate(() => { document.getElementById('exportPreview').hidden = true; });
  await page.locator('#vcBackStep').click();
  const backFromExport = await page.evaluate(() => ({
    workspace:document.body.dataset.vcWorkspace,
    previewHidden:document.getElementById('exportPreview').hidden
  }));
  const result = await page.evaluate(() => ({
    outcome:window.__vcTrackerBenchmarkLast?.outcome,
    frames:window.__vcTrackerBenchmarkLast?.frames || 0,
    button:document.getElementById('allBtn').textContent,
    workspace:document.body.dataset.vcWorkspace,
    calibration:window.__vcConfirmedCalibration,
    moreVisibleAfter:document.getElementById('desktopMoreBtn').offsetParent !== null,
    velocityBar:window.__vcVelocityBarAudit,
    meanVelocity:window.__vcCleanRebuildAudit?.reps?.[0]?.mcv,
    metricValues:[...document.querySelectorAll('#vcMetricCards .vcMetric b')]
      .map(node => node.textContent.trim())
  }));
  await context.close();
  return {...result,setupRing,desktopLiftBefore,backFromExport,
    hudLayout:{expanded:hudExpanded,collapsed:hudCollapsed,collapsedState,fordydState},
    metricsToggle:{before:metricsVisibleBefore,hiddenAfterClick:metricsHiddenAfterClick},errors};
}

async function runNoRepCase(browser, url, videoBuffer) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(() => localStorage.setItem('vc_lift','Dødløft'));
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${url}&noRep=1`,{waitUntil:'domcontentloaded'});
  await page.locator('#fileInput').setInputFiles({name:'static-plate.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await page.waitForFunction(() => !document.getElementById('canvas').hidden &&
    document.querySelector('video')?.duration > 5,{timeout:15_000});
  for (let frame = 0; frame < 9; frame++) await page.locator('#fwdS').click();
  await page.waitForFunction(() => document.getElementById('video').currentTime > .2);
  await page.locator('#athleteMarkStartBtn').click();
  await page.locator('#allBtn').click();
  const canvasBox = await page.locator('#canvas').boundingBox();
  fail(canvasBox, 'no-rep: canvas mangler');
  await page.mouse.click(canvasBox.x + canvasBox.width * 246 / 640,
    canvasBox.y + canvasBox.height * 266 / 360);
  await page.waitForFunction(() => document.body.dataset.athleteState === 'confirm',null,{timeout:8_000});
  await page.locator('#allBtn').click();
  await page.waitForFunction(() => window.__vcTrackerBenchmarkLast?.outcome === 'completed',null,
    {timeout:60_000});
  await page.waitForFunction(() => document.body.dataset.athleteState === 'error',null,
    {timeout:10_000});
  const result = await page.evaluate(() => ({
    state:document.body.dataset.athleteState,
    workspace:document.body.dataset.vcWorkspace,
    detail:document.querySelector('#athleteStatus span')?.textContent || '',
    reviewDisabled:document.getElementById('vcTabReview').disabled,
    exportDisabled:document.getElementById('vcTabExport').disabled,
    topActionVisible:document.getElementById('vcContinueStep').offsetParent !== null
  }));
  await context.close();
  return {...result,errors};
}

async function runCoachSetupCase(browser, url, videoBuffer) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${url}&coach=1`,{waitUntil:'domcontentloaded'});
  const before = await page.evaluate(() => {
    const visible = element => getComputedStyle(element).display !== 'none' &&
      element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
    return {
      state:document.body.dataset.coachState,
      setupVisible:visible(document.getElementById('coachSetup')),
      footerVisible:visible(document.querySelector('footer')),
      scrubVisible:visible(document.getElementById('scrubRow')),
      nextVisible:visible(document.getElementById('vcContinueStep'))
    };
  });
  await page.locator('#fileInput').setInputFiles({name:'coach-setup.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await page.waitForFunction(() => document.body.dataset.coachState === 'video' &&
    !document.getElementById('canvas').hidden,{timeout:15_000});
  const after = await page.evaluate(() => {
    const visible = element => getComputedStyle(element).display !== 'none' &&
      element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
    return {
      state:document.body.dataset.coachState,
      setupVisible:visible(document.getElementById('coachSetup')),
      footerVisible:visible(document.querySelector('footer')),
      scrubVisible:visible(document.getElementById('scrubRow'))
    };
  });
  await context.close();
  return {before,after,errors};
}

async function runCoachBridgeCase(browser, origin, videoBuffer) {
  const context = await browser.newContext({viewport:{width:1280,height:800}});
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/bridge-host.html?mode=coach`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.bridgeAudit?.acks >= 1,{timeout:10_000});
  const frame = page.frames().find(item => item.url().includes('/videocoach.html'));
  fail(frame, 'coach-brotesten mangler VideoCoach-iframe');
  await frame.waitForFunction(() => [...document.getElementById('coachSetupAthlete').options]
    .some(option => option.textContent === 'Brotest Coach-atlet'),null,{timeout:10_000});
  const setup = await frame.evaluate(() => ({
    setupAthletes:[...document.getElementById('coachSetupAthlete').options]
      .map(option => ({label:option.textContent,id:option.dataset.athleteId || null})),
    sourceAthletes:[...document.getElementById('athleteSel').options]
      .map(option => ({label:option.textContent,id:option.dataset.athleteId || null})),
    setupValue:document.getElementById('coachSetupAthlete').value,
    sourceValue:document.getElementById('athleteSel').value
  }));
  await frame.locator('#coachSetupAthlete').selectOption({label:'Brotest Coach-atlet'});
  await frame.locator('#coachSetupLift').selectOption({label:'Dødløft'});
  const ready = await frame.evaluate(() => ({
    startDisabled:document.getElementById('coachSetupStart').disabled,
    variationDisabled:document.getElementById('coachSetupVariation').disabled,
    sourceAthleteId:document.getElementById('athleteSel').selectedOptions[0]?.dataset.athleteId || null,
    toolGroups:[...document.querySelectorAll('#moreBar .coachToolGroup')].map(group => group.textContent),
    coreTools:['mskelBtn','aiBtn','graphBtn','fpBtn','barBtn','calibBtn','ghostBtn','cmpBtn',
      'repCmpBtn','lineBtn','angleBtn','recordBtn','exportBtn']
      .every(id => document.getElementById(id)?.closest('#moreBar')) &&
      Boolean(document.getElementById('saveBtn')?.closest('#sheet'))
  }));
  await frame.locator('#fileInput').setInputFiles({name:'coach-bridge.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await frame.waitForFunction(() => document.body.dataset.coachState === 'video' &&
    !document.getElementById('canvas').hidden,null,{timeout:15_000});
  const loaded = await frame.evaluate(() => ({
    coachState:document.body.dataset.coachState,
    footerVisible:getComputedStyle(document.querySelector('footer')).display !== 'none',
    scrubVisible:getComputedStyle(document.getElementById('scrubRow')).display !== 'none',
    overflow:document.documentElement.scrollWidth > innerWidth + 1
  }));
  const audit = await page.evaluate(() => structuredClone(window.bridgeAudit));
  await context.close();
  return {setup,ready,loaded,audit,errors};
}

async function runAthleteBridgeCase(browser, origin, videoBuffer) {
  const context = await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(() => localStorage.setItem('vc_lift','Dødløft'));
  await context.route(/^https:\/\/fonts\./, route => route.fulfill({status:200,
    contentType:'text/css',body:''}));
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(`${origin}/bridge-host.html?mode=athlete`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.bridgeAudit?.acks >= 1,{timeout:10_000});
  const frame = page.frames().find(item => item.url().includes('/videocoach.html'));
  fail(frame, 'atlet-brotesten mangler VideoCoach-iframe');
  await frame.locator('#fileInput').setInputFiles({name:'athlete-profile-bridge.webm',
    mimeType:'video/webm',buffer:videoBuffer});
  await frame.waitForFunction(() => !document.getElementById('canvas').hidden &&
    document.querySelector('video')?.duration > 5,null,{timeout:15_000});
  await frame.locator('#vcAthleteLift').selectOption({label:'Dødløft'});
  for (let index = 0; index < 9; index++) await frame.locator('#fwdS').click();
  await frame.waitForFunction(() => document.getElementById('video').currentTime > .2);
  await frame.locator('#athleteMarkStartBtn').click();
  await frame.locator('#allBtn').click();
  const canvasBox = await frame.locator('#canvas').boundingBox();
  fail(canvasBox, 'atlet-brotesten mangler canvas');
  await page.mouse.click(canvasBox.x + canvasBox.width * 246 / 640,
    canvasBox.y + canvasBox.height * (BOTTOM_SEAM_FIXTURE ? 260 : 266) / 360);
  await frame.waitForFunction(() => document.body.dataset.athleteState === 'confirm',null,{timeout:8_000});
  await frame.locator('#allBtn').click();
  await frame.waitForFunction(() => window.__vcTrackerBenchmarkLast?.outcome === 'completed',null,
    {timeout:60_000});
  await frame.waitForFunction(() => document.body.dataset.athleteState === 'done',null,{timeout:10_000});
  await frame.locator('#athleteSendBtn').click();
  await frame.waitForFunction(() => !document.getElementById('athleteSubmitSheet').hidden);
  await frame.locator('#loadInput').fill('180 kg / RPE 8');
  await frame.locator('#athleteNoteInput').fill('Brotest uden database-write');
  await frame.locator('#saveBtn').click();
  await page.waitForFunction(() => window.bridgeAudit?.saves === 1 && window.bridgeAudit?.row,
    {timeout:15_000});
  await frame.waitForFunction(() => document.body.dataset.athleteState === 'sent',null,{timeout:8_000});
  const audit = await page.evaluate(() => structuredClone(window.bridgeAudit));
  const ui = await frame.evaluate(() => ({
    athleteState:document.body.dataset.athleteState,
    submitHidden:document.getElementById('athleteSubmitSheet').hidden,
    sendLabel:document.getElementById('saveBtn').textContent,
    overflow:document.documentElement.scrollWidth > innerWidth + 1
  }));
  await context.close();
  return {audit,ui,errors};
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
  const staticVideo = await makeDeadliftVideo(browser,{staticPlate:true});
  fail(video.length > 20_000, 'den genererede uploadfixture er tom eller for lille');
  fail(staticVideo.length > 20_000, 'no-rep-fixturen er tom eller for lille');
  const noRep = await runNoRepCase(browser,candidateServer.url,staticVideo);
  fail(noRep.state === 'error' && noRep.workspace === 'video' &&
       noRep.reviewDisabled && noRep.exportDisabled && /Ingen tydelig rep/.test(noRep.detail),
    `et statisk track blev fejlagtigt meldt som færdigt: ${JSON.stringify(noRep)}`);
  fail(!noRep.topActionVisible,
    `atletflowet viste stadig en konkurrerende top-handling: ${JSON.stringify(noRep)}`);
  fail(noRep.errors.length === 0,
    `no-rep-flowet har konsolfejl: ${noRep.errors.join(' | ')}`);
  const coachSetup = await runCoachSetupCase(browser,candidateServer.url,video);
  fail(coachSetup.before.state === 'setup' && coachSetup.before.setupVisible &&
       !coachSetup.before.footerVisible && !coachSetup.before.scrubVisible &&
       !coachSetup.before.nextVisible,
    `coachens klargøring viste analyseværktøjer før video: ${JSON.stringify(coachSetup)}`);
  fail(coachSetup.after.state === 'video' && !coachSetup.after.setupVisible &&
       coachSetup.after.footerVisible && coachSetup.after.scrubVisible,
    `coachens analyseværktøjer blev ikke aktiveret efter video-load: ${JSON.stringify(coachSetup)}`);
  fail(coachSetup.errors.length === 0,
    `coachens klargøringsflow har konsolfejl: ${coachSetup.errors.join(' | ')}`);
  const coachBridge = await runCoachBridgeCase(browser,candidateServer.origin,video);
  fail(coachBridge.setup.setupAthletes.length === 2 &&
       coachBridge.setup.setupAthletes[1]?.id === BRIDGE_ATHLETE_ID &&
       coachBridge.setup.sourceAthletes[1]?.id === BRIDGE_ATHLETE_ID &&
       coachBridge.setup.setupValue === 'Brotest Coach-atlet' &&
       coachBridge.setup.sourceValue === 'Brotest Coach-atlet',
    `coachens startkort brugte ikke profilens aktuelle atletliste: ${JSON.stringify(coachBridge)}`);
  fail(!coachBridge.ready.startDisabled && !coachBridge.ready.variationDisabled &&
       coachBridge.ready.sourceAthleteId === BRIDGE_ATHLETE_ID &&
       coachBridge.ready.toolGroups.length === 4 && coachBridge.ready.coreTools,
    `coach-versionen manglede kontekst eller den fulde værktøjspakke: ${JSON.stringify(coachBridge)}`);
  fail(coachBridge.loaded.coachState === 'video' && coachBridge.loaded.footerVisible &&
       coachBridge.loaded.scrubVisible && !coachBridge.loaded.overflow &&
       coachBridge.audit.ready >= 1 && coachBridge.audit.acks >= 1,
    `coach-versionens profilbro eller videoflow fejlede: ${JSON.stringify(coachBridge)}`);
  fail(coachBridge.errors.length === 0,
    `coach-broen har konsolfejl: ${coachBridge.errors.join(' | ')}`);
  const athleteBridge = await runAthleteBridgeCase(browser,candidateServer.origin,video);
  const submitted = athleteBridge.audit.row;
  fail(athleteBridge.audit.saves === 1 && submitted?.schema_version === 3 &&
       submitted.athlete_id === BRIDGE_ATHLETE_ID && submitted.source_mode === 'athlete_submission' &&
       submitted.status === 'draft' && submitted.reps_count >= 1 &&
       Array.isArray(submitted.rep_details) && submitted.rep_details.length === submitted.reps_count &&
       Array.isArray(submitted.bar_path?.dx) && submitted.bar_path.dx.length > 10 &&
       Number.isFinite(Number(submitted.metrics?.rom_cm?.value)) &&
       submitted.session_context?.athlete_note === 'Brotest uden database-write',
    `atletversionen sendte ikke en komplet, profilkoblet analysekladde: ${JSON.stringify(athleteBridge)}`);
  fail(athleteBridge.ui.athleteState === 'sent' && athleteBridge.ui.submitHidden &&
       !athleteBridge.ui.overflow && /Sendt til coach/.test(athleteBridge.ui.sendLabel),
    `atleten fik ikke en enkel, afsluttet sendetilstand: ${JSON.stringify(athleteBridge)}`);
  fail(athleteBridge.errors.length === 0,
    `atlet-broen har konsolfejl: ${athleteBridge.errors.join(' | ')}`);
  const desktopCalibration = await runDesktopCalibrationCase(browser,candidateServer.url,video);
  fail(desktopCalibration.outcome === 'completed' && desktopCalibration.frames >= 5,
    `desktop startede ikke analysen efter bekræftet kalibrering: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.calibration?.radius > desktopCalibration.setupRing?.radius &&
       Math.abs(desktopCalibration.calibration.cmPerPx -
         45 / (2 * desktopCalibration.calibration.radius)) < 1e-9,
    `desktop gemte ikke den justerede skivering som måleskala: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.desktopLiftBefore?.visible &&
       desktopCalibration.desktopLiftBefore.parent === 'vcLiftSlot' &&
       desktopCalibration.desktopLiftBefore.moreHidden && desktopCalibration.moreVisibleAfter,
    `desktop manglede et synligt løftvalg før analysen: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.workspace === 'review',
    `desktop åbnede ikke resultatet efter analysen: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.meanVelocity > 0 &&
       desktopCalibration.metricValues.some(value => /m\/s$/.test(value) && !value.startsWith('—')),
    `desktop viste ikke en reel fartmåling: ${JSON.stringify(desktopCalibration)}`);
  fail(Number.isFinite(desktopCalibration.velocityBar?.value) &&
       desktopCalibration.velocityBar.label !== 'NaN',
    `desktop velocity-søjlen viste en ugyldig værdi: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.metricsToggle?.before && desktopCalibration.metricsToggle?.hiddenAfterClick,
    `Metrics-knappen skjulte ikke målekortene: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.hudLayout?.expanded?.height <= 120 &&
       desktopCalibration.hudLayout?.collapsed?.height < desktopCalibration.hudLayout.expanded.height - 15 &&
       desktopCalibration.hudLayout.collapsedState?.collapsed &&
       desktopCalibration.hudLayout.collapsedState.expanded === 'false' &&
       desktopCalibration.hudLayout.collapsedState.metricsDisplay === 'none',
    `desktop-resultatet kunne ikke minimeres kompakt: ${JSON.stringify(desktopCalibration.hudLayout)}`);
  fail(desktopCalibration.hudLayout?.fordydState?.trayVisible &&
       desktopCalibration.hudLayout.fordydState.hudHidden &&
       desktopCalibration.hudLayout.fordydState.trayOpen,
    `Fordyb blev stadig dækket af resultatmetrics: ${JSON.stringify(desktopCalibration.hudLayout)}`);
  fail(desktopCalibration.backFromExport?.workspace === 'review' &&
       desktopCalibration.backFromExport.previewHidden,
    `Tilbage fra Eksport gik ikke til Bane: ${JSON.stringify(desktopCalibration)}`);
  fail(desktopCalibration.errors.length === 0,
    `desktop-kalibreringsflowet har konsolfejl: ${desktopCalibration.errors.join(' | ')}`);
  const candidate = await runAthleteCase(browser,{name:'candidate',
    url:`${candidateServer.url}&trackerProbe=1`,candidate:true,entropiUx:ENTROPI_UX_ACCEPT},video);
  fail(candidate.publicMode?.athleteMode && candidate.publicMode.openVisible &&
       candidate.publicMode.sendHidden && candidate.publicMode.submitHidden &&
       candidate.publicMode.footerHidden,
    `den offentlige smagsprøve var ikke et rent, selvstændigt atletflow: ${JSON.stringify(candidate.publicMode)}`);
  const baselineIsClean = BASE !== LIVE_BASE;
  const baseline = await runAthleteCase(browser,{name:`baseline ${BASE.slice(0,7)}`,
    url:`${baselineServer.url}${baselineIsClean?'&trackerProbe=1':''}`,
    candidate:baselineIsClean},video);
  const baseInvalid = baseline.tracker.invalidFrames / Math.max(1,baseline.tracker.frames);
  const candidateInvalid = candidate.tracker.invalidFrames / Math.max(1,candidate.tracker.frames);
  const movement = result => {
    const pts=result.tracker.pts, times=result.tracker.times, valid=result.tracker.valid;
    const end=times.at(-1), floor=pts[0].y;
    const accepted=pts.map((point,index)=>({point,index,time:times[index]}))
      .filter(item=>valid[item.index]);
    const settled=accepted.filter(item=>item.time>=end-.42);
    const late=accepted.filter(item=>item.time>=end-1.25);
    const steps=late.slice(1).map((item,index)=>Math.hypot(item.point.x-late[index].point.x,
      item.point.y-late[index].point.y));
    return {floor,top:Math.min(...accepted.map(item=>item.point.y)),
      bottomDeviation:Math.max(...settled.map(item=>Math.abs(item.point.y-floor))),
      lastError:Math.abs(accepted.at(-1).point.y-floor),lateMaxStep:Math.max(0,...steps),
      recoveries:result.tracker.homeRecoveries};
  };
  const candidateMotion=movement(candidate),baselineMotion=movement(baseline);
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
  // Realtime rVFC sampling kan lande én frame forskudt ved lockout; sammenlign
  // inden for 8 % af den målte skiveradius, ikke en produkt-trackingtærskel.
  fail(candidateMotion.top <= baselineMotion.top + candidate.tracker.plateRadius*.08,
    `A/B: toppen blev dårligere (${candidateMotion.top} mod ${baselineMotion.top})`);
  if (BOTTOM_SEAM_FIXTURE) {
    fail(candidateMotion.recoveries >= 1 && baselineMotion.recoveries >= 1,
      `bund-fixturen ramte ikke recovery-seamen (${candidateMotion.recoveries}/${baselineMotion.recoveries})`);
    fail(candidateMotion.bottomDeviation + .75 < baselineMotion.bottomDeviation,
      `bunddrop blev ikke reduceret (${candidateMotion.bottomDeviation.toFixed(2)} mod ${baselineMotion.bottomDeviation.toFixed(2)}; `+
      `bias ${JSON.stringify(candidate.tracker.searchBias)}; recovery `+
      `${JSON.stringify((candidate.tracker.frameProbe||[]).filter(frame=>frame.recoveryCandidate).slice(-3))})`);
    fail(candidateMotion.lastError <= 3,
      `candidate lander ikke stabilt ved startbunden (${candidateMotion.lastError.toFixed(2)} px)`);
  }
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
  fail(candidate.liftSelection?.lift === 'Squat' && candidate.liftSelection.athleteLift === 'Squat',
    'atletens synlige squatvalg nåede ikke hovedvælgeren');
  fail(candidate.liftSelection.variation === 'Konkurrence squat' &&
    candidate.liftSelection.options.every(value => /squat/i.test(value)),
    `squat arvede variationer fra sumo: ${JSON.stringify(candidate.liftSelection)}`);
  fail(candidate.liftSelection.deadliftVariation === 'Konkurrence konventionel' &&
    candidate.liftSelection.deadliftOptions.every(value => !/sumo/i.test(value)),
    `dødløft arvede sumo-variationer: ${JSON.stringify(candidate.liftSelection)}`);
  fail(candidate.startGate?.beforeDisabled && candidate.startGate.beforeLabel === 'Sæt start først' &&
       !candidate.startGate.afterDisabled && candidate.startGate.afterLabel === 'Stangbane',
    `startguiden forklarede ikke analyselåsen tydeligt: ${JSON.stringify(candidate.startGate)}`);
  fail(candidate.reviewUi?.hudVisible &&
    /Start/.test(candidate.reviewUi.phases) && /Op/.test(candidate.reviewUi.phases) &&
    /Afslutning/.test(candidate.reviewUi.phases) && /Ned igen/.test(candidate.reviewUi.phases),
    `atletens fasevisning er ufuldstændig: ${JSON.stringify(candidate.reviewUi)}`);
  fail(/Gns\. fart/.test(candidate.reviewUi.metrics) && /Løftevej/.test(candidate.reviewUi.metrics) &&
    /Tempo/.test(candidate.reviewUi.metrics) && candidate.reviewUi.metricValues.every(value => value !== '—'),
    `atletens metrics er ikke brugbare: ${JSON.stringify(candidate.reviewUi)}`);
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
    if (ENTROPI_UX_ACCEPT) {
      fail(state.systemBar && state.systemBar.left >= -1 && state.systemBar.right <= state.width + 1,
        `${label}px Entropi-shell ligger uden for viewport`);
      fail(state.minTabHeight >= 36, `${label}px navigationens touch-target er for lille`);
      fail(state.workspace === 'review', `${label}px mistede review-positionen (${state.workspace})`);
    }
  }
  fail(candidate.errors.length === 0, `kandidaten har konsolfejl: ${candidate.errors.join(' | ')}`);
  console.log(`GRØN: A/B samme video — baseline ${BASE.slice(0,7)} ${baseline.tracker.frames} frames/${baseline.tracker.invalidFrames} invalid; `+
    `candidate ${candidate.tracker.frames}/${candidate.tracker.invalidFrames}.`);
  if (BOTTOM_SEAM_FIXTURE) console.log(`GRØN: browser-recovery reducerede sent bundudsving `+
    `${baselineMotion.bottomDeviation.toFixed(1)} → ${candidateMotion.bottomDeviation.toFixed(1)} px; `+
    `top ${baselineMotion.top.toFixed(1)} → ${candidateMotion.top.toFixed(1)} px.`);
  console.log(`GRØN: immutable raw ${candidate.audit.raw.count} pts/times/confidence; `+
    `fuld ${Math.round((candidate.audit.raw.end-candidate.audit.raw.start)*10)/10}s retur til y=${candidate.audit.raw.last.y.toFixed(1)}.`);
  console.log(`GRØN: deadlift faser ${[...phaseKinds].join(', ')}; valide velocity/ROM/tempo; exportpreview.`);
  console.log(`GRØN: desktop justerede skiveringen, bekræftede kalibreringen og analyserede ${desktopCalibration.frames} frames.`);
  console.log('GRØN: coach-versionen bruger profilens atletliste og har hele værktøjspakken.');
  console.log('GRØN: atletversionen sendte en komplet, profilkoblet analysekladde gennem den mockede appbro.');
  console.log('GRØN: den offentlige version er en selvstændig smagsprøve uden profil- eller sendeknapper.');
  console.log(`GRØN: lift-kontrol — squat ${squat.phases.join(', ')}; bench ${bench.phases.join(', ')}; raw uændret.`);
  console.log('GRØN: ATHLETE uploadflow på friske localhost-origins; 390/1440 uden overflow, konsolfejl eller debug-krom.');
} finally {
  await browser.close();
  await new Promise(resolve => baselineServer.server.close(resolve));
  await new Promise(resolve => candidateServer.server.close(resolve));
}
