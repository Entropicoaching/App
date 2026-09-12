#!/usr/bin/env node
// ORDRE 130 · commit 1 — mål Dashboard.jsx (coachens side) som Marc oplever den
// på iPad og desktop.
// -----------------------------------------------------------------------------
// Stå på skuldre: samme metode og infrastruktur som scripts/maal-app.mjs
// (ordre 123) — playwright fra den delte codex-runtime, lighthouse mod
// playwrights Chromium via en manuel CDP-port, axe kritisk/alvorlig,
// >=44px-trykflade-scanner, vandret-scroll- og tekst-overflow-scannere,
// FOER.md/EFTER.md-konventionen (anden kørsel bliver automatisk "efter" med
// diff). Infrastrukturen er bevidst KOPIERET (ikke delt via import) fra
// maal-app.mjs, for slet ikke at røre den fil — ordren forbyder ændringer
// uden for coach-området, og "npm run maal:app" skal forblive uændret grønt.
//
// TILPASSET til coachen (valg noteret her):
//   - To profiler, begge > 768px (Dashboard.jsx's egen isMobile-grænse, se
//     src/Dashboard.jsx linje ~529), fordi Marc bruger coach-siden på iPad
//     LANDSCAPE og desktop — aldrig i coachens mobile smalskærms-layout. Det
//     er selve pointen med at måle her: sidebar+desktop-tætte formularer
//     rammer et TOUCH-medie (iPad) uden at gå i det mobile layout, så
//     44px-trykflade-scanneren er reelt interessant her.
//   - Dashboard.jsx kræver en levende Supabase-session for at boote (ligesom
//     AthleteView.jsx, se maal-app.mjs's egen kommentar herom) — de seks
//     skærme måles derfor som isolerede harnesses med ÆGTE stilarter og
//     ÆGTE, uændrede rene hjælpefunktioner kopieret direkte fra
//     src/Dashboard.jsx (samme princip som maal-app.mjs's fire atlet-harnesses),
//     med attrap-atleter/data. ÆRLIG GRÆNSE: harnessenes "sidevægt" er
//     isoleret harness-vægt, IKKE Dashboard-chunkens ægte bundtvægt — den
//     ægte, uændrede Dashboard-chunk (det coachen reelt henter, uanset hvilken
//     fane der vises) rapporteres separat fra selve build-outputtet, ligesom
//     maal-app.mjs gør for AthleteView.
//   - "Tid til interaktiv" måles med Lighthouses `interactive`-audit (desktop-
//     formfaktor, da hverken iPad landscape eller desktop er en telefon) på
//     atlet-liste-skærmen med 12 attrap-atleter (ordrens tal).
//   - "Tomme tilstande" måles ved at gentage tre af skærmene (atletliste,
//     coach-briefing, check-in-gennemgang) med tomme datasæt og lade
//     tekst-scanneren se efter en rolig sætning frem for blot blankt rum.
//
// Kørsel: npm run maal:coach (= node scripts/maal-coach.mjs)
// Skriver: outputs/maal-coach/<profil>/<skærm>.png + outputs/maal-coach/FOER.md
// (eller EFTER.md + diff, hvis FOER.md allerede findes).

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, '..')
const outDir = path.join(repoRoot, 'outputs', 'maal-coach')
const distDir = path.join(repoRoot, 'dist')

const require = createRequire(import.meta.url)
const runtimeModules = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules')
const { chromium } = require(path.join(runtimeModules, 'playwright'))
const { default: lighthouse } = await import('lighthouse')
const axeCorePath = path.join(repoRoot, 'node_modules', 'axe-core', 'axe.min.js')
const axeCoreSrc = readFileSync(axeCorePath, 'utf8')

const MIN_TAP = 44
const MOCK_SUPABASE_URL = 'https://mockproj.supabase.co'
const MOCK_SUPABASE_KEY = 'mock-anon-key-vaidya-proeve'

// --- to coach-profiler: iPad landscape og desktop (ordre 130) ----------------

