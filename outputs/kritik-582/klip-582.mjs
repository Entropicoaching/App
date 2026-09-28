// Kritik 582, blok 2: mine SYNTETISKE klip til "Maal dit billede" efter Yantras 571. Ingen rigtige atleter,
// ingen rigtige klip. Billederne tegnes her i node (graatoner, som i kritik 564) og kodes med ffmpeg-static:
//   node outputs/kritik-582/klip-582.mjs            -> %TEMP%/kritik-582-klip/*.mp4|mov + klip.json
// Hvert billede har sit eget nummer i 12 blokke (bit 0 til venstre) oeverst, saa en maaling laeser praecis,
// hvilket billede siden viser eller sendte videre. Under blokkene en tidslinje og ordet SYNTETISK. En skive
// med nav gaar ned og op i mine fem squats fra 564 (REPS), tegnet til billedets EGEN tid.
//
//   sq2997.mp4     H.264 (High, B-billeder), 1080 x 1920, 30000/1001 billeder/s, 30 s, tidsskala 30000
//   sq2997.mov     samme spor i en QuickTime-beholder med tidsskala 600 (som en iPhone): tiderne afrundes
//                  til 1/600 s, saa mellemrummene bliver 33,3 og 35,0 ms i et fast moenster
//   sqvfr.mp4      H.264, variabel billedrate som en telefon (Yantras moenster): ca. 30/s med +-2 ms uro,
//                  hvert 9. billede tabt (66,7 ms) og billede 240-359 i 24/s (41,7 ms); tidsskala 90000
//   sqvfr.mov      samme spor, tidsskala 600
//   sq4k.mp4       H.264, 2160 x 3840, 29,97, 6 s, ca. 45 Mbit/s
//   sqhevc.mov     H.265/HEVC (hvc1, iPhones "Hoej effektivitet"), 1080 x 1920, 29,97, 6 s, tidsskala 600
// Tiderne i klip.json er laest tilbage fra filerne med ffmpeg (showinfo), ikke regnet: det er facit.
import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, existsSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'

export const KLIP = path.join(tmpdir(), 'kritik-582-klip')
export const BITS = 12
// Mine fem squats fra 564: start (s), ned (s), pause i bunden (s), op (s). sin ned, cos op: farten er 0 i bunden.
export const REPS = [
  { navn: 'jaevn', start: 2.0, ned: 1.2, pause: 0, op: 1.0 },
  { navn: 'hurtig op', start: 7.0, ned: 1.5, pause: 0, op: 0.8 },
  { navn: 'grind', start: 12.0, ned: 1.0, pause: 0, op: 2.2 },
  { navn: 'pause', start: 18.0, ned: 1.3, pause: 0.6, op: 1.0 },
  { navn: 'dyk', start: 24.0, ned: 0.8, pause: 0, op: 1.4 },
]
export const TOP = 500 / 1920, DYBDE = 800 / 1920 // andel af billedets hoejde
export const NAV_X = 540 / 1080
/** Navets hoejde som andel af billedets hoejde (y nedad) til tiden t. */
export function navY(t) {
  for (const r of REPS) {
    const a = t - r.start
    if (a < 0 || a > r.ned + r.pause + r.op) continue
    let f
    if (a <= r.ned) f = Math.sin((Math.PI / 2) * (a / r.ned))
    else if (a <= r.ned + r.pause) f = 1
    else f = Math.cos((Math.PI / 2) * ((a - r.ned - r.pause) / r.op))
    return TOP + DYBDE * f
  }
  return TOP
}
/** Andel af dybden over bunden (0 = bunden) til tiden t. */
export const hoejdeOver = (t) => (TOP + DYBDE - navY(t)) / DYBDE
/** Bunden af hver squat (s). */
export const bund = (r) => ({ fra: r.start + r.ned, til: r.start + r.ned + r.pause })

