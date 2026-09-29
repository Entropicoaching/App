import fs from 'fs';
const t=fs.readFileSync('C:/Users/Entropi/Desktop/Til Marc/LAES-SQUAT.html','utf8');
const m=[...t.matchAll(/<img[^>]*>/g)];
console.log(m.length);
m.forEach((x,i)=>{const s=x[0];const src=(s.match(/src="([^"]{0,40})/)||[])[1];const len=s.length;console.log(i,len,src, (s.match(/alt="[^"]{0,80}/)||[''])[0]);});
