// draft-next-week — genererer (preview) og opretter (commit) næste uges
// programudkast for en atlet, direkte fra coach-portalen.
//
// Samme regler som entropi-agent/draft.py:
//   - Kildeuge = seneste uge med start_date <= i dag (fallback: højeste week_number)
//   - RPE-progression ±2,5 kg (skippes på 0 kg-placeholder-øvelser)
//   - >50% skippede sæt -> uændret + "gentag"-note
//   - Kollisionstjek på weeks(athlete_id, start_date) — datoen ændres ALDRIG automatisk
//   - Valideringsadvarsler (sessionsantal vs. reel frekvens, weekday, kollision)
//
// Kald (kræver coach-login, JWT verificeres):
//   POST /functions/v1/draft-next-week  { "mode": "preview", "athlete_id": "<uuid>" }
//   POST /functions/v1/draft-next-week  { "mode": "commit",  "athlete_id": "<uuid>", "payload": <fra preview> }
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assessProgressionGate,
  buildProgressionStateV1,
  progressionModelContextV1,
  validateProgressionStateV1,
} from "../_shared/progressionState.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_FROM_PREFIX: Record<string, string> = {
  man: "monday", tir: "tuesday", ons: "wednesday", tor: "thursday",
  fre: "friday", "lør": "saturday", lor: "saturday", "søn": "sunday", son: "sunday",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