// Billedtider (us). Fast: k * 1e6 / fps. Variabel: Yantras moenster (scripts/syntetisk-klip.mjs), strakt til 30 s.
export const VFR_24 = [240, 360]
export function variableTider(T) {
  const t = [0]
  for (let k = 1; t[k - 1] < T * 1e6; k++) {
    let d = 33333 + ((k * 7919) % 5) * 1000 - 2000
    if (k % 9 === 0) d = 66667
    if (k >= VFR_24[0] && k < VFR_24[1]) d = 41667
    t.push(t[k - 1] + d)
  }
  return t
}
// Samme moenster som ffmpeg-udtryk; ld(0) huskes fra billede til billede (tjekket mod showinfo).
const VFR_SETPTS = `settb=1/1000000,setpts='if(eq(N,0),st(0,0),st(0,ld(0)+if(eq(mod(N,9),0),66667,if(between(N,${VFR_24[0]},${VFR_24[1] - 1}),41667,33333+mod(N*7919,5)*1000-2000))))'`

function billede(buf, W, H, n, t, T) {
  const s = W / 1080
  buf.fill(70)
  const rect = (x0, y0, x1, y1, v) => {
    x0 = Math.max(0, Math.round(x0)); x1 = Math.min(W, Math.round(x1)); y0 = Math.max(0, Math.round(y0)); y1 = Math.min(H, Math.round(y1))
    for (let y = y0; y < y1; y++) buf.fill(v, y * W + x0, y * W + x1)
  }
  const cirkel = (cx, cy, r, v) => {
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) {
      const d = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2))
      buf.fill(v, y * W + Math.max(0, Math.round(cx - d)), y * W + Math.min(W, Math.round(cx + d)))
    }
  }
  rect(0, 1700 * s, W, H, 45) // gulvet
  for (let i = 0; i < BITS; i++) rect((12 + i * 88) * s, 20 * s, (92 + i * 88) * s, 100 * s, (n >> i) & 1 ? 235 : 15)
  rect(0, 120 * s, W, 150 * s, 15); rect(0, 120 * s, Math.min(W, (W * t) / T), 150 * s, 235)
  const y = navY(t) * H, x = NAV_X * W
  rect(x + 60 * s, y + 40 * s, x + 130 * s, 1700 * s, 150) // en grov streg-loefter
  rect(x - 40 * s, y - 20 * s, x + 200 * s, y + 20 * s, 150)
  cirkel(x, y, 150 * s, 25) // skiven
  cirkel(x, y, 22 * s, 215) // navet
  const off = (n * 7919) % 65536 // korn som i en telefonvideo (+-8 graatrin, nyt hvert billede)
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] + KORN[i + off] - 8
}
let KORN = null
function korn(len) {
  if (KORN && KORN.length >= len + 65536) return
  KORN = Buffer.alloc(len + 65536)
  let z = 582
  for (let i = 0; i < KORN.length; i++) { z = (z * 1103515245 + 12345) >>> 0; KORN[i] = (z >>> 16) % 17 }
}

