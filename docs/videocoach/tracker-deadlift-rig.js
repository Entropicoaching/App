// ENT0093: syntetisk dødløft-rig for centerkorrektion.
// Samme bane og samme optiske-flow-drift køres for alle varianter. CX er facit.
// Dette er bevidst en rig, ikke kode der kan nå VideoCoach i produktion.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const W = 640, H = 720, CX = 320, RADIUS = 30, DT = 1 / 30;
const EXPECTED_VARIANTS = 3;
const here = dirname(fileURLToPath(import.meta.url));
const videoCoach = readFileSync(join(here, '..', '..', 'public', 'videocoach.html'), 'utf8');

// En rep starter/slutter på gulvet. OCCL + DISTRACT repræsenterer lår/skygge
// og en fast rack-detalje ved bunden; begge føjer drift til den syntetiske
// multipoint-median, men aldrig til plade-identiteten.
function scenario() {
  const frames = [];
  let drift = 0;
  for (let rep = 0; rep < 6; rep++) {
    for (let i = 0; i < 42; i++) {
      const phase = i / 41;
      const y = 520 - 265 * Math.sin(Math.PI * phase);
      const nearHome = y >= 500;
      const OCCL = nearHome && (i === 0 || i === 1 || i === 40 || i === 41);
      const DISTRACT = nearHome && i >= 39;
      drift += .09 + (OCCL ? .36 : 0) + (DISTRACT ? .18 : 0);
      frames.push({ rep: rep + 1, y, rawX: CX + drift, OCCL, DISTRACT });
    }
  }
  return frames;
}

// Minimal Node-port af de to produktbegreber: et lokalt pladeudsnit og en
// søgning efter den hele, bekræftede plade. I den syntetiske scene kan den
// identificerede skive kun være CX/y; OCCL og DISTRACT må ikke overtage den.
function plCapture(frame, x, y, w, h) {
  return { frame, x0: Math.max(0, x), y0: Math.max(0, y), w, h, cw: W, ch: H };
}
function plSearch(capture, pred, radius, model, searchRadius, step) {
  const { frame } = capture;
  const distance = Math.hypot(frame.x - pred.x, frame.y - pred.y);
  if (distance > searchRadius + step) return null;
  return { x: frame.x, y: frame.y, circle: model.circle, cover: model.cover,
    pairCover: model.pairCover, app: 0, distance };
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function assertProductionContract() {
  const confirmedHomeCorrection = /const confirmed=homePending&&[\s\S]{0,180}radius\*\.08;[\s\S]{0,180}nx\+=delta\.x\*\.5;ny\+=delta\.y\*\.5;[\s\S]{0,220}homePending=delta;/;
  assert(confirmedHomeCorrection.test(videoCoach),
    'VideoCoach mangler den bekraeftede, daempede doedloeft-korrektion C');
}

assertProductionContract();

function run(variant) {
  const frames = scenario();
  const p0 = { x: CX, y: 520 };
  const plateModel = { circle: 24, cover: .8, pairCover: .8 };
  const plateBase = plateModel;
  const plateIdentityUsable = plateBase.circle > 8 && plateBase.cover >= .35;
  let cur = { ...p0 }, vel = { x: 0, y: 0 }, wasNearHome = false;
  let homeEntryFrames = 0, correctionPending = null, rejected = 0, anchors = 0;
  let accumulatedError = 0, confirmedCorrections = 0;
  for (const frame of frames) {
    // Portens "optiske flow" er scenariets kendte, driftende median.
    let nx = frame.rawX, ny = frame.y;
    const nearHome = Math.hypot(nx - p0.x, ny - p0.y) <= RADIUS * 1.35;
    if (plateIdentityUsable && nearHome && !wasNearHome) homeEntryFrames = 10;
    if (plateIdentityUsable && nearHome && homeEntryFrames > 0) {
      const homeR = RADIUS * 1.15, auditStep = Math.max(3, RADIUS * .10);
      const homeFrame = plCapture({ x: CX, y: frame.y }, p0.x - homeR, p0.y - homeR, homeR * 2, homeR * 2);
      const homeHit = plSearch(homeFrame, p0, RADIUS, plateModel, homeR, auditStep);
      const homeStrong = homeHit && homeHit.circle > Math.max(9, plateBase.circle * .34) &&
        homeHit.cover >= .45 && homeHit.pairCover >= .35 && homeHit.app < 2.6;
      if (homeStrong) {
        anchors++;
        const delta = { x: homeHit.x - nx, y: homeHit.y - ny };
        if (variant === 'A') { // før 30. juli: udæmpet snap
          nx = homeHit.x; ny = homeHit.y;
        } else if (variant === 'C') { // eksperiment: to ens frames + dæmpning
          const confirmed = correctionPending && Math.hypot(delta.x - correctionPending.x,
            delta.y - correctionPending.y) <= RADIUS * .08;
          if (confirmed) { nx += delta.x * .5; ny += delta.y * .5; confirmedCorrections++; }
          correctionPending = delta;
        }
      }
    }
    if (homeEntryFrames > 0) homeEntryFrames--;
    wasNearHome = nearHome;
    const jump = Math.hypot(nx - cur.x, ny - cur.y);
    const maxJump = RADIUS * .75 + Math.hypot(vel.x, vel.y) * DT * .45;
    accumulatedError += Math.abs(nx - CX);
    if (jump > maxJump) { rejected++; continue; }
    vel = { x: (nx - cur.x) / DT, y: (ny - cur.y) / DT };
    cur = { x: nx, y: ny };
  }
  return { variant, frames: frames.length, accumulatedError, rejected, anchors, confirmedCorrections };
}

const results = ['A', 'B', 'C'].map(run);
assert(results.length === EXPECTED_VARIANTS, 'alle tre varianter skal køres');
assert(results.every(r => r.anchors >= 6), 'scenariet skal nå hjemmet i mindst fem reps');
const [a, b, c] = results;
assert(b.accumulatedError > c.accumulatedError, 'C skal mindske drift mod live B i dette scenarie');
assert(a.rejected > c.rejected, 'A skal betale flere hop-afvisninger end C i dette scenarie');

console.log('\nENT0093 — syntetisk dødløft: samme drift/OCCL/DISTRACT, CX=320');
console.log('variant | akkumuleret |nx-CX| | afviste jump-frames | home-ankre | bekræftede C');
for (const r of results) console.log(`${r.variant.padEnd(7)} | ${r.accumulatedError.toFixed(1).padStart(22)} | ${String(r.rejected).padStart(20)} | ${String(r.anchors).padStart(11)} | ${String(r.confirmedCorrections).padStart(13)}`);
console.log('\nGRØN: A, B og C er målt på samme 6-reps scenarie.');
