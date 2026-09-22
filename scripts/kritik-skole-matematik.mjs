// ORDRE 322, Blok 2 — Bhishak som KRITIKER af matematik/spil.html (313), FØR
// Marc kigger. Retter intet, committer intet i matematik-repoet. Genbruger de
// interaktionsmønstre matematik-repoets EGEN røgtest
// (scripts/browser-check-verden.mjs) allerede har bevist virker, men som en
// UAFHÆNGIG kritik: hele landsbyen spilles igennem på 390x844 (jagter bl.a.
// en brøkopgave med et UFORKORTET rigtigt svar, "kan også skrives"-hintet),
// og et lettere visuelt gennemsyn køres på desktop.
//
// Brug: node scripts/kritik-skole-matematik.mjs
// Skærmbilleder: outputs/kritik-skole/matematik/
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const MAT_ROD = 'C:\\Users\\Entropi\\Desktop\\matematik';
const requireFraMat = createRequire(path.join(MAT_ROD, 'package.json'));
const { chromium } = requireFraMat('playwright');

const url = pathToFileURL(path.join(MAT_ROD, 'spil.html')).href;
const udMappe = path.join('C:\\Users\\Entropi\\Desktop\\entropi-app-wt2', 'outputs', 'kritik-skole', 'matematik');
mkdirSync(udMappe, { recursive: true });

const fund = [];
function noter(alvor, titel, note, fil) {
  fund.push({ alvor, titel, note, fil });
  console.log(`  [${alvor}] ${titel}${fil ? ` (${fil})` : ''} — ${note}`);
}

const STEDER = [['moellen', 'Møllen'], ['landsby', 'Kirken'], ['stenbrud', 'Grusgraven'], ['marked', 'Landsbygaden'], ['havn', 'Sporvognen']];
const NAVNE = STEDER.map(([, navn]) => navn);

function broekVaerdi(tekst) {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(tekst);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

async function lavFigur(page) {
  await page.waitForSelector('#op-navn');
  await page.fill('#op-navn', 'Ravn');
  await page.locator('.opret-udseende').nth(1).click();
  await page.click('#op-start');
  await page.waitForSelector('.spil-figur');
}

async function sikreKlyngeAaben(page) {
  const klynge = page.locator('.sted-knap--klynge');
  if ((await klynge.count()) > 0 && (await klynge.getAttribute('aria-expanded')) === 'false') {
    await klynge.click();
    await page.waitForTimeout(20);
  }
}

async function gaaTilSted(page, navn) {
  await sikreKlyngeAaben(page);
  await page.locator('.sted-knap').filter({ has: page.locator('.sted-navn', { hasText: new RegExp(`^${navn}$`) }) }).click();
  await page.waitForSelector('.sted-scene');
}

async function lukBanner(page) {
  if (await page.locator('.niveau-banner').isVisible().catch(() => false)) {
    await page.click('#niveau-banner-luk');
    await page.waitForTimeout(20);
  }
}

// Prøver svarmulighederne i rækkefølge til "Rigtigt!" vises. Rapporterer
// hvis et UFORKORTET brøksvar (fx 4/6 for 2/3) bliver godkendt med hintet
// "kan også skrives" (broek.js's vurderBroekSvar/ros).
async function loesEnOpgave(page, stat) {
  await page.waitForSelector('.quest-opgave');
  const valg = await page.$$eval('.quest-svar button', (bs) => bs.map((b) => b.textContent));
  const broeker = valg.map(broekVaerdi).filter(Boolean);
  for (let i = 0; i < broeker.length; i++) {
    for (let j = i + 1; j < broeker.length; j++) {
      if (broeker[i][0] * broeker[j][1] === broeker[j][0] * broeker[i][1]) stat.ensBroeker.push(valg.join(' | '));
    }
  }
  for (let i = 0; i < valg.length; i++) {
    if (await page.locator('#quest-videre').isVisible().catch(() => false)) break;
    await page.locator('.quest-svar button').nth(i).click();
    await page.waitForTimeout(15);
  }
  await page.waitForSelector('#quest-videre', { timeout: 5000 });
  const korrekt = (await page.locator('.quest-besked--korrekt').count()) > 0;
  const beskedTekst = korrekt ? await page.locator('.quest-besked--korrekt').innerText() : '';
  stat.opgaver += 1;
  if (korrekt) stat.korrekte += 1; else stat.andet += 1;
  if (/kan (også )?skrives/.test(beskedTekst)) {
    stat.uforkortetFundet += 1;
    if (stat.uforkortetSkaermbillede < 1) {
      stat.uforkortetSkaermbillede += 1;
      await page.screenshot({ path: path.join(udMappe, `broek-uforkortet-hint-${stat.opgaver}.jpg`), type: 'jpeg', quality: 85 });
    }
    console.log(`    Brøk-hint fanget: "${beskedTekst}"`);
  }
  await page.click('#quest-videre');
  await page.waitForTimeout(15);
  await lukBanner(page);
}

async function klarMindstTo(page, stat, maksOpgaver = 80) {
  let taeller = 0;
  for (let i = 0; i < maksOpgaver; i++) {
    if (!(await page.locator('.quest-opgave').isVisible().catch(() => false))) break;
    await loesEnOpgave(page, stat);
    taeller += 1;
  }
  return taeller;
}

async function maalKnap(page, sel) {
  return page.locator(sel).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { bredde: Math.round(r.width), hoejde: Math.round(r.height), radius: cs.borderRadius, skygge: cs.boxShadow, font: cs.fontFamily.split(',')[0] };
  }).catch(() => null);
}

