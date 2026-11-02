import { readCoachTemplates, fillCoachTemplate } from '../../dashboard/coachTemplateMessages.mjs'
import { coachBriefingPointKey } from '../../coachBriefingSeen.js'
import { validId } from './conversationModel.mjs'

// Inject the existing database capability; never import a configured backend client.
export function createConversationAdapters({ enabled = false, database, getScope,
  openUpload, openVideoAnalysisReview, openAwaitingAnalysisVideo, openFeedback,
  storage, pageSize = 100, maxPages = 100 }) {
  function scope() {
    const s = getScope()
    if (enabled !== true || s?.enabled !== true || !validId(s.athleteId)
      || !['athlete', 'coach'].includes(s.role) || !s.ownerId
      || s.role === 'athlete' && s.athleteUserId !== s.ownerId
      || s.role === 'coach' && !s.athletes?.some(a => a.id === s.athleteId))
      throw Error('Samtalen er ikke tilgængelig.')
    return { ...s, athletes: s.athletes?.map(row => ({ ...row })) }
  }
  function current(expected) {
    const s = scope()
    if (s.athleteId !== expected.athleteId || s.ownerId !== expected.ownerId || s.role !== expected.role)
      throw Error('Samtalens modtager er ændret.')
    return s
  }
  async function readPages(table, s) {
    const rows = new Map()
    for (let page = 0; page < maxPages; page++) {
      current(s)
      const result = await database.from(table).select('*').eq('athlete_id', s.athleteId)
        .order('created_at').order('id').range(page * pageSize, (page + 1) * pageSize - 1)
      current(s)
      if (result?.error || !Array.isArray(result?.data)) throw Error('Samtalen kunne ikke hentes.')
      let added = 0
      for (const row of result.data) {
        if (!validId(row?.id) || row.athlete_id !== s.athleteId) throw Error('Forkert atlet i svaret.')
        if (!rows.has(row.id)) added++
        rows.set(row.id, row)
      }
      if (result.data.length < pageSize) return [...rows.values()]
      if (!added) throw Error('Gentaget side. Opdatér samtalen.')
    }
    throw Error('Samtalen overstiger hentegrænsen. Ingen afkortet historik vises som komplet.')
  }
  const sendFailure = cause => new Error('Beskeden blev ikke sendt. Prøv igen.', { cause })
  async function confirmedMessage(s, id) {
    let result
    try { result = await database.from('messages').select('*').eq('athlete_id', s.athleteId).eq('id', id) }
    catch (cause) { current(s); throw sendFailure(cause) }
    current(s)
    if (result?.error || !Array.isArray(result?.data)) throw sendFailure(result?.error || Error('Afsendelsen kunne ikke kontrolleres.'))
    return result.data.find(row => row.id === id && row.athlete_id === s.athleteId)
  }
  const referenceKey = s => `entropi2:conversation:submissions:v1:${encodeURIComponent(s.ownerId)}:${s.athleteId}`
  function knownReferences(s) {
    const store = storage?.()
    current(s)
    if (!store) return []
    const value = store.getItem(referenceKey(s))
    const ids = value === null ? [] : JSON.parse(value)
    if (!Array.isArray(ids) || ids.length > 10000 || ids.some(id => !validId(id)))
      throw Error('Videoreferencer kunne ikke hentes.')
    current(s)
    return [...new Set(ids)]
  }
  async function identity(s, clientAnalysisId) {
    const result = await database.rpc('get_my_video_analysis_submission_identity_v3',
      { p_client_analysis_id: clientAnalysisId }).single()
    current(s)
    const row = result?.data
    if (result?.error || !validId(row?.id) || row.athlete_id !== s.athleteId
      || row.client_analysis_id !== clientAnalysisId || !['draft', 'shared'].includes(row.status))
      throw Error('Videoen er endnu ikke bekræftet.')
    // Identity RPC may expose only identity/status, never assume media/feedback is present.
    return { ...row, source_mode: 'athlete_submission' }
  }
  async function coachReceipt(s, row) {
    const key = coachBriefingPointKey({ kind: 'video', video: row })
    const result = await database.from('coach_briefing_seen').select('point_key,seen_at')
      .eq('coach_id', s.ownerId).eq('point_key', key)
    current(s)
    // Existing table is not assumed deployed. Failed reads remain conservatively unread.
    if (result?.error || !Array.isArray(result?.data)) return null
    return result.data.find(r => r.point_key === key && typeof r.seen_at === 'string'
      && Number.isFinite(Date.parse(r.seen_at)))?.seen_at || null
  }
  return {
    scope,
    async load() {
      const s = scope()
      // video_analyses: same existing scoped read capability as coach history.
      // Athlete entry supplies its existing RPC reader instead (see below).
      const [messages, analyses] = await Promise.all([readPages('messages', s),
        s.role === 'athlete' ? this.readAthleteVideos(s) : readPages('video_analyses', s)])
      current(s)
      const received = s.role === 'coach' ? await Promise.all(analyses.map(async row => ({ ...row,
        conversationCoachSeenAt: row.source_mode === 'athlete_submission' ? await coachReceipt(s, row) : null }))) : analyses
      current(s); return { messages, analyses: received }
    },
    async readAthleteVideos(s) {
      const rows = new Map()
      for (const id of knownReferences(s)) {
        const row = await identity(s, id); rows.set(row.id, row)
      }
      const sharedIds = new Set()
      for (let page = 0; page < maxPages; page++) {
        current(s)
        const result = await database.rpc('get_my_shared_video_analyses_v3', { p_limit: 6, p_offset: page * 6 })
        current(s)
        if (result?.error || !Array.isArray(result?.data)) throw Error('Videofeedback kunne ikke hentes.')
        let added = 0
        for (const row of result.data) {
          // RPC is athlete scoped and may omit athlete_id. Bind only here, never arbitrary props.
          if (!validId(row?.id) || row.athlete_id && row.athlete_id !== s.athleteId) throw Error('Forkert videoatlet.')
          if (!sharedIds.has(row.id)) added++
          sharedIds.add(row.id)
          rows.set(row.id, { ...row, athlete_id: s.athleteId, status: 'shared' })
        }
        if (result.data.length < 6) return [...rows.values()]
        if (!added) throw Error('Gentaget videoside.')
      }
      throw Error('Videoernes hentegrænse er nået.')
    },
    async send(row) {
      const s = scope()
      if (!validId(row?.id) || row.athlete_id !== s.athleteId || row.sender_role !== s.role
        || !['besked', 'teknik'].includes(row.category) || typeof row.content !== 'string'
        || !row.content.trim() || row.content.length > 10000) throw Error('Ugyldig besked.')
      const match = saved => saved && ['id', 'athlete_id', 'sender_role', 'content', 'category']
        .every(key => saved[key] === row[key])
      const prior = await confirmedMessage(s, row.id)
      if (prior) { if (!match(prior)) throw Error('Besked-id er allerede brugt.'); return prior }
      current(s)
      // Reuse messages.id across every retry, including unknown write outcomes.
      let result
      try { result = await database.from('messages').insert(row) }
      catch (cause) { result = { error: cause } }
      current(s)
      const saved = await confirmedMessage(s, row.id)
      if (!match(saved)) throw sendFailure(result?.error || Error('Afsendelsen er ikke bekræftet.'))
      return saved
    },
    async seen(item) {
      const s = scope(), row = item.value
      if (row.athlete_id !== s.athleteId || !validId(row.id)) throw Error('Forkert læsemarkering.')
      let table, patch, query
      if (item.kind === 'message') {
        if (row.sender_role === s.role) return row
        table = 'messages'; patch = s.role === 'athlete' ? { read_at: new Date().toISOString() } : { read_by_coach: true }
        query = database.from(table).update(patch).eq('athlete_id', s.athleteId).eq('id', row.id).eq('sender_role', row.sender_role)
      } else {
        if (s.role === 'coach') {
          if (row.source_mode !== 'athlete_submission' || !['draft', 'shared'].includes(row.status)) return row
          const now = new Date().toISOString()
          const result = await database.from('coach_briefing_seen').upsert({ coach_id: s.ownerId,
            point_key: coachBriefingPointKey({ kind: 'video', video: row }), seen_at: now },
          { onConflict: 'coach_id,point_key' })
          current(s)
          // coachReceipt validates the scoped receipt; compare instants across wire formats.
          if (!result || result.error || Date.parse(await coachReceipt(s, row)) !== Date.parse(now))
            throw Error('Kunne ikke gemme Set for videoen. Videoen er fortsat ulæst.')
          return { ...row, conversationCoachSeenAt: now }
        }
        if (s.role !== 'athlete' || row.status !== 'shared') return row
        table = 'video_analyses'; patch = { athlete_seen_at: new Date().toISOString() }
        query = database.from(table).update(patch).eq('athlete_id', s.athleteId).eq('id', row.id).eq('status', 'shared')
      }
      const result = await query.select('id')
      current(s)
      if (result?.error || result?.data?.length !== 1 || result.data[0].id !== row.id) throw Error('Kunne ikke markere som læst.')
      return { ...row, ...patch }
    },
    templates() {
      const s = scope()
      if (s.role !== 'coach') return []
      return readCoachTemplates(storage(), s.ownerId).map(row => ({ ...row,
        text: fillCoachTemplate(row.text, s.athletes.find(a => a.id === s.athleteId).name) }))
    },
    upload() {
      const s = scope()
      if (s.role !== 'athlete' || !openUpload) throw Error('Videoupload er ikke tilgængelig.')
      return openUpload()
    },
    async submission(clientAnalysisId) {
      const s = scope()
      if (s.role !== 'athlete' || !validId(clientAnalysisId)) throw Error('Ugyldig videoidentitet.')
      const row = await identity(s, clientAnalysisId)
      const store = storage?.()
      current(s)
      if (!store) throw Error('Videoreferencen kunne ikke gemmes lokalt. Prøv igen med samme identitet.')
      const ids = [...new Set([...knownReferences(s), clientAnalysisId])]
      if (ids.length > 10000) throw Error('Videoreferencernes grænse er nået.')
      store.setItem(referenceKey(s), JSON.stringify(ids))
      current(s)
      if (!knownReferences(s).includes(clientAnalysisId)) throw Error('Videoreferencen blev ikke gemt lokalt.')
      return row
    },
    open(row) {
      const s = scope()
      if (row?.athlete_id !== s.athleteId) throw Error('Forkert videoatlet.')
      const fn = s.role === 'athlete' ? openFeedback : row.analysis_state === 'awaiting_analysis'
        ? openAwaitingAnalysisVideo : openVideoAnalysisReview
      if (!fn) throw Error('Videovisningen er ikke tilgængelig.')
      return fn(row)
    },
  }
}

// Existing AthleteView setters; useVideoCoachBro retains all native upload gates.
export function athleteUploadEntry({ setAthleteVideoCoachInstant, setAthleteVideoCoachOpen }) {
  return () => { setAthleteVideoCoachInstant(true); setAthleteVideoCoachOpen(true) }
}

export function athleteConversationScope({ enabled = false, session, athlete, coachAthleteId }) {
  return { enabled: enabled === true && !coachAthleteId, role: 'athlete', ownerId: session?.user?.id,
    athleteId: athlete?.id, athleteUserId: athlete?.user_id }
}
export function coachConversationScope({ enabled = false, session, selectedAthlete, athletes = [], hiddenAthleteIds }) {
  return { enabled: enabled === true, role: 'coach', ownerId: session?.user?.id,
    athleteId: selectedAthlete?.id, athletes: athletes.filter(row => !hiddenAthleteIds?.has(row.id)) }
}