function num(txt: unknown): number | null {
  if (txt === null || txt === undefined) return null;
  const m = String(txt).replace(",", ".").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

function dayForSession(s: { weekday?: number | null; title?: string | null }): string {
  if (typeof s.weekday === "number" && s.weekday >= 0 && s.weekday <= 6) return DAY_NAMES[s.weekday];
  const key = (s.title || "").trim().slice(0, 3).toLowerCase();
  return DAY_FROM_PREFIX[key] || "monday";
}

// (ny vægt, note) ud fra progressionsreglerne — spejler drafter._adjust
function adjust(weight: number | null, planRpe: number | null,
  act: { rpes: number[]; total: number; skipped: number } | undefined,
): [number | null, string | null] {
  if (weight === null || !act || act.total === 0) return [weight, null];
  if (act.skipped / act.total > 0.5) return [weight, "gentag - mange skippede sæt sidste uge"];
  if (weight === 0) return [weight, null]; // bodyweight/vælg-selv-vægt-placeholder
  if (!act.rpes.length || planRpe === null) return [weight, null];
  const avg = act.rpes.reduce((a, b) => a + b, 0) / act.rpes.length;
  if (avg <= planRpe - 1.0) return [Math.round((weight + 2.5) / 2.5) * 2.5, `+2.5kg (RPE ${avg.toFixed(1)} < plan)`];
  if (avg >= planRpe + 1.0) return [Math.round((weight - 2.5) / 2.5) * 2.5, `-2.5kg (RPE ${avg.toFixed(1)} > plan)`];
  return [weight, null];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Auth: kun coaches. Brugerens JWT slås op, rollen tjekkes med service-klienten.
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: "Ikke logget ind" }, 401);
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (prof?.role !== "coach") return json({ error: "Kun coaches kan generere udkast" }, 403);

    const requestBody = await req.json();
    const { mode, athlete_id, payload } = requestBody || {};
    if (!athlete_id) return json({ error: "athlete_id mangler" }, 400);

    // ---------- GODKEND PROGRESSIONSTILSTAND ----------
    // En coach skal eksplicit godkende den strukturerede forventning, før den
    // kan følge med til en ny uge. Det er adskilt fra både preview og commit.
    if (mode === "approve_progression_state") {
      const state = payload?.state;
      const sourceWeekId = payload?.source_week_id;
      const targetWeekNumber = Number(payload?.target_week_number);
      const validation = validateProgressionStateV1(state);
      if (!validation.ok) {
        return json({ error: "Progressionstilstand mangler påkrævet kontekst", missing: validation.errors }, 400);
      }
      if (!sourceWeekId || !Number.isInteger(targetWeekNumber) || targetWeekNumber < 1) {
        return json({ error: "Kildeuge eller måluge mangler i progressionstilstanden" }, 400);
      }
      if (state.program.source_week.id !== sourceWeekId
        || Number(state.program.target_week.number) !== targetWeekNumber) {
        return json({ error: "Progressionstilstanden passer ikke til det viste ugeudkast" }, 409);
      }
      const { data: sourceWeek, error: sourceWeekError } = await svc.from("weeks")
        .select("id, week_number").eq("id", sourceWeekId).eq("athlete_id", athlete_id).maybeSingle();
      if (sourceWeekError) return json({ error: `Kildeugen kunne ikke valideres: ${sourceWeekError.message}` }, 500);
      if (!sourceWeek || Number(sourceWeek.week_number) !== Number(state.program.source_week.number)) {
        return json({ error: "Kildeugen er ikke længere den, som forventningen blev bygget på" }, 409);
      }
      const { data: approved, error: approveError } = await svc.rpc("approve_training_progression_state", {
        p_athlete_id: athlete_id,
        p_state: state,
        p_source_week_id: sourceWeekId,
        p_target_week_number: targetWeekNumber,
        p_approved_by: user.id,
      });
      if (approveError) return json({ error: `Progressionstilstanden kunne ikke godkendes: ${approveError.message}` }, 500);
      return json({
        progression: {
          status: "approved_for_draft",
          can_commit: true,
          state_id: approved?.id,
          version: approved?.version,
          reasons: [],
        },
      });
    }

    // ---------- COMMIT ----------
    if (mode === "commit") {
      if (!payload?.p_payload) return json({ error: "payload mangler" }, 400);
      const progressionStateId = typeof payload?.progression_state_id === "string"
        ? payload.progression_state_id : null;
      const sourceWeekId = typeof payload?.source_week_id === "string" ? payload.source_week_id : null;
      const targetWeekNumber = Number(payload?.target_week_number);
      if (!progressionStateId || !sourceWeekId || !Number.isInteger(targetWeekNumber)) {
        return json({ error: "En godkendt progressionstilstand mangler. Generér og godkend forventningen først." }, 409);
      }
      const { data: progressionState, error: progressionStateError } = await svc
        .from("training_progression_states")
        .select("id, status, state, source_week_id, target_week_id, target_week_number")
        .eq("id", progressionStateId).eq("athlete_id", athlete_id).maybeSingle();
      if (progressionStateError) return json({ error: `Progressionstilstanden kunne ikke læses: ${progressionStateError.message}` }, 500);
      if (!progressionState || progressionState.status !== "approved" || progressionState.target_week_id) {
        return json({ error: "Den godkendte progressionstilstand er ikke længere klar til dette udkast." }, 409);
      }
      const validation = validateProgressionStateV1(progressionState.state);
      if (!validation.ok) {
        return json({ error: "Den godkendte progressionstilstand er ufuldstændig", missing: validation.errors }, 409);
      }
      if (progressionState.source_week_id !== sourceWeekId
        || Number(progressionState.target_week_number) !== targetWeekNumber
        || progressionState.state.program.source_week.id !== sourceWeekId
        || Number(progressionState.state.program.target_week.number) !== targetWeekNumber) {
        return json({ error: "Udkastet matcher ikke den godkendte progressionstilstand. Generér det igen." }, 409);
      }
      const sd = payload.start_date ?? null;
      if (sd) {
        const { data: clash } = await svc.from("weeks")
          .select("week_number, block_name").eq("athlete_id", athlete_id).eq("start_date", sd);
        if (clash?.length) {
          return json({
            error: `start_date ${sd} kolliderer med eksisterende uge ${clash[0].week_number}` +
              ` (${clash[0].block_name || "uden blok"}). Intet er oprettet — slet/ret den` +
              ` eksisterende uge, eller ret datoen i udkastet.`,
            collision: clash[0],
          }, 409);
        }
      }
      const { data: res, error: rpcErr } = await svc.rpc("create_program_week", { p_payload: payload.p_payload });
      if (rpcErr) return json({ error: `create_program_week fejlede: ${rpcErr.message}` }, 500);
      if (sd && res?.week_id) {
        const { error: sdErr } = await svc.from("weeks").update({ start_date: sd }).eq("id", res.week_id);
        if (sdErr) return json({ ...res, warning: `Ugen er oprettet, men start_date kunne ikke sættes: ${sdErr.message}` });
      }
      // weekday på sessioner: RPC'en sorterer sessioner efter dag — sortér payload ens og match på session_order
      const dayIdx = (d: string) => { const i = DAY_NAMES.indexOf((d || "").toLowerCase()); return i < 0 ? 99 : i; };
      const sorted = [...(payload.p_payload.sessions || [])].sort((a, b) => dayIdx(a.day) - dayIdx(b.day));
      const { data: dbSess } = await svc.from("sessions")
        .select("id, session_order").eq("week_id", res.week_id).order("session_order");
      let weekdaysSet = 0;
      for (let i = 0; i < sorted.length; i++) {
        const wd = DAY_NAMES.indexOf((sorted[i].day || "").toLowerCase());
        const db = (dbSess || []).find((s) => s.session_order === i);
        if (wd >= 0 && db) {
          const { error } = await svc.from("sessions").update({ weekday: wd }).eq("id", db.id);
          if (!error) weekdaysSet++;
        }
      }
      const { data: linkedState, error: stateLinkError } = await svc
        .from("training_progression_states")
        .update({ target_week_id: res.week_id, updated_at: new Date().toISOString() })
        .eq("id", progressionStateId).is("target_week_id", null)
        .select("id").maybeSingle();
      const progressionWarning = stateLinkError || !linkedState
        ? "Ugen er oprettet, men progressionstilstanden kunne ikke kobles til den. Gennemgå før næste forecast."
        : null;
      return json({ ...res, start_date: sd, weekdays_set: weekdaysSet, progression_warning: progressionWarning });
    }

    // ---------- PREVIEW ----------
    const today = new Date().toISOString().slice(0, 10);
    let { data: weeks } = await svc.from("weeks")
      .select("*, sessions(*, exercises(*))")
      .eq("athlete_id", athlete_id).lte("start_date", today)
      .order("start_date", { ascending: false }).order("week_number", { ascending: false }).limit(1);
    if (!weeks?.length) {
      ({ data: weeks } = await svc.from("weeks")
        .select("*, sessions(*, exercises(*))")
        .eq("athlete_id", athlete_id).order("week_number", { ascending: false }).limit(1));
    }
    const week = weeks?.[0];
    if (!week) return json({ error: "Ingen uger fundet for atleten" }, 404);

    const { data: progressionStates, error: progressionStateReadError } = await svc
      .from("training_progression_states")
      .select("id, version, status, state, source_week_id, target_week_id, target_week_number")
      .eq("athlete_id", athlete_id).eq("status", "approved")
      .order("version", { ascending: false }).limit(1);
    if (progressionStateReadError) {
      return json({ error: `Progressionstilstanden kunne ikke læses: ${progressionStateReadError.message}` }, 500);
    }
    const latestProgressionState = progressionStates?.[0] || null;

    // Faktiske logs seneste 7 dage pr. øvelsesnavn (snit-RPE + skip-andel)
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: logs7 } = await svc.from("exercise_logs")
      .select("rpe_actual, skipped, exercises(name)")
      .eq("athlete_id", athlete_id).gte("logged_at", since7).limit(3000);
    const actuals: Record<string, { rpes: number[]; total: number; skipped: number }> = {};
    for (const l of logs7 || []) {
      const name = (l as { exercises?: { name?: string } }).exercises?.name;
      if (!name) continue;
      const a = (actuals[name] ??= { rpes: [], total: 0, skipped: 0 });
      a.total++;
      if (l.skipped) a.skipped++;
      else if (l.rpe_actual !== null && l.rpe_actual !== undefined) a.rpes.push(Number(l.rpe_actual));
    }

    const changes: string[] = [];
    const sessionsSrc = [...(week.sessions || [])].sort(
      (a, b) => (a.session_order ?? 0) - (b.session_order ?? 0));
    const sessionsOut = sessionsSrc.map((s) => ({
      day: dayForSession(s),
      label: s.title,
      exercises: [...(s.exercises || [])]
        .sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
        .map((e) => {
          const planRpe = num(e.intensity);
          const weight = num(e.recommended_weight);
          const [newW, adjNote] = adjust(weight, planRpe, actuals[e.name]);
          if (adjNote && newW !== weight) {
            changes.push(`${s.title}: ${e.name} ${weight} -> ${newW} kg (${adjNote})`);
          } else if (adjNote) {
            changes.push(`${s.title}: ${e.name} (${adjNote})`);
          }
          const repsNum = num(e.reps);
          const oneSet: Record<string, unknown> = {};
          if (repsNum !== null) oneSet.reps = Math.round(repsNum);
          if (newW !== null) oneSet.weight = newW;
          const ex: Record<string, unknown> = {
            name: e.name,
            sets: Array.from({ length: e.sets || 1 }, () => ({ ...oneSet })),
          };
          if (repsNum === null && e.reps) ex.reps = e.reps;
          if (planRpe !== null) ex.rpeTarget = planRpe;
          const note = [e.note, adjNote].filter(Boolean).join(" | ");
          if (note) ex.note = note;
          return ex;
        }),
    }));

    // Næste mandag som start_date
    const now = new Date();
    const nextMonday = new Date(now.getTime() + (((7 - ((now.getDay() + 6) % 7)) % 7 || 7)) * 86400000);
    const startDate = nextMonday.toISOString().slice(0, 10);
    const nextNum = (week.week_number || 0) + 1;

    const candidateState = buildProgressionStateV1({
      sourceWeek: week,
      targetWeek: {
        week_number: nextNum,
        block_name: week.block_name || null,
        start_date: startDate,
        sessions: sessionsOut,
      },
      actuals,
      logWindow: { from: since7, to: new Date().toISOString() },
      previousState: latestProgressionState?.state || null,
    });
    const candidateValidation = validateProgressionStateV1(candidateState);
    const gate = candidateValidation.ok
      ? assessProgressionGate({ latestState: latestProgressionState, sourceWeek: week, targetWeekNumber: nextNum })
      : {
        status: "context_missing",
        can_commit: false,
        reasons: candidateValidation.errors,
      };
    const activeModelContext = latestProgressionState?.state
      ? progressionModelContextV1(latestProgressionState.state) : { available: false, missing: gate.reasons };
    const progression = {
      ...gate,
      state_id: gate.can_commit ? latestProgressionState?.id || null : null,
      version: gate.can_commit ? latestProgressionState?.version || null : null,
      proposal: gate.can_commit ? null : candidateState,
      display_state: gate.can_commit ? latestProgressionState?.state || null : candidateState,
      model_context_available: activeModelContext.available,
    };

    // Advarsler
    const warnings: string[] = [];
    const since21 = new Date(Date.now() - 21 * 86400000).toISOString();
    const { data: logs21 } = await svc.from("exercise_logs")
      .select("logged_at").eq("athlete_id", athlete_id).gte("logged_at", since21).limit(5000);
    const daysPerWeek: Record<string, Set<string>> = {};
    for (const l of logs21 || []) {
      const d = new Date(l.logged_at); d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      (daysPerWeek[d.toISOString().slice(0, 10)] ??= new Set()).add(l.logged_at.slice(0, 10));
    }
    const counts = Object.values(daysPerWeek).map((s) => s.size).sort((a, b) => a - b);
    if (counts.length) {
      const median = counts[Math.floor(counts.length / 2)];
      if (sessionsOut.length !== median) {
        warnings.push(`Udkastet har ${sessionsOut.length} sessioner, men atleten har reelt trænet ` +
          `${counts.join("/")} dage/uge de seneste ${counts.length} uger.`);
      }
    }
    const noWd = sessionsSrc.filter((s) =>
      !(typeof s.weekday === "number" && s.weekday >= 0 && s.weekday <= 6)).map((s) => s.title || "?");
    if (noWd.length) warnings.push(`weekday mangler på: ${noWd.join(", ")} (dag udledes af titlen).`);
    const { data: clash } = await svc.from("weeks")
      .select("week_number, block_name").eq("athlete_id", athlete_id).eq("start_date", startDate);
    if (clash?.length) {
      warnings.push(`start_date ${startDate} kolliderer med eksisterende uge ${clash[0].week_number} ` +
        `(${clash[0].block_name || "uden blok"}) — afsendelse vil blive stoppet.`);
    }

    return json({
      source_week: { week_number: week.week_number, block_name: week.block_name, start_date: week.start_date },
      draft: {
        start_date: startDate,
        source_week_id: week.id,
        target_week_number: nextNum,
        progression_state_id: progression.state_id,
        p_payload: {
          athleteId: athlete_id,
          week: nextNum,
          blockName: week.block_name,
          coachNote: `UDKAST uge ${nextNum} - genereret ${today}, SKAL reviewes af Marc`,
          sessions: sessionsOut,
        },
      },
      changes,
      warnings,
      progression,
    });
  } catch (e) {
    return json({ error: `Uventet fejl: ${(e as Error).message}` }, 500);
  }
});
