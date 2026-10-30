import { coachConversations } from '../indbakke2.mjs'
import { createCoachTemplateSender, readCoachTemplates, fillCoachTemplate } from './coachTemplateMessages.mjs'

// Created only inside the opt-in view. All database/storage capabilities are injected.
export function createInboxController({ enabled = false, database, getScope, notify = () => {},
  storage = () => globalThis.localStorage, onChanged = () => {} }) {
  const state = { messages: [], videos: [], selected: null, drafts: {}, templates: [],
    loading: false, busy: false, loaded: false, error: '', status: '' }
  let generation = 0
  let active = true
  const emit = () => { if (active) notify({ ...state }) }
  const scope = () => {
    const s = getScope()
    if (!active || enabled !== true || s?.enabled !== true || !s.coachId) throw Error('Indbakken er slået fra.')
    return s
  }
  const visible = () => scope().athletes.filter(a => !scope().hiddenAthleteIds?.has(a.id))
  const target = id => {
    if (!visible().some(a => a.id === id)) throw Error('Atleten er ikke længere i indbakken.')
  }
  const sender = createCoachTemplateSender({ enabled, database,
    getScope: () => ({ ...scope(), athletes: visible() }) })
  async function refresh() {
    const ticket = ++generation
    try {
      const ids = visible().map(a => a.id)
      state.loading = true; state.error = ''; emit()
      // Range reads avoid silently cutting older conversations at the API row cap.
      async function readPages(table, columns, order) {
        const data = []
        for (let offset = 0; ; offset += 500) {
          let query = database.from(table).select(columns).in('athlete_id', ids)
          if (table === 'video_analyses') query = query.eq('status', 'shared')
          const result = await query.order(order).order('id').range(offset, offset + 499)
          if (result.error) return result
          if (!active || ticket !== generation) return { data: [] }
          data.push(...(result.data || []))
          if ((result.data || []).length < 500) return { data }
        }
      }
      const [messages, videos] = ids.length ? await Promise.all([
        readPages('messages', '*', 'created_at'),
        readPages('video_analyses', 'id,athlete_id,status,lift,athlete_feedback,analyzed_at,created_at', 'analyzed_at'),
      ]) : [{ data: [] }, { data: [] }]
      if (!active || ticket !== generation) return false
      if (messages.error || videos.error) throw Error('Samtalerne kunne ikke opdateres. Prøv igen.')
      state.messages = (messages.data || []).filter(m => ids.includes(m.athlete_id))
      state.videos = (videos.data || []).filter(v => ids.includes(v.athlete_id) && v.status === 'shared')
      state.loaded = true
      return true
    } catch {
      if (active && ticket === generation) state.error = 'Samtalerne kunne ikke opdateres. Prøv igen.'
      return false
    } finally {
      if (active && ticket === generation) { state.loading = false; emit() }
    }
  }
  async function mutate(action) {
    if (state.busy) return false
    state.busy = true; state.error = ''; state.status = ''; emit()
    try { await action(); return true }
    catch (error) { state.error = error.message || 'Handlingen kunne ikke gemmes. Prøv igen.'; return false }
    finally { state.busy = false; emit() }
  }
  return {
    state, refresh,
    activate() { active = true },
    rows: () => coachConversations(visible(), state.messages, state.videos),
    select(id) {
      target(id); if (state.busy) return
      state.selected = id; state.templates = []; state.status = ''; state.error = ''; emit()
    },
    draft(text) { if (!state.busy && state.selected) { target(state.selected); state.drafts[state.selected] = text; emit() } },
    templates() {
      if (state.busy) return
      state.templates = []; state.error = ''; state.status = ''
      try {
        const s = scope(); state.templates = readCoachTemplates(storage(), s.coachId)
        if (!state.templates.length) state.status = 'Ingen gemte hurtige svar.'
      }
      catch { state.error = 'De eksisterende hurtige svar kunne ikke læses.' }
      emit()
    },
    applyTemplate(index) {
      const athlete = visible().find(a => a.id === state.selected)
      const template = state.templates[index]
      if (!state.busy && athlete && template) {
        state.drafts[athlete.id] = fillCoachTemplate(template.text, athlete.name); emit()
      }
    },
    send() {
      const id = state.selected
      return mutate(async () => {
        target(id)
        let sent
        try { sent = await sender({ coachId: scope().coachId, athleteId: id, text: state.drafts[id] }) }
        catch { throw Error('Beskeden kunne ikke sendes. Din kladde er bevaret. Prøv igen.') }
        if (sent !== true) return
        state.drafts[id] = ''; state.status = 'Beskeden er sendt.'
        await refresh()
        try { await onChanged() } catch { /* Persisted; do not offer duplicate send. */ }
      })
    },
    seen() {
      const id = state.selected
      return mutate(async () => {
        target(id)
        if (!state.loaded || state.loading) throw Error('Opdatér samtalen før du markerer den som set.')
        const ids = state.messages.filter(m => m.athlete_id === id && m.sender_role === 'athlete' && !m.read_by_coach).map(m => m.id)
        if (!ids.length) return
        try {
          const { error } = await database.from('messages').update({ read_by_coach: true })
            .eq('athlete_id', id).eq('sender_role', 'athlete').in('id', ids)
          if (error) throw error
        } catch { throw Error('Kunne ikke markere som set. Samtalen er fortsat ulæst.') }
        state.messages = state.messages.map(m => ids.includes(m.id) && m.athlete_id === id ? { ...m, read_by_coach: true } : m)
        state.status = 'Markeret som set.'
        try { await onChanged() } catch { /* Local confirmed read state remains. */ }
      })
    },
    dispose() { active = false; generation++ },
  }
}
