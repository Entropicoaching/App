// ORDRE 1537b · videolageret ende til ende mod lokal R2 i `wrangler dev` (ingen Cloudflare-konto, ingen nøgler):
// opdigtet Supabase på 8997, Workeren på 8796, upload af tilfældige bytes, hentning hel og i udsnit.
// Kørsel: node scripts/verify-videolager-lokal.mjs   (WRANGLER_JS peger på wrangler.js, hvis den ikke ligger i node_modules)
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const wranglerJs = [process.env.WRANGLER_JS, join(root, 'node_modules/wrangler/bin/wrangler.js'),
  'C:/Users/nugga/Hara/repos/hara-hovedtrae/node_modules/wrangler/bin/wrangler.js'].find(p => p && existsSync(p))
if (!wranglerJs) { console.log('SPRUNGET OVER: wrangler findes ikke (sæt WRANGLER_JS)'); process.exit(0) }

const ATHLETE = '11111111-1111-4111-8111-111111111111', ANALYSIS = '33333333-3333-4333-8333-333333333333'
const TOKEN = 'token-for-opdigtet-atlet-1234567890', WORKER = 'http://127.0.0.1:8796'
const supabase = createServer((req, res) => {
  const path = req.url.split('?')[0]
  const ok = req.headers.authorization === `Bearer ${TOKEN}`
  const data = !ok ? null : path === '/auth/v1/user' ? { id: '22222222-2222-4222-8222-222222222222' }
    : path === '/rest/v1/athletes' ? [{ id: ATHLETE }] : path === '/rest/v1/video_analyses' ? [{ id: 'r1' }] : null
  res.statusCode = data ? 200 : 401; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(data || {}))
})
await new Promise(r => supabase.listen(8997, '127.0.0.1', r))
const state = mkdtempSync(join(tmpdir(), 'videolager-'))
const wrangler = spawn(process.execPath, [wranglerJs, 'dev', '-c', join(root, 'workers/videolager/wrangler.jsonc'),
  '--port', '8796', '--ip', '127.0.0.1', '--persist-to', state, '--show-interactive-dev-session=false'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } })
let log = ''; wrangler.stdout.on('data', d => { log += d }); wrangler.stderr.on('data', d => { log += d })
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const post = (path, body) => fetch(WORKER + path, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body) }).then(r => r.json())
let failed = null
try {
  let up = false
  for (let i = 0; i < 120 && !up; i++) { up = await fetch(WORKER + '/sundhed', { signal: AbortSignal.timeout(2000) }).then(r => r.ok, () => false); if (!up) await new Promise(r => setTimeout(r, 500)) }
  if (!up) throw new Error('wrangler dev svarede ikke:\n' + log.slice(-1500))
  const bytes = randomBytes(12 * 1024 * 1024)
  const t0 = Date.now()
  const issued = await post('/upload-url', { client_analysis_id: ANALYSIS, mime_type: 'video/mp4', size: bytes.length })
  if (issued.mode !== 'worker' || !issued.url) throw new Error('upload-url: ' + JSON.stringify(issued))
  const put = await fetch(issued.url, { method: 'PUT', headers: issued.headers, body: bytes })
  if (put.status !== 200) throw new Error('PUT ' + put.status + ' ' + await put.text())
  const uploadMs = Date.now() - t0
  const again = await post('/upload-url', { client_analysis_id: ANALYSIS, mime_type: 'video/mp4', size: bytes.length })
  if (!again.exists) throw new Error('samme klip kunne uploades to gange')
  const download = await post('/download-url', { video_path: issued.key })
  const full = await fetch(download.url)
  const got = Buffer.from(await full.arrayBuffer())
  if (full.status !== 200 || sha(got) !== sha(bytes)) throw new Error('hentet klip er ikke det samme som det sendte')
  const part = await fetch(download.url, { headers: { range: 'bytes=1000-1999' } })
  const partBytes = Buffer.from(await part.arrayBuffer())
  if (part.status !== 206 || !partBytes.equals(bytes.subarray(1000, 2000))) throw new Error('udsnit (Range) passer ikke: ' + part.status)
  const noLogin = await fetch(WORKER + '/download-url', { method: 'POST', headers: { authorization: 'Bearer forkert-token-som-er-lang-nok' }, body: JSON.stringify({ video_path: issued.key }) })
  if (noLogin.status !== 401) throw new Error('forkert token gav ' + noLogin.status)
  console.log(`GRØN: 12 MB op og ned gennem lokal R2 (upload ${uploadMs} ms), udsnit 206, dobbelt upload afvist, forkert token 401`)
} catch (e) { failed = e } finally {
  // luk kun egne processer, efter PID
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(wrangler.pid), '/T', '/F'], { stdio: 'ignore' })
  else wrangler.kill('SIGKILL')
  supabase.close()
  await new Promise(r => setTimeout(r, 800))
  for (const dir of [state, join(root, 'workers/videolager/.wrangler')]) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* workerd kan holde filerne et øjeblik */ }
  }
}
if (failed) { console.log('FEJL: ' + failed.message); process.exit(1) }
