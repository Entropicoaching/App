#!/usr/bin/env node
// ORDRE 123 · commit 1 — mål appen som en atlet oplever den på en telefon i en hal.
// -----------------------------------------------------------------------------
// Stå på skuldre (Marcs ord): samme metode som entropi-coaching-site/scripts/
// maal.mjs (Lighthouse mobil + axe + sidevægt, ordre 111) og entropi-adaptiv/
// scripts/betaklar-proeve.mjs (44px-scanner, tre telefonprofiler, ordre 113).
//
// Genbrugt uændret herfra: Lighthouse-mål (perf/a11y), axe kritisk/alvorlig,
// >=44px-trykflade-tjek, vandret-scroll-tjek, tre profiler (iPhone 13, lille
// Android, desktop), skærmbillede pr. skridt.
//
// TILPASSET til denne app (valg noteret her, jf. "vælg det mest fornuftige"):
//   - Browser: playwright fra den delte codex-runtime (samme kilde som
//     scripts/verify-videocoach-*.mjs og verify-athlete-reps-per-set-mobile.mjs
//     allerede bruger i DENNE app) i stedet for maal.mjs's puppeteer — ingen
//     grund til to browser-afhængigheder i samme repo. Lighthouse peger på den
//     CDP-port playwrights Chromium selv åbner (samme teknik som maal.mjs
//     bruger med puppeteer's wsEndpoint, blot hentet via et manuelt
//     child_process-spawn af playwrights Chromium-binary, da playwright.launch()
//     ikke selv eksponerer en rå CDP-HTTP-port).
//   - Login (Auth.jsx) og videocoach-forsiden (public/videocoach.html) måles
//     mod den ÆGTE app (npm run build + statisk server), fordi begge fungerer
//     uden en levende Supabase-session/atletdata.
//   - AthleteView.jsx kræver derimod en levende Supabase-session for slet at
//     boote (se scripts/verify-athlete-reps-per-set-mobile.mjs's egen
//     kommentar om præcis dette) — at bygge en fuld, tro Supabase-REST-mock
//     for hele komponenten (titlen har titalvis af tabeller/RPC'er) er ude af
//     proportion for ét måle-commit. De fire atlet-skærme (dagens pas,
//     sæt-logger, opvarmning, check-in) måles derfor i isolerede harnesses,
//     der bruger den ÆGTE, uændrede logik (src/repsPrescription.js,
//     src/warmup.js) og de ÆGTE, uændrede inline-stilarter kopieret direkte
//     fra AthleteView.jsx (samme princip som det eksisterende
//     verify-athlete-reps-per-set-mobile.mjs allerede gør for netop dette
//     problem) med syntetiske øvelser — ingen atletdata.
//     ÆRLIG GRÆNSE: harness-skærmenes "sidevægt" er isoleret harness-vægt,
//     IKKE den ægte AthleteView-bundtvægt. Den ægte autentificerede skal
//     (main+AthleteView-chunk, det SPA'en reelt henter uanset hvilken fane der
//     vises) rapporteres separat, én gang, fra selve build-outputtet.
//
// Kørsel: npm run maal:app (= node scripts/maal-app.mjs)
// Skriver: outputs/maal-app/<profil>/<skærm>.png + outputs/maal-app/FOER.md
// (eller EFTER.md + diff, hvis FOER.md allerede findes — samme konvention som
// maal.mjs).

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const outDir = path.join(repoRoot, 'outputs', 'maal-app')
const distDir = path.join(repoRoot, 'dist')
const srcDir = path.join(repoRoot, 'src')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { default: lighthouse } = await import('lighthouse')
const axeCorePath = path.join(repoRoot, 'node_modules', 'axe-core', 'axe.min.js')
const axeCoreSrc = readFileSync(axeCorePath, 'utf8')

const MIN_TAP = 44
const MOCK_SUPABASE_URL = 'https://mockproj.supabase.co'
const MOCK_SUPABASE_KEY = 'mock-anon-key-vaidya-proeve'

// --- tre telefonprofiler (ordre 113) -----------------------------------------

const PROFILES = [
  {
    slug: 'iphone13', label: 'iPhone 13',
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    lighthouse: true,
  },
  {
    slug: 'android360', label: 'Android 360×740',
    viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-A115F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    lighthouse: true,
  },
  {
    slug: 'desktop', label: 'Desktop 1280×800',
    viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    lighthouse: false, // ordre beder kun om "Lighthouse mobil-scores"
  },
]

