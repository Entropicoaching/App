import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sqlDir = resolve(root, 'supabase', 'sql');
const files = [
  'sub-01-entitlements.DRAFT.sql',
  'sub-02-members.DRAFT.sql',
  'sub-03-programs.DRAFT.sql',
  'sub-04-assignments.DRAFT.sql',
  'sub-05-workouts.DRAFT.sql',
  'sub-06-hardening.DRAFT.sql',
  'sub-07-program-version-and-assignment-guard.DRAFT.sql',
  'sub-08-invited-member-activation.DRAFT.sql',
  'sub-09-week-two-proposals.DRAFT.sql',
  'sub-10-workout-persistence-guard.DRAFT.sql',
  'sub-11-shadow-contract-gate.DRAFT.sql',
  'sub-12-tier-contract-remediation.DRAFT.sql',
];

const sql = new Map(
  files.map((file) => [file, readFileSync(resolve(sqlDir, file), 'utf8')]),
);

const catalogueSource = sql.get('sub-03-programs.DRAFT.sql');
const catalogueMatch = catalogueSource.match(/\$pilot_catalogue\$\s*([\s\S]*?)\s*\$pilot_catalogue\$::jsonb/);
assert.ok(catalogueMatch, 'sub-03: machine-readable pilot catalogue is missing');
const catalogue = JSON.parse(catalogueMatch[1]);
assert.equal(catalogue.length, 6, 'sub-03: pilot must contain exactly six immutable programme versions');

const expectedTracks = new Set([
  'general-strength:begynder:2', 'general-strength:oevet:2',
  'general-strength:begynder:3', 'general-strength:oevet:3',
  'general-strength:oevet:4',
  'powerlifting-foundation:begynder:2', 'powerlifting-foundation:oevet:2',
  'powerlifting-foundation:begynder:3', 'powerlifting-foundation:oevet:3',
  'powerlifting-foundation:oevet:4',
]);
const actualTracks = new Set();
const slugs = new Set();
const expectedSlugByGoalAndDays = new Map([
  ['general-strength:2', 'general-strength-2'],
  ['general-strength:3', 'general-strength-3'],
  ['general-strength:4', 'general-strength-4'],
  ['powerlifting-foundation:2', 'powerlifting-foundation-2'],
  ['powerlifting-foundation:3', 'powerlifting-foundation-3'],
  ['powerlifting-foundation:4', 'powerlifting-foundation-4'],
]);
for (const row of catalogue) {
  assert.ok(!slugs.has(row.slug), `sub-03: duplicate slug ${row.slug}`);
  slugs.add(row.slug);
  assert.equal(row.version, 1, `${row.slug}: unexpected version`);
  assert.equal(row.min_equipment, 2, `${row.slug}: not full-gym`);
  assert.equal(row.min_tier, 'member', `${row.slug}: not member-only`);
  assert.equal(row.content?.equipment, 'gym', `${row.slug}: content equipment mismatch`);
  assert.ok(['general-strength', 'powerlifting-foundation'].includes(row.content?.goal), `${row.slug}: invalid goal`);
  assert.equal(row.slug, expectedSlugByGoalAndDays.get(`${row.content.goal}:${row.days}`), `${row.slug}: slug is not canonical for its pilot track`);
  assert.equal(row.content?.templateId, row.slug, `${row.slug}: template id must equal immutable slug`);
  assert.deepEqual(row.levels, row.days === 4 ? ['oevet'] : ['begynder', 'oevet'], `${row.slug}: invalid level/day surface`);
  assert.equal(row.content?.sessions?.length, row.days, `${row.slug}: day/session mismatch`);
  for (const level of row.levels) actualTracks.add(`${row.content.goal}:${level}:${row.days}`);
  for (const session of row.content.sessions) {
    assert.ok(session.id && session.name && session.exercises?.length, `${row.slug}: malformed session`);
    for (const exercise of session.exercises) {
      assert.ok(exercise.id && exercise.name && exercise.role, `${row.slug}: malformed exercise identity`);
      assert.ok(Number.isInteger(exercise.sets) && exercise.sets > 0, `${row.slug}: invalid sets`);
      assert.match(exercise.reps, /^\d+\s*[–-]\s*\d+$/, `${row.slug}: invalid rep range`);
      assert.ok(Number.isInteger(exercise.rest) && exercise.rest > 0, `${row.slug}: invalid rest`);
    }
  }
}
assert.deepEqual([...actualTracks].sort(), [...expectedTracks].sort(), 'sub-03: pilot track coverage mismatch');
assert.doesNotMatch(catalogueMatch[1], /erfaren|"equipment"\s*:\s*"(?:home|basic)"/i, 'sub-03: legacy level/equipment leaked into pilot');

