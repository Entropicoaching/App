// ORDRE 2125: videocoachens sporer-regression. Tegner et fast sæt syntetiske klip (ingen faste klip i git),
// kører den levende sporer og analyse fra public/videocoach.html headless i Edge og sammenligner reptal og
// fart pr. løft med docs/videocoach/regression-facit.json.
//   npm run video:regression            sammenlign med facit (exit 1 ved afvigelse)
//   npm run video:regression -- --skriv-facit    skriv facit (kun på kode, der er kendt god)
//   --kun=<tekst>   kun klip, hvis navn indeholder teksten (ingen sammenligning af manglende klip)
//   --ud=<json>     gem målingerne
// Alt er deterministisk: ingen tilfældige tal, alle mønstre er hash-funktioner af position, og kamerabevægelsen
// er faste sinuskurver. Klippene tegnes i en temp-mappe, som slettes bagefter.
// Kræver Edge (channel msedge) og playwright fra codex-runtime, som verify-videocoach-saet-bane.mjs.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { muxMp4 } from './videocoach-saet-klip.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const FACIT = join(root, 'docs', 'videocoach', 'regression-facit.json')
const args = process.argv.slice(2)
const arg = (n, d = '') => (args.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=')
const SKRIV = args.includes('--skriv-facit')
const KUN = arg('kun')
const UD = arg('ud')

const W = 720, H = 1280
const LIFT = {
  squat: { top: 420, bund: 760, r: 90 },
  baenk: { top: 480, bund: 780, r: 80 },
  doed: { top: 440, bund: 800, r: 85 },
}
const OPTUR = [0.90, 0.97, 1.05, 1.15, 1.28]
const OPTUR_HURTIG = [0.62, 0.68, 0.74, 0.80, 0.88]

// Klipsættet. kamera: stativ | haand | haand-grov | ryst. size: 'vokser' | 'skrumper'. dreje: skivens drejehastighed (rad/s).
// roll: kameraets rul i grader. daek: { t: sekunder fra klippets start (midt i tredje løfts optur), d: varighed }.
const k = (navn, lift, fps, ekstra = {}) => ({ navn, lift, fps, optur: OPTUR, kamera: 'stativ', dreje: 2.1, ...ekstra })
export const KLIP = [
  // glat sæt (stativ)
  k('doed-glat-30', 'doed', 30), k('doed-glat-60', 'doed', 60),
  k('baenk-glat-30', 'baenk', 30), k('baenk-glat-60', 'baenk', 60),
  k('squat-glat-30', 'squat', 30), k('squat-glat-60', 'squat', 60),
  k('squat-glat-hurtig-30', 'squat', 30, { optur: OPTUR_HURTIG }),
  // størrelsesskift (skiven kommer nærmere eller længere væk)
  k('squat-stoerrelse-vokser-30', 'squat', 30, { size: 'vokser' }),
  k('doed-stoerrelse-vokser-30', 'doed', 30, { size: 'vokser' }),
  k('baenk-stoerrelse-skrumper-60', 'baenk', 60, { size: 'skrumper' }),
  k('squat-stoerrelse-skrumper-30', 'squat', 30, { size: 'skrumper' }),
  // drejning (skiven drejer hurtigt; kameraet ruller)
  k('squat-dreje-hurtig-30', 'squat', 30, { dreje: 9 }),
  k('doed-dreje-hurtig-60', 'doed', 60, { dreje: 9 }),
  k('baenk-kameraroll-30', 'baenk', 30, { roll: 2.5 }),
  // dækning (en mønstret flade går forbi foran skiven)
  k('squat-daek-kort-30', 'squat', 30, { daek: { t: 9.0, d: 0.45 } }),
  k('baenk-daek-kort-60', 'baenk', 60, { daek: { t: 9.0, d: 0.45 } }),
  k('doed-daek-lang-30', 'doed', 30, { daek: { t: 8.6, d: 1.2 } }),
  k('squat-daek-haand-30', 'squat', 30, { kamera: 'haand', daek: { t: 9.0, d: 0.6 } }),
  // håndholdt (drift og rystelse, jf. 1932v og 1950v)
  k('baenk-haand-30', 'baenk', 30, { kamera: 'haand' }), k('baenk-haand-60', 'baenk', 60, { kamera: 'haand' }),
  k('doed-haand-30', 'doed', 30, { kamera: 'haand' }), k('doed-haand-60', 'doed', 60, { kamera: 'haand' }),
  k('squat-haand-30', 'squat', 30, { kamera: 'haand' }), k('squat-haand-60', 'squat', 60, { kamera: 'haand' }),
  k('squat-haand-grov-30', 'squat', 30, { kamera: 'haand-grov' }),
  k('squat-ryst-30', 'squat', 30, { kamera: 'ryst' }),
]

// Tidslinjen er ren funktion af klippets definition, så siden og noden regner det samme.
const glat = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c) }
export function tidslinje(c) {
  const L = LIFT[c.lift], led = []
  let T = 1
  for (const o of c.optur) { led.push({ a: T, b: T + 1.1, fra: L.top, til: L.bund }); T += 1.1 + 0.3; led.push({ a: T, b: T + o, fra: L.bund, til: L.top, op: true }); T += o + 0.9 }
  const slut = T + 1
  const vinduer = led.filter(s => s.op).map(s => ({ start: s.a, end: s.b }))
  return { led, slut, vinduer, start: 0.5 }
}