// --- ægte, uændrede stilarter kopieret fra src/AthleteView.jsx (linje ~1444-1455) --

const S = {
  wrap: "min-height:100vh;background:#141410;color:#edeae2;font-family:'IBM Plex Sans',sans-serif;font-weight:300;",
  topbar: "height:52px;border-bottom:1px solid rgba(237,234,226,0.07);display:flex;align-items:center;justify-content:space-between;padding:0 1.5rem;background:#1c1c18;position:sticky;top:0;z-index:50;",
  logo: "font-family:'Playfair Display',serif;font-size:1rem;color:#edeae2;",
  page: "max-width:680px;margin:0 auto;padding:1.5rem 1rem 6rem;",
  card: "background:#1c1c18;border:1px solid rgba(237,234,226,0.07);padding:1.25rem;margin-bottom:1.5rem;",
  cardLabel: "font-family:'IBM Plex Mono',monospace;font-size:0.56rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#c8923a;margin-bottom:0.75rem;",
  fieldLabel: "font-family:'IBM Plex Mono',monospace;font-size:0.54rem;letter-spacing:0.1em;text-transform:uppercase;color:#7a7770;margin-bottom:0.3rem;",
  fieldInput: "width:100%;background:#141410;border:1px solid rgba(237,234,226,0.13);color:#edeae2;font-family:'IBM Plex Sans',sans-serif;font-size:0.88rem;font-weight:300;padding:0.55rem 0.75rem;outline:none;box-sizing:border-box;",
  btnPrimary: "background:#c8923a;color:#141410;font-family:'IBM Plex Mono',monospace;font-size:0.6rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:none;padding:0.5rem 1rem;cursor:pointer;",
  btnGhost: "background:transparent;color:#7a7770;font-family:'IBM Plex Mono',monospace;font-size:0.6rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(237,234,226,0.13);padding:0.5rem 1rem;cursor:pointer;",
}

const NAV_ITEMS = ['Hjem', 'Program', 'Kost', 'Mobilitet', 'Beskeder']

function nav(activeIdx) {
  return `<nav style="position:fixed;bottom:0;left:0;right:0;background:#1c1c18;border-top:1px solid rgba(237,234,226,0.07);display:flex;z-index:100;">
    ${NAV_ITEMS.map((label, i) => `
      <button style="flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.3rem;padding:0.7rem 0;color:${i === activeIdx ? '#c8923a' : '#4a4844'};font-family:'IBM Plex Mono',monospace;font-size:0.46rem;letter-spacing:0.1em;text-transform:uppercase;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="9"/></svg>
        <span>${label}</span>
      </button>`).join('')}
  </nav>`
}

function topbar() {
  return `<div style="${S.topbar}"><div style="${S.logo}">Entropi</div><div style="width:20px;height:20px;border-radius:50%;background:rgba(237,234,226,0.08);"></div></div>`
}

function page(inner) {
  return `<div style="${S.page}">${inner}</div>`
}

