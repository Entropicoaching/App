// Ordre 653: tjek rapporten og skaermbillederne.
import { readFileSync, existsSync } from 'node:fs';
const r = readFileSync('docs/kritik-653/RAPPORT-653.md', 'utf8');
const fejl = [];
const f1 = r.split(/\r?\n/)[0];
if (!/Figurerne ligner rigtige loeft: (ja|nej)/.test(f1)) fejl.push('dom 1 mangler i foerste linje');
if (!/Marcs tre punkter rettet: (ja|nej)/.test(f1)) fejl.push('dom 2 mangler i foerste linje');
const afsnit = [...r.matchAll(/^## (.+)$/gm)].map(m => m[1].trim());
if (JSON.stringify(afsnit) !== JSON.stringify(['Gren', 'Hvad ændret', 'Testresultat', 'Hvad er næste', 'Ærlige grænser'])) fejl.push('afsnit: ' + afsnit.join(', '));
for (const b of [390, 1280]) for (let i = 1; i <= 5; i++) if (!existsSync(`outputs/kritik-653/F653-${b}-par${i}.png`)) fejl.push(`mangler ${b}-par${i}`);
for (let i = 1; i <= 10; i++) if (!existsSync(`outputs/kritik-653/F653-stor-${String(i).padStart(2, '0')}.png`)) fejl.push(`mangler stor-${i}`);
const m = JSON.parse(readFileSync('outputs/kritik-653/maaling-653.json', 'utf8'));
for (const b of ['390', '1280']) {
  if (m[b].sidelaens !== 0 || m[b].fejl.length || m[b].net.length) fejl.push(`${b}: sidelaens/fejl/net`);
  if (m[b].figurer.filter(f => f.ok).length !== 10) fejl.push(`${b}: ikke 10 figurer`);
}
if (fejl.length) { console.error('verify-653 ROED:\n' + fejl.join('\n')); process.exit(1); }
console.log('verify-653 groen');
