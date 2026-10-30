import { registerHooks } from 'node:module'
import * as dom from './indbakke2Dom.mjs'
import { indbakke2Enabled } from './indbakke2.mjs'
const view = new URL('./athlete/Indbakke2Tab.mjs', import.meta.url).href
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === view && specifier === 'react')
    return { url: new URL('./indbakke2Dom.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
export const { default: Tab } = await import('./athlete/Indbakke2Tab.mjs')
export { dom }
export const reply = (id = 'reply', athlete_id = 'a', extra = {}) => ({ id, athlete_id,
  sender_role: 'coach', content: '<img src=x onerror=bad()> Godt arbejde', category: 'besked',
  read_at: null, created_at: '2026-10-30T12:00:00Z', ...extra })
export const tick = () => new Promise(resolve => setImmediate(resolve))
export function fixture({ query = '?indbakke2=1', messages = [reply()], athleteId = 'a' } = {}) {
  dom.reset()
  const rows = structuredClone(messages), calls = [], faults = {}
  const database = { from(table) {
    const call = { table, filters: [], ids: [], payload: null, selected: null }
    const filters = []
    const q = {
      update(payload) { call.payload = payload; return q },
      eq(key, value) { call.filters.push([key, value]); filters.push(row => row[key] === value); return q },
      in(key, ids) { call.ids = [...ids]; filters.push(row => ids.includes(row[key])); return q },
      select(columns) { call.selected = columns; return q },
      async then(resolve, reject) {
        calls.push(call)
        try {
          if (faults.wait) await faults.wait
          if (faults.throw) throw Error('PRIVATE backend <script>details</script>')
          if (faults.error) return resolve({ error: { message: 'PRIVATE missing column read_at' } })
          const selected = rows.filter(row => filters.every(filter => filter(row)))
          if (faults.zero) return resolve({ data: [] })
          selected.forEach(row => Object.assign(row, call.payload))
          resolve({ data: faults.noData ? null : selected.map(row => ({ id: row.id })) })
        } catch (error) { reject(error) }
      },
    }
    return q
  } }
  let unread = messages.filter(m => m.athlete_id === athleteId && m.sender_role === 'coach' && !m.read_at).length
  const p = { messages: structuredClone(messages), sharedVideoAnalyses: [], messageInput: '',
    renderSharedFeedbackCards: () => null, fetchSharedVideoAnalyses() {}, setMessageInput() {}, sendAthleteMessage() {},
    athleteId, inboxDatabase: database, inboxReadEnabled: indbakke2Enabled(query),
    setMessages(next) { p.messages = next }, setUnreadMsgCount(next) { unread = next } }
  return { p, rows, calls, faults, database, get unread() { return unread },
    render() { return dom.render(Tab, p) },
    async open() { const tree = this.render(); dom.flush(); await tick(); return tree },
    async retry() {
      const button = dom.nodes(this.render()).find(n => n.type === 'button' && dom.text(n) === 'Prøv igen')
      if (!button) throw Error('Missing retry button')
      button.props.onClick(); this.render(); dom.flush(); await tick()
    } }
}