function shell(title, bodyHtml, activeNavIdx) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>*{box-sizing:border-box} body{margin:0;}</style>
</head><body>
<div style="${S.wrap}">
${topbar()}
${bodyHtml}
${nav(activeNavIdx)}
</div>
<script>window.__harnessReady = true</script>
</body></html>`
}

// --- Harness 1: "Dagens pas" (hjem-fanen, AthleteView.jsx linje ~3906-4003) --

function harnessHjem() {
  const sessions = [
    { title: 'Squat — uge 6', done: true, wd: null, exCount: 4 },
    { title: 'Bænkpres — topsæt', done: false, isNext: true, started: false, wd: null, exCount: 5 },
    { title: 'Dødløft — volumen', done: false, isNext: false, wd: 'Torsdag', exCount: 4 },
  ]
  const sessionButtons = sessions.map(sess => {
    const isNext = !!sess.isNext
    const done = !!sess.done
    return `<button style="display:flex;align-items:center;justify-content:space-between;background:${isNext ? 'rgba(200,146,58,0.1)' : 'rgba(237,234,226,0.03)'};border:1px solid ${isNext ? 'rgba(200,146,58,0.45)' : 'rgba(237,234,226,0.07)'};color:#edeae2;padding:0.6rem 0.75rem;cursor:pointer;width:100%;text-align:left;font-family:'IBM Plex Sans',sans-serif;font-weight:300;opacity:${done ? 0.55 : 1};margin-bottom:0.35rem;">
      <span style="display:flex;align-items:center;gap:0.5rem;min-width:0;">
        ${isNext ? '<span style="color:#c8923a;font-size:0.7rem;flex-shrink:0;">&#9654;</span>' : ''}
        ${done ? '<span style="color:#6cba6c;font-size:0.8rem;flex-shrink:0;">&#10003;</span>' : ''}
        <span style="font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${sess.title}</span>
        ${isNext ? '<span style="font-family:\'IBM Plex Mono\',monospace;font-size:0.46rem;letter-spacing:0.08em;text-transform:uppercase;color:#141410;background:#c8923a;padding:0.1rem 0.35rem;flex-shrink:0;">Næste</span>' : ''}
        ${!isNext && !done && sess.wd ? `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.46rem;letter-spacing:0.06em;text-transform:uppercase;color:#7a7770;flex-shrink:0;">${sess.wd}</span>` : ''}
      </span>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;letter-spacing:0.08em;text-transform:uppercase;color:#7a7770;flex-shrink:0;margin-left:0.75rem;">${sess.exCount} øvelser →</span>
    </button>`
  }).join('')

  const body = page(`
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:400;color:#edeae2;line-height:1.1;">God <em style="font-style:italic;color:#7a7770;">morgen</em>.</h1>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a4844;margin-top:0.25rem;">Torsdag d. 10. september 2026</div>
    </div>
    <button type="button" aria-label="Gå til dagens parathed" style="display:flex;align-items:center;gap:0.75rem;width:100%;text-align:left;padding:0.85rem 1rem;background:rgba(200,146,58,0.05);border:1px solid rgba(200,146,58,0.13);margin-bottom:1.25rem;cursor:pointer;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8923a" stroke-width="1.75"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;color:#c8923a;letter-spacing:0.08em;text-transform:uppercase;">Start din dag — log din readiness</div>
    </button>
    <div style="${S.card}">
      <div style="${S.cardLabel}">Mit program</div>
      <div style="display:flex;align-items:baseline;gap:0.6rem;margin-bottom:0.75rem;">
        <span style="font-family:'IBM Plex Mono',monospace;font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:#c8923a;">Uge 6 · 8-14. sep</span>
        <span style="font-family:'Playfair Display',serif;font-size:1rem;color:#edeae2;">Styrkeblok</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.35rem;">${sessionButtons}</div>
    </div>
  `)
  return shell('Dagens pas', body, 0)
}

// --- Harness 2: sæt-logger med interval-reps (AthleteView.jsx linje ~4941-5027,
// ordre 106) — bruger den ÆGTE, uændrede src/repsPrescription.js ------------

function harnessSaetLogger() {
  const body = page(`
    <div style="margin-bottom:0.75rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#c8923a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.1rem;">4 sæt · × 6-8 · RPE 8</div>
      <h1 style="font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:400;color:#edeae2;line-height:1.1;margin:0.2rem 0 1rem;">Bænkpres</h1>
    </div>
    <div id="sets"></div>
    <script type="module">
      import { parseRepsPrescription } from '/src/repsPrescription.js'
      const container = document.getElementById('sets')
      const rep = parseRepsPrescription('6-8')
      const editable = rep.type !== 'fixed'
      const defaultReps = rep.type === 'range' ? String(rep.min) : ''
      const rows = [
        { setNum: 1, logged: { weight: 85, reps: 7, rpe: 8 } },
        { setNum: 2, logged: null },
        { setNum: 3, logged: null },
      ]
      for (const row of rows) {
        const div = document.createElement('div')
        div.style.marginBottom = '0.75rem'
        div.dataset.setNum = String(row.setNum)
        if (row.logged) {
          div.innerHTML = \`
            <div style="display:flex;align-items:baseline;gap:0.75rem;margin-bottom:0.5rem;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:#4a4844;text-transform:uppercase;letter-spacing:0.06em;min-width:52px;">Sæt \${row.setNum}</div>
              <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:baseline;">
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.85rem;color:#edeae2;">\${row.logged.weight}kg × \${row.logged.reps}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.6rem;color:#7a7770;">RPE \${row.logged.rpe}</span>
              </div>
            </div>\`
        } else {
          div.innerHTML = \`
            <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;">
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:#7a7770;text-transform:uppercase;letter-spacing:0.06em;min-width:52px;">Sæt \${row.setNum}</div>
              <input data-role="weight" style="width:80px;min-width:80px;min-height:44px;box-sizing:border-box;flex-shrink:0;padding:0.65rem 0.5rem;font-size:1.1rem;text-align:center;background:#141410;border:1px solid rgba(237,234,226,0.13);color:#edeae2;font-family:'IBM Plex Sans',sans-serif;" type="text" inputmode="decimal" placeholder="kg">
              \${editable
                ? \`<span style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:#c8923a;">×</span>
                   <input data-role="reps-input" style="width:52px;min-width:52px;min-height:44px;box-sizing:border-box;flex-shrink:0;padding:0.65rem 0.3rem;font-size:1.1rem;text-align:center;background:#141410;border:1px solid rgba(237,234,226,0.13);color:#edeae2;font-family:'IBM Plex Sans',sans-serif;" type="text" inputmode="numeric" value="\${defaultReps}">\`
                : \`<span data-role="reps-static" style="font-family:'IBM Plex Mono',monospace;font-size:0.88rem;color:#c8923a;white-space:nowrap;">× 6-8</span>\`
              }
              <button style="background:#c8923a;color:#141410;font-family:'IBM Plex Mono',monospace;font-size:0.65rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:none;padding:0.65rem 1rem;min-height:44px;box-sizing:border-box;cursor:pointer;">Log</button>
              <button style="background:transparent;color:#4a4844;font-family:'IBM Plex Mono',monospace;font-size:0.55rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;border:1px solid rgba(237,234,226,0.08);padding:0.65rem 0.75rem;min-height:44px;box-sizing:border-box;cursor:pointer;">Spring over</button>
            </div>\`
        }
        container.appendChild(div)
      }
      window.__harnessReady = true
    </script>
  `)
  return shell('Sæt-logger', body, 1)
}

