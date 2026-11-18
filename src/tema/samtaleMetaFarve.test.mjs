// Ordre 1663: afsender- og tidslinjen i samtalen ("Coach · i dag 14:11", ConversationView.mjs) staar i #b6b2a8,
// og den farve manglede i temaets tabel. I lys tilstand blev den staaende som lys graa paa creme (kontrast 1,9).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { varmTemaKode } from './varmTema.mjs'

test('samtalens afsender- og tidslinje faar temaets graa tekstfarve, saa den kan laeses i lys', async () => {
  const kilde = await readFile(new URL('../entropi2/conversation/ConversationView.mjs', import.meta.url), 'utf8')
  const ud = varmTemaKode(kilde, '/src/entropi2/conversation/ConversationView.mjs')
  assert.match(ud, /color: 'var\(--e-tekst2\)', fontSize: '0\.875rem'/)
  assert.doesNotMatch(ud, /#b6b2a8/i)
})
