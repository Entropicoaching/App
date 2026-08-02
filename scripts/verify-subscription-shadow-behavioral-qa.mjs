import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const matrixPath = resolve(root, 'docs', 'qa', 'subscription-shadow-behavioral-matrix-v1.json');
const runbookPath = resolve(root, 'docs', 'subscription-shadow-behavioral-qa-runbook.md');
const reviewPath = resolve(root, 'subscription-shadow-behavioral-qa.html');
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
const runbook = readFileSync(runbookPath, 'utf8');
const review = readFileSync(reviewPath, 'utf8');

const required = new Map([
  ['BQA-01', /free user/i],
  ['BQA-02', /cross-user isolation/i],
  ['BQA-03', /invalid assignment\/program/i],
  ['BQA-04', /idempotent/i],
  ['BQA-05', /role escalation/i],
  ['BQA-06', /expired access/i],
  ['BQA-07', /rollback/i],
]);

assert.equal(matrix.schemaVersion, 1, 'matrix schemaVersion must be 1');
assert.equal(matrix.executionState, 'PENDING_AUTHORIZED_SHADOW_RUN', 'matrix must not claim a completed DB test');
assert.equal(matrix.allowedProjectRef, 'maxhsefxbrvsgolscqwh', 'matrix must pin the isolated shadow project');
assert.deepEqual(matrix.requiredCaseIds, [...required.keys()], 'required case list is missing or reordered');
assert.equal(matrix.cases.length, required.size, 'matrix must contain exactly the seven required cases');

for (const [id, titlePattern] of required) {
  const testCase = matrix.cases.find((item) => item.id === id);
  assert.ok(testCase, `missing required test case ${id}`);
  assert.match(testCase.title, titlePattern, `${id}: title does not describe the required behaviour`);
  for (const field of ['risk', 'preconditions', 'actions', 'expected', 'evidence']) {
    assert.ok(testCase[field], `${id}: missing ${field}`);
    if (Array.isArray(testCase[field])) assert.ok(testCase[field].length > 0, `${id}: ${field} must not be empty`);
  }
  assert.equal(testCase.stopOnFailure, true, `${id}: must stop on failure`);
}

for (const phrase of [
  /no database test has been run/i,
  /does not authorise or execute a\s+rollback/i,
  /never use a direct\s+product-state write/i,
  /PENDING, BLOCKED or FAIL/i,
]) assert.match(runbook, phrase, `runbook missing safety statement: ${phrase}`);

assert.doesNotMatch(runbook, /insert\s+into\s+public\.sub_|update\s+public\.sub_|delete\s+from\s+public\.sub_/i, 'runbook must not contain direct product-state write instructions');
assert.match(review, /PENDING_AUTHORIZED_SHADOW_RUN/, 'review page must show pending execution state');
assert.match(review, /localStorage/, 'review page must retain only local operator notes');
assert.match(review, /import matrix from '.\/docs\/qa\/subscription-shadow-behavioral-matrix-v1\.json'/, 'review page must load the validated matrix');
assert.match(review, /c\.id/, 'review page must render each matrix case id');

console.log(`PASS subscription shadow behavioural QA package (${matrix.cases.length} required cases, static only)`);
