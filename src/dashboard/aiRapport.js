// ORDRE 377: flyttet uændret fra src/Dashboard.jsx (se docs/DASHBOARD-KORT.md).
// "AI-rapport" på Analyse-fanen: bygger teksten coachen kopierer til en AI
// (instruktion, nøgletal, e1RM/tonnage-digest, træningslog, PR, parathed,
// kropsvægt, stævner). Handler-fabrik: Dashboard kalder den i hvert render.
import { parsePlannedRpe } from '../dashboardShared'
import { ATHLETE_LOGS_LIMIT } from './coachKonstanter'
import { byggKategoriOpslag, kategoriFor } from '../exerciseNames'

export function lavAiRapport({
  athleteLogs, athletePRs, athleteReadiness, athleteWeightLogs, exerciseLibrary, meetResults,
  selectedAthlete, setAiExportText,
}) {
  function generateAIReport(weeksBack) {
    const ath = selectedAthlete
    if (!ath) return

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeksBack * 7)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const fmtDato = str => new Date(str + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' })
    const fmtDatoShort = str => new Date(str + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
    const pad = (str, len) => String(str).padEnd(len)

    // Byg sessions fra athleteLogs
    const sessionMap = {}
    for (const log of athleteLogs) {
      const ex = log.exercises
      const sess = ex?.sessions
      const week = sess?.weeks
      const date = log.logged_at.slice(0, 10)
      if (date < cutoffStr) continue
      const key = `${ex?.session_id}_${date}`
      if (!sessionMap[key]) {
        sessionMap[key] = {
          date,
          title: sess?.title || 'Ukendt session',
          week_number: week?.week_number ?? null,
          block_name: week?.block_name ?? null,
          athlete_rating: sess?.athlete_rating ?? null,
          athlete_comment: sess?.athlete_comment ?? null,
          exercises: {},
        }
      }
      const exId = log.exercise_id
      if (!sessionMap[key].exercises[exId]) {
        sessionMap[key].exercises[exId] = {
          name: ex?.name ?? 'Ukendt øvelse',
          planned_sets: ex?.sets ?? null,
          planned_reps: ex?.reps ?? null,
          planned_intensity: ex?.intensity ?? null,
          planned_rpe_int: parsePlannedRpe(ex?.intensity), // fallback når sæt ikke har eget rpe_planned
          sets: [],
        }
      }
      sessionMap[key].exercises[exId].sets.push({
        set_number: log.set_number,
        weight: log.weight,
        reps: log.reps_completed,
        rpe_planned: log.rpe_planned,
        rpe_actual: log.rpe_actual,
        skipped: log.skipped,
      })
    }

    const sessions = Object.values(sessionMap).sort((a, b) => a.date.localeCompare(b.date))

    // Grupper sessions per uge
    const weekGroups = {}
    for (const sess of sessions) {
      const wk = sess.week_number ?? 'Ukendt'
      const wkKey = `${String(wk).padStart(3, '0')}_${sess.block_name || ''}`
      if (!weekGroups[wkKey]) weekGroups[wkKey] = { week_number: wk, block_name: sess.block_name, sessions: [] }
      weekGroups[wkKey].sessions.push(sess)
    }

    const periodStart = sessions.length ? fmtDatoShort(sessions[0].date) : '—'
    const periodEnd = sessions.length ? fmtDatoShort(sessions[sessions.length - 1].date) : '—'

    const filteredWeight = athleteWeightLogs.filter(l => l.logged_at >= cutoffStr).sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    const filteredReadiness = athleteReadiness.filter(l => l.logged_date >= cutoffStr).sort((a, b) => a.logged_date.localeCompare(b.logged_date))
    const filteredPRs = athletePRs.filter(l => (l.logged_at || '').slice(0, 10) >= cutoffStr).sort((a, b) => (a.logged_at || '').localeCompare(b.logged_at || ''))

    const avgWeight = filteredWeight.length ? (filteredWeight.reduce((s, l) => s + l.weight, 0) / filteredWeight.length).toFixed(1) : null

    // Nøgletal til AI-resumé
    let loggedSets = 0, skippedSets = 0, rpeSum = 0, rpeCount = 0, rpeDevSum = 0, rpeDevCount = 0
    for (const sess of sessions) {
      for (const ex of Object.values(sess.exercises)) {
        for (const set of ex.sets) {
          if (set.skipped) { skippedSets++; continue }
          loggedSets++
          if (set.rpe_actual != null) {
            rpeSum += Number(set.rpe_actual); rpeCount++
            const planRpe = set.rpe_planned ?? ex.planned_rpe_int
            if (planRpe != null) { rpeDevSum += Number(set.rpe_actual) - planRpe; rpeDevCount++ }
          }
        }
      }
    }
    const avgRpe = rpeCount ? (rpeSum / rpeCount).toFixed(1) : null
    const avgRpeDev = rpeDevCount ? (rpeDevSum / rpeDevCount) : null
    const weightsAsc = filteredWeight
    const weightStart = weightsAsc.length ? weightsAsc[0].weight : null
    const weightEnd = weightsAsc.length ? weightsAsc[weightsAsc.length - 1].weight : null
    const weightDelta = (weightStart != null && weightEnd != null) ? (weightEnd - weightStart).toFixed(1) : null
    const avgReadiness = filteredReadiness.length ? Math.round(filteredReadiness.reduce((s, r) => s + (r.readiness_score || 0), 0) / filteredReadiness.length) : null

    let lines = []

    // Instruktion til AI (så coachen bare kan paste og få en analyse)
    lines.push('INSTRUKTION TIL AI')
    lines.push('Du er en erfaren styrke- og styrkeløftcoach (squat, bænk, dødløft, OHP) og fungerer')
    lines.push('som et KRITISK, analytisk medblik for atletens coach. Ikke for atleten, og ikke som')
    lines.push('den der bestemmer programmet: coachen designer selv træningen ud fra mange års')
    lines.push('erfaring. Din opgave er at kvalificere hans beslutning med en skarp, ærlig datalæsning.')
    lines.push('Svar på dansk.')
    lines.push('')
    lines.push('KRAV TIL DIT SVAR:')
    lines.push('  1. Underbyg HVER observation med konkrete tal, datoer eller sessioner fra data.')
    lines.push('     Ingen generiske udsagn. Skriv fx "Squat e1RM 212 til 224 over 5 uger", ikke')
    lines.push('     "pæn fremgang". Peg på det sæt/den uge der bærer konklusionen.')
    lines.push('  2. Vær kritisk med nuancer. Skeln signal fra støj: en enkelt høj RPE eller én dårlig')
    lines.push('     dag er ikke en tendens. Nævn konfoundere (lav readiness, få målinger, kropsvægt-')
    lines.push('     udsving kan være hydrering) og sig klart hvornår data er for tyndt til en')
    lines.push('     konklusion. Skeln korrelation fra kausalitet. Overfortolk ikke små stikprøver.')
    lines.push('  3. Begrund HVER anbefaling: mekanismen bag den OG det datagrundlag den hviler på.')
    lines.push('     Giv hellere 2 til 3 muligheder med afvejning end ét diktat, og lad coachen vælge.')
    lines.push('  4. Undlad ros for rosens skyld. Sig "utilstrækkeligt data" når det er tilfældet.')
    lines.push('')
    lines.push('FAGLIGT GRUNDLAG (ræsonnér inden for dette; coachens egen metode har forrang hvor den afviger):')
    lines.push('  - RPE/RIR: RPE 10 = 0 reps tilbage, 9 = ca. 1, 8 = ca. 2, 7 = ca. 3. Autoregulering:')
    lines.push('    vægten justeres for at ramme mål-RPE. Stigende RPE på SAMME vægt over tid tyder på')
    lines.push('    akkumuleret træthed. RPE er mest pålidelig på tunge sæt med lave reps.')
    lines.push('  - e1RM (Epley) er et proxy for maksstyrke. Læs TENDENSER over uger, ikke enkeltsessioner.')
    lines.push('    Mest troværdig ved 1 til 5 reps; høje reps overvurderer typisk.')
    lines.push('  - Volumen vs. intensitet: volumen (sæt × reps, tonnage) driver hypertrofi og')
    lines.push('    arbejdskapacitet; intensitet (% af 1RM / RPE) driver maksstyrke og specificitet.')
    lines.push('    Tænk i minimum effektiv volumen vs. maksimal restituerbar volumen.')
    lines.push('  - SRA og specificitet: adaptation kræver at træthed forsvinder (superkompensation).')
    lines.push('    Konkurrenceløftene (squat/bænk/dødløft, evt. OHP) skal trænes specifikt tæt på stævne.')
    lines.push('  - Blok-periodisering, typiske faser og formål: Akkumulering = volumen, moderat RPE.')
    lines.push('    Intensivering = tungere, færre reps, højere RPE. Peak = specificitet, skåret volumen,')
    lines.push('    korte tunge sæt. Deload = fjern træthed. GPP/hypertrofi = off-season base.')
    lines.push('  - Under-restitution: lav readiness + RPE-inflation ved fast vægt + stagnerende e1RM')
    lines.push('    peger samlet på for lidt restitution. Deload udløses planlagt eller reaktivt.')
    lines.push('  - Kropsvægt påvirker løftearme og vægtklasse; tolk kortsigtede udsving med forbehold')
    lines.push('    for hydrering og glykogen.')
    lines.push('  - Individualisering: ovenstående er generelt. Vægt atletens kontekst og coachens metode.')
    lines.push('')
    lines.push('STRUKTUR PÅ SVARET:')
    lines.push('  1) Fremgang & tendenser: e1RM pr. løft (tal + ændring), RPE vs. plan (er der drift?),')
    lines.push('     volumen/tonnage. Vurdér: er fremgangen reel, eller ligger den inden for støj?')
    lines.push('  2) Restitution: mønstre i søvn/energi/motivation/stress/ømhed vs. præstation, læst')
    lines.push('     kritisk (konfoundere, hvilken vej årsagen går).')
    lines.push('  3) Røde flag: stagnation, høj RPE ved let vægt, lav konsistens, uønsket vægtændring.')
    lines.push('     Angiv alvorsgrad og hvad der VILLE be- eller afkræfte flaget.')
    lines.push('  4) Handleperspektiv til næste blok: konkrete forslag (volumen, intensitet, øvelses-')
    lines.push('     valg, evt. deload) MED begrundelse og afvejning. Marker hvor du er usikker.')
    lines.push('  5) Datakvalitet: hvad mangler, eller hvad ville skærpe analysen næste gang.')
    lines.push('')
    lines.push('LÆSENØGLE: energi/motivation/stress/ømhed = 1-5 · readiness = 0-100 · RPE = 6-10.')
    lines.push('Digest-tabellerne EST. 1RM-UDVIKLING og UGENTLIGT TONNAGE er dit primære grundlag for')
    lines.push('fremgang og volumen. I loggen betyder "RPE 8 (plan 7)" faktisk vs. planlagt RPE for sættet.')
    lines.push('Læg vægt på atletens MÅL og COACH-NOTER øverst når du vurderer relevans, prioritering')
    lines.push('og individuelle hensyn (fx skader). Antag intet om data der ikke findes.')
    lines.push('')

    lines.push('═══════════════════════════════════════════════════════')
    lines.push(`ATLET:    ${ath.name}`)
    lines.push(`PERIODE:  Seneste ${weeksBack} uger (${periodStart} – ${periodEnd})`)
    lines.push(``)
    const maxes = [
      ath.squat ? `Squat ${ath.squat}kg` : null,
      ath.bench ? `Bænk ${ath.bench}kg` : null,
      ath.deadlift ? `Dødløft ${ath.deadlift}kg` : null,
    ].filter(Boolean)
    if (maxes.length) lines.push(`KONKURRENCEMAXES: ${maxes.join(' | ')}`)
    const trainMaxes = [
      ath.training_squat ? `Squat ${ath.training_squat}kg` : null,
      ath.training_bench ? `Bænk ${ath.training_bench}kg` : null,
      ath.training_deadlift ? `Dødløft ${ath.training_deadlift}kg` : null,
    ].filter(Boolean)
    if (trainMaxes.length) lines.push(`TRÆNINGSMAXES:    ${trainMaxes.join(' | ')}`)
    if (ath.competition_date) lines.push(`STÆVNE:           ${fmtDato(ath.competition_date)}`)
    if (avgWeight) lines.push(`KROPSVÆGT:        ${avgWeight}kg gns (${filteredWeight.length} målinger)`)
    // Mål og coach-noter giver AI'en den kontekst (skader, fokus, individuelle
    // hensyn) der gør analysen nuanceret frem for generisk.
    if (ath.goal && ath.goal.trim()) lines.push(`MÅL:              ${ath.goal.trim()}`)
    if (ath.notes && ath.notes.trim()) {
      lines.push('COACH-NOTER (kontekst, skader, hensyn):')
      ath.notes.trim().split('\n').forEach(l => lines.push(`  ${l}`))
    }
    lines.push('═══════════════════════════════════════════════════════')
    lines.push('')

    // Nøgletal
    lines.push('── NØGLETAL (perioden) ─────────────────────────────────')
    lines.push('')
    lines.push(`  Træningspas:     ${sessions.length} over ${Object.keys(weekGroups).length} uger`)
    lines.push(`  Loggede sæt:     ${loggedSets}${skippedSets ? ` (+ ${skippedSets} skippet)` : ''}`)
    if (avgRpe) lines.push(`  Gns. RPE:        ${avgRpe}`)
    if (avgRpeDev != null) {
      const sign = avgRpeDev > 0 ? '+' : ''
      const tolk = avgRpeDev >= 0.5 ? ' (tungere end planlagt)' : avgRpeDev <= -0.5 ? ' (lettere end planlagt)' : ' (på plan)'
      lines.push(`  RPE vs. plan:    ${sign}${avgRpeDev.toFixed(1)}${tolk} · ${rpeDevCount} sæt m. plan`)
    }
    if (avgReadiness != null) lines.push(`  Gns. readiness:  ${avgReadiness}/100 (${filteredReadiness.length} check-ins)`)
    if (weightDelta != null) lines.push(`  Vægtudvikling:   ${weightStart}kg → ${weightEnd}kg (${weightDelta > 0 ? '+' : ''}${weightDelta}kg)`)
    lines.push('')

    // Afkortnings-advarsel: ramte vi fetch-grænsen, og er ældste hentede sæt nyere end
    // periodens start, så mangler de ældste uger i rapporten (lydløst datatab uden dette).
    const oldestLogged = athleteLogs.length ? athleteLogs[athleteLogs.length - 1].logged_at.slice(0, 10) : null
    if (athleteLogs.length >= ATHLETE_LOGS_LIMIT && oldestLogged && oldestLogged > cutoffStr) {
      lines.push(`⚠ BEMÆRK: træningsdata er afkortet ved ${ATHLETE_LOGS_LIMIT} sæt — log før ${fmtDatoShort(oldestLogged)} mangler. Vælg færre uger for fuld dækning.`)
      lines.push('')
    }

    // Est. 1RM-udvikling + ugentligt tonnage pr. hovedløft (digest før den rå log)
    const nameToCat = byggKategoriOpslag(exerciseLibrary)
    // OHP har ingen bibliotekskategori — genkend barbell overhead press på navn
    // (samme regler som atlet-siden) og behandl det som en "OHP"-kategori. Sådan
    // kommer OHP-fokuserede atleter (fx Henrik) med i digest-tabellerne.
    const ohpRe = /ohp|overhead|militar|push press|strict pres|split jerk/
    const ohpExclude = /triceps|extension|raise|fly|db |dumbbell|håndvægt/
    const catFor = name => {
      const n = (name || '').toLowerCase()
      if (ohpRe.test(n) && !ohpExclude.test(n)) return 'OHP'
      return kategoriFor(name, nameToCat)
    }
    const mainCats = [['Squat', 'Squat'], ['Bænk', 'Bænkpres'], ['Dødløft', 'Dødløft'], ['OHP', 'OHP']]
    const epley = (w, r) => w * (1 + r / 30)
    const wkLbl = w => { const d = new Date(w + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }
    const isoMon = dateStr => {
      const d = new Date(dateStr + 'T12:00:00'); const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0, 10)
    }
    const e1rmByCat = {}     // cat -> { date -> bedste e1RM }
    const tonByCatWeek = {}  // cat -> { mandagsnøgle -> kg-volumen }
    const weekKeysSet = new Set()
    for (const sess of sessions) {
      for (const ex of Object.values(sess.exercises)) {
        const cat = catFor(ex.name)
        if (!cat) continue
        for (const set of ex.sets) {
          if (set.skipped || !set.weight || !set.reps) continue
          const e = epley(Number(set.weight), Number(set.reps))
          if (!e1rmByCat[cat]) e1rmByCat[cat] = {}
          if (!(sess.date in e1rmByCat[cat]) || e > e1rmByCat[cat][sess.date]) e1rmByCat[cat][sess.date] = e
          const wk = isoMon(sess.date)
          weekKeysSet.add(wk)
          if (!tonByCatWeek[cat]) tonByCatWeek[cat] = {}
          tonByCatWeek[cat][wk] = (tonByCatWeek[cat][wk] || 0) + Number(set.weight) * Number(set.reps)
        }
      }
    }

    const e1rmLines = []
    for (const [lbl, cat] of mainCats) {
      const m = e1rmByCat[cat]
      if (!m) continue
      const dates = Object.keys(m).sort()
      const pts = dates.map(d => `${Math.round(m[d])} (${fmtDatoShort(d)})`)
      const first = Math.round(m[dates[0]]), last = Math.round(m[dates[dates.length - 1]])
      const delta = last - first, pct = first ? Math.round((delta / first) * 100) : 0
      const trend = dates.length > 1 ? `   Δ ${delta > 0 ? '+' : ''}${delta}kg (${pct > 0 ? '+' : ''}${pct}%)` : ''
      e1rmLines.push(`  ${pad(lbl, 10)}${pts.join(' · ')}${trend}`)
    }
    if (e1rmLines.length) {
      lines.push('── EST. 1RM-UDVIKLING (Epley, bedste sæt pr. dag) ──────')
      lines.push('')
      lines.push(...e1rmLines)
      lines.push('')
    }

    const weekKeys = [...weekKeysSet].sort()
    if (weekKeys.length && Object.keys(tonByCatWeek).length) {
      lines.push('── UGENTLIGT TONNAGE (tons = vægt × reps / 1000) ───────')
      lines.push('')
      lines.push(`  ${pad('', 10)}${weekKeys.map(w => pad(wkLbl(w), 7)).join('')}`)
      for (const [lbl, cat] of mainCats) {
        const m = tonByCatWeek[cat]
        if (!m) continue
        lines.push(`  ${pad(lbl, 10)}${weekKeys.map(w => pad(m[w] != null ? (Math.round(m[w] / 100) / 10).toFixed(1) : '—', 7)).join('')}`)
      }
      lines.push('')
    }

    // Træningslog
    lines.push('── TRÆNINGSLOG ─────────────────────────────────────────')
    lines.push('')

    if (Object.keys(weekGroups).length === 0) {
      lines.push('Ingen træningslog i perioden.')
    } else {
      for (const wkKey of Object.keys(weekGroups).sort()) {
        const wg = weekGroups[wkKey]
        lines.push(`Uge ${wg.week_number}${wg.block_name ? ` — ${wg.block_name}` : ''}`)
        for (const sess of wg.sessions) {
          const ratingStr = sess.athlete_rating ? ` [Rating: ${sess.athlete_rating}/5]` : ' [Ikke rated]'
          lines.push(`  ▸ ${sess.title} [${fmtDatoShort(sess.date)}]${ratingStr}`)
          if (sess.athlete_comment) lines.push(`    Kommentar: "${sess.athlete_comment}"`)
          for (const ex of Object.values(sess.exercises)) {
            const planStr = [
              ex.planned_sets && ex.planned_reps ? `${ex.planned_sets}×${ex.planned_reps}` : null,
              ex.planned_intensity ? `@${ex.planned_intensity}` : null,
            ].filter(Boolean).join(' ')
            lines.push(`    ${pad(ex.name, 24)}${planStr ? `Plan: ${planStr}` : ''}`)
            const sortedSets = ex.sets.sort((a, b) => a.set_number - b.set_number)
            for (const set of sortedSets) {
              if (set.skipped) {
                lines.push(`      Sæt ${set.set_number}: [skippet]`)
              } else {
                const planRpe = set.rpe_planned ?? ex.planned_rpe_int
                const rpeStr = set.rpe_actual != null
                  ? `  RPE ${set.rpe_actual}${planRpe != null ? ` (plan ${planRpe})` : ''}`
                  : (planRpe != null ? `  RPE plan ${planRpe}` : '')
                lines.push(`      Sæt ${set.set_number}: ${set.weight}kg × ${set.reps}${rpeStr}`)
              }
            }
          }
        }
        lines.push('')
      }
    }

    // PRs i perioden
    if (filteredPRs.length > 0) {
      lines.push('── PERSONLIGE REKORDER (i perioden) ────────────────────')
      lines.push('')
      for (const pr of filteredPRs) {
        lines.push(`  ${pad(pr.exercise_name, 20)} ${pr.weight}kg × ${pr.reps}  (${fmtDatoShort(pr.logged_at.slice(0, 10))})`)
      }
      lines.push('')
    }

    // Readiness
    if (filteredReadiness.length > 0) {
      lines.push('── READINESS (energi/motiv./stress/ømhed = 1–5) ────────')
      lines.push('')
      lines.push(`  ${pad('Dato', 10)}${pad('Søvn', 7)}${pad('Energi', 8)}${pad('Motiv.', 8)}${pad('Stress', 8)}${pad('Ømhed', 8)}Score`)
      for (const r of filteredReadiness) {
        lines.push(`  ${pad(fmtDatoShort(r.logged_date), 10)}${pad(r.sleep_hours != null ? r.sleep_hours + 't' : '—', 7)}${pad(r.energy != null ? r.energy + '/5' : '—', 8)}${pad(r.motivation != null ? r.motivation + '/5' : '—', 8)}${pad(r.stress != null ? r.stress + '/5' : '—', 8)}${pad(r.soreness_level != null ? r.soreness_level + '/5' : '—', 8)}${r.readiness_score != null ? r.readiness_score + '/100' : '—'}`)
      }
      const zoneCounts = {}
      for (const r of filteredReadiness) for (const z of (r.sore_zones || [])) zoneCounts[z] = (zoneCounts[z] || 0) + 1
      const zones = Object.entries(zoneCounts).sort((a, b) => b[1] - a[1])
      if (zones.length) {
        lines.push('')
        lines.push(`  Hyppigste ømme zoner: ${zones.map(([z, n]) => `${z} (${n}x)`).join(', ')}`)
      }
      // Korrelations-hint: gns. RPE på lav-readiness-dage (<50) vs. gode dage (≥75).
      // Samme dato-tærskler som atlet-appens readinessSignal. Viser om træning føles
      // tungere når atleten er upklar → input til restitutions-vurdering (pkt. 2).
      const readinessByDate = {}
      for (const r of filteredReadiness) if (r.readiness_score != null) readinessByDate[r.logged_date] = r.readiness_score
      let lowRpeSum = 0, lowRpeN = 0, hiRpeSum = 0, hiRpeN = 0
      for (const sess of sessions) {
        const score = readinessByDate[sess.date]
        if (score == null) continue
        for (const ex of Object.values(sess.exercises)) {
          for (const set of ex.sets) {
            if (set.skipped || set.rpe_actual == null) continue
            if (score < 50) { lowRpeSum += Number(set.rpe_actual); lowRpeN++ }
            else if (score >= 75) { hiRpeSum += Number(set.rpe_actual); hiRpeN++ }
          }
        }
      }
      if (lowRpeN >= 2 && hiRpeN >= 2) {
        const lowAvg = (lowRpeSum / lowRpeN).toFixed(1), hiAvg = (hiRpeSum / hiRpeN).toFixed(1)
        const diff = (lowRpeSum / lowRpeN) - (hiRpeSum / hiRpeN)
        const tolk = diff >= 0.5 ? ' → træning føles tungere på upklare dage' : diff <= -0.5 ? ' → træning føles lettere på upklare dage (uventet)' : ' → ingen tydelig forskel'
        lines.push('')
        lines.push(`  RPE vs. readiness: ${lowAvg} på lav-readiness-dage (<50, ${lowRpeN} sæt) vs. ${hiAvg} på gode dage (≥75, ${hiRpeN} sæt)${tolk}`)
      }
      lines.push('')
    }

    // Vægt
    if (filteredWeight.length > 0) {
      lines.push('── KROPSVÆGT ───────────────────────────────────────────')
      lines.push('')
      for (const w of filteredWeight) {
        lines.push(`  ${fmtDatoShort(w.logged_at)}   ${w.weight}kg`)
      }
      lines.push('')
    }

    // Stævnehistorik
    if (meetResults.length > 0) {
      lines.push('── STÆVNEHISTORIK ──────────────────────────────────────')
      lines.push('')
      for (const m of [...meetResults].reverse()) {
        const parts = [
          m.squat != null ? `S ${m.squat}` : null,
          m.bench != null ? `B ${m.bench}` : null,
          m.deadlift != null ? `D ${m.deadlift}` : null,
        ].filter(Boolean).join(' / ')
        lines.push(`  ${pad(fmtDatoShort(m.meet_date), 12)}${pad(m.meet_name || '—', 22)}${parts}${m.total != null ? `  = ${m.total}kg` : ''}`)
      }
      lines.push('')
    }

    lines.push('═══════════════════════════════════════════════════════')

    setAiExportText(lines.join('\n'))
  }

  return {
    generateAIReport,
  }
}
