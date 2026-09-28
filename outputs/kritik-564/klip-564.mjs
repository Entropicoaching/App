// Kritik 564, blok 1: mine SYNTETISKE klip til "Maal dit billede" fra en video. Ingen rigtige atleter,
// ingen rigtige klip. Billederne tegnes her i node (graatoner) og kodes med ffmpeg-static:
//   node outputs/kritik-564/klip-564.mjs            -> %TEMP%/kritik-564-klip/*.mp4|mov|webm
// Hvert billede har sit eget nummer skrevet i 11 blokke (bit 0 til venstre) oeverst, saa en maaling kan
// laese praecis hvilket billede siden viser eller sendte videre, uafhaengigt af maskinens hastighed.
// Under blokkene en tidslinje (bredden = tiden) og ordet SYNTETISK. En skive med nav gaar ned og op i
// fem squats med forskellig rytme (tabellen REPS); navets hoejde er kendt for hvert billede.
//
//   sq30.mp4   H.264, 1080 x 1920 (telefon paa hoejkant), 30 billeder/s, 30 s, ca. 16 Mbit/s (som en telefon-MP4)
//   sq30.mov   samme video i en QuickTime-beholder (iPhone-endelsen)
//   sq30.webm  VP9, samme billeder
//   sq30-60.mp4, sq30-25.mp4   60 og 25 billeder/s, 30 s
//   sq30-hevc.mp4              H.265/HEVC (iPhone "Hoej effektivitet"), 10 s
//   sq5-4k.mp4                 H.264, 2160 x 3840, 30 billeder/s, 5 s
import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'

export const KLIP = path.join(tmpdir(), 'kritik-564-klip')
export const BITS = 11
// Fem squats: start (s), ned (s), pause i bunden (s), op (s). Nedturen er sin(pi/2 u), opturen cos(pi/2 u):
// farten er 0 i bunden, og forskellen mellem ned og op naer bunden er kun forholdet mellem varighederne.
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
/** Bunden af hver squat (s): foerste og sidste billede med navet lavest. */
export const bund = (r) => ({ fra: r.start + r.ned, til: r.start + r.ned + r.pause })

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
  for (let i = 0; i < BITS; i++) rect((40 + i * 90) * s, 20 * s, (120 + i * 90) * s, 100 * s, (n >> i) & 1 ? 235 : 15)
  rect(0, 120 * s, W, 150 * s, 15); rect(0, 120 * s, (W * t) / T, 150 * s, 235)
  const y = navY(t) * H, x = NAV_X * W
  rect(x + 60 * s, y + 40 * s, x + 130 * s, 1700 * s, 150) // en grov streg-loefter
  rect(x - 40 * s, y - 20 * s, x + 200 * s, y + 20 * s, 150)
  cirkel(x, y, 150 * s, 25) // skiven
  cirkel(x, y, 22 * s, 215) // navet
  // Korn som i en telefonvideo (+-8 graatrin, nyt hvert billede), saa bitraten og afkodningen ligner et rigtigt klip.
  const off = (n * 7919) % 65536
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i] + KORN[i + off] - 8
}
let KORN = null
function korn(len) {
  if (KORN && KORN.length >= len + 65536) return
  KORN = Buffer.alloc(len + 65536)
  let z = 564
  for (let i = 0; i < KORN.length; i++) { z = (z * 1103515245 + 12345) >>> 0; KORN[i] = (z >>> 16) % 17 }
}

async function kod(fil, { W = 1080, H = 1920, fps = 30, T = 30, args }) {
  const ud = path.join(KLIP, fil)
  if (existsSync(ud)) return ud
  const p = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-r', String(fps), '-i', '-',
    '-vf', `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='SYNTETISK':x=${40 * (W / 1080)}:y=${170 * (W / 1080)}:fontsize=${72 * (W / 1080)}:fontcolor=white`,
    ...args, ud], { stdio: ['pipe', 'inherit', 'inherit'] })
  const buf = Buffer.alloc(W * H)
  korn(W * H)
  const N = Math.round(T * fps)
  for (let n = 0; n < N; n++) {
    billede(buf, W, H, n, n / fps, T)
    if (!p.stdin.write(buf)) await new Promise((ok) => p.stdin.once('drain', ok))
  }
  p.stdin.end()
  await new Promise((ok, fejl) => p.on('close', (c) => (c ? fejl(new Error(`ffmpeg ${fil}: ${c}`)) : ok())))
  return ud
}

export async function lavKlip() {
  mkdirSync(KLIP, { recursive: true })
  // Bitraten som en telefon i 1080p (ca. 16 Mbit/s); 4K ca. 45 Mbit/s.
  const h264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '16M', '-maxrate', '18M', '-bufsize', '32M', '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
  const h264k = h264.map((a) => (a === '16M' ? '45M' : a === '18M' ? '50M' : a === '32M' ? '90M' : a))
  const ud = {
    'sq30.mp4': await kod('sq30.mp4', { args: h264 }),
    'sq30.mov': await kod('sq30.mov', { args: [...h264.slice(0, -2), '-f', 'mov'] }),
    'sq30.webm': await kod('sq30.webm', { args: ['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-b:v', '16M', '-g', '30', '-pix_fmt', 'yuv420p'] }),
    'sq30-60.mp4': await kod('sq30-60.mp4', { fps: 60, args: h264 }),
    'sq30-25.mp4': await kod('sq30-25.mp4', { fps: 25, args: h264 }),
    'sq30-hevc.mp4': await kod('sq30-hevc.mp4', { T: 10, args: ['-c:v', 'libx265', '-preset', 'veryfast', '-b:v', '8M', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p', '-x265-params', 'log-level=error', '-movflags', '+faststart'] }),
    'sq5-4k.mp4': await kod('sq5-4k.mp4', { W: 2160, H: 3840, T: 5, args: h264k }),
  }
  const info = Object.fromEntries(Object.entries(ud).map(([k, f]) => [k, { mb: +(statSync(f).size / 1e6).toFixed(1) }]))
  writeFileSync(path.join(KLIP, 'klip.json'), JSON.stringify(info, null, 1))
  return { filer: ud, info }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const t0 = Date.now()
  const { info } = await lavKlip()
  console.log(info, `${((Date.now() - t0) / 1000).toFixed(0)} s`)
}
