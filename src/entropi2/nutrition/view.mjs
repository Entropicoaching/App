import { foodPortion, unitsForFood, mealKey } from './controller.mjs'
import { startAdvice, weightSummary, displayNumber, remainingToday } from './startModel.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
let mountSequence = 0

// Mount inside an assembly-owned host; load nutrition.css separately. No global DOM.
// The caller disposes/remounts on athlete/date change. No shared entry is changed.
export function mountNutrition(host, controller, { onCoach, onNavigate, ...weightProps } = {}) {
  if (!controller) return () => {} // default OFF: do not even touch the host.
  const doc = host.ownerDocument
  const contentId = 'e2-nutrition-content-' + (++mountSequence)
  let sequence = 0, destroyed = false, manual = {}, selection = '0', amount = '100', unit = '0'
  let weightPending = false, weightError = ''
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
    const main = append(app, 'main')
    main.setAttribute('id', contentId); main.setAttribute('tabindex', '-1')
    const weighing = append(main, 'section', 'card')
    append(weighing, 'h2', '', 'Din vægt')
    const summary = weightSummary(weightProps.weightLogs, s.athleteId, s.date)
    append(weighing, 'p', 'muted space', summary.latest
      ? `Seneste vægt: ${displayNumber(summary.latest.weight)} kg · ${summary.latest.date}` : 'Ingen vejninger endnu')
    append(weighing, 'p', 'muted', summary.average !== null
      ? `Ugegennemsnit: ${displayNumber(summary.average)} kg · ${summary.days} vejedage (seneste 7 dage)`
      : 'Ingen vejninger de seneste 7 dage')
    if (summary.comparison !== null) append(weighing, 'p', 'muted', summary.comparison)
    const weightConnected = typeof weightProps.logWeight === 'function' && typeof weightProps.onWeightInput === 'function'
    if (weightConnected) {
      const form = append(weighing, 'form', 'stack space')
      const input = field(form, 'Vægt (kg)', weightProps.weightInput ?? '', value => {
        weightProps = { ...weightProps, weightInput: value }
        weightProps.onWeightInput(value)
      })
      input.disabled = weightPending || weightProps.savingWeight === true
      const save = button(form, input.disabled ? 'Gemmer vægt…' : 'Gem vægt', () => {}, input.disabled)
      save.type = 'submit'; save.setAttribute('data-focus', 'save-weight')
      form.addEventListener('submit', async e => {
        e.preventDefault()
        if (destroyed || weightPending || weightProps.savingWeight === true) return
        const value = parseInputNumber(weightProps.weightInput)
        if (!(value > 0)) { weightError = 'Angiv en gyldig vægt over 0 kg.'; draw(); return }
        weightPending = true; weightError = ''; draw()
        try {
          // Existing logWeight is zero-argument and returns void, even on failure.
          // The owner controls feedback, input clearing and refreshed weight rows.
          await weightProps.logWeight()
        } catch { weightError = 'Vægten blev ikke gemt. Prøv igen.' }
        finally { weightPending = false; draw() }
      })
    } else append(weighing, 'p', 'muted space', 'Vejning er ikke tilsluttet endnu.')
    if (weightError) { const p = append(weighing, 'p', 'space', weightError); p.setAttribute('role', 'alert') }
    const intro = append(main, 'div', 'intro')
    append(intro, 'p', 'eyebrow', 'Kost · ' + s.date)
    append(intro, 'h1', '', 'Dit næste måltid')
    append(intro, 'p', 'muted', 'Brug dine mål uden at logge. Dagbogen er valgfri.')
    const hero = append(main, 'section', 'card hero')
    append(hero, 'h2', '', 'Dagens mål')
    const advice = startAdvice(s.targets)
    if (!advice.kcal && !advice.protein) append(hero, 'p', 'space', 'Ingen mål endnu')
    else {
      append(hero, 'p', 'space', advice.kcal ? `Energi: ${displayNumber(advice.kcal)} kcal` : 'Energi: Ingen mål endnu')
      append(hero, 'p', 'space', advice.protein ? `Protein: ${displayNumber(advice.protein)} g` : 'Protein: Ingen mål endnu')
      const tips = append(hero, 'ul', 'list')
      advice.tips.forEach(tip => append(tips, 'li', '', tip))
    }
    if (!advice.kcal || !advice.protein) append(hero, 'p', 'muted space', 'Tal med din coach om at aftale de manglende kostmål.')
    if (typeof onCoach === 'function') button(hero, 'Tal med din coach', onCoach)
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
          + (target ? ` · aftalt mål ${target} ${unitName}` : ' · Ingen mål endnu'))
        if (target && s.totals && s.logs.length) {
          const progress = append(goals, 'progress'); progress.max = target; progress.value = Math.min(target, s.totals[key])
          progress.setAttribute('aria-label', label + ', registreret i forhold til aftalt mål')
        }
      }
      const remaining = remainingToday(s.totals, s.targets)
      if (remaining) {
        const parts = []
        if (remaining.kcal !== null) parts.push(remaining.kcal === 0 ? 'Energi nået' : `${displayNumber(remaining.kcal)} kcal`)
        if (remaining.protein !== null) parts.push(remaining.protein === 0 ? 'Protein nået' : `${displayNumber(remaining.protein)} g protein`)
        append(goals, 'p', 'muted space', 'Tilbage i dag: ' + parts.join(' · '))
      }
      append(goals, 'p', 'small muted space', 'Registreringer viser ikke nødvendigvis hele dagens indtag. Ingen samlet kostvurdering.')
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
  const cleanup = () => { destroyed = true; unsubscribe(); controller.dispose(); host.replaceChildren() }
  // Update weight props without remounting the diary or losing a meal draft.
  cleanup.updateWeight = props => {
    if (destroyed) return
    weightProps = { ...weightProps, ...props }; draw()
  }
  return cleanup
}