async function kod(fil, { W = 1080, H = 1920, tider, vfr = false, args }) {
  const ud = path.join(KLIP, fil)
  if (existsSync(ud)) return ud
  const T = tider[tider.length - 1] / 1e6
  const vf = [`drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SYNTETISK':x=${40 * (W / 1080)}:y=${170 * (W / 1080)}:fontsize=${72 * (W / 1080)}:fontcolor=white`]
  if (vfr) vf.push(VFR_SETPTS)
  const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-r', '30000/1001', '-i', '-',
    '-vf', vf.join(','), ...(vfr ? ['-fps_mode', 'passthrough', '-enc_time_base', '1/90000'] : []), ...args, ud], { stdio: ['pipe', 'inherit', 'inherit'] })
  const buf = Buffer.alloc(W * H)
  korn(W * H)
  for (let n = 0; n < tider.length; n++) {
    billede(buf, W, H, n, tider[n] / 1e6, T)
    if (!p.stdin.write(buf)) await new Promise((ok) => p.stdin.once('drain', ok))
  }
  p.stdin.end()
  await new Promise((ok, fejl) => p.on('close', (c) => (c ? fejl(new Error(`ffmpeg ${fil}: ${c}`)) : ok())))
  return ud
}
function omPak(fra, fil, skala) {
  const ud = path.join(KLIP, fil)
  if (!existsSync(ud)) execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', fra, '-c', 'copy', '-video_track_timescale', String(skala), '-f', 'mov', ud])
  return ud
}
/** Billedernes tider (us) i filen, i visningsraekkefoelge, laest med showinfo (facit). */
function laesTider(f) {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', f, '-map', '0:v:0', '-vf', 'showinfo', '-f', 'null', '-'], { maxBuffer: 1 << 28 })
  const s = r.stderr.toString()
  // pts i filterets tidsbase (pts_time har kun 6 cifre): "config in time_base: 1/30000" og "pts:   1001"
  const [, tn, td] = s.match(/config in time_base: (\d+)\/(\d+)/)
  const tider = [...s.matchAll(/ pts:\s*(\d+)/g)].map((m) => Math.round((Number(m[1]) * Number(tn) * 1e6) / Number(td)))
  const info = s.match(/Stream #0:0[^\n]*Video: ([^\n]+)/)?.[1] ?? ''
  return { tider, info: info.slice(0, 160) }
}

export async function lavKlip() {
  mkdirSync(KLIP, { recursive: true })
  const h264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-b:v', '16M', '-maxrate', '18M', '-bufsize', '32M', '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  const h264k = h264.map((a) => (a === '16M' ? '45M' : a === '18M' ? '50M' : a === '32M' ? '90M' : a))
  const fast = (T) => Array.from({ length: Math.round(T * 30000 / 1001) }, (_, k) => Math.round((k * 1001e6) / 30000))
  const ud = {}
  ud['sq2997.mp4'] = await kod('sq2997.mp4', { tider: fast(30), args: [...h264, '-video_track_timescale', '30000'] })
  ud['sq2997.mov'] = omPak(ud['sq2997.mp4'], 'sq2997.mov', 600)
  ud['sqvfr.mp4'] = await kod('sqvfr.mp4', { tider: variableTider(30), vfr: true, args: [...h264, '-video_track_timescale', '90000'] })
  ud['sqvfr.mov'] = omPak(ud['sqvfr.mp4'], 'sqvfr.mov', 600)
  ud['sq4k.mp4'] = await kod('sq4k.mp4', { W: 2160, H: 3840, tider: fast(6), args: [...h264k, '-video_track_timescale', '30000'] })
  ud['sqhevc.mov'] = await kod('sqhevc.mov', { tider: fast(6), args: ['-c:v', 'libx265', '-preset', 'veryfast', '-b:v', '8M', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-x265-params', 'log-level=error', '-video_track_timescale', '600', '-f', 'mov'] })
  const jf = path.join(KLIP, 'klip.json')
  const gammel = existsSync(jf) ? JSON.parse(readFileSync(jf, 'utf8')) : {}
  const info = {}
  for (const [k, f] of Object.entries(ud)) {
    const st = statSync(f)
    if (gammel[k] && gammel[k].bytes === st.size) { info[k] = gammel[k]; continue }
    const { tider, info: codec } = laesTider(f)
    info[k] = { bytes: st.size, mb: +(st.size / 1e6).toFixed(1), billeder: tider.length, codec, tider }
  }
  writeFileSync(jf, JSON.stringify(info))
  return { filer: ud, info }
}
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const t0 = Date.now()
  const { info } = await lavKlip()
  for (const [k, v] of Object.entries(info)) {
    const g = v.tider.slice(1).map((x, i) => x - v.tider[i])
    console.log(k, v.mb, 'MB', v.billeder, 'billeder', 'mellemrum', Math.min(...g), '-', Math.max(...g), 'us |', v.codec)
  }
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)} s`)
}
