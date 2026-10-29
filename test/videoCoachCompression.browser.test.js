import { test } from 'node:test'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import ffmpeg from 'ffmpeg-static'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

const dir = resolve('work/video-compression')
mkdirSync(dir, { recursive: true })
function run(args, encoding) {
  const result = spawnSync(ffmpeg, ['-hide_banner', ...args], {
    encoding, maxBuffer: 64 * 1024 * 1024,
  })
  assert.equal(result.status, 0, String(result.stderr))
  return result
}

test('syntetisk klip bliver mindre med højst 1080p, bevægelse og bevaret lyd', { timeout: 120_000 }, async () => {
  const sourcePath = resolve(dir, 'source.mp4')
  const outputPath = resolve(dir, 'compressed.webm')
  run(['-y', '-f', 'lavfi', '-i', 'testsrc2=size=2560x1440:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '6', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-b:v', '16M', '-minrate', '16M', '-maxrate', '16M', '-bufsize', '32M',
    '-x264-params', 'nal-hrd=cbr', '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart', sourcePath])
  const source = readFileSync(sourcePath)
  const helper = readFileSync(new URL('../public/videoCoachCompression.js', import.meta.url))
  const server = createServer((request, response) => {
    if (request.url === '/videoCoachCompression.js') {
      response.setHeader('Content-Type', 'text/javascript'); response.end(helper)
    } else if (request.url === '/source.mp4') {
      response.setHeader('Content-Type', 'video/mp4'); response.end(source)
    } else {
      response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>Videoprøve</title>')
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: [
      '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
    ] })
    const page = await browser.newPage()
    await page.goto('http://127.0.0.1:' + server.address().port)
    const measured = await page.evaluate(async () => {
      const { compressVideoForUpload } = await import('/videoCoachCompression.js')
      const original = new File([await (await fetch('/source.mp4')).blob()], 'syntetisk.mp4', { type: 'video/mp4' })
      const disabledUnchanged = await compressVideoForUpload(original) === original
      const progress = []
      const compressed = await compressVideoForUpload(original, {
        enabled: true, onProgress: value => progress.push(value),
      })
      const bytes = new Uint8Array(await compressed.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 16_384) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384))
      }
      return {
        before: original.size, after: compressed.size, mime: compressed.type,
        usedOriginal: compressed === original, disabledUnchanged, progress,
        base64: btoa(binary), browser: navigator.userAgent,
      }
    })
    assert.equal(measured.disabledUnchanged, true)
    assert.equal(measured.usedOriginal, false, 'Browseren skal faktisk komprimere klippet')
    assert.ok(measured.after < measured.before)
    assert.equal(measured.progress[0], 0)
    assert.equal(measured.progress.at(-1), 100)
    assert.ok(measured.progress.some(value => value > 0 && value < 100))
    writeFileSync(outputPath, Buffer.from(measured.base64, 'base64'))

    // Dekod lydprøverne. Et spor alene beviser ikke, at lyden er bevaret.
    const decoded = run(['-i', outputPath, '-vn', '-ac', '1', '-ar', '8000',
      '-f', 'f32le', 'pipe:1'])
    const samples = decoded.stdout
    let sumSquares = 0
    for (let offset = 0; offset < samples.length; offset += 4) sumSquares += samples.readFloatLE(offset) ** 2
    const audioRms = Math.sqrt(sumSquares / (samples.length / 4))
    const audioSeconds = samples.length / 4 / 8000
    assert.ok(audioRms > 0.02, 'Tonen skal stadig være hørbar')
    assert.ok(audioSeconds > 5.5 && audioSeconds < 7, 'Hele klippet skal være med')
    const dimensions = String(decoded.stderr).match(/Video:[^\n]*?(\d{2,5})x(\d{2,5})/)
    assert.ok(dimensions, 'FFmpeg skal kunne aflæse videoopløsningen')
    assert.deepEqual(dimensions.slice(1).map(Number), [1920, 1080])
    const frames = run(['-i', outputPath, '-an', '-vf', 'fps=2,scale=32:18',
      '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']).stdout
    const frameBytes = 32 * 18 * 3
    assert.ok(frames.length >= frameBytes * 10)
    let difference = 0
    for (let i = 0; i < frameBytes; i++) difference += Math.abs(frames[i] - frames[frames.length - frameBytes + i])
    assert.ok(difference / frameBytes > 1, 'Videoen skal indeholde bevægelse')
    const report = {
      source: '6 sekunder, 2560 x 1440, 30 billeder/s, H.264 ved 16 Mbit/s og en 440 Hz tone',
      beforeBytes: measured.before, afterBytes: measured.after,
      reductionPercent: Number(((1 - measured.after / measured.before) * 100).toFixed(1)),
      outputMime: measured.mime, width: 1920, height: 1080,
      targetVideoBitsPerSecond: 4_000_000,
      audioRms, audioSeconds, movementDifference: difference / frameBytes,
      browser: measured.browser,
    }
    writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    console.log('VIDEO_COMPRESSION_MEASUREMENT ' + JSON.stringify(report))
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
