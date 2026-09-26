// ORDRE 399 blok 3: verify:kritik-399.
//   1. outputs/kritik-399/opgaver.txt har mindst 30 opgaver pr. sted og opgavetype,
//      og hver opgave har en dom (DOM: ok eller DOM: SPOEJS Ux).
//   2. docs/kritik-399/KRITIK-matematik-opgaver.md har M-SP1 til M-SP5, og hvert fund
//      har en kodeplacering (src/fil.js:linje). Findes matematik-repoet, tjekkes det, at
//      filen og linjen findes i main.
//   3. Kornmaalingen findes, og RAPPORT-399.md starter med "Ordre 399" og har de fem afsnit.
// Exit 1 ved fejl.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const MATEMATIK = process.env.MATEMATIK_ROD ?? "C:/Users/Entropi/Desktop/matematik";
const fejl = [];
const ok = (b, t) => { if (!b) fejl.push(t); };

// 1. opgaver.txt
const opg = readFileSync("outputs/kritik-399/opgaver.txt", "utf8").replace(/\r/g, "").split("\n");
const typer = new Map();
let aktuel = null;
for (const l of opg) {
  const h = /^--- TYPE (\S+): (\d+) opgaver/.exec(l);
  if (h) { aktuel = h[1]; typer.set(aktuel, { hoved: +h[2], opgaver: 0, domme: 0 }); continue; }
  if (/^=+$/.test(l)) aktuel = null;
  if (!aktuel) continue;
  if (new RegExp(`^\\[${aktuel.replace("/", "\\/")} #\\d+\\]`).test(l)) typer.get(aktuel).opgaver++;
  if (/^ {4}DOM: (ok|SPOEJS U[1-7](,U[1-7])*( \|.*)?)$/.test(l)) typer.get(aktuel).domme++;
}
ok(typer.size >= 30, `kun ${typer.size} opgavetyper i opgaver.txt`);
for (const [t, v] of typer) {
  ok(v.opgaver >= 30, `${t}: ${v.opgaver} opgaver (under 30)`);
  ok(v.opgaver === v.hoved, `${t}: overskriften siger ${v.hoved}, der er ${v.opgaver}`);
  ok(v.domme === v.opgaver, `${t}: ${v.domme} domme til ${v.opgaver} opgaver`);
}
const steder = new Set([...typer.keys()].map((k) => k.split("/")[0]));
for (const s of ["moellen", "stenbrud", "marked", "landsby", "havn", "skjult"]) ok(steder.has(s), `stedet ${s} mangler i opgaver.txt`);

// 2. M-SP-fund med kodeplacering
const kritik = readFileSync("docs/kritik-399/KRITIK-matematik-opgaver.md", "utf8");
const harMat = existsSync(`${MATEMATIK}/.git`);
const linjer = new Map();
const matFil = (fil) => {
  if (!linjer.has(fil)) {
    try { linjer.set(fil, execFileSync("git", ["-C", MATEMATIK, "show", `main:${fil}`], { encoding: "utf8" }).split("\n")); }
    catch { linjer.set(fil, null); }
  }
  return linjer.get(fil);
};
let placeringer = 0;
for (let i = 1; i <= 5; i++) {
  const start = kritik.indexOf(`### M-SP${i}:`);
  ok(start >= 0, `M-SP${i} mangler i KRITIK-matematik-opgaver.md`);
  if (start < 0) continue;
  const slut = kritik.indexOf("\n### ", start + 5);
  const afsnit = kritik.slice(start, slut < 0 ? undefined : slut);
  const refs = [...afsnit.matchAll(/`(src\/[\w./-]+\.js):(\d+)(?:-(\d+))?/g)];
  ok(refs.length > 0, `M-SP${i} har ingen kodeplacering (src/fil.js:linje)`);
  for (const [, fil, fra, til] of refs) {
    placeringer++;
    if (!harMat) continue;
    const l = matFil(fil);
    ok(l !== null, `M-SP${i}: ${fil} findes ikke i matematik main`);
    if (l) ok(Number(til ?? fra) <= l.length, `M-SP${i}: ${fil}:${til ?? fra} ligger efter filens slutning (${l.length} linjer)`);
  }
}

// 3. Kornmaaling og rapport
ok(existsSync("outputs/kritik-399/korn/maaling.json"), "kornmaalingen mangler");
if (existsSync("docs/kritik-399/RAPPORT-399.md")) {
  const r = readFileSync("docs/kritik-399/RAPPORT-399.md", "utf8").replace(/\r/g, "");
  ok(r.split("\n")[0].trim() === "Ordre 399", "RAPPORT-399.md starter ikke med 'Ordre 399'");
  for (const a of ["## Gren", "## Hvad ændret", "## Testresultat", "## Hvad er næste", "## Ærlige grænser"]) ok(r.includes(a), `RAPPORT-399.md mangler afsnittet "${a}"`);
} else fejl.push("docs/kritik-399/RAPPORT-399.md mangler");

const antal = [...typer.values()].reduce((a, v) => a + v.opgaver, 0);
console.log(`opgaver.txt: ${typer.size} typer paa ${steder.size} steder, ${antal} opgaver, min ${Math.min(...[...typer.values()].map((v) => v.opgaver))} pr. type`);
console.log(`M-SP1..5: ${placeringer} kodeplaceringer${harMat ? " tjekket mod matematik main" : " (matematik ikke fundet, linjer ikke tjekket)"}`);
if (fejl.length) { console.error(`FEJL (${fejl.length}):\n- ${fejl.join("\n- ")}`); process.exit(1); }
console.log("verify:kritik-399 OK");
