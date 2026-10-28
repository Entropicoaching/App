import assert from 'node:assert/strict'

// Explicit fixture expectations, independent of the candidate table.
export const routes = {
  'atlet-hjem': { clicks: [], title: 'Næste træning' },
  'atlet-program': { clicks: ['Mere', 'Mit program', 'Næste uge →'], title: 'Uge 6 · 2.11.2026 - 8.11.2026· planlagt', checks: ['↩ Tilbage til denne uge'] },
  'atlet-mobilitet': { clicks: ['Mere', 'Mobilitet', '✦MobilitetByg en session og tag den, når du er stram›', 'Squat', 'Mere dybde'], title: 'Giv dit løft mere plads', checks: ['Mere dybde'] },
  'atlet-fremgang': { clicks: ['Fremgang', 'Styrke', 'Rekorder', 'Se alle detaljer'], title: 'Fremgang', checks: ['Rekorder', 'Dine rekorder'] },
  'atlet-profil': { clicks: ['Konto'], title: 'Næste træning', checks: ['Se guiden igen', 'Log ud'] },
  "videocoach-tidsmarkeringer": {"clicks": ["Kontakt", "Teknik & løft", "Se feedback", "Åbn syntetiske tidsmarkeringer", "4.0 s: Se coachens tegnede linje ved bunden."], "title": "4.0 s / 8 s", "checks": ["Se coachens tegnede linje ved bunden."]},
  "atlet-mobilitetsbibliotek": {"clicks": ["Mere", "Mobilitet", "✦MobilitetByg en session og tag den, når du er stram›", "Se øvelsesbibliotek"], "title": "Øvelsesbibliotek", "checks": ["Dybde", "Hofteposition"]},
  "atlet-hjemmerutine": {"clicks": ["Mere", "Mobilitet", "✦MobilitetByg en session og tag den, når du er stram›", "Squat", "Mere dybde", "Start min rutine"], "title": "Giv dit løft mere plads", "checks": ["Næste øvelse", "Ret mit fokus"]},
  "atlet-blok-mod-blok": {"clicks": ["Fremgang", "Styrke", "Se alle detaljer"], "title": "Denne blok mod forrige blok", "checks": ["Denne blok: Styrke, uge 4 til 6. Indtil 2026-10-28. Forrige blok: Grundlag, uge 1 til 3."]},
  "atlet-gentagelsesrekorder": {"clicks": ["Fremgang", "Styrke", "Rekorder", "Se alle detaljer"], "title": "Rekorder pr. antal gentagelser", "checks": ["Bedste loggede vægt ved præcis 1, 3, 5 og 8 gentagelser. Alle gennemførte sæt tæller."]},
  "coach-oprydning": {"clicks": ["Menu", "Mere"], "title": "Arbejdsindbakke.", "checks": ["Min træning", "VideoCoach"]},
  "coach-staevnekalender": {"clicks": ["Menu", "Kalender"], "title": "Stævnedatoer", "checks": ["Testatlet · Stævne"]},
  'coach-dagsliste': { clicks: [], title: 'Arbejdsindbakke.', checks: ['TTestatletUge 5'] },
  'coach-atletprofil': { clicks: ['TTestatletUge 5'], title: 'Testatlet' },
  'coach-analyse': { clicks: ['TTestatletUge 5', 'Mere▾', '📈Analyse'], title: 'Konklusion', checks: ['Se grundlaget'] },
  'coach-videokoe': { clicks: ['Arbejdsindbakke'], title: 'Arbejdsindbakke.', checks: ['Vigtigst nu'] },
}
export function fakePage(id, { wrongTitle = false, missingCheck = false, failClick = -1 } = {}) {
  const fixture = routes[id]
  let position = 0, finds = 0
  const calls = [], files = []
  return {
    calls, files,
    async open(url) { assert.equal(new URL(url).searchParams.get('screen'), id); calls.push('open') },
    async closeList() { calls.push('closeList') },
    async ready() { calls.push('ready') },
    async click(query) {
      assert.ok(new RegExp(query.name, 'u').test(fixture.clicks[position]), `Klik ${position}: ${query.name}`)
      if (position === failClick) throw new Error('Syntetisk klikfejl')
      position++; calls.push('click')
    },
    async find(query) {
      assert.equal(position, fixture.clicks.length, 'Hele klikvejen skal gennemføres')
      if (!finds++) return { name: wrongTitle ? 'Forkert side' : fixture.title }
      if (missingCheck) return false
      const name = fixture.checks[finds - 2]
      assert.ok(new RegExp(query.name, 'u').test(name), `Tilstand: ${query.name} / ${name}`)
      return { name }
    },
    async settle() { calls.push('settle') },
    async shot(file) { calls.push('shot'); files.push(file) },
  }
}

// Small DOM with real parent/descendant relations, visibility and events.
export function element(tag, content = '', attrs = {}, children = []) {
  const node = { tagName: tag.toUpperCase(), attrs, children, parentElement: null, open: !!attrs.open,
    hidden: !!attrs.hidden, disabled: !!attrs.disabled, clicks: 0,
    get textContent() { return content + children.map(child => child.textContent).join('') },
    getAttribute(name) { return attrs[name] ?? null },
    getClientRects() { return attrs.noRect ? [] : [{}] },
    contains(other) { return this === other || children.some(child => child.contains(other)) },
    querySelectorAll(selector) {
      const parts = selector.split(',')
      const match = el => parts.some(part => part === '*' || part.toUpperCase() === el.tagName ||
        (!!/^\[role="(.+)"\]$/.exec(part) && /^\[role="(.+)"\]$/.exec(part)[1] === el.attrs.role))
      return children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(match)
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null },
    closest(selector) { if (this.tagName.toLowerCase() === selector) return this; return this.parentElement?.closest(selector) || null },
    click() { this.clicks++; attrs.onClick?.() },
  }
  children.forEach(child => { child.parentElement = node })
  return node
}
export function withDom(root, run) {
  const previousDocument = globalThis.document, previousStyle = globalThis.getComputedStyle
  globalThis.document = { getElementById: () => root }
  globalThis.getComputedStyle = node => ({ display: 'block', visibility: 'visible', opacity: '1', ...node.attrs.style })
  try { return run() } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousStyle === undefined) delete globalThis.getComputedStyle; else globalThis.getComputedStyle = previousStyle
  }
}
