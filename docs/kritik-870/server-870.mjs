// Ordre 870: lille lokal server (kun 127.0.0.1) paa loeftmodellens uddrag.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const rod = process.env.LM; const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css' };
http.createServer((q, s) => { const p = path.join(rod, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': T[path.extname(p)] || 'application/octet-stream' }); s.end(d); } }); }).listen(8871, '127.0.0.1');





