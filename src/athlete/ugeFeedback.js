// UP2: rent modul. Opsummerer en afsluttet uge til coachen. Ingen I/O, intet ur,
// ingen programaendring: output er kun beskrivelse og spoergsmaal.
// Syntetiske former: week {sessions:[{id,title,weekday,exercises:[{id,name,sets,reps,recommended_weight}]}]}
// logs [{exercise_id,weight,reps_completed,skipped,rpe,note}]
const RPE_HIGH = 9;
const num = v => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const validRpe = v => { const n = num(v); return n !== null && n >= 1 && n <= 10 ? n : null; };
// Planlagte reps: enkelt tal eller "a-b" (nedre graense); alt andet -> null (ukendt).
export function plannedReps(reps) {
  const m = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(String(reps ?? ''));
  return m ? Number(m[1]) : null;
}
export function summarizeWeek(week, logs) {
  const sessions = (week && Array.isArray(week.sessions)) ? week.sessions : [];
  const allLogs = (Array.isArray(logs) ? logs : []).filter(l => l && typeof l === 'object');
  const out = {
    status: 'tom', pas: [], afvigelser: [], noter: [], rpe: null,
    spoergsmaal: [], automatiskProgramaendring: false,
  };
  const known = new Set();
  let plannedSets = 0, doneSets = 0, skippedSets = 0;
  const uncovered = [];
  for (const s of sessions) {
    const exs = Array.isArray(s.exercises) ? s.exercises : [];
    const pas = { sessionId: s.id ?? null, titel: s.title || null, planlagtSaet: 0, gennemfoertSaet: 0, sprunget: 0, manglendeOevelser: [], status: 'ikke_logget' };
    for (const e of exs) {
      known.add(e.id);
      const planned = Math.max(0, Number(e.sets) || 0);
      const mine = allLogs.filter(l => l.exercise_id === e.id);
      const done = mine.filter(l => !l.skipped);
      const skipped = mine.length - done.length;
      pas.planlagtSaet += planned; pas.gennemfoertSaet += done.length; pas.sprunget += skipped;
      const nm = e.name || String(e.id);
      // Fuld daekning kraever, at hver planlagt oevelse selv har nok gennemfoerte saet; ekstra saet andetsteds kompenserer ikke.
      if (planned > 0 && done.length < planned) { pas.manglendeOevelser.push(nm); uncovered.push(nm); }
      if (planned > 0 && mine.length === 0) out.afvigelser.push({ type: 'ikke_logget', ovelse: nm, planlagt: planned });
      else if (planned > 0 && done.length < planned) out.afvigelser.push({ type: 'faerre_saet', ovelse: nm, planlagt: planned, gennemfoert: done.length, sprunget: skipped });
      if (planned > 0 && done.length > planned) out.afvigelser.push({ type: 'flere_saet', ovelse: nm, planlagt: planned, gennemfoert: done.length });
      const pr = plannedReps(e.reps), pw = num(e.recommended_weight);
      const lowReps = pr === null ? 0 : done.filter(l => num(l.reps_completed) !== null && num(l.reps_completed) < pr).length;
      if (lowReps) out.afvigelser.push({ type: 'faerre_reps', ovelse: nm, saet: lowReps, planlagt: pr });
      const diffW = pw === null ? 0 : done.filter(l => num(l.weight) !== null && num(l.weight) !== pw).length;
      if (diffW) out.afvigelser.push({ type: 'anden_vaegt', ovelse: nm, saet: diffW, anbefalet: pw });
    }
    pas.status = pas.planlagtSaet === 0 ? 'ingen_saet_planlagt'
      : pas.manglendeOevelser.length === 0 ? 'gennemfoert'
      : (pas.gennemfoertSaet + pas.sprunget > 0 ? 'delvis' : 'ikke_logget');
    plannedSets += pas.planlagtSaet; doneSets += pas.gennemfoertSaet; skippedSets += pas.sprunget;
    out.pas.push(pas);
  }
  const unknown = allLogs.filter(l => !known.has(l.exercise_id));
  if (unknown.length) out.afvigelser.push({ type: 'ukendt_ovelse_log', antal: unknown.length });
  const mineLogs = allLogs.filter(l => known.has(l.exercise_id));
  for (const l of mineLogs) {
    if (typeof l.note === 'string' && l.note.trim()) out.noter.push({ ovelseId: l.exercise_id, tekst: l.note.trim() });
  }
  const done = mineLogs.filter(l => !l.skipped);
  const rpes = done.map(l => validRpe(l.rpe)).filter(v => v !== null);
  const invalid = done.filter(l => l.rpe != null && l.rpe !== '' && validRpe(l.rpe) === null).length;
  out.rpe = {
    kilde: 'selvrapporteret subjektiv RPE; ikke en objektiv måling eller diagnose',
    saetMedRpe: rpes.length, saetUdenRpe: done.length - rpes.length - invalid, ugyldigeRpe: invalid,
    gennemsnit: rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length * 10) / 10 : null,
    max: rpes.length ? Math.max(...rpes) : null,
  };
  if (plannedSets === 0) out.status = 'tom';
  else if (doneSets === 0 && skippedSets === 0) out.status = 'ingen_logs';
  else if (doneSets === 0) out.status = 'sprunget_over';
  else out.status = out.pas.every(p => p.status === 'gennemfoert') ? 'fuld' : 'delvis';

  const q = out.spoergsmaal;
  if (out.status === 'tom') q.push('Ugen indeholder ingen planlagte sæt. Er det tilsigtet, eller mangler programmet data?');
  if (out.status === 'ingen_logs') q.push('Der er ingen loggede sæt. Blev ugen trænet uden logning, eller blev den ikke gennemført?');
  if (out.status === 'sprunget_over') q.push('Alle ' + skippedSets + ' registrerede sæt er markeret som sprunget over. Hvorfor blev ugen sprunget over, og var det aftalt med atleten?');
  if (out.status === 'delvis') q.push('Ugen blev kun delvist gennemført. Skal de manglende pas håndteres, eller er afvigelsen acceptabel?');
  if (out.status === 'delvis' && uncovered.length) q.push('Øvelser uden fuld dækning: ' + uncovered.join(', ') + '. Skal de indhentes, eller er afvigelsen acceptabel?');
  if (out.afvigelser.some(a => a.type === 'anden_vaegt' || a.type === 'faerre_reps')) q.push('Atleten afveg fra anbefalet vægt/reps. Hvad er forklaringen, og er det relevant for næste uges belastning?');
  if (out.afvigelser.some(a => a.type === 'ukendt_ovelse_log')) q.push('Der er logs for øvelser uden for ugens program. Hvor hører de hjemme?');
  if (out.noter.length) q.push('Atleten har skrevet noter. Kræver nogen af dem opfølgning?');
  if (doneSets > 0) {
    if (out.rpe.saetMedRpe === 0) q.push('RPE mangler helt for ugen. Skal atleten spørges direkte?');
    else {
      const missing = out.rpe.saetUdenRpe + out.rpe.ugyldigeRpe;
      if (missing > 0) q.push('RPE mangler eller er ugyldig for ' + missing + ' sæt; oversigten bygger kun på de øvrige.');
      if (out.rpe.gennemsnit >= RPE_HIGH) q.push('Selvrapporteret RPE var høj (gns ' + out.rpe.gennemsnit + '). Hvordan vil coachen vurdere det sammen med atleten?');
    }
  }
  return out;
}
