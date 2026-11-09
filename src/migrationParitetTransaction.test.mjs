import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

// Execute the mounted runner's migration loop verbatim, with only its filesystem
// inputs replaced by tiny synthetic migrations. Never duplicate its catch logic.
const source = readFileSync(new URL('../scripts/proeve-migration-v3.mjs', import.meta.url), 'utf8')
const start = source.indexOf('const filer = readdirSync(migDir)')
const end = source.indexOf('// 2. syntetiske data', start)
assert.ok(start >= 0 && end > start, 'the actual migration loop must be found')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const loop = new AsyncFunction('db', 'readdirSync', 'migDir', 'V2', 'V3', 'les', 'join', 'ud', source.slice(start, end))

const run = (db, migrations, reports) => loop(
  db, () => Object.keys(migrations), 'synthetic', 'v2.sql', 'v3.sql',
  path => migrations[basename(path)], join, message => reports.push(message),
)

test('failed BEGIN migration is reported, rolled back, and followed by healthy legacy queries', async () => {
  const db = new PGlite()
  const reports = []
  try {
    await db.exec('CREATE TABLE legacy_result (value integer); INSERT INTO legacy_result VALUES (7)')
    await run(db, {
      '020-success.sql': 'BEGIN; INSERT INTO legacy_result VALUES (23); COMMIT;',
      '010-failure.sql': 'BEGIN; INSERT INTO legacy_result VALUES (99); SELECT * FROM missing_transaction_relation; COMMIT;',
      'v2.sql': 'SELECT * FROM must_not_run_v2',
      'v3.sql': 'SELECT * FROM must_not_run_v3',
      'ignored.txt': 'SELECT * FROM must_not_run_text',
    }, reports)
    assert.deepEqual(reports, [
      '- 010-failure.sql: kunne ikke koeres uden prod-tabeller (relation "missing_transaction_relation" does not exist)',
      '- 020-success.sql: koert',
    ])
    assert.match((await db.query('select current_date::text d')).rows[0].d, /^\d{4}-\d{2}-\d{2}$/)
    assert.deepEqual((await db.query('SELECT value FROM legacy_result ORDER BY value')).rows, [{ value: 7 }, { value: 23 }])
  } finally {
    await db.close()
  }
})

test('nontransactional failure remains reported and later migrations still execute', async () => {
  const db = new PGlite()
  const reports = []
  try {
    await run(db, {
      '010-plain.sql': 'SELECT * FROM missing_plain_relation',
      '020-success.sql': 'CREATE TABLE legacy_result AS SELECT 42 AS value',
    }, reports)
    assert.deepEqual(reports, [
      '- 010-plain.sql: kunne ikke koeres uden prod-tabeller (relation "missing_plain_relation" does not exist)',
      '- 020-success.sql: koert',
    ])
    assert.deepEqual((await db.query('SELECT value FROM legacy_result')).rows, [{ value: 42 }])
  } finally {
    await db.close()
  }
})

test('successful explicit transactions commit without recovery', async () => {
  const db = new PGlite()
  const reports = []
  const commands = []
  try {
    await run({ exec: sql => { commands.push(sql); return db.exec(sql) } }, {
      '010-success.sql': 'BEGIN; CREATE TABLE legacy_result AS SELECT 17 AS value; COMMIT;',
    }, reports)
    assert.deepEqual(reports, ['- 010-success.sql: koert'])
    assert.equal(commands.length, 1)
    assert.deepEqual((await db.query('SELECT value FROM legacy_result')).rows, [{ value: 17 }])
  } finally {
    await db.close()
  }
})

test('rollback rejection escapes the actual catch and prevents false continuation', async () => {
  const db = new PGlite()
  const reports = []
  const recoveryFailure = new Error('synthetic rollback failure')
  try {
    await assert.rejects(run({ exec: sql => sql === 'ROLLBACK' ? Promise.reject(recoveryFailure) : db.exec(sql) }, {
      '010-failure.sql': 'BEGIN; SELECT * FROM missing_recovery_relation; COMMIT;',
      '020-must-not-run.sql': 'CREATE TABLE false_success (value integer)',
    }, reports), error => error === recoveryFailure)
    assert.deepEqual(reports, [
      '- 010-failure.sql: kunne ikke koeres uden prod-tabeller (relation "missing_recovery_relation" does not exist)',
    ])
    await db.exec('ROLLBACK')
    assert.equal((await db.query("SELECT to_regclass('false_success') AS relation")).rows[0].relation, null)
  } finally {
    await db.close()
  }
})
