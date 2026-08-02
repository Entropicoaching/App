import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

for (const page of ['customer-journey.html', 'pilot-feedback-review.html']) {
  test(`${page} routes direct local review to its built entry`, async () => {
    const html = await readFile(new URL(`../../../${page}`, import.meta.url), 'utf8')
    assert.match(html, /location\.protocol === 'file:'/)
    assert.match(html, /dist-subscription-pilot/)
    assert.match(html, /<script type="module" src="\/src\/subscription\//)
  })
}