const PROFILES = [
  {
    slug: 'ipad-landscape', label: 'iPad landscape 1180×820',
    viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: false, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  {
    slug: 'desktop', label: 'Desktop 1440×900',
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    userAgent: undefined,
  },
]

// --- ægte, uændrede stilarter og hjælpefunktioner kopieret fra
// src/Dashboard.jsx (linje ~81, ~135-146, ~269-303, ~423-435) --------------

const statusColors = { active: '#6cba6c', peaking: '#c8923a', offseason: '#7a7770', ferie: '#5b9bb5' }

const VIDEOCOACH_STATUS = {
  draft: { label: 'Kladde', color: '#c8923a' },
  coach_approved: { label: 'Godkendt', color: '#6cba6c' },
  shared: { label: 'Delt med atlet', color: '#67dff5' },
  invalid: { label: 'Ugyldig', color: '#cf6b4e' },
}

const s = {
  wrap: { minHeight: '100vh', background: '#141410', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 300, display: 'flex' },
  sidebar: { width: '220px', minHeight: '100vh', background: '#1c1c18', borderRight: '1px solid rgba(237,234,226,0.07)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0 },
  sidebarLogo: { padding: '1.5rem 1.25rem 1.25rem', borderBottom: '1px solid rgba(237,234,226,0.07)' },
  wordmark: { fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#edeae2' },
  sub: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4a4844', marginTop: '0.2rem' },
  navItem: (active) => ({ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1.25rem', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: active ? '#c8923a' : '#7a7770', cursor: 'pointer', borderLeft: active ? '2px solid #c8923a' : '2px solid transparent', background: active ? 'rgba(200,146,58,0.08)' : 'transparent' }),
  main: { marginLeft: '220px', flex: 1, minWidth: 0 },
  topbar: { height: '52px', borderBottom: '1px solid rgba(237,234,226,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', background: 'rgba(20,20,16,0.95)', position: 'sticky', top: 0, zIndex: 50 },
  topbarTitle: { fontFamily: "'Playfair Display', serif", fontSize: '1rem', fontWeight: 400, color: '#edeae2' },
  page: { padding: '2rem' },
  btnPrimary: { background: '#c8923a', color: '#141410', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnGhost: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.13)', padding: '0.5rem 1rem', cursor: 'pointer' },
  btnEdit: { background: 'transparent', color: '#7a7770', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.52rem', letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid rgba(237,234,226,0.1)', padding: '0.2rem 0.55rem', minHeight: '44px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' },
  card: { background: '#1c1c18', border: '1px solid rgba(237,234,226,0.07)', padding: '1.5rem', marginBottom: '1.5rem' },
  cardLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.56rem', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c8923a', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.54rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7a7770', marginBottom: '0.35rem' },
  fieldInput: { width: '100%', background: '#141410', border: '1px solid rgba(237,234,226,0.13)', color: '#edeae2', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '0.88rem', fontWeight: 300, padding: '0.55rem 0.75rem', outline: 'none' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'rgba(237,234,226,0.07)', border: '1px solid rgba(237,234,226,0.07)' },
  athleteCard: { background: '#141410', padding: '1.25rem 1.5rem', cursor: 'pointer', borderTop: '2px solid transparent', display: 'flex', alignItems: 'center', gap: '1rem' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#242420', border: '1px solid rgba(237,234,226,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", fontSize: '0.9rem', color: '#c8923a', flexShrink: 0 },
  badge: (status) => ({ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.5rem', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.2rem 0.5rem', background: statusColors[status] + '22', color: statusColors[status] }),
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function readinessSignal(score) {
  if (score >= 75) return { color: '#6cba6c', text: 'Kroppen er klar 💪', bg: 'rgba(108,186,108,0.07)' }
  if (score >= 50) return { color: '#c8923a', text: 'Tag det lidt roligt i dag', bg: 'rgba(200,146,58,0.07)' }
  return { color: '#e05555', text: 'Overvej en let session i dag', bg: 'rgba(224,85,85,0.07)' }
}

function formatLastSeen(ts) {
  if (!ts) return null
  const diffDays = Math.floor((Date.now() - new Date(ts)) / 86400000)
  const dotColor = diffDays <= 2 ? '#6cba6c' : diffDays <= 7 ? '#c8923a' : '#4a4844'
  const text = diffDays === 0 ? 'Aktiv i dag' : diffDays <= 7 ? 'Aktiv denne uge' : `Sidst aktiv: ${diffDays} dage siden`
  return { text, dotColor }
}

// css(): omsætter et React-lignende style-objekt (camelCase-nøgler) til en CSS-
// attributstreng, så de ÆGTE style-objekter ovenfor kan genbruges uændret i
// static HTML uden manuel transskription (transskriptionsfejl er netop det,
// der gør harnesses upålidelige).
const PX_PROPS = new Set(['width', 'height', 'minHeight', 'minWidth', 'maxWidth', 'top', 'left', 'right', 'bottom', 'padding', 'margin', 'marginTop', 'marginLeft', 'marginBottom', 'marginRight', 'fontSize', 'borderRadius', 'gap', 'zIndex'])
function kebab(k) { return k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()) }
function css(obj) {
  // Afsluttende ';' er bevidst - uden den smelter en efterfølgende, tilføjet
  // CSS-egenskab sammen med sidste værdi (fx "cursor:pointermin-height:44px"),
  // som browseren så tavst kasserer.
  return Object.entries(obj).map(([k, v]) => {
    if (typeof v === 'number') v = PX_PROPS.has(k) && k !== 'zIndex' ? `${v}px` : String(v)
    return `${kebab(k)}:${v}`
  }).join(';') + ';'
}

// --- attrap-data ---------------------------------------------------------------

const MOCK_ATHLETES = Array.from({ length: 12 }, (_, i) => {
  const names = ['Anna Berg', 'Mikkel Holm', 'Sara Lund', 'Jonas Krogh', 'Ida Vestergaard', 'Peter Falk',
    'Nanna Ross', 'Kasper Dam', 'Freja Skov', 'Thomas Riis', 'Emma Kjær', 'Oliver Nyholm']
  const statuses = ['active', 'active', 'active', 'peaking', 'active', 'offseason', 'active', 'ferie', 'active', 'active', 'peaking', 'active']
  const lastSeenDays = [0, 1, 0, 3, 9, 0, 2, 20, 0, 1, 4, 0]
  return {
    id: `ath-${i}`, name: names[i], status: statuses[i],
    last_seen: new Date(Date.now() - lastSeenDays[i] * 86400000).toISOString(),
    weight_class: 74 + (i % 5) * 7,
  }
})

// --- HTML-byggeklodser -----------------------------------------------------

function sidebar(activeKey) {
  const items = [
    { key: 'list', label: 'Forside' },
    { key: 'inbox', label: 'Indbakke' },
  ]
  return `<div style="${css(s.sidebar)}">
    <div style="${css(s.sidebarLogo)}"><div style="${css(s.wordmark)}">Entropi</div><div style="${css(s.sub)}">Coach</div></div>
    ${items.map(it => `<div style="${css(s.navItem(it.key === activeKey))}">${it.label}</div>`).join('')}
  </div>`
}

function topbar(title) {
  return `<div style="${css(s.topbar)}"><div style="${css(s.topbarTitle)}">${title}</div><div style="width:28px;height:28px;border-radius:50%;background:rgba(237,234,226,0.08);"></div></div>`
}

function shell(title, activeKey, bodyHtml) {
  return `<!doctype html><html lang="da"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>*{box-sizing:border-box} body{margin:0;}</style>
</head><body>
<div style="${css(s.wrap)}">
${sidebar(activeKey)}
<div style="${css(s.main)}">
${topbar(title)}
<div style="${css(s.page)}">${bodyHtml}</div>
</div>
</div>
<script>window.__harnessReady = true</script>
</body></html>`
}

// --- Harness 1: Atletliste (view === 'list', Dashboard.jsx linje ~4349-4543) --

function harnessAtletListe(athletes) {
  const cards = athletes.length === 0
    ? `<div style="${css(s.card)}text-align:center;color:#7a7770;font-family:'IBM Plex Sans',sans-serif;">Ingen atleter endnu. Tilføj din første atlet for at komme i gang.</div>`
    : `<div style="${css(s.grid)}">
        ${athletes.map(a => {
          const seen = formatLastSeen(a.last_seen)
          return `<div style="${css(s.athleteCard)}">
            <div style="${css(s.avatar)}">${initials(a.name)}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.95rem;color:#edeae2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.name}</div>
              <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.3rem;">
                <span style="${css(s.badge(a.status))}">${a.status}</span>
                ${seen ? `<span style="width:6px;height:6px;border-radius:50%;background:${seen.dotColor};flex-shrink:0;"></span><span style="font-family:'IBM Plex Mono',monospace;font-size:0.5rem;color:#7a7770;">${seen.text}</span>` : ''}
              </div>
            </div>
          </div>`
        }).join('')}
      </div>`
  return shell('Atleter', 'list', `<div style="${css(s.cardLabel)}margin-bottom:1rem;">${athletes.length} atleter</div>${cards}`)
}

// --- Harness 2: Én atlets uge / hub (Dashboard.jsx linje ~4689-4750) ----------

function harnessAtletensUge() {
  const stat = [
    { label: 'Parathed i dag', value: 78, sub: 'Kroppen er klar 💪', color: '#6cba6c' },
    { label: 'Træninger denne uge', value: 3, sub: '42 sæt', color: '#edeae2' },
    { label: 'Ulæste beskeder', value: 1, sub: 'fra atleten', color: '#c8923a' },
    { label: 'Til stævne', value: 6, sub: 'uger', color: '#c8923a' },
  ]
  const sections = [
    { label: 'Oversigt', desc: 'Maks, kropsvægt & status' },
    { label: 'Program', desc: 'Ugeplan & sessioner' },
    { label: 'Log', desc: 'Træningslog & historik' },
    { label: 'Analyse', desc: 'Grafer & belastning' },
    { label: 'Opvarmning', desc: 'Mobilitet & rutiner' },
    { label: 'Beskeder', desc: 'Chat med atleten' },
  ]
  const body = `
    <div style="${css(s.card)}display:grid;grid-template-columns:repeat(4, 1fr);gap:1rem;">
      ${stat.map((st, i) => `<div style="display:flex;flex-direction:column;gap:0.2rem;${i > 0 ? 'border-left:1px solid rgba(237,234,226,0.07);padding-left:1rem;' : ''}">
        <div style="${css(s.fieldLabel)}">${st.label}</div>
        <div style="display:flex;align-items:baseline;gap:0.4rem;">
          <span style="font-family:'Playfair Display',serif;font-size:1.6rem;color:${st.color};line-height:1;">${st.value}</span>
          <span style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;color:#7a7770;">${st.sub}</span>
        </div>
      </div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1rem;">
      ${sections.map(sec => `<button style="background:#1c1c18;border:1px solid rgba(237,234,226,0.07);text-align:left;padding:1.25rem;cursor:pointer;display:flex;flex-direction:column;gap:0.6rem;">
        <div style="font-family:'IBM Plex Sans',sans-serif;font-size:1rem;color:#edeae2;">${sec.label}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.55rem;color:#7a7770;line-height:1.4;">${sec.desc}</div>
      </button>`).join('')}
    </div>`
  return shell('Anna Berg', 'list', body)
}

// --- Harness 3: Check-in-gennemgang (oversigt-fanen, Dashboard.jsx ~5958-6008) -

function harnessCheckInGennemgang(hasCheckIn) {
  let card
  if (!hasCheckIn) {
    card = `<div style="${css(s.card)}color:#7a7770;font-family:'IBM Plex Sans',sans-serif;font-size:0.85rem;">Ingen check-in logget i dag endnu.</div>`
  } else {
    const todayR = { readiness_score: 62, sleep_hours: 6.5, energy: 3, motivation: 4, stress: 3, soreness_level: 2, sore_zones: ['Ben', 'Ryg'] }
    const sig = readinessSignal(todayR.readiness_score)
    const params = [['Søvn', `${todayR.sleep_hours}t`], ['Energi', `${todayR.energy}/5`], ['Motivation', `${todayR.motivation}/5`], ['Stress', `${todayR.stress}/5`], ['Ømhed', `${todayR.soreness_level}/5`]]
    card = `<div style="${css(s.card)}background:${sig.bg};">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
        <div style="display:flex;align-items:baseline;gap:0.9rem;">
          <div>
            <div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#4a4844;margin-bottom:0.3rem;">Parathed i dag</div>
            <div style="font-size:0.95rem;color:${sig.color};">${sig.text}</div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:1.6rem;font-weight:500;color:${sig.color};line-height:1;">${todayR.readiness_score}<span style="font-size:0.55rem;color:#4a4844;font-weight:400;margin-left:0.2rem;">/100</span></div>
        </div>
        <div style="display:flex;gap:1.1rem;flex-wrap:wrap;">
          ${params.map(([label, val]) => `<div style="text-align:center;"><div style="${css(s.fieldLabel)}">${label}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem;color:#edeae2;">${val}</div></div>`).join('')}
        </div>
      </div>
      <div style="margin-top:0.75rem;display:flex;align-items:baseline;gap:0.5rem;">
        <div style="${css(s.fieldLabel)}">Lokal ømhed</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.65rem;color:#7a7770;">${todayR.sore_zones.join(', ')}</div>
      </div>
    </div>`
  }
  const statsCard = `<div style="${css(s.card)}">
    <div style="${css(s.cardLabel)}">Resultater <button style="${css(s.btnEdit)}">Rediger</button></div>
    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:1px;background:rgba(237,234,226,0.07);">
      ${[['Squat', '145kg'], ['Bænkpres', '95kg'], ['Dødløft', '175kg']].map(([l, v]) => `<div style="background:#1c1c18;padding:1rem 0.75rem;"><div style="font-family:'Playfair Display',serif;font-size:1.4rem;color:#edeae2;">${v}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:0.52rem;letter-spacing:0.1em;text-transform:uppercase;color:#4a4844;margin-top:0.3rem;">${l}</div></div>`).join('')}
    </div>
  </div>`
  return shell('Anna Berg — oversigt', 'list', card + statsCard)
}

// --- Harness 4: Program-redigering, øvelsesformular med reps som interval
// (exFormRow, Dashboard.jsx linje ~3180-3294 + program-fanens ugekort) --------

function harnessProgramRedigering() {
  const exRow = (name, sets, reps, intensity) => `
    <div style="display:grid;grid-template-columns:2fr 0.5fr 0.7fr minmax(200px, 2fr) 1.5fr;gap:0.5rem;align-items:end;margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid rgba(237,234,226,0.05);">
      <div style="font-size:0.85rem;color:#edeae2;">${name}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem;color:#7a7770;">${sets}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem;color:#c8923a;">${reps}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:0.8rem;color:#7a7770;">${intensity}</div>
      <div></div>
    </div>`
  const form = `
    <div style="${css(s.fieldLabel)}margin-bottom:0.5rem;">Tilføj øvelse</div>
    <div style="display:grid;grid-template-columns:2fr 0.5fr 0.7fr minmax(200px, 2fr) 1.5fr;gap:0.5rem;align-items:end;">
      <div><div style="${css(s.fieldLabel)}">Navn</div><input style="${css(s.fieldInput)}font-size:0.8rem;padding:0.4rem 0.6rem;min-height:44px;box-sizing:border-box;" type="text" placeholder="Søg øvelse..."></div>
      <div><div style="${css(s.fieldLabel)}">Sæt</div><input style="${css(s.fieldInput)}font-size:0.8rem;padding:0.4rem 0.6rem;min-height:44px;box-sizing:border-box;" type="number" placeholder="Sæt"></div>
      <div><div style="${css(s.fieldLabel)}">Reps</div><input style="${css(s.fieldInput)}font-size:0.8rem;padding:0.4rem 0.6rem;min-height:44px;box-sizing:border-box;" type="text" placeholder="Reps (fx 6-8)" value="6-8"></div>
      <div><div style="${css(s.fieldLabel)}">Intensitet</div>
        <div style="display:flex;gap:0.25rem;">
          <select aria-label="Intensitetsenhed" style="${css(s.fieldInput)}font-size:0.72rem;padding:0.4rem 0.3rem;width:auto;flex-shrink:0;min-height:44px;box-sizing:border-box;"><option>RPE</option></select>
          <input style="${css(s.fieldInput)}font-size:0.8rem;padding:0.4rem 0.6rem;flex:1;min-height:44px;box-sizing:border-box;" type="number" placeholder="f.eks. 8">
        </div>
      </div>
      <div><div style="${css(s.fieldLabel)}">Note</div><input style="${css(s.fieldInput)}font-size:0.8rem;padding:0.4rem 0.6rem;min-height:44px;box-sizing:border-box;" type="text" placeholder="Note"></div>
    </div>`
  const body = `<div style="${css(s.cardLabel)}">Uge 6 · Session 2 — Bænkpres-dag</div>
    <div style="${css(s.card)}">
      ${exRow('Bænkpres', 4, '6-8', 'RPE 8')}
      ${exRow('Skråbænk med håndvægte', 3, '8-10', 'RPE 7')}
      ${exRow('Triceps pushdown', 3, '10-12', 'RPE 8')}
      ${form}
    </div>`
  return shell('Anna Berg — program', 'list', body)
}

// --- Harness 5: Coach Briefing / Indbakke (view === 'inbox', Dashboard.jsx
// linje ~3605-3777) -----------------------------------------------------------

function harnessCoachBriefing(hasItems) {
  if (!hasItems) {
    return shell('Indbakke', 'inbox', `<div style="${css(s.card)}text-align:center;color:#7a7770;font-family:'IBM Plex Sans',sans-serif;">Indbakken er tom. Intet kræver din opmærksomhed lige nu.</div>`)
  }
  const items = [
    { athlete: 'Anna Berg', track: 'Teknik', text: 'Ny video afventer review — squat, uge 6', unread: 1 },
    { athlete: 'Mikkel Holm', track: 'Besked', text: 'Skulderen føles stiv i dag, skal jeg justere?', unread: 2 },
    { athlete: 'Sara Lund', track: 'Teknik', text: 'Lav parathed 3 dage i træk', unread: 0 },
  ]
  const rows = items.map(it => `
    <div style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;border-bottom:1px solid rgba(237,234,226,0.05);cursor:pointer;">
      <div style="${css(s.avatar)}width:34px;height:34px;font-size:0.75rem;">${initials(it.athlete)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:0.5rem;"><span style="font-size:0.85rem;color:#edeae2;">${it.athlete}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:0.48rem;letter-spacing:0.08em;text-transform:uppercase;color:#7a7770;">${it.track}</span></div>
        <div style="font-family:'IBM Plex Sans',sans-serif;font-size:0.78rem;color:#7a7770;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${it.text}</div>
      </div>
      ${it.unread > 0 ? `<span style="background:#c8923a;color:#141410;border-radius:999px;font-size:0.55rem;padding:0.1rem 0.4rem;font-weight:600;flex-shrink:0;">${it.unread}</span>` : ''}
    </div>`).join('')
  const body = `<div style="${css(s.cardLabel)}">Kræver din opmærksomhed</div><div style="${css(s.card)}padding:0;">${rows}</div>`
  return shell('Indbakke', 'inbox', body)
}

// --- Harness 6: Videoer (analyse-fanen, Dashboard.jsx linje ~4855-4940) ------

function harnessVideoer(hasVideos) {
  if (!hasVideos) {
    return shell('Anna Berg — analyse', 'list', `<div style="${css(s.cardLabel)}">VideoCoach · individuelle bevægelsesanalyser</div><div style="${css(s.card)}text-align:center;color:#7a7770;font-family:'IBM Plex Sans',sans-serif;">Ingen analyser endnu for denne atlet.</div>`)
  }
  const rows = [
    { lift: 'Squat', variation: 'competition', status: 'draft', kg: 140, when: '10. sep' },
    { lift: 'Bænkpres', variation: 'pause', status: 'coach_approved', kg: 95, when: '8. sep' },
    { lift: 'Dødløft', variation: 'sumo', status: 'shared', kg: 175, when: '5. sep' },
  ]
  const rowsHtml = rows.map(r => {
    const st = VIDEOCOACH_STATUS[r.status]
    return `<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem 0;border-bottom:1px solid rgba(237,234,226,0.05);">
      <div style="flex:1;">
        <div style="font-size:0.85rem;color:#edeae2;">${r.lift} · ${r.variation}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:0.5rem;color:#7a7770;">${r.kg} kg · ${r.when}</div>
      </div>
      <span style="font-family:'IBM Plex Mono',monospace;font-size:0.5rem;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:0.2rem 0.5rem;background:${st.color}22;color:${st.color};">${st.label}</span>
      <button style="${css(s.btnGhost)}">Åbn</button>
    </div>`
  }).join('')
  const body = `<div style="${css(s.cardLabel)}">VideoCoach · individuelle bevægelsesanalyser <button style="${css(s.btnPrimary)}font-size:0.58rem;padding:0.45rem 0.8rem;min-height:44px;box-sizing:border-box;">+ Ny optagelse</button></div><div style="${css(s.card)}">${rowsHtml}</div>`
  return shell('Anna Berg — analyse', 'list', body)
}

// --- statisk server -----------------------------------------------------------

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }

const HARNESSES = {
  '/harness/atletliste.html': () => harnessAtletListe(MOCK_ATHLETES),
  '/harness/atletliste-tom.html': () => harnessAtletListe([]),
  '/harness/atletens-uge.html': harnessAtletensUge,
  '/harness/checkin-gennemgang.html': () => harnessCheckInGennemgang(true),
  '/harness/checkin-gennemgang-tom.html': () => harnessCheckInGennemgang(false),
  '/harness/program-redigering.html': harnessProgramRedigering,
  '/harness/coach-briefing.html': () => harnessCoachBriefing(true),
  '/harness/coach-briefing-tom.html': () => harnessCoachBriefing(false),
  '/harness/videoer.html': () => harnessVideoer(true),
  '/harness/videoer-tom.html': () => harnessVideoer(false),
}

function startServer() {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0])
    if (HARNESSES[urlPath]) {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end(HARNESSES[urlPath]())
      return
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

// --- skærme (ordrens liste + tomme-tilstand-varianter) ------------------------

const SCREENS = [
  { id: 'atletliste', label: 'Atletliste (12 attrap-atleter)', url: '/harness/atletliste.html', measureTTI: true },
  { id: 'atletliste-tom', label: 'Atletliste (tom tilstand)', url: '/harness/atletliste-tom.html' },
  { id: 'atletens-uge', label: 'Én atlets uge (hub)', url: '/harness/atletens-uge.html' },
  { id: 'checkin-gennemgang', label: 'Check-in-gennemgang', url: '/harness/checkin-gennemgang.html' },
  { id: 'checkin-gennemgang-tom', label: 'Check-in-gennemgang (tom tilstand)', url: '/harness/checkin-gennemgang-tom.html' },
  { id: 'program-redigering', label: 'Program-redigering (øvelsesformular, reps-interval)', url: '/harness/program-redigering.html' },
  { id: 'coach-briefing', label: 'Coach Briefing (indbakke)', url: '/harness/coach-briefing.html' },
  { id: 'coach-briefing-tom', label: 'Coach Briefing (tom tilstand)', url: '/harness/coach-briefing-tom.html' },
  { id: 'videoer', label: 'Videoer (VideoCoach-analyser)', url: '/harness/videoer.html' },
  { id: 'videoer-tom', label: 'Videoer (tom tilstand)', url: '/harness/videoer-tom.html' },
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

async function measureWeight(page, gotoUrl) {
  const responses = []
  const onResp = async (resp) => {
    try {
      const headers = resp.headers()
      let size = Number(headers['content-length'] || 0)
      if (!size) { try { const buf = await resp.body(); size = buf.length } catch { size = 0 } }
      responses.push({ url: resp.url(), type: resp.request().resourceType(), size })
    } catch { /* navigation kan afbryde sene svar */ }
  }
  page.on('response', onResp)
  await page.goto(gotoUrl, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(300)
  page.off('response', onResp)
  const totalKb = Math.round(responses.reduce((a, r) => a + r.size, 0) / 1024)
  return { totalKb, requestCount: responses.length }
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
    const nodes = [...document.querySelectorAll('button, a[href], input, select, [role="button"], [data-tap-target]')]
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

async function measureLighthouseDesktop(url, port, width, height) {
  const result = await lighthouse(url, {
    port, output: 'json', logLevel: 'error',
    onlyCategories: ['performance', 'accessibility'],
    formFactor: 'desktop',
    screenEmulation: { mobile: false, width, height, deviceScaleFactor: 1, disabled: false },
  })
  const cats = result.lhr.categories
  const score = (c) => (c ? Math.round(c.score * 100) : null)
  const ttiMs = result.lhr.audits?.interactive?.numericValue ?? null
  return { performance: score(cats.performance), accessibility: score(cats.accessibility), ttiMs: ttiMs != null ? Math.round(ttiMs) : null }
}

// --- ægte, uændrede Dashboard-chunk fra build-output --------------------------

function measureDashboardShellWeight() {
  const files = readdirSync(path.join(distDir, 'assets'))
  const dashboardFiles = files.filter(f => f.startsWith('Dashboard-') && f.endsWith('.js'))
  const kb = (f) => Math.round(statSync(path.join(distDir, 'assets', f)).size / 1024)
  return { files: dashboardFiles, totalKb: dashboardFiles.reduce((a, f) => a + kb(f), 0), perFile: dashboardFiles.map(f => `${f} (${kb(f)} KB)`) }
}

// --- markdown -------------------------------------------------------------------

function mdEscape(str) { return String(str ?? '').replace(/\|/g, '\\|') }

function buildTable(rows) {
  const header = ['Profil', 'Skærm', 'Perf', 'A11y', 'TTI (ms)', 'Sidevægt (KB)', 'Axe-fejl', 'Trykflader <44px', 'Vandret scroll', 'Tekst ud af boks']
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`]
  for (const r of rows) {
    lines.push(`| ${r.profile} | ${r.screen} | ${r.lh.performance} | ${r.lh.accessibility} | ${r.lh.ttiMs ?? '—'} | ${r.weight.totalKb} | ${r.axe.length} | ${r.tapTargets.length} | ${r.overflow ? 'JA' : 'nej'} | ${r.textOverflow.length ? r.textOverflow.length + ': ' + mdEscape(r.textOverflow.join('; ')) : '0'} |`)
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
    lines.push(`- **${key(a)}**: perf ${d(b.lh.performance, a.lh.performance)}, a11y ${d(b.lh.accessibility, a.lh.accessibility)}, TTI ${d(b.lh.ttiMs, a.lh.ttiMs)} ms, sidevægt ${d(b.weight.totalKb, a.weight.totalKb)} KB, axe-fejl ${d(b.axe.length, a.axe.length)}, trykflader<44px ${d(b.tapTargets.length, a.tapTargets.length)}`)
  }
  return lines.join('\n')
}

// --- main ------------------------------------------------------------------

async function main() {
  mkdirSync(outDir, { recursive: true })
  for (const p of PROFILES) mkdirSync(path.join(outDir, p.slug), { recursive: true })

  const isEfterRun = existsSync(path.join(outDir, 'FOER.md'))
  const shotPrefix = isEfterRun ? 'efter' : 'foer'

  console.log('Bygger appen (npm run build, fiktive Supabase-nøgler i proces-scope)...')
  const build = spawnSync('npm run build', {
    cwd: repoRoot, stdio: 'inherit', shell: true,
    env: { ...process.env, VITE_SUPABASE_URL: MOCK_SUPABASE_URL, VITE_SUPABASE_KEY: MOCK_SUPABASE_KEY },
  })
  if (build.status !== 0) { console.error('Build fejlede.'); process.exit(1) }

  const shellWeight = measureDashboardShellWeight()

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

        const weight = await measureWeight(page, `${origin}${screen.url}`)
        await page.waitForTimeout(300)
        const axe = await runAxe(page)
        const tapTargets = await scanTapTargets(page)
        const overflow = await scanOverflow(page)
        const textOverflow = await scanTextOverflow(page)

        const shotPath = path.join(outDir, profile.slug, `${shotPrefix}-${screen.id}.png`)
        await page.screenshot({ path: shotPath, fullPage: true })

        const lh = await measureLighthouseDesktop(`${origin}${screen.url}`, cdpPort, profile.viewport.width, profile.viewport.height)

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

  const ttiRow = rows.find(r => r.screen.includes('12 attrap-atleter'))

  const md = [
    `# ${isEfter ? 'Måling efter' : 'Måling før'} — coachens side (Ordre 130)`,
    '',
    `Målt ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, ${PROFILES.length} profiler × ${SCREENS.length} skærme, med attrap-data (ingen atletdata).`,
    '',
    `**Den ægte, uændrede Dashboard-chunk** (det coachen reelt henter, uanset hvilken fane der vises): ${shellWeight.totalKb} KB (${shellWeight.perFile.join(', ') || 'ingen Dashboard-*.js fundet i dist/assets'}).`,
    '',
    ttiRow ? `**Tid til interaktiv, atletliste (12 attrap-atleter):** ${ttiRow.lh.ttiMs ?? '—'} ms (Lighthouse "interactive"-audit, desktop-formfaktor).` : '',
    '',
    '_Ærlig grænse: de ti skærme er isolerede harnesses (ægte style-objekter og ægte, uændrede hjælpefunktioner kopieret fra src/Dashboard.jsx, attrap-data) — Dashboard.jsx kræver en levende Supabase-session for slet at boote. Deres "sidevægt"/Perf/TTI-tal er harness-isolerede, ikke den ægte Dashboard-bundtvægt/boot-tid (se chunk-tallet ovenfor). Harness-TTI måler kun den statiske HTML\'s egen (minimale) JS — IKKE Dashboard.jsx\'s reelle React-hydrering + Supabase-dataheentning, som er markant tungere; det reelle mål for "tid til interaktiv" er derfor chunk-vægten ovenfor plus de faktiske netværkskald, ikke dette tal alene._',
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
