// ORDRE 399: forstyrrer melkornene "Rigtigt!"-teksten? Headless maaling paa en
// git-archive-kopi af matematik/main (spil.html), flygtig profil, figuren "Ravn"
// (ingen elevdata). Moellens forloeb 1 svares rigtigt tre gange paa 390x844
// (touch) og een gang paa 1280x800. Hver 25. ms i 0,9 s maales kornenes kasser
// mod tekstens egen glyf-kasse (Range, ikke hele beskedfeltet).
// Brug: node outputs/kritik-399/korn-maaling.mjs <kopi-rod> <playwright-index.mjs>
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [rod, pw] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(pw).href);
const ud = path.resolve("outputs/kritik-399/korn");
mkdirSync(ud, { recursive: true });
const URL_SPIL = pathToFileURL(path.join(rod, "spil.html")).href;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const vaerdi = (t) => { const m = /^(\d+)\/(\d+)$/.exec(t.trim()); return m ? +m[1] / +m[2] : null; };
function rigtigtValg(tekst, valg) {
  const m = /delt (?:sin mark )?i (\d+) lige store (?:felter|stykker), og (\d+) er/.exec(tekst);
  if (!m) return null;
  return valg.find((v) => Math.abs(vaerdi(v) - +m[2] / +m[1]) < 1e-9) ?? null;
}

const resultater = [];
const browser = await chromium.launch({ headless: true });
for (const vp of [{ navn: "mobil", width: 390, height: 844, touch: true, antal: 3 }, { navn: "desktop", width: 1280, height: 800, touch: false, antal: 1 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(URL_SPIL);
  await page.fill("#op-navn", "Ravn");
  await page.click("#op-start");
  await page.waitForSelector(".quest-opgave");
  for (let n = 1; n <= vp.antal; n++) {
    const tekst = await page.locator(".quest-opgave-tekst").textContent();
    const valg = (await page.locator(".quest-svar button").allTextContents()).map((t) => t.trim());
    const rigtig = rigtigtValg(tekst, valg);
    if (!rigtig) { resultater.push({ vp: vp.navn, n, fejl: `intet rigtigt svar fundet: ${tekst}` }); break; }
    const knap = page.locator(".quest-svar button").filter({ hasText: rigtig }).first();
    await knap.scrollIntoViewIfNeeded();
    // Maalingen startes i siden foer trykket, saa den ikke venter paa playwright.
    await page.evaluate(() => {
      window.__korn = [];
      const t0 = performance.now();
      const tag = () => {
        const besked = document.querySelector(".quest-besked--korrekt");
        let glyf = null;
        if (besked) {
          const r = document.createRange();
          r.selectNodeContents(besked);
          const rects = [...r.getClientRects()].filter((q) => q.width > 0);
          if (rects.length) glyf = rects.reduce((a, q) => ({ left: Math.min(a.left, q.left), top: Math.min(a.top, q.top), right: Math.max(a.right, q.right), bottom: Math.max(a.bottom, q.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
        }
        const korn = [...document.querySelectorAll(".melkorn")].map((k) => { const q = k.getBoundingClientRect(); return { left: q.left, top: q.top, right: q.right, bottom: q.bottom, op: Number(getComputedStyle(k).opacity) }; });
        window.__korn.push({ t: Math.round(performance.now() - t0), glyf, beskedTekst: besked?.textContent.trim().slice(0, 60) ?? null, korn });
        if (performance.now() - t0 < 950) setTimeout(tag, 25);
      };
      setTimeout(tag, 0);
    });
    if (vp.touch) await knap.tap(); else await knap.click();
    for (const ms of [80, 250, 450]) {
      await page.waitForTimeout(ms === 80 ? 80 : ms === 250 ? 170 : 200);
      await page.screenshot({ path: path.join(ud, `${vp.navn}-svar${n}-${ms}ms.png`), clip: await page.evaluate(() => { const b = document.querySelector(".quest-besked--korrekt")?.getBoundingClientRect(); return b ? { x: 0, y: Math.max(0, b.top - 90), width: innerWidth, height: 200 } : { x: 0, y: 0, width: innerWidth, height: 300 }; }) });
    }
    await page.waitForTimeout(600);
    const proever = await page.evaluate(() => window.__korn);
    const med = proever.filter((p) => p.glyf && p.korn.length);
    const over = med.filter((p) => p.korn.some((k) => k.op > 0.05 && k.right > p.glyf.left && k.left < p.glyf.right && k.bottom > p.glyf.top && k.top < p.glyf.bottom));
    const maxOver = Math.max(0, ...med.map((p) => p.korn.filter((k) => k.op > 0.05 && k.right > p.glyf.left && k.left < p.glyf.right && k.bottom > p.glyf.top && k.top < p.glyf.bottom).length));
    const g = med[0]?.glyf;
    resultater.push({
      vp: vp.navn, n, opgave: tekst.slice(0, 80), svar: rigtig,
      besked: med[0]?.beskedTekst ?? null,
      glyfKasse: g ? { bredde: Math.round(g.right - g.left), hoejde: Math.round(g.bottom - g.top) } : null,
      proever: med.length,
      kornSynligt_ms: med.length ? `${med[0].t}-${med.at(-1).t}` : null,
      proeverMedKornPaaTeksten: over.length,
      tidMedKornPaaTeksten_ms: over.length ? over.at(-1).t - over[0].t + 25 : 0,
      forsteOgSidste_ms: over.length ? [over[0].t, over.at(-1).t] : null,
      flestKornPaaTekstenSamtidig: maxOver,
    });
    await page.locator("#quest-videre").click();
    await page.waitForTimeout(150);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(ud, "maaling.json"), JSON.stringify(resultater, null, 2));
console.log(JSON.stringify(resultater, null, 2));
