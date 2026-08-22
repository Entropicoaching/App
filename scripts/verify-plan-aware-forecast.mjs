import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  fallbackForecastStartDate,
  forecastTargetForWeek,
  plannedWeekIsEmpty,
  sameTargetBlock,
  sameTargetWeekId,
} from '../supabase/functions/_shared/forecastPlanTarget.js'

const sourceWeek = {
  id: 'source-week',
  week_number: 4,
  block_name: 'Akkumulering',
}

const plannedWeek = {
  id: 'planned-week',
  week_number: 5,
  block_name: 'Intensificering',
  block_description: 'Mere specifik styrke, færre reps.',
  start_date: '2026-08-31',
  sessions: [],
}

const target = forecastTargetForWeek({ sourceWeek, plannedWeek, now: new Date('2026-08-22T12:00:00Z') })
assert.deepEqual(target, {
  id: 'planned-week',
  is_planned: true,
  week_number: 5,
  block_name: 'Intensificering',
  block_description: 'Mere specifik styrke, færre reps.',
  start_date: '2026-08-31',
}, 'den næste planlagte uge skal styre forecastets blok og dato')
assert.equal(plannedWeekIsEmpty(plannedWeek), true, 'en plan-skal uden sessioner kan udfyldes')
assert.equal(plannedWeekIsEmpty({ ...plannedWeek, sessions: [{ id: 'session' }] }), false,
  'en planlagt uge med indhold må ikke overskrives')

const fallback = forecastTargetForWeek({ sourceWeek, now: new Date('2026-08-22T12:00:00Z') })
assert.deepEqual(fallback, {
  id: null,
  is_planned: false,
  week_number: 5,
  block_name: 'Akkumulering',
  block_description: null,
  start_date: '2026-08-24',
}, 'uden plan bevarer forecastet den eksisterende uge-til-uge-adfærd')
assert.equal(fallbackForecastStartDate(new Date('2026-08-24T12:00:00Z')), '2026-08-31')

const state = { program: { target_week: { id: 'planned-week', block_name: 'Intensificering' } } }
assert.equal(sameTargetWeekId(state, 'planned-week'), true)
assert.equal(sameTargetWeekId(state, 'another-week'), false)
assert.equal(sameTargetBlock(state, { blockName: 'Intensificering' }), true)
assert.equal(sameTargetBlock(state, { blockName: 'Akkumulering' }), false)

const migration = readFileSync(new URL('../supabase/migrations/20260822151141_fill_planned_program_week.sql', import.meta.url), 'utf8')
assert.match(migration, /create or replace function public\.fill_planned_program_week/i)
assert.match(migration, /security invoker/i, 'RPC’en må ikke eskalere rettigheder unødigt')
assert.match(migration, /for update/i, 'den planlagte uge skal låses under udfyldning')
assert.match(migration, /planned_week_not_empty/i, 'en udfyldt uge må aldrig overskrives')
assert.doesNotMatch(migration, /insert into public\.weeks/i, 'RPC’en skal fylde den eksisterende plan-skal, ikke oprette en ny uge')
assert.match(migration, /grant execute on function public\.fill_planned_program_week\(uuid, jsonb\) to service_role/i)

console.log('OK: forecast bruger planlagt måluge uden at overskrive eksisterende indhold.')
