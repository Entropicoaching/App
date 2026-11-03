/**
 * Pure coach signal aggregation; no raw records, IO or feature-flag reads.
 * Call only with athlete-entered, coach-authorized summaries.
 *
 * @typedef {'belastning'|'styrke'|'kost'|'vaegt'} SignalSource
 * @typedef {'info'|'obs'|'vigtig'} SignalStrength
 * @typedef {Object} SignalEvidence
 * @property {boolean} sufficient Explicit upstream data-quality decision.
 * @property {number} sampleCount Distinct observations, never summed on merge.
 * @property {number} minimumSampleCount Source-owned minimum, positive integer.
 * @property {string} from First included day, YYYY-MM-DD.
 * @property {string} to Last included day, YYYY-MM-DD (inclusive).
 * @property {string} summary Human-readable basis with units where relevant.
 * @typedef {Object} SignalCandidate
 * @property {string} key Canonical issue, shared across sources for duplicates.
 * @property {string} subject Stable scope, e.g. 'weekly' or an exercise ID.
 * @property {SignalStrength} strength
 * @property {string} reason Coach-facing explanation, not a diagnosis.
 * @property {SignalEvidence} dataBasis
 * @typedef {Object} SignalOutput
 * @property {string} athleteId athletes.id, never athletes.user_id.
 * @property {SignalSource} source
 * @property {SignalCandidate[]} signals Empty when no supported signal exists.
 */

const SOURCES = ['belastning', 'styrke', 'kost', 'vaegt']
const PRIORITY = new Map([['vigtig', 0], ['obs', 1], ['info', 2]])
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const text = value => typeof value === 'string' && value.trim().length > 0
const token = value => text(value) && value === value.trim()
const count = value => Number.isSafeInteger(value) && value > 0

function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function evidenceIsValid(basis) {
  return basis?.sufficient === true
    && count(basis.sampleCount) && count(basis.minimumSampleCount)
    && basis.sampleCount >= basis.minimumSampleCount
    && day(basis.from) && day(basis.to) && basis.from <= basis.to
    && text(basis.summary)
}

/**
 * One prioritized list for exactly one athlete. Explicit true is required for ON.
 * Invalid or insufficient candidates are ignored individually; missing data does
 * not become an alert. No clinical/trend thresholds are invented here.
 * Duplicate identity is (key, subject) within the requested athlete. Different
 * periods retain separate evidence, but yield one issue with strongest strength.
 * Ties use key then subject in code-unit order, independent of arrival order.
 *
 * @param {{athleteId: string, enabled?: boolean, outputs?: SignalOutput[]}} options
 * @returns {Array<{athleteId: string, key: string, subject: string,
 * strength: SignalStrength, reasons: string[], sources: SignalSource[],
 * dataBasis: Array<SignalEvidence & {source: SignalSource}>}>}
 */
export function buildAthleteSignalList(options = {}) {
  // OFF must not inspect outputs or invoke any upstream computations.
  if (options?.enabled !== true || !token(options.athleteId)) return []
  const { athleteId, outputs } = options
  if (!Array.isArray(outputs)) return []
  const groups = new Map()

  for (const output of outputs) {
    if (output?.athleteId !== athleteId || !SOURCES.includes(output.source)
      || !Array.isArray(output.signals)) continue
    for (const signal of output.signals) {
      if (!token(signal?.key) || !token(signal.subject)
        || !PRIORITY.has(signal.strength) || !text(signal.reason)
        || !evidenceIsValid(signal.dataBasis)) continue

      const identity = JSON.stringify([signal.key, signal.subject])
      if (!groups.has(identity)) {
        groups.set(identity, {
          athleteId, key: signal.key, subject: signal.subject,
          strength: signal.strength, reasons: new Set(), sources: new Set(),
          evidence: new Map(),
        })
      }
      const group = groups.get(identity)
      if (PRIORITY.get(signal.strength) < PRIORITY.get(group.strength)) {
        group.strength = signal.strength
      }
      group.reasons.add(signal.reason.trim())
      group.sources.add(output.source)
      // Copy only the public contract, never arbitrary upstream fields.
      const basis = signal.dataBasis
      const evidence = {
        source: output.source, sufficient: true,
        sampleCount: basis.sampleCount, minimumSampleCount: basis.minimumSampleCount,
        from: basis.from, to: basis.to, summary: basis.summary.trim(),
      }
      group.evidence.set(JSON.stringify(evidence), evidence)
    }
  }

  return [...groups.values()].map(group => ({
    athleteId: group.athleteId, key: group.key, subject: group.subject,
    strength: group.strength,
    reasons: [...group.reasons].sort(compare),
    sources: SOURCES.filter(source => group.sources.has(source)),
    dataBasis: [...group.evidence.entries()].sort(([a], [b]) => compare(a, b))
      .map(([, basis]) => basis),
  })).sort((a, b) => PRIORITY.get(a.strength) - PRIORITY.get(b.strength)
    || compare(a.key, b.key) || compare(a.subject, b.subject))
}
