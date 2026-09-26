// ORDRE 399 blok 1: genererer opgaver med matematik-spillets egne generatorer
// (QUEST_BANK i src/spil-quest.js) fra en git-archive-kopi af matematik/main.
// Brug: node outputs/kritik-399/generer-opgaver.mjs <sti-til-kopi> > outputs/kritik-399/opgaver.txt
import { pathToFileURL } from "node:url";
import path from "node:path";

const rod = process.argv[2];
if (!rod) throw new Error("Angiv stien til kopien af matematik");
const q = await import(pathToFileURL(path.join(rod, "src/spil-quest.js")).href);

const MAAL = 36;
const SALTE = 1500;
const MIN = 30; // faerre unikke tekster end dette: fyldes op med gentagelser, der er markeret
const STEDNAVN = { moellen: "Moellen", stenbrud: "Grusgraven", marked: "Koebmanden", landsby: "Kirken (Degnen)", havn: "Sporvognen (Konduktoeren)" };
const kaeder = { ...q.QUEST_BANK, skjult: [q.SKJULT_QUEST] };
STEDNAVN.skjult = "Den gamle gang (Grusgraven, lygten)";


// --- Laererens og elevens dom (ORDRE 399) -----------------------------------
// Reglerne er skrevet EFTER at have laest opgaverne; hver regel er een ting,
// en laerer i 4.-6. klasse eller en elev ville studse over. Giver [[U, grund]].
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const broeker = (t) => [...t.matchAll(/(\d+)\/(\d+)/g)].map((m) => [+m[1], +m[2]]);
const rigtig = (o) => o.svarmuligheder.find((s) => s.korrekt)?.tekst ?? "";
function dom(sted, id, o, quest, unikke) {
  const t = o.tekst;
  const d = [];
  const hints = o.svarmuligheder.map((s) => s.hint ?? "").join(" ");
  if (unikke < MIN) d.push(["U6", `kun ${unikke} forskellige opgaver af denne type i hele spillet; eleven moeder de samme igen`]);
  const uforkortetITekst = broeker(t).some(([a, b]) => gcd(a, b) > 1);
  const skaevNaevner = broeker(t).some(([, b]) => [7, 9, 11, 13].includes(b));
  switch (id) {
    case "del-af-helhed": {
      if (t.startsWith("Kværnhjulet")) d.push(["U1", "ingen maler felter paa et kvaernhjul"]);
      const m = /i (\d+) lige store \w+, og (\d+) er/.exec(t);
      if (m && rigtig(o) !== `${m[2]}/${m[1]}`) d.push(["U4", `eleven taeller ${m[2]}/${m[1]}, men svaret staar som ${rigtig(o)}: forkortning foer den er laert (trin 4)`]);
      break;
    }
    case "del": {
      const m = /deler (\d+) sæk/.exec(t);
      d.push(["U1", "moellen sender ikke korn ud til gaardene; gaardene koerer korn TIL moellen, og moellen leverer mel"]);
      if (m && +m[1] === 1) d.push(["U3", "'1 sække' og 'de 1 sække' i hint og forklaring"]);
      const g = /mellem (\d+) gårde/.exec(t);
      if (m && g && rigtig(o) !== `${m[1]}/${g[1]}`) d.push(["U4", `regnestykket giver ${m[1]}/${g[1]}, men svaret staar som ${rigtig(o)}: forkortning foer trin 4`]);
      break;
    }
    case "sammenlign":
      if (uforkortetITekst) d.push(["U2", "en uforkortet brøk i historien (fx 2/4 sæk); ingen siger det, man siger en halv sæk"]);
      break;
    case "lignende":
      if (t.includes("små poser")) d.push(["U4", "historien spoerger efter antal poser, men opgaven spoerger 'hvilken brøk er lige så meget'"]);
      if (t.includes("så kort som muligt")) d.push(["U3", "'skriv brøken så kort som muligt' er ikke skolesprog; man siger 'forkort brøken mest muligt'"]);
      if (/lagt (\d+) til både/.test(hints) && +/lagt (\d+) til både/.exec(hints)[1] >= 5) d.push(["U7", "en svarmulighed (fx 13/18) som ingen elev ville vaelge; den afsloerer svaret"]);
      break;
    case "traek-fra":
    case "sammenlaeg":
    case "af-maengde":
    case "faelles-naevner":
      if (uforkortetITekst) d.push(["U2", "en uforkortet brøk i historien (fx 3/9 sæk, 4/6 af sækkene)"]);
      if (skaevNaevner) d.push(["U2", "syvende-, niende- eller ellevtedele af en sæk; ingen maaler mel saadan"]);
      break;
    case "blandet":
      if (t.includes("Skriv det som et blandet tal")) d.push(["U1", "ingen har '11/8 sæk mel'; man har 11 poser a 1/8 sæk"]);
      break;
    case "lineal":
      if (/fra 0 og ender/.test(t)) d.push(["U3", "'ligger fra 0 og ender' mangler '-stregen' og laeses stift"]);
      if (/\b(En|Et) (sten|pind|kvist|søm) (starter|ligger fra|starter ved)/.test(hints)) d.push(["U3", "hintet siger 'En sten starter' om den bestemte sten; det skal vaere 'Stenen starter'"]);
      break;
    case "enhed": {
      const m = /: (\d+) gange/.exec(o.forklaring ?? "");
      if (m && +m[1] >= 50) d.push(["U7", `forklaringen goer ${m[1]} fingerbredder/fingernegle til et billede; det kan ingen se for sig`]);
      break;
    }
    case "omregn":
      if (/spor er \d+ cm og \d+ mm/.test(t)) d.push(["U5", "tipvognens spor er under 10 cm langt"]);
      if (/(\d+) cm = \1 cm/.test(hints)) d.push(["U3", "hintet siger '390 cm = 390 cm'"]);
      break;
    case "omkreds-trin":
      if (/m lang og \d+ cm bred/.test(t)) d.push(["U1", "ingen maaler den ene side af en plads i m og den anden i cm"]);
      break;
    case "areal-trin": {
      const m = /er (\d+) m lang og (\d+) m bred/.exec(t);
      if (m && +m[1] * +m[2] < 12) d.push(["U5", `en grusplads paa ${+m[1] * +m[2]} m² er en terrasse, ikke en plads til grus`]);
      break;
    }
    case "maalestok": {
      const m = /Gruspladsen er (\d+) m lang/.exec(t);
      if (m && +m[1] < 10) d.push(["U5", `gruspladsen er ${m[1]} m lang her, men 30-90 m i de andre maalestoksopgaver`]);
      break;
    }
    case "pris":
    case "del-handel":
    case "areal":
    case "omkreds":
      if (o.svarmuligheder.every((s) => /^\d+$/.test(s.tekst))) d.push(["U5", "svarene staar uden enhed (kr, m, m²); Grusgraven laerer eleven, at enheden er en del af svaret"]);
      if (id === "del-handel") d.push(["U1", "en koebmand deler ikke sine penge ud til kunderne"]);
      if (id === "omkreds" && t.startsWith("En anden grusplads")) d.push(["U4", "'En anden grusplads' uden at der har vaeret en foerste"]);
      break;
    case "kasser":
      d.push(["U1", "'varer' er ikke noget man taeller; det er aebler, daaser eller poser"]);
      if (/leverance/i.test(quest.titel) && o.svarmuligheder.some((s) => s.korrekt && +s.tekst < 60)) d.push(["U4", `questen hedder '${quest.titel}', men leverancen er ${rigtig(o)} varer`]);
      break;
    case "ankomst":
    case "sejltid":
    case "afgang-tilbage": {
      const m = /Turen tager (\d+) timer/.exec(t) ?? [null, String(Number(/(\d+):00 og når frem kl\. (\d+)/.exec(t)?.[2]) - Number(/kl\. (\d+):00 og/.exec(t)?.[1]))];
      if (+m[1] >= 2) d.push(["U5", `en sporvognstur i sognet paa ${m[1]} timer (Grusgraven siger turen er 8-15 km)`]);
      d.push(["U7", "kun hele timer (kl. 13:00 + 4 timer): 2.-3.-klasses niveau, ingen minutter"]);
      break;
    }
  }
  return d;
}

