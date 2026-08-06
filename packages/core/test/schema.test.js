import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan } from '../src/validation.js';

const validPlan = {
  schemaVersion: 1,
  id: 'pln_test',
  title: 'Read daily',
  kind: 'habit',
  timezone: 'Asia/Kolkata',
  window: { start: '2026-07-31', end: null },
  createdAt: '2026-07-31T00:00:00.000Z',
  updatedAt: '2026-07-31T00:00:00.000Z',
  revision: 1,
  source: 'ui',
  tracks: [{ id: 'trk_read', name: 'Read', color: '#4E8C3F' }],
  phases: [],
  recurrences: [{ id: 'rec_read', track: 'trk_read', title: 'Read', rule: { freq: 'daily' }, from: '2026-07-31', until: null }],
  schedule: [],
  events: [],
};

test('versioned plan schema accepts a minimal user-authored habit', () => {
  assert.deepEqual(validatePlan(validPlan), { ok: true, errors: [] });
});

test('schema rejects semantic duplicate ids and invalid dates', () => {
  const invalid = structuredClone(validPlan);
  invalid.schedule.push({ date: 'tomorrow', tasks: [{ id: 'rec_read', title: 'Collision' }] });
  const validation = validatePlan(invalid);
  assert.equal(validation.ok, false);
  assert(validation.errors.some(item => item.path === 'schedule[0].date'));
  assert(validation.errors.some(item => item.path === 'schedule[0].tasks[0].id'));
});

test('schema rejects impossible dates, duplicate schedule days and missing phases', () => {
  const invalid = structuredClone(validPlan);
  invalid.window.start = '2026-02-30';
  invalid.schedule = [
    { date: '2026-08-01', tasks: [] },
    { date: '2026-08-01', tasks: [] },
  ];
  delete invalid.phases;
  const validation = validatePlan(invalid);
  assert.equal(validation.ok, false);
  assert(validation.errors.some(item => item.path === 'window.start'));
  assert(validation.errors.some(item => item.path === 'schedule[1].date'));
  assert(validation.errors.some(item => item.path === 'phases'));
});
