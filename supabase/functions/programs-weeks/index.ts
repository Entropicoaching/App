// ============================================================
// POST /functions/v1/programs-weeks
//
// Opretter en fuld træningsuge for en atlet (sessioner, øvelser,
// sæt -> mappet til den eksisterende flade datamodel) i ét kald.
//
// Auth: header "x-api-key" skal matche secret PROGRAMS_API_KEY.
//
// Body:
// {
//   "athleteId": "uuid",
//   "week": 1,
//   "blockName": "Blok 1",
//   "coachNote": "valgfri note til atleten",
//   "sessions": [
//     {
//       "day": "sunday",          // styrer rækkefølgen i ugen (ingen dag-kolonne i db)
//       "label": "Sek bænk",      // bliver sessionens titel
//       "exercises": [
//         {
//           "name": "Pause bænk 3s",
//           "sets": [ { "reps": 4, "weight": 130 }, ... ],
//           "rpeTarget": 7.5,     // -> intensity "RPE 7.5"
//           "note": "valgfri"
//         }
//       ]
//     }
//   ]
// }
//
// Mapping til datamodellen (sets-array kan ikke gemmes pr. sæt i planen):
//   sets               = antal sæt i arrayet
//   reps               = ens reps -> "4";  varierende -> "3-5"
//   recommended_weight = tungeste sæt (top-sæt). Skal du have distinkte
//                        sæt-grupper (fx top-sæt + back-off), så send dem
//                        som SEPARATE exercises.
//   intensity          = "RPE <rpeTarget>" hvis sat, ellers exercise.intensity
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Engelske + danske ugedage -> rang (man=1 ... søn=7). Bruges kun til sortering.
const WEEKDAY_RANK: Record<string, number> = {
  monday: 1, mandag: 1,
  tuesday: 2, tirsdag: 2,
  wednesday: 3, onsdag: 3,
  thursday: 4, torsdag: 4,
  friday: 5, fredag: 5,
  saturday: 6, "lørdag": 6, lordag: 6,
  sunday: 7, "søndag": 7, sondag: 7,
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Konstant-tids sammenligning, så svartid ikke afslører nøglen
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function asNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Mapper én indkommende exercise (med sets-array) til en flad db-række
function mapExercise(ex: any, order: number) {
  const setsArr: any[] = Array.isArray(ex?.sets) ? ex.sets : [];
  const repsVals = setsArr.map((s) => asNumber(s?.reps)).filter((n): n is number => n !== null);
  const weightVals = setsArr.map((s) => asNumber(s?.weight)).filter((n): n is number => n !== null);

  let reps: string | null = null;
  if (repsVals.length) {
    const min = Math.min(...repsVals);
    const max = Math.max(...repsVals);
    reps = min === max ? String(min) : `${min}-${max}`;
  }

  // top-sæt = tungeste vægt
  const recommended_weight = weightVals.length ? Math.max(...weightVals) : null;

  const rpe = asNumber(ex?.rpeTarget);
  const intensity = rpe !== null
    ? `RPE ${rpe}`
    : (typeof ex?.intensity === "string" && ex.intensity.trim() ? ex.intensity.trim() : null);

  return {
    name: typeof ex?.name === "string" && ex.name.trim() ? ex.name.trim() : "Øvelse",
    sets: setsArr.length || null,
    reps,
    intensity,
    note: typeof ex?.note === "string" && ex.note.trim() ? ex.note.trim() : null,
    recommended_weight,
    exercise_order: order,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // --- Auth ---
  const expected = Deno.env.get("PROGRAMS_API_KEY");
  if (!expected) return json({ error: "server_misconfigured", detail: "PROGRAMS_API_KEY ikke sat" }, 500);
  const provided = req.headers.get("x-api-key") ?? "";
  if (!safeEqual(provided, expected)) return json({ error: "unauthorized" }, 401);

  // --- Parse ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // --- Validér ---
  const errors: string[] = [];
  if (typeof body?.athleteId !== "string" || !body.athleteId.trim()) errors.push("athleteId mangler");
  if (asNumber(body?.week) === null) errors.push("week skal være et tal");
  if (!Array.isArray(body?.sessions) || body.sessions.length === 0) errors.push("sessions skal være en ikke-tom liste");
  if (errors.length) return json({ error: "validation_failed", details: errors }, 400);

  // --- Sortér sessioner efter ugedag, byg flad payload ---
  const sessionsIn: any[] = body.sessions.map((s: any, i: number) => ({
    raw: s,
    rank: WEEKDAY_RANK[String(s?.day ?? "").trim().toLowerCase()] ?? 99,
    origIdx: i,
  }));
  sessionsIn.sort((a, b) => (a.rank - b.rank) || (a.origIdx - b.origIdx));

  const sessions = sessionsIn.map((entry, sIdx) => {
    const s = entry.raw;
    const exercises = (Array.isArray(s?.exercises) ? s.exercises : []).map(
      (ex: any, eIdx: number) => mapExercise(ex, eIdx),
    );
    return {
      title: typeof s?.label === "string" && s.label.trim() ? s.label.trim() : "Træning",
      session_order: sIdx,
      exercises,
    };
  });

  // --- Skriv (atomisk via RPC, service role bypasser RLS) ---
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("create_program_week", {
    p_athlete_id: body.athleteId,
    p_week_number: asNumber(body.week),
    p_block_name: typeof body.blockName === "string" ? body.blockName : null,
    p_coach_note: typeof body.coachNote === "string" ? body.coachNote : null,
    p_sessions: sessions,
  });

  if (error) {
    if (error.message?.includes("athlete_not_found")) {
      return json({ error: "athlete_not_found", athleteId: body.athleteId }, 404);
    }
    return json({ error: "db_error", detail: error.message }, 500);
  }

  return json({ ok: true, ...data }, 201);
});