// --- Harness 3: opvarmning (ordre 105/AthleteView.jsx linje ~4809-4900) —
// bruger den ÆGTE, uændrede src/warmup.js -----------------------------------

function harnessOpvarmning() {
  const body = page(`
    <div style="margin-bottom:0.75rem;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:#c8923a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.1rem;">1 sæt · × 5 · RPE 9</div>
      <h1 style="font-family:'Playfair Display',serif;font-size:1.6rem;font-weight:400;color:#edeae2;line-height:1.1;margin:0.2rem 0 1rem;">Dødløft</h1>
    </div>
    <div id="warmup"></div>
    <script type="module">
      import { calcWarmupSets } from '/src/warmup.js'
      const sets = calcWarmupSets(140, 5, 'Dødløft')
      const wrap = document.getElementById('warmup')
      wrap.innerHTML = \`
        <div style="margin-bottom:0.75rem;border:1px solid rgba(237,234,226,0.07);border-left:2px solid rgba(200,146,58,0.3);">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.1em;text-transform:uppercase;color:#7a7770;">Opvarmningssæt —</span>
              <span style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;color:#7a7770;text-decoration:underline dotted;">140kg</span>
            </div>
            <span style="color:#4a4844;font-size:0.55rem;">▲</span>
          </div>
          <div style="padding:0 0.75rem 0.6rem;">
            \${sets.map((ws, i) => \`
              <!-- Ægte markup: en almindelig div med onClick, INGEN role/aria-label — se AthleteView.jsx linje ~4882-4892. data-tap-target er kun scriptets eget mål-instrument, ikke en ARIA-attribut, så den ikke selv skaber axe-fund. -->
              <div data-tap-target="\${'warmup-row-' + i}" data-tap-label="Opvarmningssæt \${i + 1}: \${ws.weight}kg × \${ws.reps}" style="display:flex;align-items:center;gap:0.65rem;margin-bottom:0.35rem;cursor:pointer;">
                <div style="width:14px;height:14px;flex-shrink:0;border:1px solid rgba(237,234,226,0.2);"></div>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:#c8923a;min-width:28px;">\${ws.pct}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.82rem;color:#edeae2;text-decoration:underline dotted;">\${ws.weight}kg</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:#7a7770;">× \${ws.reps}</span>
                <button title="Spring dette opvarmningssæt over" style="margin-left:auto;background:none;border:none;color:#4a4844;cursor:pointer;font-size:0.6rem;min-width:32px;min-height:32px;">✕</button>
              </div>\`).join('')}
          </div>
        </div>\`
      window.__harnessReady = true
    </script>
  `)
  return shell('Opvarmning', body, 1)
}