async function tjekTapTargets(page, forklaring) {
  const boxes = await page.$$eval('.sted-knap', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { bredde: Math.round(r.width), hoejde: Math.round(r.height) }; }));
  const under44 = boxes.filter((b) => b.bredde < 44 || b.hoejde < 44);
  if (under44.length) noter('alvor-2', `Trykflader under 44px på kortet (${forklaring})`, JSON.stringify(under44), 'src/spil-app.js / src/spil.css');
  else console.log(`  Alle ${boxes.length} sted-knapper på kortet er mindst 44x44px (${forklaring}).`);
}

async function koerMobil(browser) {
  console.log('\n== MATEMATIK: 390x844, fuld landsby ==');
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const fejl = [];
  page.on('pageerror', (e) => fejl.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(m.text()); });
  const stat = { opgaver: 0, korrekte: 0, andet: 0, ensBroeker: [], uforkortetFundet: 0, uforkortetSkaermbillede: 0 };

  await page.goto(url);
  await lavFigur(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(udMappe, 'mobil-01-kort-start.jpg'), type: 'jpeg', quality: 85, fullPage: true });
  await tjekTapTargets(page, '390px, ved start');

  const kortSkilt = await page.locator('.kort-skilt').innerText().catch(() => null);
  console.log(`  Kort-skilt: "${kortSkilt}"`);

  for (const navn of NAVNE) {
    const status = await page.$$eval('.sted-knap:not(.sted-knap--klynge)', (els) => els.map((e) => ({ navn: e.querySelector('.sted-navn')?.textContent, aaben: !e.disabled })));
    const denneStatus = status.find((s) => s.navn === navn);
    if (!denneStatus?.aaben) { console.log(`  ${navn}: endnu ikke åbent (låst op senere) — springer over her.`); continue; }
    await gaaTilSted(page, navn);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(udMappe, `mobil-sted-${navn}.jpg`), type: 'jpeg', quality: 85, fullPage: true });
    const antal = await klarMindstTo(page, stat, 80);
    console.log(`  ${navn}: ${antal} opgaver løst.`);
    await sikreKlyngeAaben(page);
    await page.click('.sted-knap--tilbage, #sted-tilbage').catch(() => {});
    await page.waitForSelector('.kort').catch(() => {});
  }

  if (stat.ensBroeker.length) noter('alvor-1', 'To forkerte-men-lige-store brøksvar vist samtidig', stat.ensBroeker[0], 'src/spil-quest.js');
  if (stat.uforkortetFundet === 0) console.log('  Ingen uforkortet-korrekt brøksag ("kan også skrives") stødt på i denne kørsel — se "hvad jeg ikke kunne teste".');
  else console.log(`  Uforkortet-korrekt brøksag bekræftet ${stat.uforkortetFundet} gang(e) — se broek-uforkortet-hint-*.jpg.`);

  // ---- Udstyr og journal ----
  await page.click('#journal-knap').catch(async () => { await page.click('.journal-knap, [aria-label*="journal" i]').catch(() => {}); });
  await page.waitForSelector('.journal-liste').catch(() => {});
  await page.screenshot({ path: path.join(udMappe, 'mobil-journal.jpg'), type: 'jpeg', quality: 85, fullPage: true });
  const udstyrTekst = await page.locator('.udstyr-liste').innerText().catch(() => '');
  console.log(`  Udstyr i journalen: ${udstyrTekst.replace(/\n+/g, ' | ')}`);
  const journalKnapper = await page.$$eval('.udstyr-knap', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
  if (journalKnapper.some((m) => m < 44)) noter('alvor-2', 'Udstyrs-knap i journalen under 44px', JSON.stringify(journalKnapper), 'src/spil.css');

  if (fejl.length) noter('alvor-1', 'Konsol-/sidefejl under 390px-gennemløbet', fejl.join(' | '), '');
  else console.log('  Ingen konsol-/sidefejl gennem hele 390px-gennemløbet.');
  console.log(`  I alt ${stat.opgaver} opgaver løst (${stat.korrekte} korrekte, ${stat.andet} andet/facit-vist).`);

  await context.close();
  return stat;
}

