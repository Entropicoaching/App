import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = fileURLToPath(new URL('..', import.meta.url))
const forwardPath = `${root}/supabase/sql/sub-13-member-self-setup.DRAFT.sql`
const rollbackPath = `${root}/supabase/sql/sub-13-member-self-setup.ROLLBACK.DRAFT.sql`
const forward = readFileSync(forwardPath, 'utf8')
const rollback = readFileSync(rollbackPath, 'utf8')

function compact(value) {
  return value.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim()
}

function functionDefinition(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = forward.match(new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+${escaped}\\s*\\(([\\s\\S]*?)\\)\\s*returns([\\s\\S]*?)\\n\\$\\$;`,
    'i',
  ))
  assert.ok(match, `Missing function definition: ${name}`)
  return { parameters: match[1], definition: match[0], returnsAndBody: match[2] }
}

test('forward migration is shadow-scoped, transactional and additive', () => {
  assert.match(forward, /entropi-subscription-shadow\s*\/\s*maxhsefxbrvsgolscqwh/i)
  assert.match(compact(forward), /^begin;/i)
  assert.match(compact(forward), /commit;\s*$/i)
  assert.doesNotMatch(forward, /public\.profiles|profiles\.role|\b1:1\b/i)
  assert.doesNotMatch(forward, /(?:insert\s+into|update|delete\s+from)\s+public\.sub_entitlements\b/i)
  assert.doesNotMatch(forward, /(?:update|delete\s+from)\s+public\.sub_programs\b/i)
  assert.doesNotMatch(forward, /(?:delete\s+from|truncate\s+(?:table\s+)?)\s+public\.sub_assignments\b/i)
})

test('member preferences and immutable catalogue cover every reviewed lane', () => {
  assert.match(forward, /check\s*\(equipment\s+in\s*\('gym',\s*'home'\)\)/i)
  assert.match(forward, /days_per_week\s+in\s*\(2,\s*3,\s*4\)/i)
  assert.match(forward, /level_axis\s*\(level\)[\s\S]*?'begynder'[\s\S]*?'oevet'/i)
  assert.match(forward, /array\[level\]::text\[\]/i)
  assert.match(forward, /setupSchemaVersion',\s*1/i)
  assert.match(forward, /baselinePolicyVersion',\s*1/i)
  assert.match(forward, /engineVersion',\s*3/i)
  assert.match(forward, /prescriptionLibraryVersion',\s*2/i)
  assert.match(forward, /\)\s*<>\s*96/i)

  // The immutable level lane must carry the same conservative dose as engine v3.
  assert.match(forward, /v_sets\s*:=\s*least\(v_sets,\s*2\)/i)
  assert.match(forward, /v_target_rpe\s*:=\s*'6'/i)
  assert.match(forward, /v_week_one_percent\s*-\s*0\.025/i)
  assert.match(forward, /case\s+p_equipment\s+when\s+'home'\s+then\s+1\s+else\s+2\.5\s+end/i)
  assert.match(forward, /maximumRealizedProgressionPercent',\s*0\.03/i)
  assert.match(forward, /mindst\s+to\s+sammenlignelige\s+eksponeringer[\s\S]*?lav\s+sikkerhed[\s\S]*?kræves\s+tre[\s\S]*?konkrete\s+RPE-loft/i)

  const homeExerciseIds = [
    'home-goblet-squat',
    'home-box-squat',
    'home-dumbbell-bench-press',
    'home-dumbbell-deadlift',
    'home-dumbbell-sumo-deadlift',
    'home-dumbbell-rdl',
    'home-split-squat',
    'home-reverse-lunge',
    'home-one-arm-row',
    'home-dumbbell-floor-press',
    'home-close-grip-push-up',
    'home-dumbbell-overhead-press',
    'home-band-pulldown',
    'home-lateral-raise',
    'home-dead-bug',
  ]
  homeExerciseIds.forEach(id => assert.match(forward, new RegExp(`'${id}'`, 'i'), id))

  assert.match(forward, /drop\s+function\s+public\.sub_setup_build_content_v1/i)
  assert.match(forward, /drop\s+function\s+public\.sub_setup_map_exercise_v1/i)
})

test('shared workout guard caps logged set index to the immutable level prescription', () => {
  const guard = functionDefinition('public.sub_enforce_workout_set').definition
  assert.match(guard, /select\s+count\(\*\),\s*max\(e\s*->>\s*'sets'\)/i)
  assert.match(guard, /v_match_count\s*<>\s*1/i)
  assert.match(guard, /v_planned_sets_text[\s\S]*?!~\s*'\^\[1-9\]\[0-9\]\*\$'/i)
  assert.match(guard, /new\.set_index\s*>\s*v_planned_sets_text::integer/i)
  assert.doesNotMatch(guard, /count\(\*\)[\s\S]*?=\s*v_planned_sets/i)
  assert.match(forward, /revoke\s+execute\s+on\s+function\s+public\.sub_enforce_workout_set\(\)[\s\S]*?from\s+public,\s*anon,\s*authenticated,\s*service_role/i)
})

test('owner RPC accepts only browser inputs and canonicalises raw baselines', () => {
  const rpc = functionDefinition('public.sub_complete_my_program_setup_v1')
  const parameterNames = [...rpc.parameters.matchAll(/\b(p_[a-z0-9_]+)\s+(?:uuid|jsonb)\b/gi)]
    .map(match => match[1])
  assert.deepEqual(parameterNames, ['p_request_id', 'p_match_input', 'p_baselines'])
  assert.doesNotMatch(rpc.parameters, /target|user|program|tier|source/i)
  assert.match(rpc.returnsAndBody, /table\s*\(assignment_id\s+uuid,\s*program_id\s+uuid,\s*created\s+boolean\)/i)
  assert.match(rpc.definition, /language\s+plpgsql\s+security\s+definer/i)
  assert.match(rpc.definition, /v_user_id\s+uuid\s*:=\s*auth\.uid\(\)/i)
  assert.match(rpc.definition, /sub_effective_tier\(v_user_id\)[\s\S]*?'member'/i)
  assert.equal((rpc.definition.match(/pg_advisory_xact_lock/gi) || []).length, 2)
  assert.match(rpc.definition, /request:'\s*\|\|\s*p_request_id::text[\s\S]*?owner:'\s*\|\|\s*v_user_id::text/i)

  const matchKeys = [
    'schemaVersion', 'goal', 'level', 'daysPerWeek', 'equipment',
    'squatStyle', 'deadliftStyle',
  ]
  matchKeys.forEach(key => assert.match(rpc.definition, new RegExp(`'${key}'`), key))
  assert.match(rpc.definition, /jsonb_object_keys\(p_match_input\)\)\s*<>\s*7/i)
  assert.match(rpc.definition, /v_level\s+not\s+in\s*\('begynder',\s*'oevet'\)/i)
  assert.match(rpc.definition, /v_equipment\s+not\s+in\s*\('gym',\s*'home'\)/i)
  assert.match(rpc.definition, /v_squat_style\s+not\s+in\s*\('high-bar',\s*'low-bar'\)/i)
  assert.match(rpc.definition, /v_deadlift_style\s+not\s+in\s*\('conventional',\s*'sumo'\)/i)

  assert.match(rpc.definition, /jsonb_object_keys\(p_baselines\)\)\s*<>\s*3/i)
  assert.match(rpc.definition, /array\['squat',\s*'bench',\s*'deadlift'\]/i)
  assert.match(rpc.definition, /key\s+not\s+in\s*\('weightKg',\s*'reps',\s*'rpe'\)/i)
  assert.match(rpc.definition, /v_weight\s*<=\s*0\s+or\s+v_weight\s*>\s*500/i)
  assert.match(rpc.definition, /v_reps\s*<\s*1\s+or\s+v_reps\s*>\s*12/i)
  assert.match(rpc.definition, /v_rpe\s*<\s*5\s+or\s+v_rpe\s*>\s*10/i)
  assert.match(rpc.definition, /when\s+v_reps\s*=\s*1\s+and\s+v_rpe\s*=\s*10\s+then\s+'one_rm'[\s\S]*?else\s+'heavy_set'/i)
  assert.match(rpc.definition, /'setupSchemaVersion',\s*1[\s\S]*?'baselinePolicyVersion',\s*1[\s\S]*?'baselines',\s*v_canonical_baselines/i)
})

test('RPC selects one level-specific immutable version and never replaces active state', () => {
  const rpc = functionDefinition('public.sub_complete_my_program_setup_v1').definition
  assert.match(rpc, /v_program_slug\s*:=\s*'setup-v1-'[\s\S]*?v_level[\s\S]*?v_equipment[\s\S]*?v_squat_style[\s\S]*?v_deadlift_style/i)
  assert.match(rpc, /v_program_count\s*<>\s*1/i)
  assert.match(rpc, /p\.status\s*=\s*'published'/i)
  assert.match(rpc, /p\.levels\s*=\s*array\[v_level\]::text\[\]/i)
  assert.match(rpc, /p\.content\s*->>\s*'level'\s*=\s*v_level/i)
  assert.match(rpc, /where\s+a\.request_id\s*=\s*p_request_id/i)
  assert.match(rpc, /return\s+query\s+select\s+v_existing_id,\s*v_program_id,\s*false/i)
  assert.match(rpc, /where\s+a\.user_id\s*=\s*v_user_id\s+and\s+a\.ended_at\s+is\s+null/i)
  assert.match(rpc, /allerede\s+et\s+aktivt\s+program/i)
  assert.doesNotMatch(rpc, /update\s+public\.sub_assignments/i)
  assert.equal((rpc.match(/insert\s+into\s+public\.sub_assignments/gi) || []).length, 1)
  assert.match(rpc, /'member_self_setup_v1'/i)
  assert.match(rpc, /return\s+query\s+select\s+v_assignment_id,\s*v_program_id,\s*true/i)
})

test('setup insert trigger binds reconstructable content and grants only owner RPC', () => {
  const guard = functionDefinition('public.sub_enforce_setup_assignment_binding_v1').definition
  for (const key of [
    'schemaVersion', 'setupSchemaVersion', 'baselinePolicyVersion', 'baselines',
    'level', 'equipment', 'squatStyle', 'deadliftStyle',
  ]) {
    assert.match(guard, new RegExp(`'${key}'`), key)
  }
  assert.match(forward, /create\s+trigger\s+entropi_sub_enforce_setup_assignment_binding_v1\s+before\s+insert\s+on\s+public\.sub_assignments/i)
  assert.match(forward, /revoke\s+all\s+on\s+function\s+public\.sub_complete_my_program_setup_v1\(uuid,\s*jsonb,\s*jsonb\)[\s\S]*?from\s+public,\s*anon,\s*authenticated,\s*service_role/i)
  assert.match(forward, /grant\s+execute\s+on\s+function\s+public\.sub_complete_my_program_setup_v1\(uuid,\s*jsonb,\s*jsonb\)\s+to\s+authenticated/i)
  assert.doesNotMatch(forward, /grant\s+execute[\s\S]{0,180}sub_complete_my_program_setup_v1[\s\S]{0,80}to\s+(?:anon|service_role|public)/i)
  assert.match(forward, /has_table_privilege\('authenticated',\s*'public\.sub_assignments',\s*'INSERT'\)/i)
})

test('rollback disables setup without deleting history or narrowing stored preferences', () => {
  assert.match(rollback, /entropi-subscription-shadow\s*\/\s*maxhsefxbrvsgolscqwh/i)
  assert.match(compact(rollback), /^begin;/i)
  assert.match(rollback, /revoke\s+all\s+on\s+function\s+public\.sub_complete_my_program_setup_v1/i)
  assert.match(rollback, /drop\s+function\s+public\.sub_complete_my_program_setup_v1/i)
  assert.match(rollback, /update\s+public\.sub_programs\s+set\s+status\s*=\s*'retired'/i)
  assert.doesNotMatch(rollback, /(?:delete\s+from|truncate\s+(?:table\s+)?)\s+public\.(?:sub_assignments|sub_programs|sub_members|sub_workouts|sub_workout_sets)\b/i)
  assert.doesNotMatch(rollback, /alter\s+table\s+public\.sub_members/i)
  assert.doesNotMatch(rollback, /public\.profiles|profiles\.role|\b1:1\b/i)
  assert.match(compact(rollback), /commit;\s*$/i)
})
