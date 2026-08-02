import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyShadowBinding } from './verify-subscription-shadow-binding.mjs';

const expectedProjectRef = 'maxhsefxbrvsgolscqwh';
const correct = [
  'VITE_SUB_SUPABASE_URL=https://maxhsefxbrvsgolscqwh.supabase.co/',
  'VITE_SUB_SUPABASE_PROJECT_REF=maxhsefxbrvsgolscqwh',
  'VITE_SUB_SUPABASE_ANON_KEY=this-value-must-not-be-read',
].join('\n');

test('accepts matching non-secret project identifiers', () => {
  assert.deepEqual(verifyShadowBinding({ source: correct, expectedProjectRef }), { ok: true });
});

test('fails closed when URL host and configured ref differ', () => {
  const result = verifyShadowBinding({
    source: correct.replace('VITE_SUB_SUPABASE_PROJECT_REF=maxhsefxbrvsgolscqwh', 'VITE_SUB_SUPABASE_PROJECT_REF=aaaaaaaaaaaaaaaaaaaa'),
    expectedProjectRef,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /do not match/);
});

test('fails closed for an unauthorised but internally matching project', () => {
  const other = correct
    .replaceAll('maxhsefxbrvsgolscqwh', 'aaaaaaaaaaaaaaaaaaaa');
  const result = verifyShadowBinding({ source: other, expectedProjectRef });
  assert.equal(result.ok, false);
  assert.match(result.reason, /authorised subscription shadow project/);
});

test('fails closed for malformed or missing URL', () => {
  const result = verifyShadowBinding({
    source: 'VITE_SUB_SUPABASE_PROJECT_REF=maxhsefxbrvsgolscqwh',
    expectedProjectRef,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /URL/);
});
