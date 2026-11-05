import test from 'node:test'
import assert from 'node:assert/strict'
import { messageText, timestampContent, validId } from './conversationModel.mjs'
import { athleteAnswerContent } from './athleteConversation.mjs'

const row = content => Object.freeze({ sender_role: 'coach', category: 'teknik', content })

test('display reuses the timestamp producer and ID contract without changing stored data', () => {
  for (const id of ['a', '_-0', 'a'.repeat(120), '00000000-0000-4000-8000-000000000001']) {
    assert.equal(validId(id), true)
    const content = timestampContent({ id, lift: 'squat', created_at: '2026-11-02T08:00:00Z' }, 3.5, 'Hold brystet oppe.')
    const value = row(content)
    assert.equal(messageText(value), 'Squat-video 2. nov. ved 3,5 s\nHold brystet oppe.')
    assert.equal(value.content, content)
  }
})

test('display removes the complete metadata suffix with CRLF and trailing whitespace', () => {
  for (const newline of ['\n', '\r\n']) {
    for (const trailing of ['', ' ', '\t', '\n', '\r\n', ' \t\r\n\n\u00a0']) {
      const body = `Video ved 0 s${newline}En note${newline}med to linjer.  `
      assert.equal(messageText(row(`${body}${newline}Video-id: synthetic-video${trailing}`)), body)
    }
  }
})

test('Home can hide metadata-only technique messages without changing default first-line behavior', () => {
  for (const id of ['a', '_-0', 'a'.repeat(120), '00000000-0000-4000-8000-000000000001']) {
    for (const prefix of ['', '\n', '\r\n', ' \t\r\n']) {
      for (const suffix of ['', ' \t\r\n']) {
        const content = `${prefix}Video-id: ${id}${suffix}`, value = row(content)
        assert.equal(messageText(value, { hideStandaloneVideoId: true }).trim(), '')
        assert.equal(messageText(value), prefix === '' ? content : prefix.replace(/\r?\n$/, ''))
        assert.equal(value.content, content)
      }
    }
  }
})

test('ordinary text, athlete messages, invalid IDs and non-final markers stay byte-identical', () => {
  for (const id of ['', 'a'.repeat(121), 'ugyldigt id', 'æ', '<script>', ' leading']) {
    assert.equal(validId(id), false)
    const content = `En note\nVideo-id: ${id}`
    assert.equal(messageText(row(content)), content)
  }
  for (const content of ['En almindelig note', 'Video-id: synthetic', 'En note\nVideo-id: synthetic\nForklaring',
    'En note\nvideo-id: synthetic', 'En note\nVideo-id: synthetic\rForklaring']) {
    assert.equal(messageText(row(content)), content)
  }
  const content = 'En note\nVideo-id: synthetic'
  for (const extra of [{ sender_role: 'athlete' }, { category: 'besked' }, { category: undefined }, { sender_role: undefined }]) {
    assert.equal(messageText({ ...row(content), ...extra }), content)
  }
  for (const content of [undefined, null, 42, {}]) assert.equal(messageText(row(content)), content)
  assert.equal(messageText(null), undefined)
})

test('quick answers quote the visible question without propagating its internal video ID', () => {
  const value = row(timestampContent({ id: 'synthetic-video' }, 0, 'Kan du prøve igen?'))
  const content = value.content
  assert.equal(athleteAnswerContent({ value }, 'Jeg har brug for hjælp'),
    'Svar på: Video ved 0 s\nKan du prøve igen?\nJeg har brug for hjælp')
  assert.equal(value.content, content)
})

test('Home metadata option preserves non-technique, invalid and non-final standalone text', () => {
  const content = 'Video-id: synthetic-video'
  for (const value of [{ ...row(content), sender_role: 'athlete' }, { ...row(content), category: 'besked' },
    row('Video-id: ugyldigt id'), row('Video-id: synthetic-video\nForklaring'), row('video-id: synthetic-video')])
    assert.equal(messageText(value, { hideStandaloneVideoId: true }), value.content)
})
