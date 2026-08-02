-- SHADOW QA ONLY: maxhsefxbrvsgolscqwh. Uses retained fixture identities,
-- creates uniquely prefixed workout rows, then deletes them and restores the
-- two fixture entitlements before commit. No passwords or profiles are changed.

begin;

create temporary table sub12_qa_entitlements as
select * from public.sub_entitlements;

create temporary table sub12_qa_counts as
select (select count(*) from public.sub_workouts) workouts,
       (select count(*) from public.sub_workout_sets) sets;

create temporary table sub12_qa_results (
  case_id text primary key,
  result text not null,
  evidence jsonb not null
);
grant all on table sub12_qa_results to authenticated;

-- FREE + role escalation negative control: only start-2, no member programme,
-- no assignment, and the write RPC fails before any guessed payload is used.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
do $$
declare
  v_tier text;
  v_has_coaching boolean;
  v_free_slugs text[];
  v_member_count integer;
  v_assignment_count integer;
  v_role text;
  v_rejected boolean := false;
begin
  select tier, has_coaching into v_tier, v_has_coaching from public.sub_my_access_v1();
  select coalesce(array_agg(slug order by slug), array[]::text[])
    into v_free_slugs from public.sub_programs where min_tier = 'free';
  select count(*) into v_member_count from public.sub_programs where min_tier = 'member';
  select count(*) into v_assignment_count from public.sub_assignments;
  select role into v_role from public.profiles where id = auth.uid();
  begin
    perform public.sub_persist_completed_workout_v1(
      '99c7105b-f2df-486f-baa5-4e2877305f49', 'a', 'sub12-remediation-free',
      now() - interval '1 minute', now() - interval '30 seconds',
      '[{"exercise_id":"high-bar-squat","set_index":1,"reps":5,"weight_kg":50,"rpe":6}]'::jsonb
    );
  exception when others then
    v_rejected := sqlerrm like '%Aktivt medlemskab kræves%';
  end;
  if v_tier <> 'free' or v_has_coaching or v_free_slugs <> array['start-2']::text[]
     or v_member_count <> 0 or v_assignment_count <> 0 or v_role <> 'coach'
     or not v_rejected then
    raise exception 'BQA-01/BQA-05 failed';
  end if;
  insert into sub12_qa_results values
    ('BQA-01','PASS',jsonb_build_object('tier',v_tier,'free_slugs',v_free_slugs,'member_programmes',v_member_count,'write_rejected',v_rejected)),
    ('BQA-05','PASS',jsonb_build_object('profiles_role',v_role,'tier',v_tier,'has_coaching',v_has_coaching,'grant_from_role',false));
end;
$$;

-- MEMBER A: exact assigned member track and persistence, exact replay, altered
-- replay rejection and cross-assignment rejection.
reset role;
update public.sub_entitlements
set tier = 'member', valid_until = now() + interval '1 hour', updated_at = now()
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  v_assignment_id uuid;
  v_program_id uuid;
  v_day_id text;
  v_exercise_id text;
  v_member_count integer;
  v_first uuid;
  v_replay uuid;
  v_started timestamptz := now() - interval '1 minute';
  v_completed timestamptz := now() - interval '30 seconds';
  v_invalid_binding boolean := false;
  v_altered_replay boolean := false;
begin
  select a.id, a.program_id, s->>'id', e->>'id'
    into v_assignment_id, v_program_id, v_day_id, v_exercise_id
  from public.sub_assignments a
  join public.sub_programs p on p.id = a.program_id
  cross join lateral jsonb_array_elements(p.content->'sessions') s
  cross join lateral jsonb_array_elements(s->'exercises') e
  where a.ended_at is null
  limit 1;
  select count(*) into v_member_count from public.sub_programs where min_tier = 'member';
  if v_assignment_id is null or v_member_count <> 1 then
    raise exception 'MEMBER exact-assignment access failed';
  end if;
  v_first := public.sub_persist_completed_workout_v1(
    v_assignment_id, v_day_id, 'sub12-remediation-member-idempotent',
    v_started, v_completed,
    jsonb_build_array(jsonb_build_object('exercise_id',v_exercise_id,'set_index',1,'reps',5,'weight_kg',50,'rpe',6))
  );
  v_replay := public.sub_persist_completed_workout_v1(
    v_assignment_id, v_day_id, 'sub12-remediation-member-idempotent',
    v_started, v_completed,
    jsonb_build_array(jsonb_build_object('exercise_id',v_exercise_id,'set_index',1,'reps',5,'weight_kg',50,'rpe',6))
  );
  begin
    perform public.sub_persist_completed_workout_v1(
      v_assignment_id, v_day_id, 'sub12-remediation-member-idempotent',
      v_started, v_completed,
      jsonb_build_array(jsonb_build_object('exercise_id',v_exercise_id,'set_index',1,'reps',6,'weight_kg',50,'rpe',6))
    );
  exception when others then v_altered_replay := true;
  end;
  begin
    perform public.sub_persist_completed_workout_v1(
      'db11121e-a4d6-4821-a3ca-ebfb2f6c4a98', v_day_id, 'sub12-remediation-invalid-binding',
      now() - interval '1 minute', now() - interval '30 seconds',
      jsonb_build_array(jsonb_build_object('exercise_id',v_exercise_id,'set_index',1,'reps',5,'weight_kg',50,'rpe',6))
    );
  exception when others then v_invalid_binding := true;
  end;
  if v_first is null or v_replay is distinct from v_first or not v_altered_replay or not v_invalid_binding then
    raise exception 'BQA-03/BQA-04 failed';
  end if;
  insert into sub12_qa_results values
    ('MEMBER','PASS',jsonb_build_object('exact_member_programmes',v_member_count,'assignment_id',v_assignment_id,'persisted',true)),
    ('BQA-03','PASS',jsonb_build_object('cross_assignment_rejected',v_invalid_binding)),
    ('BQA-04','PASS',jsonb_build_object('workout_id',v_first,'exact_replay_same_id',v_replay=v_first,'altered_replay_rejected',v_altered_replay));
