import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consecutiveSettingsSchema, DEFAULT_CONSECUTIVE_SETTINGS, parseConsecutiveSettings } from './settings.js';

test('nothing stored means aidispatch defaults', () => {
  assert.deepEqual(parseConsecutiveSettings(null), DEFAULT_CONSECUTIVE_SETTINGS);
  assert.deepEqual(parseConsecutiveSettings('garbage'), DEFAULT_CONSECUTIVE_SETTINGS);
});

test('stored fields are read, broken ones fall back one by one', () => {
  const s = parseConsecutiveSettings({ model: 'gpt-6-sol', end_silence_ms: 900, hard_end_ms: 99999, semantic_threshold: 0.9, barge_in_words: 'x' });
  assert.deepEqual(s, { model: 'gpt-6-sol', endSilenceMs: 900, hardEndMs: 2200, semanticThreshold: 0.9, bargeInWords: 5 });
  assert.equal(parseConsecutiveSettings('{"end_silence_ms":800}').endSilenceMs, 800);   // legacy JSON-string encoding
});

test('the admin schema enforces the ranges and rejects unknown keys', () => {
  assert.ok(consecutiveSettingsSchema.safeParse({ end_silence_ms: 700, barge_in_words: 5 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ end_silence_ms: 200 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ semantic_threshold: 1 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ model: 'gpt-4o' }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ foo: 1 }).success);
});

test('the hard limit must outlast the end-of-thought pause, and is repaired when it does not', () => {
  // The ranges overlap and the hard limit is meant to be the LAST gate. Raise the pause to the maximum the
  // UI itself advertises, leave the limit at its default, and the order inverts: every release reason but
  // 'hard' goes dead, so a Russian "uh-huh" in the English speaker's pause is translated and spoken into the
  // room, and so is transcription garbage the overlap drop exists to swallow.
  assert.ok(!consecutiveSettingsSchema.safeParse({ end_silence_ms: 3000, hard_end_ms: 2200 }).success);
  assert.ok(!consecutiveSettingsSchema.safeParse({ end_silence_ms: 2200, hard_end_ms: 2200 }).success);
  assert.ok(consecutiveSettingsSchema.safeParse({ end_silence_ms: 700, hard_end_ms: 2200 }).success);
  // The schema is partial, so a PUT of one field alone never reaches the cross-field check: the parse repairs it.
  assert.equal(parseConsecutiveSettings({ end_silence_ms: 3000 }).hardEndMs, 3100);
  assert.equal(parseConsecutiveSettings({ end_silence_ms: 3000, hard_end_ms: 2200 }).hardEndMs, 3100);
  assert.equal(parseConsecutiveSettings({ end_silence_ms: 700 }).hardEndMs, 2200);   // a no-op on a sane pair
});