const SIDE_GEN = () => `<!doctype html><body><script>
const W=${W},H=${H},M=200;
const LIFT=${JSON.stringify(LIFT)};
const sm=x=>{const c=Math.max(0,Math.min(1,x));return c*c*(3-2*c)};
const hash=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s)};
const blod=(x,y,sc)=>{const xi=Math.floor(x/sc),yi=Math.floor(y/sc),fx=x/sc-xi,fy=y/sc-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v-.5};
const cv=new OffscreenCanvas(W,H),g=cv.getContext('2d',{willReadFrequently:true});
// væg og gulv med struktur i flere størrelser (kameraets bevægelse kan måles på den)
const bgC=new OffscreenCanvas(W+2*M,H+2*M),bgI=bgC.getContext('2d').createImageData(W+2*M,H+2*M);
for(let y=0;y<H+2*M;y++)for(let x=0;x<W+2*M;x++){const v=Math.max(0,Math.min(255,120+blod(x,y,32)*90+blod(x+500,y,12)*60+blod(x,y+500,5)*40));const o=(y*(W+2*M)+x)*4;bgI.data[o]=bgI.data[o+1]=bgI.data[o+2]=v;bgI.data[o+3]=255}
bgC.getContext('2d').putImageData(bgI,0,0);
// dækkeren: en mønstret flade
const OW=420,OH=1100,occ=new OffscreenCanvas(OW,OH),og=occ.getContext('2d');
og.fillStyle='rgb(58,58,66)';og.fillRect(0,0,OW,OH);
for(let i=0;i<700;i++){const v=40+Math.floor(hash(i,1.5)*150);og.fillStyle='rgb('+v+','+v+','+v+')';og.fillRect(hash(i,2.5)*(OW-20),hash(i,3.5)*(OH-20),10+hash(i,4.5)*40,10+hash(i,5.5)*40)}
const kamera=(t,m)=>{if(m==='stativ')return{x:0,y:0};const s=m==='haand-grov'?2:1;
  if(m==='ryst')return{x:5*Math.sin(t*3.7*6.2832)+2*Math.sin(t*6.3*6.2832),y:5*Math.sin(t*4.3*6.2832+1)+2*Math.sin(t*7.1*6.2832)};
  return{x:s*(25*Math.sin(t/7.3*6.2832+.4)+4*Math.sin(t*4.3*6.2832)),y:s*(40*Math.sin(t/6.1*6.2832+1.2)+18*Math.sin(t/2.6*6.2832+.5)+4*Math.sin(t*3.7*6.2832+2)+1.5*Math.sin(t*6.3*6.2832))}};
function tidslinje(c){const L=LIFT[c.lift],led=[];let T=1;for(const o of c.optur){led.push({a:T,b:T+1.1,fra:L.top,til:L.bund});T+=1.4;led.push({a:T,b:T+o,fra:L.bund,til:L.top});T+=o+.9}return{led,slut:T+1}}
function tegn(c,tl,t){
  const L=LIFT[c.lift];let y=L.top;for(const s of tl.led){if(t>=s.b)y=s.til;else if(t>=s.a){y=s.fra+(s.til-s.fra)*sm((t-s.a)/(s.b-s.a));break}else break}
  const cam=kamera(t,c.kamera),u=t/tl.slut;
  const R=L.r*(c.size==='vokser'?1+.3*sm(u):c.size==='skrumper'?1-.25*sm(u):1);
  g.save();g.setTransform(1,0,0,1,0,0);
  if(c.roll){g.translate(W/2,H/2);g.rotate(c.roll*Math.sin(t/3.1*6.2832)*Math.PI/180);g.translate(-W/2,-H/2)}
  g.drawImage(bgC,-M+cam.x,-M+cam.y);
  const cx=W/2+cam.x,cy=y+cam.y;
  // atletens krop: en bred firkant, der følger stangen lodret
  g.fillStyle='rgb(72,70,84)';g.fillRect(cx-150,cy-60,300,H);g.fillStyle='rgb(96,92,110)';g.fillRect(cx-150,cy-60,300,28);
  const ring=(r,col)=>{g.fillStyle=col;g.beginPath();g.arc(cx,cy,r,0,7);g.fill()};
  ring(R,'rgb(66,66,66)');ring(R-6,'rgb(42,42,42)');ring(R*.62,'rgb(155,155,155)');ring(R*.55,'rgb(42,42,42)');ring(11,'rgb(188,188,188)');
  const th=t*c.dreje;for(const ph of [0,Math.PI*.9]){const o=R*.13*(ph?2.3:1);g.fillStyle='rgb(205,205,205)';g.beginPath();g.arc(cx+Math.cos(th+ph)*o,cy+Math.sin(th+ph)*o,6.5,0,7);g.fill()}
  if(c.daek){const d=c.daek.d;const q=(t-c.daek.t)/d;if(q>=0&&q<=1){const ox=-OW+sm(q)*(W+OW);const oy=cy-OH/2;g.drawImage(occ,ox,oy)}}
  g.restore();
  return{x:cx,y:cy,r:R}
}
const b64=u=>{let s='';for(let q=0;q<u.length;q+=32768)s+=String.fromCharCode.apply(null,u.subarray(q,q+32768));return btoa(s)};
window.lav=async c=>{
  const tl=tidslinje(c),FPS=c.fps,n=Math.round(tl.slut*FPS);
  const cfg={codec:'avc1.64002A',width:W,height:H,bitrate:FPS===60?18e6:12e6,framerate:FPS,avc:{format:'avc'},latencyMode:'quality'};
  const sup=await VideoEncoder.isConfigSupported(cfg);if(!sup.supported)throw new Error('H.264-kodning understøttes ikke i denne browser');
  const chunks=[];let desc=null;
  const enc=new VideoEncoder({output:(ch,m)=>{const u=new Uint8Array(ch.byteLength);ch.copyTo(u);chunks.push({key:ch.type==='key',data:b64(u)});if(m&&m.decoderConfig&&m.decoderConfig.description)desc=b64(new Uint8Array(m.decoderConfig.description))},error:e=>{throw e}});
  enc.configure(cfg);
  let p0=null;
  for(let i=0;i<n;i++){const t=i/FPS,p=tegn(c,tl,t);if(i===Math.round(.5*FPS))p0=p;
    const vf=new VideoFrame(cv,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});enc.encode(vf,{keyFrame:i%30===0});vf.close();
    if(enc.encodeQueueSize>8)await new Promise(r=>setTimeout(r,0))}
  await enc.flush();
  return{desc,chunks,p0,n}
};
<\/script></body>`

