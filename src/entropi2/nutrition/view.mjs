import { foodPortion, unitsForFood, mealKey } from './controller.mjs'
let mountSequence = 0

// Mount inside an assembly-owned host; load nutrition.css separately. No global DOM.
// The caller disposes/remounts on athlete/date change. No shared entry is changed.
export function mountNutrition(host, controller, { onCoach, onNavigate } = {}) {
  if (!controller) return () => {} // default OFF: do not even touch the host.
  const doc = host.ownerDocument
  const contentId = 'e2-nutrition-content-' + (++mountSequence)
  let sequence = 0, destroyed = false, manual = {}, selection = '0', amount = '100', unit = '0'
  const node = (tag, cls, text) => {
    const n = doc.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = String(text)
    return n
  }
  const append = (parent, tag, cls, text) => { const n = node(tag, cls, text); parent.append(n); return n }
  const button = (parent, text, fn, disabled = false) => {
    const b = append(parent, 'button', 'cta', text); b.type = 'button'; b.disabled = disabled
    b.addEventListener('click', fn); return b
  }
  const action = meal => controller.log(meal, 'nutrition-' + (++sequence))
  const field = (parent, label, value, change, type = 'text') => {
    const l = append(parent, 'label', '', label), input = append(l, 'input')
    input.type = type; input.value = value; input.required = true
    input.setAttribute('data-focus', 'field-' + label)
    if (type === 'text' && label !== 'Måltid') input.inputMode = 'decimal'
    input.addEventListener('input', e => change(e.target.value))
    return input
  }
  const draw = () => {
    if (destroyed) return
    const s = controller.snapshot()
    // Preserve focus on state updates; all user data enters the DOM as textContent.
    const focused = doc.activeElement?.getAttribute('data-focus')
    const openDetails = [...host.querySelectorAll('details')].filter(n => n.open).map(n => n.getAttribute('data-focus'))
    const app = node('div', 'e2-nutrition')
    const skip = append(app, 'a', 'skip', 'Gå til indhold')
    skip.setAttribute('href', '#' + contentId)
    const top = append(app, 'header', 'top')
    const brand = append(top, 'span', 'brand', 'Entropi')
    append(brand, 'span', 'edition', '02')
    const main = append(app, 'main')
    main.setAttribute('id', contentId); main.setAttribute('tabindex', '-1')
    const intro = append(main, 'div', 'intro')
    append(intro, 'p', 'eyebrow', 'Kost · ' + s.date)
    append(intro, 'h1', '', 'Dit næste måltid')
    append(intro, 'p', 'muted', 'En enkel dagbog. Mål kræver en aftalt plan.')
    const hero = append(main, 'section', 'card hero')
    append(hero, 'p', 'eyebrow', 'Din måltidsplan')
    append(hero, 'h2', '', 'Ingen måltidsplan tilgængelig')
    append(hero, 'p', 'muted space', 'Se dine registreringer nedenfor, eller tal med din coach om en plan.')
    append(main, 'h2', 'section-head', 'Dagens dagbog')
    const status = append(main, 'p', 'space', s.message)
    status.setAttribute('role', s.phase.endsWith('error') ? 'alert' : 'status')
    status.setAttribute('aria-live', 'polite')
    main.setAttribute('aria-busy', String(s.pending || s.phase === 'loading'))
    if (s.phase === 'idle' || s.phase === 'loading') append(main, 'p', 'muted', 'Indlæser kostloggen…')
    if (s.phase === 'load-error') button(main, 'Hent kostloggen igen', () => controller.load())
    if (s.loaded) {
      const ul = append(main, 'ul', 'list')
      if (!s.logs.length) append(ul, 'li', 'muted', 'Ingen måltider registreret i dag.')
      for (const row of s.logs) {
        const li = append(ul, 'li')
        append(li, 'strong', '', typeof row.meal === 'string' ? row.meal : 'Ugyldigt måltid')
        append(li, 'small', '', s.invalid ? 'Næringsdata skal kontrolleres.' : `${row.kcal} kcal · ${row.protein} g protein`)
      }
      const goals = append(main, 'section', 'card')
      append(goals, 'p', 'eyebrow', 'Dagens registreringer og mål')
      append(goals, 'h2', '', s.invalid ? 'Næringsdata skal kontrolleres' : s.logs.length ? 'Registreret indtag' : 'Ingen vurdering endnu')
      for (const [key, label, unitName] of [['kcal', 'Energi', 'kcal'], ['protein', 'Protein', 'g']]) {
        const target = s.targets[key] > 0 ? s.targets[key] : null
        append(goals, 'p', 'muted space', label + ': ' + (s.totals ? `${s.totals[key]} ${unitName}` : 'ukendt')
          + (target ? ` · aftalt mål ${target} ${unitName}` : ' · intet aftalt mål'))
        if (target && s.totals && s.logs.length) {
          const progress = append(goals, 'progress'); progress.max = target; progress.value = Math.min(target, s.totals[key])
          progress.setAttribute('aria-label', label + ', registreret i forhold til aftalt mål')
        }
      }
      append(goals, 'p', 'small muted space', 'Registreringer viser ikke nødvendigvis hele dagens indtag. Ingen samlet kostvurdering.')
      if (typeof onCoach === 'function') button(goals, 'Tal med din coach', onCoach)
      const quick = (title, items, prefix) => {
        const section = append(main, 'section', 'card'); append(section, 'h2', '', title)
        if (!items.length) append(section, 'p', 'muted space', 'Ingen måltider endnu.')
        items.forEach((meal, i) => {
          const row = append(section, 'div', 'space stack')
          const b = button(row, 'Log ' + meal.meal, () => action(meal), s.pending)
          b.setAttribute('data-focus', prefix + '-log-' + i)
          const f = button(row, s.favoriteKeys.includes(mealKey(meal)) ? 'Fjern favorit: ' + meal.meal : 'Gem favorit: ' + meal.meal, () => controller.toggleFavorite(meal), s.pending)
          f.setAttribute('aria-pressed', String(s.favoriteKeys.includes(mealKey(meal))))
          f.setAttribute('data-focus', prefix + '-favorite-' + i)
        })
      }
      quick('Favoritter', s.favorites, 'fav'); quick('Seneste måltider', s.recent, 'recent')
      if (s.favoriteError) { const p = append(main, 'p', 'space', s.favoriteError); p.setAttribute('role', 'alert') }
      const details = append(main, 'details', 'card'); details.setAttribute('data-focus', 'log-form')
      append(details, 'summary', '', 'Notér et måltid')
      const inner = append(details, 'div')
      const form = append(inner, 'form', 'stack')
      field(form, 'Måltid', manual.meal || '', v => { manual.meal = v })
      for (const [k, l] of [['kcal', 'Energi (kcal)'], ['protein', 'Protein (g)'], ['carb', 'Kulhydrat (g)'], ['fat', 'Fedt (g)']]) {
        field(form, l, manual[k] ?? '', v => { manual[k] = v })
      }
      append(form, 'p', 'small muted', 'Angiv kendte værdier. Brug 0 kun når værdien er kendt som nul.')
      const save = button(form, s.pending ? 'Gemmer…' : 'Gem måltid', () => {}, s.pending); save.type = 'submit'; save.setAttribute('data-focus', 'save')
      form.addEventListener('submit', async e => {
        e.preventDefault()
        if (await action({ ...manual })) { manual = {}; draw() }
      })
      if (s.foods.length) {
        const foodForm = append(inner, 'form', 'stack space')
        const foodLabel = append(foodForm, 'label', '', 'Fødevare')
        const select = append(foodLabel, 'select'); select.value = selection
        select.setAttribute('data-focus', 'food-choice')
        s.foods.forEach((f, i) => { const opt = append(select, 'option', '', f.name); opt.value = String(i) })
        select.value = selection
        select.addEventListener('change', e => { selection = e.target.value; unit = '0'; draw() })
        const food = s.foods[Number(selection)]
        field(foodForm, 'Mængde', amount, v => { amount = v })
        const unitLabel = append(foodForm, 'label', '', 'Enhed'), unitSelect = append(unitLabel, 'select')
        unitSelect.setAttribute('data-focus', 'unit-choice')
        unitsForFood(food).forEach((u, i) => { const opt = append(unitSelect, 'option', '', u.label); opt.value = String(i) })
        unitSelect.value = unit; unitSelect.addEventListener('change', e => { unit = e.target.value })
        const add = button(foodForm, 'Log portion', () => {}, s.pending); add.type = 'submit'
        foodForm.addEventListener('submit', e => { e.preventDefault(); action(foodPortion(food, amount, Number(unit))) })
      }
      const hb = button(main, 'Se historik', () => controller.toggleHistory(), s.pending)
      hb.setAttribute('aria-expanded', String(s.history)); hb.setAttribute('data-focus', 'history')
      if (s.history) {
        const section = append(main, 'section', 'card'); append(section, 'h2', '', 'Historik · seneste 30 dage')
        if (!s.historyRows.length) append(section, 'p', 'muted', 'Ingen registreringer i perioden.')
        const list = append(section, 'ul', 'list')
        s.historyRows.forEach(row => append(list, 'li', '', `${row.date} · ${typeof row.meal === 'string' ? row.meal : 'Ugyldigt måltid'}`))
      }
    }
    if (typeof onNavigate === 'function') {
      const nav = append(app, 'nav', 'nav'); nav.setAttribute('aria-label', 'Atlet')
      for (const [text, route] of [['Hjem', 'hjem'], ['Analyse', 'analyse'], ['Beskeder', 'beskeder']]) button(nav, text, () => onNavigate(route))
    }
    host.replaceChildren(app)
    for (const n of host.querySelectorAll('[data-focus]')) {
      const key = n.getAttribute('data-focus')
      if (n.tagName.toLowerCase() === 'details' && openDetails.includes(key)) n.open = true
      if (key === focused) n.focus()
    }
  }
  const unsubscribe = controller.subscribe(draw)
  draw()
  controller.load()
  return () => { destroyed = true; unsubscribe(); controller.dispose(); host.replaceChildren() }
}
