import fs from 'fs';
let t=fs.readFileSync('C:/Users/Entropi/Desktop/Til Marc/LAES-SQUAT.html','utf8');
t=t.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<script[\s\S]*?<\/script>/g,'');
t=t.replace(/<img[^>]*?alt="([^"]*)"[^>]*>/g,(m,a)=>`[FIG: ${a}]`).replace(/<img[^>]*>/g,'[FIG]');
t=t.replace(/<\/(p|h1|h2|h3|h4|li|figcaption|div|tr|section)>/g,'\n').replace(/<br\s*\/?>/g,'\n').replace(/<[^>]+>/g,'');
t=t.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n\s*\n+/g,'\n');
fs.writeFileSync('outputs/kritik-709/tekst.txt',t);
console.log(t.length);