// --- Harness 4: check-in / parathed (AthleteView.jsx linje ~4007-4096) ------

function harnessCheckIn() {
  const scaleRow = (key, label, hint) => `
    <div style="margin-bottom:1rem;">
      <div style="${S.fieldLabel}">${label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.5rem;color:#4a4844;letter-spacing:0.06em;margin-bottom:0.4rem;">${hint}</div>
      <div style="display:flex;gap:0.4rem;">
        ${[1, 2, 3, 4, 5].map(v => `<button data-role="scale-${key}" style="flex:1;padding:0.9rem 0;font-family:'IBM Plex Mono',monospace;font-size:1rem;font-weight:500;border:1px solid rgba(237,234,226,0.13);background:#141410;color:#7a7770;cursor:pointer;">${v}</button>`).join('')}
      </div>
    </div>`
  const body = page(`
    <div style="${S.card}">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;margin-bottom:0.75rem;">
        <div style="${S.cardLabel}margin-bottom:0;">Dagens parathed</div>
      </div>
      <div style="margin-bottom:1rem;">
        <div style="${S.fieldLabel}">Søvn</div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <input type="number" min="0" max="24" step="0.5" placeholder="timer" style="${S.fieldInput}max-width:90px;font-size:1.1rem;padding:0.5rem 0.6rem;text-align:center;">
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.62rem;color:#7a7770;letter-spacing:0.06em;">timer</span>
        </div>
      </div>
      ${scaleRow('energy', 'Energiniveau', '1 = ingen energi  ·  5 = fuld energi')}
      ${scaleRow('motivation', 'Motivation', '1 = ingen lyst  ·  5 = klar til at løfte')}
      ${scaleRow('stress', 'Stress', '1 = helt rolig  ·  5 = meget stresset')}
      ${scaleRow('soreness', 'Muskelømhed', '1 = ingen ømhed  ·  5 = meget øm')}
      <div style="margin-bottom:1.25rem;">
        <div style="${S.fieldLabel}">Lokal ømhed <span style="font-family:'IBM Plex Mono',monospace;font-size:0.5rem;color:#4a4844;letter-spacing:0.04em;text-transform:none;font-weight:400;">(valgfrit)</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
          ${['Ben', 'Ryg', 'Skuldre/Arme', 'Core'].map(zone => `<button data-role="zone" style="padding:0.5rem 0.9rem;font-family:'IBM Plex Mono',monospace;font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase;border:1px solid rgba(237,234,226,0.13);background:#141410;color:#7a7770;cursor:pointer;">${zone}</button>`).join('')}
        </div>
      </div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.56rem;color:#c8923a;margin-bottom:0.6rem;letter-spacing:0.05em;">Udfyld energi, motivation, stress, ømhed for at logge</div>
      <button style="${S.btnPrimary}width:100%;min-height:44px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;opacity:0.45;">Log parathed</button>
    </div>
  `)
  return shell('Check-in', body, 0)
}

// --- statisk server -----------------------------------------------------------

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
}

