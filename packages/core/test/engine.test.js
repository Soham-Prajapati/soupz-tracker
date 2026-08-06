import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryRepository, TrackerEngine, createHabitPlan, tasksForDate } from '../src/index.js';

const fixedClock = () => new Date('2026-07-31T12:00:00.000Z');

function makeEngine() {
  let index = 0;
  return new TrackerEngine(new MemoryRepository(), {
    clock: fixedClock,
    idFactory: prefix => `${prefix}_${++index}`,
  });
}

test('plain habit creation produces one recurrence and deterministic daily occurrences', async () => {
  const plan = createHabitPlan({ title: 'Read 20 minutes', from: '2026-07-31', timezone: 'Asia/Kolkata' });
  assert.equal(plan.kind, 'habit');
  assert.equal(plan.schedule.length, 0);
  assert.equal(plan.recurrences.length, 1);
  assert.equal(tasksForDate(plan, '2026-08-01').length, 1);
  assert.equal(tasksForDate(plan, '2026-08-01')[0].id, tasksForDate(plan, '2026-08-01')[0].id);
});

test('write_plan dry run returns a structural diff without mutating storage', async () => {
  const engine = makeEngine();
  const plan = createHabitPlan({ title: 'Read', from: '2026-07-31' });
  const preview = await engine.writePlan({ plan, mode: 'create', dryRun: true });
  assert.equal(preview.diff.tasksAdded, 1);
  assert.equal((await engine.getState()).plans.length, 0);

  await engine.writePlan({ plan, mode: 'create' });
  const replacement = structuredClone(plan);
  replacement.recurrences.push({
    id: 'rec_second', title: 'Journal', track: plan.tracks[0].id,
    rule: { freq: 'daily' }, from: '2026-07-31', until: null,
  });
  const replacePreview = await engine.writePlan({ plan: replacement, mode: 'replace', dryRun: true });
  assert.equal(replacePreview.revision, 2);
  assert.equal(replacePreview.diff.tasksAdded, 1);
  assert.equal((await engine.getPlan({ planId: plan.id })).plan.revision, 1);
});

test('add_tasks resolves tracks and set_progress remains idempotent', async () => {
  const engine = makeEngine();
  const plan = createHabitPlan({ title: 'Read', from: '2026-07-31' });
  await engine.writePlan({ plan, mode: 'create' });
  const result = await engine.addTasks({
    planId: plan.id,
    tasks: [{ date: '2026-08-01', track: 'Fitness', title: 'Run' }],
  });
  assert.equal(result.created.length, 1);
  assert(result.warnings.includes('Created track Fitness.'));
  const taskId = result.created[0].id;
  assert.equal((await engine.setProgress({ planId: plan.id, entries: [{ taskId, done: true }] })).updated, 1);
  assert.equal((await engine.setProgress({ planId: plan.id, entries: [{ taskId, done: true }] })).updated, 1);
  const slice = await engine.getPlan({ planId: plan.id, from: '2026-08-01', to: '2026-08-01', status: 'done' });
  assert.equal(slice.matched, 1);
});

test('deterministic catch-up respects fixed tasks and daily phase capacity', async () => {
  const engine = makeEngine();
  const plan = createHabitPlan({ title: 'Read', from: '2026-07-28' });
  plan.recurrences = [];
  plan.phases = [{ id: 'phase', name: 'Steady', start: '2026-07-31', end: '2026-08-10', rate: 1 }];
  plan.schedule = [
    { date: '2026-07-28', tasks: [{ id: 'a', title: 'A' }, { id: 'fixed', title: 'Deadline', fixed: true }] },
    { date: '2026-07-29', tasks: [{ id: 'b', title: 'B' }] },
  ];
  await engine.writePlan({ plan, mode: 'create' });
  const preview = await engine.reschedule({ planId: plan.id, move: { strategy: 'catchUp', horizonDays: 2 }, dryRun: true });
  assert.deepEqual(preview.moves.map(move => move.to), ['2026-07-31', '2026-08-01']);
  assert.deepEqual(preview.skipped, [{ taskId: 'fixed', reason: 'fixed tasks cannot move' }]);
  const untouched = await engine.getPlan({ planId: plan.id, from: '2026-07-28', to: '2026-08-01' });
  assert.equal(untouched.plan.schedule.some(day => day.date === '2026-07-31'), false);

  await engine.reschedule({ planId: plan.id, move: { strategy: 'catchUp', horizonDays: 2 } });
  const moved = await engine.getPlan({ planId: plan.id, from: '2026-07-31', to: '2026-08-01' });
  assert.equal(moved.matched, 2);
});

test('rest days preserve streaks and plan end dates stop recurring work', async () => {
  const engine = new TrackerEngine(new MemoryRepository(), { clock: () => new Date('2026-08-03T12:00:00.000Z') });
  const plan = createHabitPlan({ title: 'Weekly review', from: '2026-08-02', frequency: 'weekly', byDay: [0] });
  plan.window.end = '2026-08-02';
  await engine.writePlan({ plan, mode: 'create' });
  const task = tasksForDate(plan, '2026-08-02')[0];
  await engine.setProgress({ planId: plan.id, entries: [{ taskId: task.id, done: true }] });
  const state = await engine.getState({ today: '2026-08-03' });
  assert.equal(state.todayTasks.length, 0);
  assert.equal(state.streaks[0].days, 1);
  assert.equal(tasksForDate(plan, '2026-08-09').length, 0);
});