const ud = [];
const opsummering = [];
ud.push("ORDRE 399 - alle opgavetyper i spil.html, genereret med spillets egne generatorer");
ud.push(`Kilde: matematik main (git archive), QUEST_BANK.lavOpgaver over mange spilsalte. Maal: ${MAAL} unikke opgaver pr. sted og opgavetype.`);
ud.push("Format: [sted/type #n] (quest, svaerhed) tekst | svar: rigtig (*) og forkerte med hint | forklaring");
ud.push("");

for (const [sted, kaede] of Object.entries(kaeder)) {
  const pr = new Map();
  for (let salt = 1; salt <= SALTE; salt++) {
    q.saetSpilSalt(salt * 31 + 7);
    for (const quest of kaede) {
      for (const o of quest.lavOpgaver(0)) {
        const liste = pr.get(o.id) ?? [];
        if (!pr.has(o.id)) pr.set(o.id, liste);
        if (!liste.some((x) => x.o.tekst === o.tekst)) liste.push({ o, quest });
        else if (liste.length < MIN) liste.push({ o, quest, gentaget: liste.findIndex((x) => x.o.tekst === o.tekst) + 1 });
      }
    }
  }
  ud.push("=".repeat(78));
  ud.push(`STED: ${STEDNAVN[sted]} (${sted})`);
  for (const quest of kaede) ud.push(`  quest "${quest.titel}": til: "${quest.replikker[0]}" / klaret: "${quest.replikker[1]}"`);
  ud.push("");
  for (const [id, alle] of pr) {
    const unikke = alle.filter((x) => !x.gentaget).length;
    const liste = unikke >= MIN ? alle.filter((x) => !x.gentaget).slice(0, MAAL) : [...alle.filter((x) => !x.gentaget), ...alle.filter((x) => x.gentaget)].slice(0, MIN);
    ud.push(`--- TYPE ${sted}/${id}: ${liste.length} opgaver (unikke tekster fundet over ${SALTE} spil: ${unikke}) ---`);
    const stat = [];
    liste.forEach(({ o, quest, gentaget }, i) => {
      ud.push(`[${sted}/${id} #${i + 1}] (${quest.titel}, s${quest.sværhed})${gentaget ? ` (GENTAGET: samme tekst som #${gentaget})` : ""} ${o.tekst}`);
      for (const s of o.svarmuligheder) ud.push(`    ${s.korrekt ? "*" : "-"} ${s.tekst}${s.hint ? `  || hint: ${s.hint}` : ""}`);
      if (o.forklaring) ud.push(`    forklaring: ${o.forklaring}`);
      if (o.skridt) ud.push(`    skridt: ${o.skridt}`);
      const d = dom(sted, id, o, quest, unikke);
      ud.push(d.length ? `    DOM: SPOEJS ${[...new Set(d.map(([u]) => u))].join(",")} | ${d.map(([u, g]) => `${u}: ${g}`).join(" | ")}` : "    DOM: ok");
      stat.push(d);
    });
    const spoejse = stat.filter((d) => d.length).length;
    const u = {};
    for (const d of stat) for (const x of new Set(d.map(([k]) => k))) u[x] = (u[x] ?? 0) + 1;
    const hyppigst = Object.entries(u).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "-";
    opsummering.push(`${STEDNAVN[sted].padEnd(38)} ${id.padEnd(16)} ${String(liste.length).padStart(3)} opg.  spoejse ${String(spoejse).padStart(3)} (${String(Math.round((100 * spoejse) / liste.length)).padStart(3)} %)  U: ${hyppigst}`);
    ud.push("");
  }
}
ud.splice(4, 0, "OPSUMMERING (sted, type, antal, spoejse, U-typer)", ...opsummering, "");
process.stdout.write(ud.join("\n") + "\n");