const html = readFileSync(join(root, 'public', 'videocoach.html'), 'utf8')
function block(a, b) {
  const i = html.indexOf(a); if (i < 0) throw new Error(`mangler i videocoach.html: ${a.slice(0, 50)}`)
  const j = html.indexOf(b, i); if (j < 0) throw new Error(`mangler i videocoach.html: ${b.slice(0, 50)}`)
  return html.slice(i, j)
}
const freezeSrc = block('function freezeRawAcquisition(path, session) {', 'function createAnalysisSession() {')
const analyseSrc = block('function buildVisualBarPath(points, valid, times,', '// ORDRE 85 · slut: rep-detektion')
const trackerSrc = block('const PL_ANG = 24, PL_TAU = Math.PI * 2;', 'async function startBarTracking(p0) {')

// Samme sele som verify-videocoach-saet-bane.mjs (sporer, rep-tælling), men med den ægte analyse, så fart og
// kameraets fradrag er med.
const HARNESS = (clipB64) => `<!doctype html><html><body>
<video id="vid" muted playsinline preload="auto" src="data:video/mp4;base64,${clipB64}"></video>
<canvas id="visCanvas"></canvas>
<script>
window.__loaded = new Promise(r => { const v = document.getElementById('vid'); if (v.readyState >= 1) r(); else v.addEventListener('loadedmetadata', () => r(), { once: true }) });
let video = document.getElementById('vid'), canvas = document.getElementById('visCanvas');
let ocan = document.createElement('canvas'), octx = ocan.getContext('2d', { willReadFrequently: true });
let cmPerPx = 1;
window.__init = (w, h, plateR) => { canvas.width = w; canvas.height = h; ocan.width = w; ocan.height = h; cmPerPx = 45 / (2 * plateR) };
let strokes = [], colorInput = { value: '#e63946' };
let barBtn = { textContent: '', classList: { add(){}, remove(){} } }, playBtn = { textContent: '' };
function playLabel(){ return '' } function say(){}
let setAthleteState = null, awaitShClick = null, analyzing = false;
let SLIM = false, ATHLETE = false, COACHWEB = false, DESKTOP = true, HAS_RVFC = false;
let FRAME = 1 / 30, TRACKER_BENCHMARK = false, TRACKER_PROBE = false, VC_TRACKER_FAST = true;
let vcTiming = { trackingStartedAt: null };
let wizard = null, plateConfirm = null, awaitCalib = false, awaitBarClick = false, analysisSession = null, tracking = true, curUrl = 'x';
function idxAtTime(s, t) { const ts = s.times || []; let lo = 0, hi = ts.length - 1; if (!ts.length) return 0; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m } return lo }
function updateCleanReviewUI() {}
function seekTo(t) { return new Promise(res => { if (Math.abs(video.currentTime - t) < 1e-4) { res(); return } const f = () => { video.removeEventListener('seeked', f); res() }; video.addEventListener('seeked', f); video.currentTime = t }) }
<\/script>
<script>${freezeSrc}<\/script>
<script>${analyseSrc}<\/script>
<script>${trackerSrc}<\/script>
<script>
function analyzePath(path) { return analyzeCleanPath(path) }
window.koer = async (s, p0, lift) => {
  strokes.length = 0; tracking = true; await seekTo(s);
  const session = { schema: 1, lift, trackingStart: s, trackingEnd: video.duration };
  const ok = await startMultipointTracking({ x: p0.x, y: p0.y, r: p0.r }, session);
  const path = strokes.find(x => x.type === 'path');
  if (!path) return { ok, pts: 0 };
  if (!path.raw) freezeRawAcquisition(path, session);
  path.analysisSession = session;
  analyzeCleanPath(path);
  const reps = (path.reps || []).map(r => ({ mcv: r.mcv, camMoved: !!r.camMoved }));
  const a = path.analysis || {};
  return { ok, pts: path.pts.length, gyldige: path.valid.filter(Boolean).length, cam: path.raw.cam ? path.raw.cam.length : 0,
    camMaxPx: a.camMaxPx ?? null, reps, lastY: path.pts.at(-1).y };
};
<\/script></body></html>`

