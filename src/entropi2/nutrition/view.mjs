import { antalOrd } from '../antalOrd.mjs'
import { mountUgeplan } from './ugeplan/mount.mjs'
import { unitsForFood, mealKey } from './controller.mjs'
import { startAdvice, weightSummary, displayNumber, remainingToday } from './startModel.mjs'
import { historyDays } from './historyDays.mjs'
import { weekText } from './weekText.mjs'
import { weeklyTrend } from './weeklyTrend.mjs'
import { mealLabel } from './mealLabel.mjs'
import { mealProtein, eveningProtein } from './dailyProtein.mjs'
import { isDayReceipt } from '../../mealEvidence.mjs'
import { parseInputNumber } from '../../athlete/kostNumbers.mjs'
import { calendarDay } from '../../calendarDate.js'
// Shared presentation text for diary and weight reads; no read/write ownership here.
const readText = {
  retry: 'Hent igen', pending: 'Henter…',
  diaryLoading: 'Henter kostloggen…', diaryError: 'Kostloggen kunne ikke hentes.',
  weightLoading: 'Henter vejningerne…', weightError: 'Vejningerne kunne ikke hentes.',
}
let mountSequence = 0

// Mount inside an assembly-owned host; load nutrition.css separately. No global DOM.
// The caller disposes/remounts on athlete/date change. No shared entry is changed.
export function mountNutrition(host, controller, { onCoach, onNavigate, clock = () => new Date(), mountWeekPlan = mountUgeplan, ...weightProps } = {}) {
  if (!controller) return () => {} // default OFF: do not even touch the host.
  const doc = host.ownerDocument
  const contentId = 'e2-nutrition-content-' + (++mountSequence)
  let sequence = 0, destroyed = false, manual = {}, selection = '0', amount = '100', unit = '0'
  amount = String(controller.foodAmount(0))
  let weightPending = false, weightReadPending = false, weightError = ''
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
  const inHost = target => {
    for (let n = target; n; n = n.parentElement) if (n === host) return true
    return false
  }
  const canFocus = target => {
    if (!target || !inHost(target) || target.isConnected === false || target.disabled) return false
    for (let n = target; n; n = n.parentElement) {
      if (n.hidden || n.getAttribute('hidden') !== null) return false
      const parent = n.parentElement
      if (parent?.tagName.toLowerCase() === 'details' && !parent.open && n !== parent.children[0]) return false
    }
    return true
  }
  const focusControl = key => {
    const controls = [...host.querySelectorAll('[data-focus]')]
    const target = controls.find(n => n.getAttribute('data-focus') === key)
    const fallback = controls.find(n => n.getAttribute('data-focus') === 'diary-summary')
    if (canFocus(target)) target.focus()
    else if (canFocus(fallback)) fallback.focus()
  }
  const draw = () => {
    if (destroyed) return
    const s = controller.snapshot()
    const isToday = s.date === calendarDay(clock())
    // Preserve focus on state updates; all user data enters the DOM as textContent.
    const active = inHost(doc.activeElement) ? doc.activeElement : null
    const focusKeys = []
    for (let n = active; n && n !== host; n = n.parentElement) {
      const target = n.tagName.toLowerCase() === 'details' ? n.children[0] : n
      const key = target?.getAttribute('data-focus')
      if (key) focusKeys.push(key)
    }
    const selectionRange = active && typeof active.selectionStart === 'number'
      ? [active.selectionStart, active.selectionEnd, active.selectionDirection] : null
    const openDetails = [...host.querySelectorAll('details')].filter(n => n.open).map(n => n.getAttribute('data-focus'))
    const app = node('div', 'e2-nutrition')
    const skip = append(app, 'a', 'skip', 'Gå til indhold')
    skip.setAttribute('data-focus', 'skip')
    skip.setAttribute('href', '#' + contentId)
    const main = append(app, 'main')
    main.setAttribute('id', contentId); main.setAttribute('tabindex', '-1')
    main.setAttribute('data-focus', 'main')
    if (s.loaded) {
      const fast = append(main, 'section', 'card'); fast.setAttribute('data-kost-del', 'hurtig')
      append(fast, 'h2', '', 'Log hurtigt')
      const templateState = s.mealTemplates
      // One shared limit across sources, using the controller's existing identity.
      // Keep every remaining choice reachable without adding duplicate log buttons.
      const quickKeys = new Set(), choices = []
      for (const [title, items, prefix] of [
        ['Gentag i går', s.yesterday, 'yesterday'],
        ['Favoritter', s.favorites, 'fav'],
        ['Seneste måltider', s.recent, 'recent'],
      ]) items.forEach((meal, i) => {
        const key = mealKey(meal)
        if (quickKeys.has(key)) return
        quickKeys.add(key); choices.push({ title, meal, prefix, i })
      })
      const quick = (parent, items) => {
        let section, previousPrefix
        for (const { title, meal, prefix, i } of items) {
          if (prefix !== previousPrefix) {
            section = append(parent, 'section', 'space'); append(section, 'h2', '', title)
            previousPrefix = prefix
          }
          const row = append(section, 'div', 'space stack')
          const label = prefix === 'yesterday' ? 'Log igen: ' : prefix === 'recent' ? 'Gentag dette måltid: ' : 'Log '
          const b = button(row, label + meal.meal, () => action(meal), s.pending)
          b.setAttribute('data-focus', prefix + '-log-' + i)
        }
      }
      quick(fast, choices.slice(0, 3))
      if (choices.length > 3) {
        const more = append(fast, 'details', 'space'); more.setAttribute('data-focus', 'more-meals')
        append(more, 'summary', '', 'Flere måltider').setAttribute('data-focus', 'more-meals-summary')
        quick(more, choices.slice(3))
      }
      const availableTemplates = (templateState?.templates || []).filter(item => !quickKeys.has(mealKey(item.meal)))
      const templates = node('details', 'space')
      templates.setAttribute('data-focus', 'templates')
      const templateSummary = append(templates, 'summary')
      templateSummary.setAttribute('data-focus', 'templates-summary')
      append(templateSummary, 'h2', '', 'Skabeloner')
      for (const [i, item] of availableTemplates.entries()) {
        const b = button(templates, 'Log skabelon: ' + item.name, () => controller.logTemplate(item.id, intent()), s.pending)
        b.setAttribute('data-focus', 'template-log-' + i)
      }
      if (templateState?.suggestions.length) {
        const suggestions = append(templates, 'details', 'space')
        suggestions.setAttribute('data-focus', 'template-suggestions')
        append(suggestions, 'summary', '', 'Forslag fra ofte loggede måltider').setAttribute('data-focus', 'template-suggestions-summary')
        for (const [i, item] of templateState.suggestions.entries()) {
          const b = button(suggestions, 'Gem skabelon: ' + item.name, () => controller.acceptTemplate(item.id), s.pending)
          b.setAttribute('data-focus', 'template-accept-' + i)
        }
      }
      if (templateState?.error) { const p = append(fast, 'p', 'space', templateState.error); p.setAttribute('role', 'alert') }
      const details = append(fast, 'details', 'space'); details.setAttribute('data-focus', 'log-form')
      append(details, 'summary', '', 'Notér et måltid').setAttribute('data-focus', 'log-form-summary')
      const inner = append(details, 'div')
      const form = append(inner, 'form', 'stack')
      field(form, 'Måltid', manual.meal || '', v => { manual.meal = v })
      for (const [k, l] of [['kcal', 'Energi (kcal)'], ['protein', 'Protein (g)'], ['carb', 'Kulhydrat (g)'], ['fat', 'Fedt (g)']]) {
        field(form, l, manual[k] ?? '', v => { manual[k] = v })
      }
      append(form, 'p', 'small muted', 'Angiv kendte værdier. Brug 0 kun når værdien er kendt som nul.')
      const save = button(form, s.pending ? 'Gemmer…' : 'Gem måltid', () => {}, s.pending); save.className += ' cta-primary'; save.type = 'submit'; save.setAttribute('data-focus', 'save')
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
        const add = button(foodForm, 'Log portion', () => {}, s.pending); add.className += ' cta-primary'; add.type = 'submit'
        add.setAttribute('data-focus', 'log-portion')
        foodForm.addEventListener('submit', e => { e.preventDefault(); return controller.logFood(Number(selection), amount, Number(unit), intent()) })
      }
      if (availableTemplates.length || templateState?.suggestions.length) fast.append(templates)
    }
    const weightStatus = weightProps.weightStatus
    const weightReady = weightStatus?.athleteId === s.athleteId && weightStatus.state === 'ready'
    const weightReadError = weightStatus?.athleteId === s.athleteId && weightStatus.state === 'error'
    const weightLoading = weightStatus?.athleteId === s.athleteId && weightStatus.state === 'loading'
    const weightEmpty = weightReady && Array.isArray(weightProps.weightLogs) && weightProps.weightLogs.length === 0
    const summary = weightSummary(weightReady ? weightProps.weightLogs : [], s.athleteId, s.date)
    const weightConnected = isToday && typeof weightProps.logWeight === 'function' && typeof weightProps.onWeightInput === 'function'
    const weighing = node('section', 'card'); weighing.setAttribute('data-kost-del', 'vaegt')
    if (summary.latest || weightReady || weightLoading || weightReadError || weightConnected || weightError) {
      main.append(weighing)
      append(weighing, 'h2', '', 'Din vægt')
    }
    // Marc 3. nov.: dansk dato i stedet for ISO, og kun én tom-tekst, når der ingen vejninger er.
    const dag = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso)); return m ? `${Number(m[3])}. ${['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'][Number(m[2]) - 1]}` : String(iso) }
    weighing.setAttribute('aria-busy', String(weightLoading || weightReadPending))
    if (weightLoading) {
      const p = append(weighing, 'p', 'muted space', readText.weightLoading)
      p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite')
    }
    if (summary.latest || weightEmpty) append(weighing, 'p', 'muted space', summary.latest
      ? `Seneste vægt: ${displayNumber(summary.latest.weight)} kg · ${dag(summary.latest.date)}` : 'Ingen vejninger endnu')
    if (weightReady && !summary.latest && !weightEmpty) append(weighing, 'p', 'muted space', 'Ingen vejninger at vise for den valgte dag.')
    if (weightReadError) {
      const p = append(weighing, 'p', 'space', readText.weightError); p.setAttribute('role', 'alert')
      const retry = weightProps.retryWeight
      if (typeof retry === 'function') {
        const b = button(weighing, weightReadPending ? readText.pending : readText.retry, async () => {
          if (destroyed || weightReadPending || weightProps.weightStatus !== weightStatus || weightProps.retryWeight !== retry) return
          weightReadPending = true; draw()
          try { await retry() }
          catch { /* The owner retains the read error; the button permits another attempt. */ }
          finally { weightReadPending = false; draw() }
        }, weightReadPending)
        b.setAttribute('data-focus', 'retry-weight')
      }
    }
    if (summary.latest) append(weighing, 'p', 'muted', summary.average !== null
      ? `Ugegennemsnit: ${displayNumber(summary.average)} kg · ${summary.days} ${antalOrd(summary.days, 'vejedag', 'vejedage')} (seneste 7 dage)`
      : 'Ingen vejninger de seneste 7 dage')
    if (summary.comparison !== null) append(weighing, 'p', 'muted', summary.comparison)
    if (weightConnected) {
      const form = append(weighing, 'form', 'stack space')
      const input = field(form, 'Vægt (kg)', weightProps.weightInput ?? '', value => {
        weightProps = { ...weightProps, weightInput: value }
        weightProps.onWeightInput(value)
      })
      input.disabled = weightPending || weightProps.savingWeight === true
      const save = button(form, input.disabled ? 'Gemmer vægt…' : 'Gem vægt', () => {}, input.disabled)
      save.className += ' cta-primary'; save.type = 'submit'; save.setAttribute('data-focus', 'save-weight')
      form.addEventListener('submit', async e => {
        e.preventDefault()
        if (destroyed || weightPending || weightProps.savingWeight === true || s.date !== calendarDay(clock())) return
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
    }
    if (weightError) { const p = append(weighing, 'p', 'space', weightError); p.setAttribute('role', 'alert') }
    const intro = append(main, 'div', 'intro'); intro.setAttribute('data-kost-del', 'intro')
    // Marc 3. nov.: datoen staar allerede i topbjaelken.
    append(intro, 'p', 'eyebrow', isToday ? 'Kost i dag' : 'Kost · den valgte dag')
    append(intro, 'h1', '', isToday ? 'Dit næste måltid' : 'Din kostdagbog')
    append(intro, 'p', 'muted', 'Brug dine mål uden at logge. Dagbogen er valgfri.')
    const hero = append(main, 'section', 'card hero'); hero.setAttribute('data-kost-del', 'maal')
    append(hero, 'h2', '', isToday ? 'Dagens mål' : 'Mål for den valgte dag')
    const advice = startAdvice(s.targets)
    if (advice.kcal) append(hero, 'p', 'space', `Energi: ${displayNumber(advice.kcal)} kcal`)
    if (advice.protein) append(hero, 'p', 'space', `Protein: ${displayNumber(advice.protein)} g`)
    if (advice.tips.length) {
      const help = append(hero, 'details', 'space'); help.setAttribute('data-focus', 'general-meal-help')
      append(help, 'summary', '', 'Generel hjælp til måltider').setAttribute('data-focus', 'general-meal-help-summary')
      append(help, 'p', 'muted', 'Et generelt eksempel, som du kan tilpasse med din coach. Det er ikke en individuel måltidsplan.')
      const tips = append(help, 'ul', 'list')
      advice.tips.forEach(tip => append(tips, 'li', '', tip))
    }
    if ((!advice.kcal || !advice.protein) && typeof onCoach !== 'function') append(hero, 'p', 'muted space', 'Aftal dine kostmål med din coach.')
    if (typeof onCoach === 'function') button(hero, 'Tal med din coach', onCoach).setAttribute('data-focus', 'coach')
    // Keep feedback outside the fold, including failures from meal actions.
    const diary = node('details', 'card')
    diary.setAttribute('data-focus', 'diary')
    const diarySummary = append(diary, 'summary')
    diarySummary.setAttribute('data-focus', 'diary-summary')
    append(s.loaded ? diarySummary : main, 'h2', s.loaded ? '' : 'section-head', isToday ? 'Dagens dagbog' : 'Dagbog for den valgte dag')
    const status = append(main, 'p', 'space', s.phase === 'load-error' ? readText.diaryError : s.message)
    status.setAttribute('role', s.phase.endsWith('error') ? 'alert' : 'status')
    status.setAttribute('aria-live', 'polite')
    main.setAttribute('aria-busy', String(s.pending || s.phase === 'loading'))
    if (s.phase === 'idle' || s.phase === 'loading') append(main, 'p', 'muted', readText.diaryLoading)
    if (s.phase === 'load-error') button(main, readText.retry, () => controller.load()).setAttribute('data-focus', 'retry-diary')
    if (s.loaded) {
      // Marc 3. nov.: uden maaltider stod "Ingen maaltider registreret i dag." to gange;
      // fordelingen vises kun, naar der er noget at fordele (dagbogen siger det tomme).
      const knownProtein = mealProtein(s.logs).filter(meal => meal.protein !== null)
      if (knownProtein.length) {
        const distribution = append(diary, 'section', 'space')
        append(distribution, 'h3', '', 'Protein pr. måltid')
        const list = append(distribution, 'ul', 'list')
        for (const meal of knownProtein) append(list, 'li', '', `${meal.meal}: ${displayNumber(meal.protein)} g protein`)
      }
      const ul = append(diary, 'ul', 'list')
      if (s.needsRefresh) {
        append(diary, 'p', 'muted', 'Hent dagbogen igen for at kunne rette eller fjerne det nye måltid.')
        button(diary, readText.retry, () => controller.load(), s.pending).setAttribute('data-focus', 'refresh-diary')
      }
      if (!s.logs.length) append(ul, 'li', 'muted', isToday ? 'Ingen måltider registreret i dag.' : 'Ingen måltider registreret den valgte dag.')
      for (const [index, row] of s.logs.entries()) {
        const li = append(ul, 'li')
        const label = mealLabel(row.meal)
        const partLabel = append(li, 'label', 'meal-part')
        const part = append(partLabel, 'input')
        part.type = 'checkbox'; part.checked = s.selectedParts.includes(index); part.disabled = s.pending
        part.setAttribute('aria-label', 'Vælg del ' + (index + 1) + ': ' + label)
        part.setAttribute('data-focus', 'meal-part-' + index)
        part.addEventListener('change', () => controller.toggleMealPart(index))
        append(partLabel, 'span', '', 'Vælg til eget måltid')
        append(li, 'strong', '', label)
        const validRow = typeof row.meal === 'string' && row.meal.trim()
          && ['kcal', 'protein', 'carb', 'fat'].every(key => parseInputNumber(row[key]) !== null)
        append(li, 'small', '', validRow ? `${displayNumber(parseInputNumber(row.kcal))} kcal · ${displayNumber(parseInputNumber(row.protein))} g protein` : 'Kontrollér næringsværdierne for dette måltid.')
        if (s.editableIds?.includes(row.id)) {
          const edit = button(li, 'Ret måltid: ' + label, () => {
            if (destroyed || controller.snapshot().pending) return
            editing = { id: row.id, intent: intent(), meal: row.meal,
              ...Object.fromEntries(['kcal', 'protein', 'carb', 'fat'].map(k => [k, row[k] ?? ''])) }
            removing = null; draw()
            focusControl('edit-Måltid')
          }, s.pending)
          edit.setAttribute('data-focus', 'edit-' + row.id)
        }
        if (s.removableIds?.includes(row.id)) {
          const remove = button(li, 'Fjern måltid: ' + label, () => {
            if (destroyed || controller.snapshot().pending) return
            removing = { id: row.id, intent: intent() }; editing = null; draw()
            focusControl('cancel-remove')
          }, s.pending)
          remove.setAttribute('data-focus', 'remove-' + row.id)
        }
        if (editing?.id === row.id && s.editableIds?.includes(row.id)) {
          const draft = editing, form = append(li, 'form', 'stack space')
          form.setAttribute('aria-label', 'Ret måltid: ' + label)
          for (const [k, label] of [['meal', 'Måltid'], ['kcal', 'Energi (kcal)'], ['protein', 'Protein (g)'], ['carb', 'Kulhydrat (g)'], ['fat', 'Fedt (g)']]) {
            const input = field(form, label, draft[k], v => { draft[k] = v })
            input.setAttribute('data-focus', 'edit-' + label); input.disabled = s.pending
          }
          append(form, 'p', 'small muted', 'Angiv kendte værdier. Brug 0 kun når værdien er kendt som nul.')
          const save = button(form, 'Gem ændring', () => {}, s.pending); save.className += ' cta-primary'; save.type = 'submit'
          save.setAttribute('data-focus', 'save-edit')
          button(form, 'Annuller rettelse', () => { editing = null; draw() }, s.pending).setAttribute('data-focus', 'cancel-edit')
          form.addEventListener('submit', async e => {
            e.preventDefault()
            if (destroyed || editing !== draft) return
            if (await controller.update(draft.id, { ...draft }, draft.intent)) {
              const ownedFocus = inHost(doc.activeElement)
              editing = null; draw()
              if (ownedFocus) focusControl('edit-' + row.id)
            }
          })
        }
        if (removing?.id === row.id && s.removableIds?.includes(row.id)) {
          const confirmation = removing, group = append(li, 'div', 'stack space')
          append(group, 'p', '', 'Vil du fjerne måltidet ' + label + '?')
          button(group, 'Ja, fjern måltid', async () => {
            if (destroyed || removing !== confirmation) return
            if (await controller.remove(row.id, confirmation.intent, true)) { removing = null; draw() }
          }, s.pending).setAttribute('data-focus', 'confirm-remove')
          const cancel = button(group, 'Behold måltid', () => {
            removing = null; draw()
            focusControl('remove-' + row.id)
          }, s.pending)
          cancel.setAttribute('data-focus', 'cancel-remove')
        }
      }
      if (s.logs.length >= 2) {
        const own = append(diary, 'form', 'card stack')
        own.setAttribute('aria-label', 'Gem eget måltid')
        append(own, 'h2', '', 'Gem eget måltid')
        append(own, 'p', 'muted', 'Vælg mindst to af dagens måltider og gem dem samlet i Favoritter.')
        append(own, 'p', '', s.selectedParts.length + ' dele valgt')
        const name = field(own, 'Navn på eget måltid', ownMealName, v => { ownMealName = v })
        name.inputMode = 'text'; name.maxLength = 60; name.disabled = s.pending
        const save = button(own, 'Gem i Favoritter', () => {}, s.pending || s.selectedParts.length < 2)
        save.className += ' cta-primary'; save.type = 'submit'; save.setAttribute('data-focus', 'save-own-meal')
        own.addEventListener('submit', e => {
          e.preventDefault()
          if (destroyed) return
          controller.saveOwnMeal(ownMealName)
        })
      }
      const remaining = remainingToday(s.totals, s.targets)
      const goals = node('section', 'card')
      if (s.totals && (s.logs.length || remaining)) main.append(goals)
      if (s.logs.length && s.totals) {
        append(goals, 'p', 'eyebrow', isToday ? 'Dagens registreringer og mål' : 'Registreringer og mål for den valgte dag')
        append(goals, 'h2', '', 'Registreret indtag')
        for (const [key, label, unitName] of [['kcal', 'Energi', 'kcal'], ['protein', 'Protein', 'g']]) {
          const target = s.targets[key] > 0 ? s.targets[key] : null
          append(goals, 'p', 'muted space', `${label}: ${displayNumber(s.totals[key])} ${unitName}`)
          if (target && s.totals && s.logs.length) {
            const progress = append(goals, 'progress'); progress.max = target; progress.value = Math.min(target, s.totals[key])
            progress.setAttribute('aria-label', label + ', registreret i forhold til aftalt mål')
          }
        }
      }
      if (remaining) {
        const parts = []
        if (remaining.kcal !== null) parts.push(displayNumber(remaining.kcal) === '0' ? 'Energi nået' : `${displayNumber(remaining.kcal)} kcal`)
        if (remaining.protein !== null) parts.push(displayNumber(remaining.protein) === '0' ? 'Protein nået' : `${displayNumber(remaining.protein)} g protein`)
        append(goals, 'p', 'muted space', (isToday ? 'Tilbage i dag: ' : 'Tilbage til målet den valgte dag: ') + parts.join(' · '))
      }
      const evening = isToday ? eveningProtein(remaining, clock()) : null
      if (evening) append(goals, 'p', 'muted space', evening)
      if (s.logs.length && s.totals) append(goals, 'p', 'small muted space', 'Registreringer viser ikke nødvendigvis hele ' + (isToday ? 'dagens' : 'den valgte dags') + ' indtag. Ingen samlet kostvurdering.')
      // Intake and remaining goals stay reachable before the collapsed diary.
      main.append(diary)
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
      if (s.favoriteError) { const p = append(main, 'p', 'space', s.favoriteError); p.setAttribute('role', 'alert') }
      const weekly = append(main, 'section', 'card')
      if (s.historyRows.length) {
        append(weekly, 'h2', '', 'Din uge')
        append(weekly, 'p', 'muted space', weekText(s.historyRows, s.targets, s.date, { compact: true }))
        const weeks = weeklyTrend(s.historyRows, s.targets, s.date)
        if (weeks.length) append(weekly, 'p', 'small muted space',
          'Loggede dage pr. kalenderuge: ' + weeks.map(week => week.loggedDays).join(' → ')
          + ' · ældste først, denne uge indtil nu.')
      }
      const planInputs = controller.weekPlanInputs()
      const key = JSON.stringify({ ...planInputs, storage: undefined })
      if (!planHost || key !== planKey) {
        clearPlan(); planHost = node('div'); planKey = key
      }
      const plan = append(weekly, 'details', 'space')
      plan.setAttribute('data-focus', 'week-plan')
      append(plan, 'summary', '', 'Ugeplan').setAttribute('data-focus', 'week-plan-summary')
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
            append(list, 'li', '', mealLabel(row.meal)))
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
    // APP-KOST-START1 ("vaegttrenden er det vigtigste tal"), derefter dagens maal og valgfri logning.
    const kids = [...main.children], del = n => n.getAttribute?.('data-kost-del')
    const first = ['intro', 'vaegt', 'maal', 'hurtig'].map(k => kids.find(n => del(n) === k)).filter(Boolean)
    main.replaceChildren(...first, ...kids.filter(n => !first.includes(n)))
    host.replaceChildren(app)
    for (const n of host.querySelectorAll('[data-focus]')) {
      const key = n.getAttribute('data-focus')
      if (n.tagName.toLowerCase() === 'details' && openDetails.includes(key)) n.open = true
    }
    // Restore folds before testing visibility. Never take focus from another host,
    // a detached view, or restore into a closed fold / disabled pending action.
    const targets = [...host.querySelectorAll('[data-focus]')]
    for (const key of focusKeys) {
      const target = targets.find(n => n.getAttribute('data-focus') === key)
      if (!canFocus(target)) continue
      target.focus({ preventScroll: true })
      if (key === focusKeys[0] && selectionRange && typeof target.setSelectionRange === 'function') target.setSelectionRange(...selectionRange)
      break
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
