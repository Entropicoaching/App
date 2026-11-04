import { mountUgeplan } from './ugeplan/mount.mjs'
import { unitsForFood, mealKey } from './controller.mjs'
import { startAdvice, weightSummary, displayNumber, remainingToday } from './startModel.mjs'
import { historyDays } from './historyDays.mjs'
import { weekText } from './weekText.mjs'
import { weeklyTrend } from './weeklyTrend.mjs'
import { mealProtein, eveningProtein } from './dailyProtein.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
let mountSequence = 0

// Mount inside an assembly-owned host; load nutrition.css separately. No global DOM.
// The caller disposes/remounts on athlete/date change. No shared entry is changed.
export function mountNutrition(host, controller, { onCoach, onNavigate, clock = () => new Date(), mountWeekPlan = mountUgeplan, ...weightProps } = {}) {
  if (!controller) return () => {} // default OFF: do not even touch the host.
  const doc = host.ownerDocument
  const contentId = 'e2-nutrition-content-' + (++mountSequence)
  let sequence = 0, destroyed = false, manual = {}, selection = '0', amount = '100', unit = '0'
  amount = String(controller.foodAmount(0))
  let weightPending = false, weightError = ''
  let planHost, planKey, currentPlanFold, disposePlan = () => {}, planMounted = false
  const clearPlan = () => {
    disposePlan(); disposePlan = () => {}; planHost = undefined; planKey = undefined
    currentPlanFold = undefined; planMounted = false
  }
  let editing = null, removing = null, ownMealName = ''
  const intent = () => 'nutrition-' + (++sequence)
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
  const action = meal => controller.log(meal, intent())
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
    if (s.loaded) {
      const fast = append(main, 'section', 'card'); fast.setAttribute('data-kost-del', 'hurtig')
      append(fast, 'h2', '', 'Log hurtigt')
      const templateState = s.mealTemplates
      const yesterdayMeals = s.yesterday
      if (yesterdayMeals.length) {
        const section = append(fast, 'section', 'space'); append(section, 'h2', '', 'Gentag i går')
        yesterdayMeals.forEach((meal, i) => {
          const row = append(section, 'div', 'space stack')
          const b = button(row, 'Log igen: ' + meal.meal, () => action(meal), s.pending)
          b.setAttribute('data-focus', 'yesterday-log-' + i)
        })
      }
      const quickKeys = new Set(yesterdayMeals.map(mealKey))
      const quick = (title, items, prefix) => {
        items = items.slice(0, 5)
        if (!items.length) return
        const section = append(fast, 'section', 'space'); append(section, 'h2', '', title)
        items.forEach((meal, i) => {
          quickKeys.add(mealKey(meal))
          const row = append(section, 'div', 'space stack')
          const b = button(row, (prefix === 'recent' ? 'Gentag dette måltid: ' : 'Log ') + meal.meal, () => action(meal), s.pending)
          b.setAttribute('data-focus', prefix + '-log-' + i)
        })
      }
      const favoriteKeys = new Set(s.favorites.map(mealKey))
      // Yesterday already supplies a log button for these exact meal identities.
      const yesterdayKeys = new Set(s.yesterday.map(mealKey))
      quick('Favoritter', s.favorites.filter(meal => !yesterdayKeys.has(mealKey(meal))), 'fav')
      quick('Seneste måltider', s.recent.filter(meal => !favoriteKeys.has(mealKey(meal)) && !yesterdayKeys.has(mealKey(meal))), 'recent')
      const availableTemplates = (templateState?.templates || []).filter(item => !quickKeys.has(mealKey(item.meal)))
      const templates = node('details', 'space')
      templates.setAttribute('data-focus', 'templates')
      const templateSummary = append(templates, 'summary')
      append(templateSummary, 'h2', '', 'Skabeloner')
      for (const [i, item] of availableTemplates.entries()) {
        const b = button(templates, 'Log skabelon: ' + item.name, () => controller.logTemplate(item.id, intent()), s.pending)
        b.setAttribute('data-focus', 'template-log-' + i)
      }
      if (templateState?.suggestions.length) {
        const suggestions = append(templates, 'details', 'space')
        suggestions.setAttribute('data-focus', 'template-suggestions')
        append(suggestions, 'summary', '', 'Forslag fra ofte loggede måltider')
        for (const [i, item] of templateState.suggestions.entries()) {
          const b = button(suggestions, 'Gem skabelon: ' + item.name, () => controller.acceptTemplate(item.id), s.pending)
          b.setAttribute('data-focus', 'template-accept-' + i)
        }
      }
      if (templateState?.error) { const p = append(fast, 'p', 'space', templateState.error); p.setAttribute('role', 'alert') }
      const details = append(fast, 'details', 'space'); details.setAttribute('data-focus', 'log-form')
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
        select.addEventListener('change', e => { selection = e.target.value; unit = '0'; amount = String(controller.foodAmount(Number(selection))); draw() })
        const food = s.foods[Number(selection)]
        field(foodForm, 'Mængde', amount, v => { amount = v })
        const unitLabel = append(foodForm, 'label', '', 'Enhed'), unitSelect = append(unitLabel, 'select')
        unitSelect.setAttribute('data-focus', 'unit-choice')
        unitsForFood(food).forEach((u, i) => { const opt = append(unitSelect, 'option', '', u.label); opt.value = String(i) })
        unitSelect.value = unit; unitSelect.addEventListener('change', e => { unit = e.target.value; draw() })
        const steps = append(foodForm, 'div', 'gram-steps')
        steps.setAttribute('role', 'group'); steps.setAttribute('aria-label', 'Justér mængde i gram')
        for (const step of [10, 50, 100]) for (const delta of [-step, step]) {
          const b = button(steps, (delta > 0 ? '+' : '−') + step + ' g', () => {
            if (destroyed || controller.snapshot().pending) return
            const n = parseInputNumber(amount), u = unitsForFood(food)[Number(unit)]
            if (!(n > 0) || !u) return
            const grams = Math.max(1, Math.round((n * u.grams + delta) * 1000) / 1000)
            if (!Number.isFinite(grams)) return
            amount = String(grams); unit = '0'; draw()
          }, s.pending)
          b.setAttribute('data-focus', 'gram-step-' + delta)
          b.setAttribute('aria-label', (delta > 0 ? 'Tilføj ' : 'Træk ') + step + ' gram' + (delta < 0 ? ' fra' : ''))
        }
        append(foodForm, 'p', 'small muted', 'Gramknapperne justerer mængden. Log portion gemmer måltidet.')
        if (s.portionError) { const p = append(foodForm, 'p', 'small', s.portionError); p.setAttribute('role', 'alert') }
        const add = button(foodForm, 'Log portion', () => {}, s.pending); add.type = 'submit'
        foodForm.addEventListener('submit', e => { e.preventDefault(); return controller.logFood(Number(selection), amount, Number(unit), intent()) })
      }
      if (availableTemplates.length || templateState?.suggestions.length) fast.append(templates)
    }
    const weighing = append(main, 'section', 'card'); weighing.setAttribute('data-kost-del', 'vaegt')
    append(weighing, 'h2', '', 'Din vægt')
    const summary = weightSummary(weightProps.weightLogs, s.athleteId, s.date)
    // Marc 3. nov.: dansk dato i stedet for ISO, og kun én tom-tekst, når der ingen vejninger er.
    const dag = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'][Number(m[2]) - 1]}` : String(iso) }
    append(weighing, 'p', 'muted space', summary.latest
      ? `Seneste vægt: ${displayNumber(summary.latest.weight)} kg · ${dag(summary.latest.date)}` : 'Ingen vejninger endnu')
    if (summary.latest) append(weighing, 'p', 'muted', summary.average !== null
      ? `Ugegennemsnit: ${displayNumber(summary.average)} kg · ${summary.days} ${summary.days === 1 ? 'vejedag' : 'vejedage'} (seneste 7 dage)`
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
    const intro = append(main, 'div', 'intro'); intro.setAttribute('data-kost-del', 'intro')
    // Marc 3. nov.: datoen staar allerede i topbjaelken.
    append(intro, 'p', 'eyebrow', 'Kost i dag')
    append(intro, 'h1', '', 'Dit næste måltid')
    append(intro, 'p', 'muted', 'Brug dine mål uden at logge. Dagbogen er valgfri.')
    const hero = append(main, 'section', 'card hero'); hero.setAttribute('data-kost-del', 'maal')
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
      // Marc 3. nov.: uden maaltider stod "Ingen maaltider registreret i dag." to gange;
      // fordelingen vises kun, naar der er noget at fordele (dagbogen siger det tomme).
      if (s.logs.length) {
        const distribution = append(main, 'section', 'space')
        append(distribution, 'h3', '', 'Protein pr. måltid')
        const list = append(distribution, 'ul', 'list')
        for (const meal of mealProtein(s.logs)) append(list, 'li', '', meal.meal + ': '
          + (meal.protein === null ? 'ukendt protein' : `${displayNumber(meal.protein)} g protein`))
      }
      const ul = append(main, 'ul', 'list')
      if (s.needsRefresh) {
        append(main, 'p', 'muted', 'Hent dagbogen igen for at kunne rette eller fjerne det nye måltid.')
        button(main, 'Hent dagbogen igen', () => controller.load(), s.pending)
      }
      if (!s.logs.length) append(ul, 'li', 'muted', 'Ingen måltider registreret i dag.')
      for (const [index, row] of s.logs.entries()) {
        const li = append(ul, 'li')
        const partLabel = append(li, 'label', 'meal-part')
        const part = append(partLabel, 'input')
        part.type = 'checkbox'; part.checked = s.selectedParts.includes(index); part.disabled = s.pending
        part.setAttribute('aria-label', 'Vælg del ' + (index + 1) + ': ' + row.meal)
        part.setAttribute('data-focus', 'meal-part-' + index)
        part.addEventListener('change', () => controller.toggleMealPart(index))
        append(partLabel, 'span', '', 'Vælg til eget måltid')
        append(li, 'strong', '', typeof row.meal === 'string' ? row.meal : 'Ugyldigt måltid')
        append(li, 'small', '', s.invalid ? 'Næringsdata skal kontrolleres.' : `${row.kcal} kcal · ${row.protein} g protein`)
        if (s.editableIds?.includes(row.id)) {
          const edit = button(li, 'Ret måltid: ' + row.meal, () => {
            if (destroyed || controller.snapshot().pending) return
            editing = { id: row.id, intent: intent(), meal: row.meal,
              ...Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(k => [k, row[k] ?? ''])) }
            removing = null; draw()
            Array.from(host.querySelectorAll('input')).find(n => n.getAttribute('data-focus') === 'edit-Måltid')?.focus()
          }, s.pending)
          edit.setAttribute('data-focus', 'edit-' + row.id)
        }
        if (s.removableIds?.includes(row.id)) {
          const remove = button(li, 'Fjern måltid: ' + row.meal, () => {
            if (destroyed || controller.snapshot().pending) return
            removing = { id: row.id, intent: intent() }; editing = null; draw()
            Array.from(host.querySelectorAll('button')).find(n => n.getAttribute('data-focus') === 'cancel-remove')?.focus()
          }, s.pending)
          remove.setAttribute('data-focus', 'remove-' + row.id)
        }
        if (editing?.id === row.id && s.editableIds?.includes(row.id)) {
          const draft = editing, form = append(li, 'form', 'stack space')
          form.setAttribute('aria-label', 'Ret måltid: ' + row.meal)
          for (const [k, label] of [['meal', 'Måltid'], ['kcal', 'Energi (kcal)'], ['protein', 'Protein (g)'], ['carb', 'Kulhydrat (g)'], ['fat', 'Fedt (g)']]) {
            const input = field(form, label, draft[k], v => { draft[k] = v })
            input.setAttribute('data-focus', 'edit-' + label); input.disabled = s.pending
          }
          append(form, 'p', 'small muted', 'Angiv kendte værdier. Brug 0 kun når værdien er kendt som nul.')
          const save = button(form, 'Gem ændring', () => {}, s.pending); save.type = 'submit'
          save.setAttribute('data-focus', 'save-edit')
          button(form, 'Annuller rettelse', () => { editing = null; draw() }, s.pending)
          form.addEventListener('submit', async e => {
            e.preventDefault()
            if (destroyed || editing !== draft) return
            if (await controller.update(draft.id, { ...draft }, draft.intent)) {
              editing = null; draw()
              Array.from(host.querySelectorAll('button')).find(n => n.getAttribute('data-focus') === 'edit-' + row.id)?.focus()
            }
          })
        }
        if (removing?.id === row.id && s.removableIds?.includes(row.id)) {
          const confirmation = removing, group = append(li, 'div', 'stack space')
          append(group, 'p', '', 'Vil du fjerne måltidet ' + row.meal + '?')
          button(group, 'Ja, fjern måltid', async () => {
            if (destroyed || removing !== confirmation) return
            if (await controller.remove(row.id, confirmation.intent, true)) { removing = null; draw() }
          }, s.pending)
          const cancel = button(group, 'Behold måltid', () => {
            removing = null; draw()
            Array.from(host.querySelectorAll('button')).find(n => n.getAttribute('data-focus') === 'remove-' + row.id)?.focus()
          }, s.pending)
          cancel.setAttribute('data-focus', 'cancel-remove')
        }
      }
      if (s.logs.length >= 2) {
        const own = append(main, 'form', 'card stack')
        own.setAttribute('aria-label', 'Gem eget måltid')
        append(own, 'h2', '', 'Gem eget måltid')
        append(own, 'p', 'muted', 'Vælg mindst to af dagens måltider og gem dem samlet i Favoritter.')
        append(own, 'p', '', s.selectedParts.length + ' dele valgt')
        const name = field(own, 'Navn på eget måltid', ownMealName, v => { ownMealName = v })
        name.inputMode = 'text'; name.maxLength = 60; name.disabled = s.pending
        const save = button(own, 'Gem i Favoritter', () => {}, s.pending || s.selectedParts.length < 2)
        save.type = 'submit'; save.setAttribute('data-focus', 'save-own-meal')
        if (s.favoriteError) { const p = append(own, 'p', 'space', s.favoriteError); p.setAttribute('role', 'alert') }
        own.addEventListener('submit', e => {
          e.preventDefault()
          if (destroyed) return
          controller.saveOwnMeal(ownMealName)
        })
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
        if (remaining.kcal !== null) parts.push(displayNumber(remaining.kcal) === '0' ? 'Energi nået' : `${displayNumber(remaining.kcal)} kcal`)
        if (remaining.protein !== null) parts.push(displayNumber(remaining.protein) === '0' ? 'Protein nået' : `${displayNumber(remaining.protein)} g protein`)
        append(goals, 'p', 'muted space', 'Tilbage i dag: ' + parts.join(' · '))
      }
      const evening = eveningProtein(remaining, clock())
      if (evening) append(goals, 'p', 'muted space', evening)
      append(goals, 'p', 'small muted space', 'Registreringer viser ikke nødvendigvis hele dagens indtag. Ingen samlet kostvurdering.')
      // Keep the existing library controls below the diary, without duplicate log buttons.
      const library = (title, items, prefix) => {
        if (!items.length) return
        const section = append(main, 'section', 'card'); append(section, 'h2', '', title)
        items.forEach((meal, i) => {
          const row = append(section, 'div', 'space stack')
          const favorite = s.favoriteKeys.includes(mealKey(meal))
          const f = button(row, favorite ? 'Fjern favorit: ' + meal.meal : 'Gem favorit: ' + meal.meal, () => controller.toggleFavorite(meal), s.pending)
          f.setAttribute('aria-pressed', String(favorite))
          f.setAttribute('data-focus', prefix + '-favorite-' + i)
        })
      }
      library('Dine favoritter', s.favorites, 'fav')
      library('Måltidsbibliotek', s.recent.filter(meal => !s.favoriteKeys.includes(mealKey(meal))), 'recent')
      if (s.favoriteError && s.logs.length < 2) { const p = append(main, 'p', 'space', s.favoriteError); p.setAttribute('role', 'alert') }
      const weekly = append(main, 'section', 'card')
      append(weekly, 'h2', '', 'Din uge')
      append(weekly, 'p', 'muted space', weekText(s.historyRows, s.targets, s.date, { compact: true }))
      const weeks = weeklyTrend(s.historyRows, s.targets, s.date)
      if (weeks.length) append(weekly, 'p', 'small muted space',
        'Loggede dage pr. kalenderuge: ' + weeks.map(week => week.loggedDays).join(' → ')
        + ' · ældste først, denne uge indtil nu.')
      const planInputs = controller.weekPlanInputs()
      const key = JSON.stringify({ ...planInputs, storage: undefined })
      if (!planHost || key !== planKey) {
        clearPlan(); planHost = node('div'); planKey = key
      }
      const plan = append(weekly, 'details', 'space')
      plan.setAttribute('data-focus', 'week-plan')
      append(plan, 'summary', '', 'Ugeplan')
      plan.append(planHost)
      currentPlanFold = plan
      const openPlan = () => {
        if (destroyed || currentPlanFold !== plan || !plan.open || planMounted) return
        planMounted = true
        disposePlan = mountWeekPlan(planHost, planInputs)
      }
      plan.addEventListener('toggle', openPlan)
      if (openDetails.includes('week-plan')) { plan.open = true; openPlan() }
      const hb = button(main, 'Se historik', () => controller.toggleHistory(), s.pending)
      hb.setAttribute('aria-expanded', String(s.history)); hb.setAttribute('data-focus', 'history')
      if (s.history) {
        const section = append(main, 'section', 'card'); append(section, 'h2', '', 'Historik · seneste 30 dage')
        const days = historyDays(s.historyRows, s.targets)
        const dateFormat = new Intl.DateTimeFormat('da-DK', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
        if (!days.length) append(section, 'p', 'muted', 'Ingen registreringer i perioden.')
        for (const day of days) {
          const group = append(section, 'section', 'space')
          const heading = append(group, 'h3')
          const date = append(heading, 'time', '', dateFormat.format(new Date(day.date + 'T00:00:00Z')))
          date.setAttribute('datetime', day.date)
          append(group, 'p', 'muted', day.kcal === null || day.protein === null
            ? 'Næringsdata skal kontrolleres'
            : `${displayNumber(day.kcal)} kcal · ${displayNumber(day.protein)} g protein`)
          const list = append(group, 'ul', 'list')
          s.historyRows.filter(row => row.date === day.date && !isDayReceipt(row)).forEach(row =>
            append(list, 'li', '', typeof row.meal === 'string' ? row.meal : 'Ugyldigt måltid'))
        }
      }
    }
    if (s.undo) {
      const undo = append(app, 'section', 'undo-bar')
      undo.setAttribute('role', 'status'); undo.setAttribute('aria-live', 'polite')
      append(undo, 'p', 'small', 'Gemt: ' + s.undo.meal + ' · Fortryd inden 5 sekunder')
      const b = button(undo, 'Fortryd', () => controller.undoLog(s.undo.token, intent()), s.pending)
      b.setAttribute('data-focus', 'undo-log')
    }
    if (!s.loaded) clearPlan()
    // Marc 3. nov. (keep it simple): overskriften foerst; vejningen bliver oeverst som bestilt i
    // APP-KOST-START1 ("vaegttrenden er det vigtigste tal"), derefter log hurtigt og dagens maal.
    const kids = [...main.children], del = n => n.getAttribute?.('data-kost-del')
    const first = ['intro', 'vaegt', 'hurtig', 'maal'].map(k => kids.find(n => del(n) === k)).filter(Boolean)
    main.replaceChildren(...first, ...kids.filter(n => !first.includes(n)))
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
  const cleanup = () => { destroyed = true; clearPlan(); unsubscribe(); controller.dispose(); host.replaceChildren() }
  // Update weight props without remounting the diary or losing a meal draft.
  cleanup.updateWeight = props => {
    if (destroyed) return
    weightProps = { ...weightProps, ...props }; draw()
  }
  return cleanup
}