const memberDraft = sql.get('sub-02-members.DRAFT.sql');
assert.match(memberDraft, /level\s+text\s+check\s*\(level\s+in\s*\('begynder',\s*'oevet'\)\)/i, 'sub-02: member levels must match the locked pilot');
assert.match(memberDraft, /equipment\s+text\s+check\s*\(equipment\s*=\s*'gym'\)/i, 'sub-02: member equipment must be full gym only');
assert.match(memberDraft, /check\s*\(days_per_week\s+in\s*\(2,\s*3\)\s+or\s*\(days_per_week\s*=\s*4\s+and\s+level\s*=\s*'oevet'\)\)/i, 'sub-02: four days must be oevet-only');
assert.doesNotMatch(memberDraft, /erfaren|bodyweight|dumbbells/i, 'sub-02: legacy pilot preference leaked into shadow schema');

for (const [file, source] of sql) {
  assert.match(source, /DRAFT ONLY/i, `${file}: missing DRAFT-only marker`);
  assert.match(source, /production/i, `${file}: missing production warning`);
}

const statements = [...sql.values()]
  .join('\n')
  .replace(/--.*$/gm, '')
  .split(';')
  .map((statement) => statement.replace(/\s+/g, ' ').trim().toLowerCase())
  .filter(Boolean);

const forbiddenClientWriteGrant = statements.find((statement) =>
  /^grant\s+(?:[^;]*\b)?(?:insert|update|delete|truncate)\b/.test(statement)
  && /sub_(?:entitlements|programs|assignments)/.test(statement)
  && /\b(?:anon|authenticated)\b/.test(statement),
);
assert.equal(
  forbiddenClientWriteGrant,
  undefined,
  `forbidden client write grant: ${forbiddenClientWriteGrant}`,
);

const assignmentDraft = sql.get('sub-04-assignments.DRAFT.sql');
assert.doesNotMatch(
  assignmentDraft,
  /create\s+policy[\s\S]{0,160}sub_assignments\s+for\s+(?:insert|update|all)/i,
  'sub-04 must never open a temporary client assignment-write window',
);
for (const required of [
  /new\.match_input\s*->>\s*'goal'\s+is distinct from\s+v_program_goal/i,
  /coalesce\(new\.match_input\s*->>\s*'level',\s*''\)\s*<>\s*all\(v_program_levels\)/i,
  /new\.match_input\s*->>\s*'equipment'[\s\S]{0,100}v_program_equipment/i,
  /new\.match_input\s*->>\s*'daysPerWeek'[\s\S]{0,180}v_program_days/i,
]) {
  assert.match(assignmentDraft, required, `sub-04: assignment must bind match input to the immutable pilot version (${required})`);
}

const protectedProductTables = '(?:entitlements|programs|assignments|pilot_member_activations|week_two_proposals|week_two_decisions|workouts|workout_sets)';
assert.doesNotMatch(
  [...sql.values()].join('\n'),
  new RegExp(`create\\s+policy[\\s\\S]{0,180}on\\s+public\\.sub_${protectedProductTables}[\\s\\S]{0,100}for\\s+(?:all|insert|update|delete)`, 'i'),
  'protected subscription product tables must never receive a client write policy in any DRAFT step',
);

assert.match(
  sql.get('sub-07-program-version-and-assignment-guard.DRAFT.sql'),
  /before\s+update\s+or\s+delete\s+on\s+public\.sub_programs/i,
  'published program versions must reject both update and delete',
);

const executableByAuthenticated = statements.filter((statement) =>
  /^grant\s+execute\s+on\s+function/.test(statement)
  && /\bto\s+authenticated\b/.test(statement),
);
const allowedAuthenticatedFunctions = [
  'sub_current_tier',
  'sub_my_access_v1',
  'sub_decide_week_two_proposal_v1',
  'sub_my_week_two_proposal_state_v1',
  'sub_persist_completed_workout_v1',
];
for (const statement of executableByAuthenticated) {
  assert.ok(
    allowedAuthenticatedFunctions.some((name) => statement.includes(name)),
    `unexpected authenticated RPC: ${statement}`,
  );
}