const HARNESSES = {
  '/harness/dagens-pas.html': harnessHjem,
  '/harness/saet-logger.html': harnessSaetLogger,
  '/harness/opvarmning.html': harnessOpvarmning,
  '/harness/check-in.html': harnessCheckIn,
}

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    if (HARNESSES[urlPath]) {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(HARNESSES[urlPath]())
      return
    }
    if (urlPath.startsWith('/src/')) {
      try {
        const data = readFileSync(path.join(srcDir, urlPath.slice('/src/'.length)))
        res.writeHead(200, { 'content-type': 'application/javascript' })
        res.end(data)
        return
      } catch { res.writeHead(404); res.end('not found'); return }
    }
    const filePath = path.join(distDir, urlPath === '/' ? '/index.html' : urlPath)
    if (!filePath.startsWith(distDir)) { res.writeHead(403); res.end(); return }
    try {
      const data = readFileSync(filePath)
      res.writeHead(200, { 'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })
}

// --- skærme (ordrens liste) ---------------------------------------------------

const SCREENS = [
  { id: 'login', label: 'Login', kind: 'real', url: '/' },
  { id: 'dagens-pas', label: 'Dagens pas', kind: 'harness', url: '/harness/dagens-pas.html' },
  { id: 'saet-logger', label: 'Sæt-logger (interval-reps)', kind: 'harness', url: '/harness/saet-logger.html' },
  { id: 'opvarmning', label: 'Opvarmning', kind: 'harness', url: '/harness/opvarmning.html' },
  { id: 'videocoach-forside', label: 'Videocoach-forside (uden video)', kind: 'real', url: '/videocoach.html' },
  { id: 'check-in', label: 'Check-in (parathed)', kind: 'harness', url: '/harness/check-in.html' },
]

// --- Chrome via playwrights bundlede binary, med en rå CDP-port til Lighthouse

function launchChrome() {
  const execPath = chromium.executablePath()
  return new Promise((resolve, reject) => {
    const proc = spawn(execPath, [
      '--headless=new', '--remote-debugging-port=0', '--no-sandbox',
      '--disable-gpu', '--disable-dev-shm-usage',
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let buf = ''
    const timer = setTimeout(() => reject(new Error('Chrome åbnede ikke en devtools-port i tide')), 15000)
    const onData = (chunk) => {
      buf += chunk.toString()
      const m = buf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)
      if (m) { clearTimeout(timer); proc.stderr.off('data', onData); resolve({ proc, port: Number(m[1]) }) }
    }
    proc.stderr.on('data', onData)
    proc.once('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

// --- målinger ------------------------------------------------------------------

async function measureWeight(page, origin, gotoUrl) {
  const responses = []
  const onResp = async (resp) => {
    try {
      const headers = resp.headers()
      let size = Number(headers['content-length'] || 0)
      // Playwrights Response hedder body(), ikke Puppeteers buffer() — uden
      // dette fald tilbage stod sidevægten som 0, når content-length manglede.
      if (!size) { try { const buf = await resp.body(); size = buf.length } catch { size = 0 } }
      responses.push({ url: resp.url(), type: resp.request().resourceType(), size })
    } catch { /* navigation kan afbryde sene svar */ }
  }
  page.on('response', onResp)
  await page.goto(gotoUrl, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(300)
  page.off('response', onResp)
  const totalKb = Math.round(responses.reduce((a, r) => a + r.size, 0) / 1024)
  const jsKb = Math.round(responses.filter(r => r.type === 'script').reduce((a, r) => a + r.size, 0) / 1024)
  const cssKb = Math.round(responses.filter(r => r.type === 'stylesheet').reduce((a, r) => a + r.size, 0) / 1024)
  const imgKb = Math.round(responses.filter(r => r.type === 'image').reduce((a, r) => a + r.size, 0) / 1024)
  return { totalKb, jsKb, cssKb, imgKb, requestCount: responses.length }
}

async function runAxe(page) {
  await page.addScriptTag({ content: axeCoreSrc })
  const results = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] })
    return r.violations
      .filter(v => v.impact === 'critical' || v.impact === 'serious')
      .map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }))
  })
  return results
}

async function scanTapTargets(page) {
  return page.evaluate((MIN) => {
    // [data-tap-target] fanger ægte klikbare elementer i markeringen (fx en
    // <div onClick> uden ARIA-rolle, som i AthleteView.jsx's opvarmningsrække) —
    // et rent test-instrument, ikke en ARIA-attribut, så det ikke selv skaber axe-fund.
    const nodes = [...document.querySelectorAll('button, a[href], input, [role="button"], [data-tap-target]')]
    return nodes
      .filter(el => el.offsetParent !== null)
      .map(el => {
        const rect = el.getBoundingClientRect()
        const raw = el.getAttribute('data-tap-label') || el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || ''
        const text = raw.replace(/\s+/g, ' ').trim().slice(0, 60)
        return { text, height: Math.round(rect.height), width: Math.round(rect.width) }
      })
      .filter(item => item.height > 0 && (item.height < MIN || item.width < MIN))
  }, MIN_TAP)
}

async function scanOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
}

async function scanTextOverflow(page) {
  return page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length > 0) continue
      const text = (el.textContent || '').trim()
      if (!text) continue
      const cs = getComputedStyle(el)
      if (cs.whiteSpace !== 'nowrap') continue
      if (el.scrollWidth > el.clientWidth + 1) out.push(text.slice(0, 60))
    }
    return out
  })
}

