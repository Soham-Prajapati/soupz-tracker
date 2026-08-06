import assert from 'node:assert/strict';
import test from 'node:test';
import { createHabitPlan } from '../packages/core/src/index.js';
import {
  engineStateFromPlans,
  previewGenericMove,
  projectGenericPlans,
  writeGenericPlan,
} from './genericTracker.js';
import { progressKey } from './progressKeys.js';

const habit = (title, color) => createHabitPlan({
  title,
  color,
  from: '2026-08-01',
  timezone: 'Asia/Kolkata',
});

test('generic projection combines every user plan and carries track colours as data', async () => {
  const plans = [habit('Read', '#2F8C86'), habit('Walk', '#D4553A')];
  const state = await projectGenericPlans({ plans, date: '2026-08-01' });

  assert.deepEqual(state.todayTasks.map(task => task.title).sort(), ['Read', 'Walk']);
  assert.deepEqual(state.todayTasks.map(task => task.trackColor).sort(), ['#2F8C86', '#D4553A']);
  assert.ok(state.todayTasks.every(task => task.homeDate === '2026-08-01'));
});

test('pushed overlays move a task to any target and preserve a usable undo date', async () => {
  const plans = [habit('Read', '#2F8C86')];
  const home = await projectGenericPlans({ plans, date: '2026-08-01' });
  const task = home.todayTasks[0];
  const pushed = { [task.id]: '2026-08-04' };

  assert.equal((await projectGenericPlans({ plans, date: '2026-08-01', pushed })).todayTasks.length, 0);
  const target = await projectGenericPlans({ plans, date: '2026-08-04', pushed });
  const moved = target.todayTasks.find(item => item.id === task.id);
  assert.equal(moved.moved, true);
  assert.equal(moved.homeDate, '2026-08-01');

  const preview = await previewGenericMove({
    plans,
    pushed,
    planId: task.planId,
    taskId: task.id,
    toDate: task.homeDate,
  });
  assert.deepEqual(preview.skipped, []);
  assert.equal(preview.moves[0].to, '2026-08-01');
});

test('generic plan writes validate through the shared core without mutating input arrays', async () => {
  const before = [];
  const plan = habit('Stretch', '#7FA23C');
  const result = await writeGenericPlan(before, plan);

  assert.equal(result.validation.ok, true);
  assert.equal(result.plans[0].title, 'Stretch');
  assert.deepEqual(before, []);
  assert.equal(engineStateFromPlans(result.plans).plans[plan.id].id, plan.id);
});

test('saved plans reject cross-plan task id collisions before progress can alias', async () => {
  const first = habit('First', '#2F8C86');
  first.recurrences = [];
  first.schedule = [{ date: '2026-08-01', tasks: [{ id: 'tsk_shared', title: 'First task' }] }];
  const second = habit('Second', '#D4553A');
  second.recurrences = [];
  second.schedule = [{ date: '2026-08-01', tasks: [{ id: 'tsk_shared', title: 'Second task' }] }];
  const result = await writeGenericPlan([first], second);
  assert.equal(result.validation.ok, false);
  assert.match(result.validation.errors[0].message, /unique across saved plans/);
});

test('composite progress keys isolate identical imported task ids', () => {
  const first = habit('First', '#2F8C86');
  const second = habit('Second', '#D4553A');
  first.recurrences = second.recurrences = [];
  first.schedule = [{ date: '2026-08-01', tasks: [{ id: 'same', title: 'First' }] }];
  second.schedule = [{ date: '2026-08-01', tasks: [{ id: 'same', title: 'Second' }] }];
  const state = engineStateFromPlans([first, second], { [progressKey(first.id, 'same')]: true });
  assert.equal(state.progress[first.id].entries.same.done, true);
  assert.equal(state.progress[second.id].entries.same?.done, undefined);
});
