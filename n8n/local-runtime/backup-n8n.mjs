import { createHash, randomUUID } from 'node:crypto'
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptRoot = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)

function option(name, fallback) {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  if (!args[index + 1]) throw new Error(`${name} requires a value`)
  return args[index + 1]
}

const runtimeRoot = path.resolve(option('--runtime-root', scriptRoot))
const moduleRoot = path.resolve(option('--module-root', runtimeRoot))
const backupRoot = path.resolve(option('--backup-root', path.join(homedir(), 'Documents', 'Entropicoaching', 'n8n-backups')))
const keep = Number.parseInt(option('--keep', '14'), 10)
if (!Number.isInteger(keep) || keep < 1 || keep > 60) {
  throw new Error('--keep must be an integer from 1 through 60')
}

const dataRoot = path.join(runtimeRoot, 'data', '.n8n')
const databasePath = path.join(dataRoot, 'database.sqlite')
const configPath = path.join(dataRoot, 'config')
const normalizedRuntime = `${path.resolve(runtimeRoot).toLowerCase()}${path.sep}`
const normalizedBackup = `${backupRoot.toLowerCase()}${path.sep}`
if (normalizedBackup.startsWith(normalizedRuntime)) {
  throw new Error('Backup root must be outside the n8n runtime folder')
}

await Promise.all([stat(databasePath), stat(configPath)])
await mkdir(backupRoot, { recursive: true, mode: 0o700 })

const requireFromRuntime = createRequire(path.join(moduleRoot, 'package.json'))
const sqlite3 = requireFromRuntime('sqlite3')
const n8nVersion = requireFromRuntime('n8n/package.json').version

function openDatabase(filename, mode) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(filename, mode, error => error ? reject(error) : resolve(database))
  })
}

function closeDatabase(database) {
  return new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()))
}

function createSnapshot(database, destination) {
  return new Promise((resolve, reject) => {
    const backup = database.backup(destination)
    backup.step(-1, stepError => {
      backup.finish(finishError => {
        if (stepError) reject(stepError)
        else if (finishError) reject(finishError)
        else resolve()
      })
    })
  })
}

function queryAll(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => error ? reject(error) : resolve(rows))
  })
}

async function sha256(filename) {
  return createHash('sha256').update(await readFile(filename)).digest('hex')
}

const stamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace('.', '')
const finalName = `backup-${stamp}`
const stagingRoot = path.join(backupRoot, `.partial-${randomUUID()}`)
const finalRoot = path.join(backupRoot, finalName)
const snapshotPath = path.join(stagingRoot, 'database.sqlite')
const copiedConfigPath = path.join(stagingRoot, 'config')

let sourceDatabase
let snapshotDatabase
try {
  await mkdir(stagingRoot, { mode: 0o700 })
  sourceDatabase = await openDatabase(databasePath, sqlite3.OPEN_READONLY)
  await createSnapshot(sourceDatabase, snapshotPath)
  await closeDatabase(sourceDatabase)
  sourceDatabase = null

  snapshotDatabase = await openDatabase(snapshotPath, sqlite3.OPEN_READONLY)
  const integrityRows = await queryAll(snapshotDatabase, 'PRAGMA integrity_check')
  await closeDatabase(snapshotDatabase)
  snapshotDatabase = null
  const integrityValues = integrityRows.flatMap(row => Object.values(row))
  if (integrityValues.length !== 1 || integrityValues[0] !== 'ok') {
    throw new Error('SQLite integrity check failed for the backup snapshot')
  }

  await cp(configPath, copiedConfigPath, { force: false })
  const [databaseInfo, configInfo, databaseSha256, configSha256] = await Promise.all([
    stat(snapshotPath), stat(copiedConfigPath), sha256(snapshotPath), sha256(copiedConfigPath),
  ])
  const manifest = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    n8nVersion,
    integrity: 'ok',
    files: {
      'database.sqlite': { bytes: databaseInfo.size, sha256: databaseSha256 },
      config: { bytes: configInfo.size, sha256: configSha256 },
    },
  }
  await writeFile(path.join(stagingRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(stagingRoot, finalRoot)

  const entries = await readdir(backupRoot, { withFileTypes: true })
  const backups = entries
    .filter(entry => entry.isDirectory() && /^backup-\d{8}T\d{6}(?:\d{3})?Z$/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse()
  for (const expired of backups.slice(keep)) {
    const expiredPath = path.resolve(backupRoot, expired)
    if (!`${expiredPath.toLowerCase()}${path.sep}`.startsWith(normalizedBackup)) {
      throw new Error('Refusing to rotate a backup outside the configured backup root')
    }
    await rm(expiredPath, { recursive: true, force: true })
  }

  console.log(`OK: created ${finalName}; retained ${Math.min(backups.length, keep)} backup(s)`)
} catch (error) {
  if (snapshotDatabase) await closeDatabase(snapshotDatabase).catch(() => {})
  if (sourceDatabase) await closeDatabase(sourceDatabase).catch(() => {})
  await rm(stagingRoot, { recursive: true, force: true }).catch(() => {})
  throw error
}
