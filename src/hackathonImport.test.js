import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HackathonImportError,
  candidateToHackathonPlan,
  commitReviewedHackathon,
  createReviewEngine,
  exportHackathonPlan,
  extractHackathonCandidate,
  importHackathonPlan,
} from './hackathonImport.js';

const candidate = {
  title: 'Build weekend',
  start: '2026-08-01',
  deadline: '2026-08-03',
  demoGoal: 'A working demo',
  sourceUrl: 'https://example.test/hackathon',
  stages: [{
    name: 'Product',
    color: '#D4553A',
    tasks: [{ title: 'Map judge flow', date: '2026-08-01', why: 'Keeps the demo legible', demoCritical: true }],
  }],
  deadlines: [{ title: 'Submit', date: '2026-08-03', why: 'Portal closes' }],
};

const deterministicOptions = () => {
  let id = 0;
  return { idFactory: prefix => `${prefix}_stable_${++id}`, now: () => '2026-07-31T12:00:00.000Z' };
};

test('extractor rejects missing keys before network access when auth is required', async () => {
  let called = false;
  await assert.rejects(
    extractHackathonCandidate({ endpoint: 'http://127.0.0.1:11434/v1/chat/completions', pageText: 'facts', fetchImpl: async () => { called = true; } }),
    error => error instanceof HackathonImportError && /key is not saved/i.test(error.message),
  );
  assert.equal(called, false);
});

test('malformed extractor output is rejected and pasted text is sent only to the configured endpoint', async () => {
  let requestedUrl;
  await assert.rejects(
    extractHackathonCandidate({
      endpoint: 'http://127.0.0.1:11434/v1/chat/completions',
      allowNoKey: true,
      sourceUrl: 'https://example.test/source',
      pageText: 'Deadline is 3 August.',
      fetchImpl: async (url) => {
        requestedUrl = url;
        return { ok: true, async json() { return { choices: [{ message: { content: '{bad json' } }] }; } };
      },
    }),
    /malformed JSON/,
  );
  assert.equal(requestedUrl, 'http://127.0.0.1:11434/v1/chat/completions');
});

test('review gate prevents writes until explicit confirmation', async () => {
  const engine = createReviewEngine();
  await assert.rejects(commitReviewedHackathon({ candidate, confirmed: false, engine }), /explicitly confirm/);
  assert.deepEqual((await engine.getState()).plans, []);

  const plan = await commitReviewedHackathon({ candidate, confirmed: true, engine, options: deterministicOptions() });
  assert.equal(plan.kind, 'hackathon');
  assert.equal((await engine.getState()).plans.length, 1);
});

test('candidate IDs are stable under deterministic conversion and teammate JSON round-trips exactly', () => {
  const first = candidateToHackathonPlan(candidate, deterministicOptions());
  const second = candidateToHackathonPlan(candidate, deterministicOptions());
  assert.deepEqual(first, second);
  assert.deepEqual(importHackathonPlan(exportHackathonPlan(first)), first);
});