async function koerDesktop(browser) {
  console.log('\n== MATEMATIK: desktop (1280x800), visuelt gennemsyn ==');
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const fejl = [];
  page.on('pageerror', (e) => fejl.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') fejl.push(m.text()); });
  await page.goto(url);
  await lavFigur(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(udMappe, 'desktop-01-kort-start.jpg'), type: 'jpeg', quality: 85 });
  const stedKnap = await maalKnap(page, '.sted-knap');
  if (stedKnap) console.log(`  sted-knap (desktop): ${stedKnap.bredde}x${stedKnap.hoejde}px, radius ${stedKnap.radius}, skygge ${stedKnap.skygge === 'none' ? 'ingen' : 'ja'}, font ${stedKnap.font}`);

  await gaaTilSted(page, 'Møllen');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(udMappe, 'desktop-02-moellen-scene.jpg'), type: 'jpeg', quality: 85 });
  const stat = { opgaver: 0, korrekte: 0, andet: 0, ensBroeker: [], uforkortetFundet: 0, uforkortetSkaermbillede: 0 };
  await klarMindstTo(page, stat, 2);
  console.log(`  Møllen (desktop): ${stat.opgaver} opgave(r) løst som visuel stikprøve.`);
  await page.screenshot({ path: path.join(udMappe, 'desktop-03-efter-opgave.jpg'), type: 'jpeg', quality: 85 });

  if (fejl.length) noter('alvor-1', 'Konsol-/sidefejl under desktop-gennemsynet', fejl.join(' | '), '');
  else console.log('  Ingen konsol-/sidefejl under desktop-gennemsynet.');
  await context.close();
}

async function main() {
  const browser = await chromium.launch();
  await koerMobil(browser);
  await koerDesktop(browser);
  await browser.close();
  writeFileSync(path.join(udMappe, 'fund.json'), JSON.stringify(fund, null, 2));
  console.log(`\nMatematik-kritik færdig. ${fund.length} fund logget (se outputs/kritik-skole/matematik/fund.json). Skærmbilleder i outputs/kritik-skole/matematik/.`);
}

await main();
