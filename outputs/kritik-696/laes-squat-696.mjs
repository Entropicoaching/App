// Udtraek af artiklens tekst og taelling af Marcs skriveregler (kun laes). Brug: node laes-squat-696.mjs <LAES-SQUAT.html>
import fs from 'node:fs';
const h = fs.readFileSync(process.argv[2], 'utf8');
const t = h.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<img[^>]*>/g, '[IMG]').replace(/<\/(p|h2|h3|li|div|figcaption)>/g, '\n').replace(/<[^>]+>/g, '');
fs.writeFileSync(new URL('.tekst-lokal.txt', import.meta.url), t);
const styleFree = h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
console.log('tekst tegn', t.length);
console.log('em-dash i brodtekst', (styleFree.match(/—|&mdash;|&#8212;/g) || []).length, '| i alt inkl. css', (h.match(/—|&mdash;|&#8212;/g) || []).length);
console.log('en-dash i brodtekst', (styleFree.match(/–|&ndash;/g) || []).length);
console.log('figurer', (h.match(/<figure/g) || []).length, 'billeder', (h.match(/<img/g) || []).length);
for (const k of ['Glassbrook', 'Indtil mit eget klip', 'De fire næste', 'Der er to billeder', 'Gå dybere'])
  console.log(k, (t.match(new RegExp(k, 'g')) || []).length);
