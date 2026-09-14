// Minimal statisk fil-server (node:http, ingen ny afhængighed) — server
// scripts/pose-proeve/ selv (node_modules, models/, tmp/, harness.html) til
// Playwright-siden. Understøtter Range-requests, fordi <video>-elementet
// beder om dem selv ved normal afspilning af en lokal http-fil.
import { createServer } from 'node:http'
import { createReadStream, statSync, existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
}

export function startStaticServer(root, port = 0) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    const filePath = normalize(join(root, urlPath))
    if (!filePath.startsWith(normalize(root)) || !existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    const stat = statSync(filePath)
    const type = CONTENT_TYPES[extname(filePath)] || 'application/octet-stream'
    const range = req.headers.range
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
      const start = parseInt(startStr, 10)
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': type,
      })
      createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': type, 'Accept-Ranges': 'bytes' })
      createReadStream(filePath).pipe(res)
    }
  })
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port
      resolve({ server, port: actualPort, url: `http://127.0.0.1:${actualPort}` })
    })
  })
}
