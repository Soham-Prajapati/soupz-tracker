import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { createHabitPlan } from '../packages/core/src/index.js';
import {
  addHackathonMilestone,
  addHackathonTask,
  addHackathonWorkstream,
  createHackathonPlan,
  hackathonTasksForDate,
  normalizeTrackerMode,
  projectHackathonPlan,
  removeHackathonItem,
  updateHackathonMetadata,
  viewForTrackerMode,
} from './hackathonMode.js';

const ids = (() => {
  let index = 0;
  return prefix => `${prefix}_test_${++index}`;
})();
const now = () => '2026-07-31T12:00:00.000Z';
const localToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

test('mode switching is explicit, stable and returns to the standard today view', () => {
  assert.equal(normalizeTrackerMode('hackathon'), 'hackathon');
  assert.equal(normalizeTrackerMode('anything-else'), 'standard');
  assert.equal(viewForTrackerMode('hackathon', 'calendar'), 'hackathon');
  assert.equal(viewForTrackerMode('standard', 'hackathon'), 'today');
  assert.equal(viewForTrackerMode('standard', 'calendar'), 'calendar');
});

test('hackathon plans use the generic versioned plan shape and preserve stable ids', () => {
  let plan = createHackathonPlan({
    title: 'Build weekend', start: '2026-08-01', deadline: '2026-08-03', demoGoal: 'A working demo',
  }, { idFactory: ids, now });
  plan = addHackathonWorkstream(plan, { name: 'Product', color: '#123456' }, { idFactory: ids, now });
  const trackId = plan.tracks[0].id;
  plan = addHackathonTask(plan, {
    title: 'Finish the judge flow', date: '2026-08-02', track: trackId,
    demoCritical: true, blockedBy: 'Waiting for sample data',
  }, { idFactory: ids, now });
  plan = addHackathonMilestone(plan, {
    title: 'Submission', date: '2026-08-03', track: trackId,
  }, { idFactory: ids, now });

  const taskId = plan.schedule[0].tasks[0].id;
  const metadataEdit = updateHackathonMetadata(plan, { demoGoal: 'A reliable live demo' }, { now });
  assert.equal(metadataEdit.schemaVersion, 1);
  assert.equal(metadataEdit.kind, 'hackathon');
  assert.equal(metadataEdit.schedule[0].tasks[0].id, taskId);
  assert.equal(metadataEdit.ext.hackathon.demoGoal, 'A reliable live demo');
  assert.equal(metadataEdit.revision, plan.revision + 1);

  const projection = projectHackathonPlan(metadataEdit, {}, '2026-08-02');
  assert.equal(projection.readiness, 'blocked');
  assert.deepEqual(projection.demoCriticalRemaining.map(task => task.id), [taskId]);
  assert.equal(hackathonTasksForDate(metadataEdit, '2026-08-02')[0].trackName, 'Product');

  const complete = projectHackathonPlan(metadataEdit, { [taskId]: true }, '2026-08-02');
  assert.equal(complete.readiness, 'ready');
});

test('empty input is a no-op and removal is explicit without mutating prior revisions', () => {
  const plan = createHackathonPlan({ title: 'Weekend' }, { idFactory: ids, now });
  assert.equal(addHackathonTask(plan, { title: '', date: '' }, { idFactory: ids, now }), plan);
  const withTrack = addHackathonWorkstream(plan, { name: 'Demo' }, { idFactory: ids, now });
  const removed = removeHackathonItem(withTrack, withTrack.tracks[0].id, { now });
  assert.equal(withTrack.tracks.length, 1);
  assert.equal(removed.tracks.length, 0);
  assert.equal(removed.revision, withTrack.revision + 1);
});

test('removing a workstream leaves its stable tasks explicitly unassigned', () => {
  let plan = createHackathonPlan({ title: 'Weekend' }, { idFactory: ids, now });
  plan = addHackathonWorkstream(plan, { name: 'Pitch' }, { idFactory: ids, now });
  const trackId = plan.tracks[0].id;
  plan = addHackathonTask(plan, { title: 'Write the story', date: '2026-08-01', track: trackId }, { idFactory: ids, now });
  const taskId = plan.schedule[0].tasks[0].id;
  const removed = removeHackathonItem(plan, trackId, { now });
  assert.equal(removed.schedule[0].tasks[0].id, taskId);
  assert.equal(removed.schedule[0].tasks[0].track, null);
});

test('hackathon projection never mutates user-created generic plans', () => {
  const genericPlans = [createHabitPlan({
    title: 'Read',
    from: '2026-08-01',
    timezone: 'Asia/Kolkata',
  })];
  const before = structuredClone(genericPlans);
  const plan = createHackathonPlan({ title: 'Independent plan' }, { idFactory: ids, now });
  projectHackathonPlan(plan, {}, '2026-08-01');
  assert.deepEqual(genericPlans, before);
});

test('the hackathon mode SSR surface exposes plain plan-maintenance controls', async () => {
  const today = localToday();
  let plan = addHackathonWorkstream(
    createHackathonPlan({
      title: 'Demo weekend', start: '2026-08-01', deadline: '2026-08-03', demoGoal: 'Show the working core flow',
    }, { idFactory: ids, now }),
    { name: 'Product', color: '#123456' },
    { idFactory: ids, now },
  );
  plan = addHackathonTask(plan, {
    title: 'Verify the core flow', date: today, track: plan.tracks[0].id, demoCritical: true,
  }, { idFactory: ids, now });
  globalThis.location = { search: '?v=hackathon' };
  globalThis.window = {
    addEventListener() {}, removeEventListener() {}, confirm: () => true,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };
  globalThis.localStorage = {
    getItem(key) {
      if (key === 'trackerMode') return JSON.stringify('hackathon');
      if (key === 'hackathonPlan') return JSON.stringify(plan);
      return null;
    },
    setItem() {}, removeItem() {},
  };
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const markup = renderToStaticMarkup(React.createElement(App));
    assert.match(markup, /Demo weekend/);
    assert.match(markup, /Workstreams/);
    assert.match(markup, /Milestones/);
    assert.match(markup, /Add task/);
    assert.match(markup, /demo-critical left/i);
    assert.match(markup, /Verify the core flow/);
    assert.match(markup, /Pasted page text/);
    assert.match(markup, /Used once, never saved/);
    assert.match(markup, /Review teammate JSON/);
    assert.match(markup, /Explicit commit/);
    assert.doesNotMatch(markup, /generate (?:a |the )?plan/i);

    globalThis.location.search = '?window=panel';
    const panelMarkup = renderToStaticMarkup(React.createElement(App));
    assert.match(panelMarkup, /Verify the core flow/);
    assert.match(panelMarkup, /Demo weekend/);
    assert.doesNotMatch(panelMarkup, /Add task/);
    assert.doesNotMatch(panelMarkup, /Plan details/);
  } finally {
    await server.close();
  }
});
