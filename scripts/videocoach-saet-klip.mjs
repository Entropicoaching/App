// ORDRE 1180: opdigtet prøveklip uden ffmpeg. En skive (samme tegning som
// scripts/make-test-clip.mjs) bevæger sig ned og op 5 gange i en kendt bane på
// grå støjbaggrund, 1080x1920, 30 fps, ca. 25 s. Klippet optages i Edge
// (MediaRecorder), så der kræves hverken ffmpeg eller ffmpeg-static. Den sande
// bane gemmes pr. billede (tid i sekunder fra første billede, x, y i pixel).
// Ingen atletdata: skiven er tegnet, ikke filmet.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const W = 1080, H = 1920, FPS = 30
export const N_REPS = 5
export const PLATE_R = 160
export const TOP_Y = 640, BOTTOM_Y = 1300
export const STANDARD = { navn: 'saet-5-reps', leadIn: 3.0, leadOut: 3.0, repDur: 2.6, holdDur: 1.2 }
// Navngivne klip prøven bruger. kort-ind-ud: optagelsen starter/slutter tæt på sættet.
export const PRESETS = {
  'saet-5-reps': {},
  'kort-ind-ud': { navn: 'kort-ind-ud', leadIn: 0.5, leadOut: 0.4 },
  // ORDRE 1192: hurtige reps, 1,6 s pr. rep med kort pause (trackeren hang efter ved vending)
  'hurtig-reps': { navn: 'hurtig-reps', leadIn: 0.4, leadOut: 0.3, repDur: 1.6, holdDur: 0.5 },
}
const smooth = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c) }
export function tidslinje(cfg = {}) {
  const c = { ...STANDARD, ...cfg }
  const cycle = c.repDur + c.holdDur
  const phase = N_REPS * c.repDur + (N_REPS - 1) * c.holdDur
  const duration = c.leadIn + phase + c.leadOut
  // Sandheden: skivens centrum. Glat vending i begge ender af hver rep.
  const truePos = t => {
    const tp = t - c.leadIn
    let y = TOP_Y
    if (tp >= 0 && tp <= phase) {
      const k = Math.min(N_REPS - 1, Math.floor(tp / cycle))
      const lt = tp - k * cycle
      if (lt <= c.repDur) { const d = lt < c.repDur / 2 ? lt / (c.repDur / 2) : (c.repDur - lt) / (c.repDur / 2); y = TOP_Y + (BOTTOM_Y - TOP_Y) * smooth(d) }
    }
    return { x: W / 2, y }
  }
  const repWindows = Array.from({ length: N_REPS }, (_, i) => ({ start: c.leadIn + i * cycle, end: c.leadIn + i * cycle + c.repDur }))
  return { ...c, cycle, phase, duration, truePos, repWindows }
}

const pageFor = tl => `<!doctype html><body><script>
const W=${W},H=${H},FPS=${FPS},R=${PLATE_R};
const cv=new OffscreenCanvas(W,H),g=cv.getContext('2d',{willReadFrequently:true});
const bg=g.createImageData(W,H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const s=Math.sin(x*12.9898+y*78.233)*43758.5453;const n=(s-Math.floor(s))*20-10;const v=Math.max(0,Math.min(255,118+n+(x/W)*18));const o=(y*W+x)*4;bg.data[o]=bg.data[o+1]=bg.data[o+2]=v;bg.data[o+3]=255}
function disc(cx,cy,t){
  const ring=(r,c)=>{g.fillStyle=c;g.beginPath();g.arc(cx,cy,r,0,7);g.fill()}
  ring(R,'rgb(66,66,66)');ring(R-9,'rgb(42,42,42)');ring(R*0.62,'rgb(155,155,155)');ring(R*0.55,'rgb(42,42,42)');ring(16,'rgb(188,188,188)')
  const th=t*2.1;for(const ph of [0,Math.PI*0.9]){const o=21*(ph?2.3:1);g.fillStyle='rgb(205,205,205)';g.beginPath();g.arc(cx+Math.cos(th+ph)*o,cy+Math.sin(th+ph)*o,9.5,0,7);g.fill()}
}
const sm=x=>{const c=Math.max(0,Math.min(1,x));return c*c*(3-2*c)};
window.__truth=t=>{const tp=t-${tl.leadIn};let y=${TOP_Y};if(tp>=0&&tp<=${tl.phase}){const k=Math.min(${N_REPS - 1},Math.floor(tp/${tl.cycle}));const lt=tp-k*${tl.cycle};if(lt<=${tl.repDur}){const d=lt<${tl.repDur}/2?lt/(${tl.repDur}/2):(${tl.repDur}-lt)/(${tl.repDur}/2);y=${TOP_Y}+(${BOTTOM_Y - TOP_Y})*sm(d)}}return {x:W/2,y}};
const b64=u=>{let s='';for(let k=0;k<u.length;k+=32768)s+=String.fromCharCode.apply(null,u.subarray(k,k+32768));return btoa(s)};
window.record=async(n)=>{
  const cfg={codec:'avc1.64002A',width:W,height:H,bitrate:8e6,framerate:FPS,avc:{format:'avc'},latencyMode:'quality'};
  const sup=await VideoEncoder.isConfigSupported(cfg);if(!sup.supported)throw new Error('H.264-kodning understøttes ikke i denne browser');
  const chunks=[];let desc=null;
  const enc=new VideoEncoder({output:(c,m)=>{const u=new Uint8Array(c.byteLength);c.copyTo(u);chunks.push({key:c.type==='key',data:b64(u)});if(m&&m.decoderConfig&&m.decoderConfig.description)desc=b64(new Uint8Array(m.decoderConfig.description))},error:e=>{throw e}});
  enc.configure(cfg);
  const frames=[];
  for(let i=0;i<n;i++){
    const t=i/FPS,p=window.__truth(t);g.putImageData(bg,0,0);disc(p.x,p.y,t);
    const vf=new VideoFrame(cv,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});
    enc.encode(vf,{keyFrame:i%30===0});vf.close();frames.push({i,t:+t.toFixed(5),x:p.x,y:p.y});
    if(enc.encodeQueueSize>8)await new Promise(r=>setTimeout(r,0));
  }
  await enc.flush();
  return {desc,chunks,frames};
};
</script></body>`