async function measureLighthouse(url, port) {
  const result = await lighthouse(url, {
    port, output: 'json', logLevel: 'error',
    onlyCategories: ['performance', 'accessibility'],
    formFactor: 'mobile',
    screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
  })
  const cats = result.lhr.categories
  const score = (c) => (c ? Math.round(c.score * 100) : null)
  return { performance: score(cats.performance), accessibility: score(cats.accessibility) }
}

// --- ægte, autentificerede skal (main + AthleteView-chunk) fra build-output --

function measureAuthenticatedShellWeight() {
  const files = readdirSync(path.join(distDir, 'assets'))
  const pick = (needle, ext) => files.find(f => f.startsWith(needle) && f.endsWith(ext))
  const indexFile = pick('index-', '.js')
  const athleteFile = pick('AthleteView-', '.js')
  const cssFile = files.find(f => f.endsWith('.css'))
  const kb = (f) => f ? Math.round(statSync(path.join(distDir, 'assets', f)).size / 1024) : 0
  return {
    files: [indexFile, athleteFile, cssFile].filter(Boolean),
    totalKb: kb(indexFile) + kb(athleteFile) + kb(cssFile),
  }
}

// --- markdown -------------------------------------------------------------------

function mdEscape(s) { return String(s ?? '').replace(/\|/g, '\\|') }

function buildTable(rows) {
  const header = ['Profil', 'Skærm', 'Perf', 'A11y', 'Sidevægt (KB)', 'Axe-fejl', 'Trykflader <44px', 'Vandret scroll', 'Tekst ud af boks']
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`]
  for (const r of rows) {
    lines.push(`| ${r.profile} | ${r.screen} | ${r.lh ? r.lh.performance : '—'} | ${r.lh ? r.lh.accessibility : '—'} | ${r.weight.totalKb} | ${r.axe.length} | ${r.tapTargets.length} | ${r.overflow ? 'JA' : 'nej'} | ${r.textOverflow.length ? r.textOverflow.length + ': ' + mdEscape(r.textOverflow.join('; ')) : '0'} |`)
  }
  return lines.join('\n')
}

function buildDetails(rows) {
  const lines = ['', '## Detaljer (trykflader og axe-fund under 44px / kritisk / alvorlig)', '']
  for (const r of rows) {
    if (!r.tapTargets.length && !r.axe.length) continue
    lines.push(`### ${r.profile} · ${r.screen}`)
    for (const t of r.tapTargets) lines.push(`- Trykflade: "${mdEscape(t.text) || '(uden tekst)'}" — ${t.width}×${t.height}px`)
    for (const a of r.axe) lines.push(`- Axe (${a.impact}): ${a.id} — ${mdEscape(a.help)} (${a.nodes} element${a.nodes === 1 ? '' : 'er'})`)
    lines.push('')
  }
  return lines.join('\n')
}

function buildDiff(before, after) {
  const lines = ['', '## Før → efter', '']
  const key = (r) => `${r.profile}::${r.screen}`
  const beforeByKey = new Map(before.map(r => [key(r), r]))
  for (const a of after) {
    const b = beforeByKey.get(key(a))
    if (!b) { lines.push(`- **${key(a)}**: ny måling, ingen "før".`); continue }
    const d = (x, y) => (x === y ? `${x}` : `${x} → ${y}`)
    lines.push(`- **${key(a)}**: perf ${d(b.lh?.performance, a.lh?.performance)}, a11y ${d(b.lh?.accessibility, a.lh?.accessibility)}, sidevægt ${d(b.weight.totalKb, a.weight.totalKb)} KB, axe-fejl ${d(b.axe.length, a.axe.length)}, trykflader<44px ${d(b.tapTargets.length, a.tapTargets.length)}`)
  }
  return lines.join('\n')
}

// --- main ------------------------------------------------------------------

