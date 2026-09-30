import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  console.log('#####', f);
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!l.startsWith('{')) { if (l) console.log(l); continue; }
    const o = JSON.parse(l); let s = o.tag + ' ' + o.navn + ':';
    for (const k in o) { if (k === 'tag' || k === 'navn') continue; const v = o[k]; s += ' ' + k + '=' + (v && typeof v === 'object' ? (v.synlig ? v.t + '-' + v.b + (v.iVindue ? '' : '!ude') : 'skjult') : v); }
    console.log(s);
  }
}
