import fs from 'fs';
const S = process.argv[2];
const t = fs.readFileSync('C:/Users/Entropi/Desktop/Til Marc/LAES-SQUAT.html', 'utf8');
const re = /data:image\/(png|svg\+xml);base64,([A-Za-z0-9+\/=]+)/g;
let i = 0;
for (const m of t.matchAll(re)) {
  const ext = m[1] === 'png' ? 'png' : 'svg';
  fs.writeFileSync(`${S}/f${i}.${ext}`, Buffer.from(m[2], 'base64'));
  console.log(i, ext, m[2].length);
  i++;
}