async function main() {
  mkdirSync(outDir, { recursive: true })
  for (const p of PROFILES) mkdirSync(path.join(outDir, p.slug), { recursive: true })

  console.log('Bygger appen (npm run build, fiktive Supabase-nøgler i proces-scope)...')
  // Ét sammensat kommando-argument (ikke et args-array) sammen med shell:true,
  // for at undgå Node's advarsel om uescapede array-argumenter — hele strengen
  // her er en fast literal, ikke brugerinput.
  const build = spawnSync('npm run build', {
    cwd: repoRoot, stdio: 'inherit', shell: true,
    env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_KEY: MOCK_SUPABASE_KEY },
  })
  if (build.status !== 0) { console.error('Build fejlede.'); process.exit(1) }

  const shellWeight = measureAuthenticatedShellWeight()

  const { server, port: serverPort } = await startServer()
  const origin = `http://127.0.0.1:${serverPort}`

  const { proc: chromeProc, port: cdpPort } = await launchChrome()
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`)

  const rows = []
  try {
    for (const profile of PROFILES) {
      console.log(`\n=== Profil: ${profile.label} ===`)
      for (const screen of SCREENS) {
        process.stdout.write(`  ${screen.label} ... `)
        const context = await browser.newContext({
          viewport: profile.viewport, deviceScaleFactor: profile.deviceScaleFactor,
          isMobile: profile.isMobile, hasTouch: profile.hasTouch,
          userAgent: profile.userAgent, serviceWorkers: 'block',
        })
        const page = await context.newPage()
        const consoleErrors = []
        page.on('pageerror', (e) => consoleErrors.push(e.message))

        const weight = await measureWeight(page, origin, `${origin}${screen.url}`)
        await page.waitForTimeout(300)
        const axe = await runAxe(page)
        const tapTargets = await scanTapTargets(page)
        const overflow = await scanOverflow(page)
        const textOverflow = await scanTextOverflow(page)

        const shotPath = path.join(outDir, profile.slug, `${screen.id}.png`)
        await page.screenshot({ path: shotPath, fullPage: true })

        let lh = null
        if (profile.lighthouse) {
          lh = await measureLighthouse(`${origin}${screen.url}`, cdpPort)
        }

        rows.push({ profile: profile.label, screen: screen.label, weight, axe, tapTargets, overflow, textOverflow, lh, consoleErrors, screenshot: path.relative(repoRoot, shotPath) })
        await context.close()
        console.log('OK' + (consoleErrors.length ? ` (${consoleErrors.length} JS-fejl)` : ''))
      }
    }
  } finally {
    await browser.close()
    chromeProc.kill()
    await new Promise((resolve) => server.close(resolve))
  }

  const foerMdPath = path.join(outDir, 'FOER.md')
  const foerJsonPath = path.join(outDir, 'FOER.json')
  const isEfter = existsSync(foerMdPath)
  const mdPath = isEfter ? path.join(outDir, 'EFTER.md') : foerMdPath
  const jsonPath = isEfter ? path.join(outDir, 'EFTER.json') : foerJsonPath

  const md = [
    `# ${isEfter ? 'Måling efter' : 'Måling før'} (Ordre 123)`,
    '',
    `Målt ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, ${PROFILES.length} profiler × ${SCREENS.length} skærme, med attrap-data (ingen atletdata).`,
    '',
    `**Den autentificerede skal** (main + AthleteView-chunk — det SPA'en henter uanset hvilken atlet-fane der vises, "dagens pas"/"sæt-logger"/"opvarmning"/"check-in" deler denne): ${shellWeight.totalKb} KB (${shellWeight.files.join(', ')}). Login og videocoach-forsiden er selvstændige og har deres egen sidevægt i tabellen nedenfor.`,
    '',
    '_Ærlig grænse: "Dagens pas", "Sæt-logger", "Opvarmning" og "Check-in" er isolerede harnesses (ægte src/repsPrescription.js + src/warmup.js + ægte inline-stilarter kopieret fra AthleteView.jsx, syntetiske øvelser) — AthleteView.jsx kræver en levende Supabase-session for slet at boote (se scripts/verify-athlete-reps-per-set-mobile.mjs). Deres "sidevægt"/Perf-tal i tabellen er harness-isolerede, ikke den ægte AthleteView-bundtvægt (se skal-tallet ovenfor). Login og videocoach-forsiden er den ægte, uændrede app._',
    '',
    buildTable(rows),
    buildDetails(rows),
  ]

  if (isEfter && existsSync(foerJsonPath)) {
    const before = JSON.parse(readFileSync(foerJsonPath, 'utf8'))
    md.push(buildDiff(before, rows))
  }

  writeFileSync(mdPath, md.join('\n') + '\n', 'utf8')
  writeFileSync(jsonPath, JSON.stringify(rows, null, 2), 'utf8')
  console.log(`\nSkrevet: ${path.relative(repoRoot, mdPath)} og ${path.relative(repoRoot, jsonPath)}`)
  console.log(`Skærmbilleder: ${path.relative(repoRoot, outDir)}/<profil>/<skærm>.png`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