const executableControlledFunction = executableByAuthenticated.find((statement) =>
  statement.includes('sub_controlled_'),
);
assert.equal(
  executableControlledFunction,
  undefined,
  `controlled RPC exposed to authenticated: ${executableControlledFunction}`,
);

const executableSql = statements.join('\n');
assert.doesNotMatch(
  executableSql,
  /(?:from|join|update|insert\s+into)\s+public\.profiles\b|profiles\.role/i,
  'subscription SQL must not authorize through profiles or profiles.role',
);

const activation = sql.get('sub-08-invited-member-activation.DRAFT.sql');
for (const required of [
  /u\.invited_at/i,
  /u\.email_confirmed_at/i,
  /u\.last_sign_in_at/i,
  /source\s*=\s*excluded\.source/i,
  /to\s+service_role/i,
]) {
  assert.match(activation, required, `activation gate missing ${required}`);
}
assert.doesNotMatch(
  activation,
  /grant\s+execute[\s\S]{0,220}to\s+authenticated/i,
  'member activation must not be client-executable',
);

const proposals = sql.get('sub-09-week-two-proposals.DRAFT.sql');
for (const required of [
  /cardinality\(evidence_workout_ids\)\s*=\s*2/i,
  /proposed_weight_kg\s*=\s*current_weight_kg\s*\+\s*2\.5/i,
  /bool_and\(ws\.rpe is not null and ws\.rpe <= 7\)/i,
  /sub_decide_week_two_proposal_v1/i,
  /undo_accept/i,
]) {
  assert.match(proposals, required, `week-two gate missing ${required}`);
}

const persistence = sql.get('sub-10-workout-persistence-guard.DRAFT.sql');
for (const required of [
  /sub_persist_completed_workout_v1/i,
  /jsonb_to_recordset\(p_sets\)/i,
  /persisted_payload/i,
  /client-id er allerede brugt/i,
  /to authenticated/i,
]) {
  assert.match(persistence, required, `workout persistence gate missing ${required}`);
}

const tierRemediation = sql.get('sub-12-tier-contract-remediation.DRAFT.sql');
for (const required of [
  /maxhsefxbrvsgolscqwh/i,
  /slug\s*=\s*'start-2'/i,
  /e\.tier\s*=\s*'member'/i,
  /e\.valid_until\s+is\s+null\s+or\s+e\.valid_until\s*>\s*now\(\)/i,
  /security\s+invoker/i,
  /sub_private\.sub_persist_completed_workout_v1_impl/i,
  /sub_week_two_proposals_assignment_id/i,
  /sub_week_two_proposals_program_id/i,
  /sub_week_two_decisions_user_id/i,
]) {
  assert.match(tierRemediation, required, `sub-12 entitlement remediation missing ${required}`);
}
assert.doesNotMatch(tierRemediation, /profiles(?:\.|\s)|dsqgaxwgtcbqgphsofav/i, 'sub-12 must not depend on profiles or production');

const finalGate = sql.get('sub-11-shadow-contract-gate.DRAFT.sql');
for (const required of [
  /has_table_privilege/i,
  /has_function_privilege/i,
  /pg_get_functiondef/i,
  /public\.sub_current_tier\(\)/i,
  /public\.sub_my_access_v1\(\)/i,
  /sub_week_two_decisions/i,
  /sub_workout_sets/i,
]) {
  assert.match(finalGate, required, `final contract assertion missing ${required}`);
}

const workoutDraft = sql.get('sub-05-workouts.DRAFT.sql');
assert.doesNotMatch(
  workoutDraft,
  /create\s+policy\s+entropi_sub_workouts_own\s+on\s+public\.sub_workouts\s+for\s+all/i,
  'sub-05 must not temporarily create a client workout write policy before sub-10 removes it',
);

for (const doc of [
  'docs/subscription-shadow-backend-safe-path.md',
  'docs/subscription-shadow-pilot-manual-qa.md',
]) {
  const source = readFileSync(resolve(root, doc), 'utf8');
  assert.doesNotMatch(
    source,
    /insert\s+into\s+public\.sub_(?:entitlements|programs|assignments)/i,
    `${doc}: operational docs must not offer direct product-state writes`,
  );
  assert.doesNotMatch(
    source,
    /update\s+public\.sub_(?:entitlements|programs|assignments)/i,
    `${doc}: operational docs must not offer direct product-state writes`,
  );
}

console.log(`PASS subscription shadow backend static contract (${files.length} DRAFT files)`);