// Minimal MP4-muxer (en H.264-spor, konstant billedrate, ingen B-frames).
function box(type, ...parts) {
  const body = Buffer.concat(parts.map(p => (Buffer.isBuffer(p) ? p : Buffer.from(p))))
  const head = Buffer.alloc(8); head.writeUInt32BE(body.length + 8, 0); head.write(type, 4, 'latin1')
  return Buffer.concat([head, body])
}
const u32 = (...v) => { const b = Buffer.alloc(4 * v.length); v.forEach((x, i) => b.writeUInt32BE(x >>> 0, i * 4)); return b }
const u16 = v => { const b = Buffer.alloc(2); b.writeUInt16BE(v); return b }
export function muxMp4({ w, h, fps, description, samples }) {
  const ts = 30000, dur = ts / fps
  const total = samples.length * dur
  const matrix = u32(0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000)
  const ftyp = box('ftyp', 'isom', u32(512), 'isomiso2avc1mp41')
  const mdatBody = Buffer.concat(samples.map(s => s.data))
  const mdat = box('mdat', mdatBody)
  const offsets = []; let off = ftyp.length + 8
  for (const s of samples) { offsets.push(off); off += s.data.length }
  const avc1 = Buffer.concat([Buffer.alloc(6), u16(1), Buffer.alloc(16), u16(w), u16(h), u32(0x480000, 0x480000), u32(0), u16(1), Buffer.alloc(32), u16(0x18), u16(0xffff)])
  const stsd = box('stsd', u32(0, 1), box('avc1', avc1, box('avcC', description)))
  const stts = box('stts', u32(0, 1, samples.length, dur))
  const keys = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean)
  const stss = box('stss', u32(0, keys.length), ...keys.map(k => u32(k)))
  const stsc = box('stsc', u32(0, 1, 1, 1, 1))
  const stsz = box('stsz', u32(0, 0, samples.length), ...samples.map(s => u32(s.data.length)))
  const stco = box('stco', u32(0, offsets.length), ...offsets.map(o => u32(o)))
  const stbl = box('stbl', stsd, stts, stss, stsc, stsz, stco)
  const dinf = box('dinf', box('dref', u32(0, 1), box('url ', u32(1))))
  const minf = box('minf', box('vmhd', u32(1), Buffer.alloc(8)), dinf, stbl)
  const mdhd = box('mdhd', u32(0, 0, 0, ts, total, 0x55c40000))
  const hdlr = box('hdlr', u32(0, 0), 'vide', Buffer.alloc(12), 'VideoHandler\0')
  const mdia = box('mdia', mdhd, hdlr, minf)
  const tkhd = box('tkhd', u32(3, 0, 0, 1, 0), u32(total), Buffer.alloc(8), u16(0), u16(0), u16(0), u16(0), matrix, u32(w << 16, h << 16))
  const trak = box('trak', tkhd, mdia)
  const mvhd = box('mvhd', u32(0, 0, 0, ts, total, 0x10000), u16(0x100), Buffer.alloc(10), matrix, Buffer.alloc(24), u32(2))
  return Buffer.concat([ftyp, mdat, box('moov', mvhd, trak)])
}

export async function lavKlip(outDir, cfg = {}) {
  const tl = tidslinje(cfg)
  const runtime = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright')
  const { chromium } = createRequire(import.meta.url)(runtime)
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 400 } })
    // WebCodecs kraever en sikker kontekst; http://localhost tæller som en
    await page.route('http://localhost/**', r => r.fulfill({ contentType: 'text/html', body: pageFor(tl) }))
    await page.goto('http://localhost/')
    const nFrames = Math.round(tl.duration * FPS)
    const res = await page.evaluate(n => window.record(n), nFrames)
    const clipPath = join(outDir, `${tl.navn}.mp4`)
    writeFileSync(clipPath, muxMp4({ w: W, h: H, fps: FPS, description: Buffer.from(res.desc, 'base64'), samples: res.chunks.map(c => ({ key: c.key, data: Buffer.from(c.data, 'base64') })) }))
    const truthPath = join(outDir, `${tl.navn}.sand-bane.json`)
    writeFileSync(truthPath, JSON.stringify({ w: W, h: H, fps: FPS, reps: N_REPS, repWindows: tl.repWindows, frames: res.frames }))
    return { clipPath, truthPath, frames: res.frames.length }
  } finally { await browser.close() }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [out, json] = process.argv.slice(2)
  if (!out) { console.error('brug: node scripts/videocoach-saet-klip.mjs <mappe> [json med navn, leadIn, leadOut, repDur, holdDur]'); process.exit(1) }
  console.log(JSON.stringify(await lavKlip(out, json ? JSON.parse(json) : {})))
}