const runtime = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')
const { chromium } = createRequire(import.meta.url)(runtime)
const tmp = mkdtempSync(join(tmpdir(), 'video-regression-'))
const maalinger = {}
let browser
try {
  const sat = KLIP.filter(c => c.navn.includes(KUN))
  if (!sat.length) throw new Error(`ingen klip matcher --kun=${KUN}`)
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const gen = await browser.newPage({ viewport: { width: 400, height: 400 } })
  gen.on('pageerror', e => console.error('[gen pageerror]', e))
  await gen.route('http://localhost/**', r => r.fulfill({ contentType: 'text/html', body: SIDE_GEN() }))
  await gen.goto('http://localhost/')
  for (const c of sat) {
    const t0 = Date.now()
    const res = await gen.evaluate(cc => window.lav(cc), c)
    const sti = join(tmp, `${c.navn}.mp4`)
    writeFileSync(sti, muxMp4({ w: W, h: H, fps: c.fps, description: Buffer.from(res.desc, 'base64'), samples: res.chunks.map(x => ({ key: x.key, data: Buffer.from(x.data, 'base64') })) }))
    const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
    page.on('pageerror', e => console.error('[browser pageerror]', c.navn, e))
    await page.setContent(HARNESS(readFileSync(sti).toString('base64')), { waitUntil: 'load' })
    await page.evaluate(() => window.__loaded)
    const dims = await page.evaluate(() => ({ w: video.videoWidth, h: video.videoHeight }))
    await page.evaluate(([w, h, r]) => window.__init(w, h, r), [dims.w, dims.h, res.p0.r])
    const tl = tidslinje(c)
    const m = await page.evaluate(([s, p0, l]) => window.koer(s, p0, l), [tl.start, res.p0, c.lift])
    await page.close()
    maalinger[c.navn] = { forventedeReps: tl.vinduer.length, reps: m.reps.length, fart: m.reps.map(r => r.mcv), kameraFlyttet: m.reps.map(r => r.camMoved), punkter: m.pts, gyldige: m.gyldige, kameraMaalt: m.cam, camMaxPx: m.camMaxPx }
    console.log(`${c.navn}: ${m.reps.length}/${tl.vinduer.length} reps, fart ${m.reps.map(r => (+r.mcv).toFixed(3)).join(' ')} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  }
} finally {
  if (browser) await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}
if (UD) writeFileSync(UD, JSON.stringify(maalinger, null, 1) + '\n')

if (SKRIV) {
  if (KUN) { console.error('--skriv-facit kræver hele sættet (ingen --kun)'); process.exit(1) }
  writeFileSync(FACIT, JSON.stringify({ beskrivelse: 'Facit for npm run video:regression (ordre 2125). Lavet på live main d15f33d2; sporerens og kalibreringens kode uændret. Tal er sporerens egne, ikke den sande fart.', klip: maalinger }, null, 1) + '\n')
  console.log(`Facit skrevet: ${Object.keys(maalinger).length} klip i ${FACIT}`)
  process.exit(0)
}
if (!existsSync(FACIT)) { console.error(`Facit mangler: ${FACIT} (kør med --skriv-facit)`); process.exit(1) }
const facit = JSON.parse(readFileSync(FACIT, 'utf8')).klip
const fejl = []
for (const [navn, m] of Object.entries(maalinger)) {
  const f = facit[navn]
  if (!f) { fejl.push(`${navn}: ikke i facit`); continue }
  if (JSON.stringify(m) !== JSON.stringify(f)) {
    const dif = Object.keys(f).filter(n => JSON.stringify(m[n]) !== JSON.stringify(f[n]))
    fejl.push(`${navn}: afviger i ${dif.join(', ')} (facit reps ${f.reps}, fart ${f.fart.map(x => (+x).toFixed(3)).join(' ')}; nu reps ${m.reps}, fart ${m.fart.map(x => (+x).toFixed(3)).join(' ')})`)
  }
}
if (!KUN) for (const navn of Object.keys(facit)) if (!maalinger[navn]) fejl.push(`${navn}: i facit, men ikke målt`)
console.log(fejl.length ? `FEJL (${fejl.length}):\n${fejl.join('\n')}` : `GRØN: ${Object.keys(maalinger).length} klip, reptal og fart bit for bit som facit.`)
process.exit(fejl.length ? 1 : 0)