end;
$$;

-- MEMBER B as a normal 14-day trial entitlement. It sees only its own member
-- assignment/programme; another user's protected rows remain invisible.
reset role;
update public.sub_entitlements
set tier = 'member', source = 'trial', valid_until = now() + interval '14 days', updated_at = now()
where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
do $$
declare
  v_tier text;
  v_member_count integer;
  v_cross_assignments integer;
  v_cross_workouts integer;
begin
  select tier into v_tier from public.sub_my_access_v1();
  select count(*) into v_member_count from public.sub_programs where min_tier='member';
  select count(*) into v_cross_assignments from public.sub_assignments where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  select count(*) into v_cross_workouts from public.sub_workouts where user_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  if v_tier <> 'member' or v_member_count <> 1 or v_cross_assignments <> 0 or v_cross_workouts <> 0 then
    raise exception 'BQA-02/TRIAL active failed';
  end if;
  insert into sub12_qa_results values
    ('BQA-02','PASS',jsonb_build_object('cross_assignments',v_cross_assignments,'cross_workouts',v_cross_workouts)),
    ('TRIAL-ACTIVE','PASS',jsonb_build_object('tier',v_tier,'duration_days',14,'exact_member_programmes',v_member_count));
end;
$$;

-- Natural expiry: access becomes free, retained history remains readable, and
-- new persistence is rejected at the public RPC before the privileged helper.
reset role;
update public.sub_entitlements
set valid_until = now() - interval '1 second', updated_at = now()
where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
do $$
declare
  v_tier text;
  v_history_before integer;
  v_history_after integer;
  v_historical_programmes integer;
  v_rejected boolean := false;
begin
  select tier into v_tier from public.sub_my_access_v1();
  select count(*) into v_history_before from public.sub_workouts;
  select count(*) into v_historical_programmes from public.sub_programs where min_tier='member';
  begin
    perform public.sub_persist_completed_workout_v1(
      '99c7105b-f2df-486f-baa5-4e2877305f49', 'a', 'sub12-remediation-expired',
      now() - interval '1 minute', now() - interval '30 seconds',
      '[{"exercise_id":"high-bar-squat","set_index":1,"reps":5,"weight_kg":50,"rpe":6}]'::jsonb
    );
  exception when others then
    v_rejected := sqlerrm like '%Aktivt medlemskab kræves%';
  end;
  select count(*) into v_history_after from public.sub_workouts;
  if v_tier <> 'free' or v_history_before < 1 or v_history_after <> v_history_before
     or v_historical_programmes <> 1 or not v_rejected then
    raise exception 'BQA-06 failed';
  end if;
  insert into sub12_qa_results values
    ('BQA-06','PASS',jsonb_build_object('tier',v_tier,'history_rows',v_history_before,'historical_member_programmes',v_historical_programmes,'new_write_rejected',v_rejected)),
    ('TRIAL-EXPIRY','PASS',jsonb_build_object('natural_tier','free','history_readable',true,'new_write_rejected',v_rejected));
end;
$$;

-- Restore retained evidence exactly and remove only this run's prefixed rows.
reset role;
delete from public.sub_workouts where client_id like 'sub12-remediation-%';
update public.sub_entitlements e
set tier = s.tier, source = s.source, valid_until = s.valid_until, updated_at = s.updated_at
from sub12_qa_entitlements s where s.user_id = e.user_id;

do $$
begin
  if (select count(*) from public.sub_workouts) <> (select workouts from sub12_qa_counts)
     or (select count(*) from public.sub_workout_sets) <> (select sets from sub12_qa_counts)
     or exists (
       (select user_id,tier,source,valid_until,updated_at from public.sub_entitlements
        except select user_id,tier,source,valid_until,updated_at from sub12_qa_entitlements)
       union all
       (select user_id,tier,source,valid_until,updated_at from sub12_qa_entitlements
        except select user_id,tier,source,valid_until,updated_at from public.sub_entitlements)
     ) then
    raise exception 'sub-12 QA cleanup failed';
  end if;
  insert into sub12_qa_results values
    ('BQA-07','PASS',jsonb_build_object('shadow_retained',true,'test_rows_cleaned',true,'passwords_mutated',false));
end;
$$;

commit;

select jsonb_build_object(
  'target_ref','maxhsefxbrvsgolscqwh',
  'result','PASS',
  'cases',(select jsonb_agg(jsonb_build_object('id',case_id,'result',result,'evidence',evidence) order by case_id) from sub12_qa_results),
  'retained_counts',jsonb_build_object('workouts',(select count(*) from public.sub_workouts),'sets',(select count(*) from public.sub_workout_sets))
) as evidence;
