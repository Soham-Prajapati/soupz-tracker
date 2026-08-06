import {
  MemoryRepository,
  TrackerEngine,
  validatePlan,
} from '../packages/core/src/index.js';
import { parseProgressKey, progressValue } from './progressKeys.js';

const clone = value => JSON.parse(JSON.stringify(value));

export function engineStateFromPlans(plans = [], done = {}, pushed = {}) {
  return {
    schemaVersion: 1,
    plans: Object.fromEntries(plans.map(plan => [plan.id, clone(plan)])),
    progress: Object.fromEntries(plans.map(plan => {
      const entries = {};
      for (const key of new Set([...Object.keys(done), ...Object.keys(pushed)])) {
        const parsed = parseProgressKey(key);
        if (parsed && parsed.planId !== plan.id) continue;
        const taskId = parsed?.taskId || key;
        entries[taskId] = {
          ...(typeof progressValue(done, plan.id, taskId) === 'boolean' ? { done: progressValue(done, plan.id, taskId) } : {}),
          ...(progressValue(pushed, plan.id, taskId) ? { pushedTo: progressValue(pushed, plan.id, taskId) } : {}),
        };
      }
      return [plan.id, { schemaVersion: 1, planId: plan.id, entries }];
    })),
  };
}

export function createGenericEngine(plans = [], done = {}, pushed = {}, options) {
  return new TrackerEngine(new MemoryRepository(engineStateFromPlans(plans, done, pushed)), options);
}

export async function projectGenericPlans({ plans = [], date, done = {}, pushed = {} }) {
  const engine = createGenericEngine(plans, done, pushed, {
    clock: () => new Date(`${date}T12:00:00.000Z`),
  });
  const state = await engine.getState({ today: date });
  const planById = new Map(plans.map(plan => [plan.id, plan]));
  return {
    ...state,
    todayTasks: state.todayTasks.map(task => {
      const plan = planById.get(task.planId);
      const track = plan?.tracks?.find(item => item.id === task.track);
      const homeDate = task.homeDate || task.date;
      return {
        ...task,
        homeDate,
        moved: Boolean(progressValue(pushed, task.planId, task.id) && progressValue(pushed, task.planId, task.id) !== homeDate),
        planTitle: plan?.title || 'Untitled plan',
        trackName: track?.name || plan?.title || 'Unassigned',
        trackColor: track?.color || '#6A5B4A',
      };
    }),
  };
}

export async function writeGenericPlan(plans, plan) {
  const validation = validatePlan(plan);
  if (!validation.ok) return { plans, validation, write: null };
  const otherTaskIds = new Set(plans.filter(item => item.id !== plan.id).flatMap(item => [
    ...(item.schedule || []).flatMap(day => day.tasks.map(task => task.id)),
    ...(item.events || []).map(event => event.id),
  ]));
  const collisions = [
    ...(plan.schedule || []).flatMap(day => day.tasks.map(task => task.id)),
    ...(plan.events || []).map(event => event.id),
  ].filter(id => otherTaskIds.has(id));
  if (collisions.length) return {
    plans,
    validation: { ok: false, errors: [{ path: 'id', message: 'task ids must be unique across saved plans' }] },
    write: null,
  };
  const repository = new MemoryRepository(engineStateFromPlans(plans));
  const engine = new TrackerEngine(repository);
  const mode = plans.some(item => item.id === plan.id) ? 'replace' : 'create';
  const write = await engine.writePlan({ plan, mode });
  const state = await repository.read();
  return { plans: Object.values(state.plans), validation: write.validation, write };
}

export async function previewGenericPlan(plans, plan) {
  const validation = validatePlan(plan);
  if (!validation.ok) return { validation, write: null };
  const repository = new MemoryRepository(engineStateFromPlans(plans));
  const engine = new TrackerEngine(repository);
  const mode = plans.some(item => item.id === plan.id) ? 'replace' : 'create';
  const write = await engine.writePlan({ plan, mode, dryRun: true });
  return { validation: write.validation, write };
}

export async function previewGenericMove({ plans, done = {}, pushed = {}, planId, taskId, homeDate, toDate }) {
  const state = engineStateFromPlans(plans, done, pushed);
  state.progress[planId].entries[taskId] = {
    ...state.progress[planId].entries[taskId],
    ...(homeDate ? { homeDate } : {}),
  };
  const engine = new TrackerEngine(new MemoryRepository(state), {
    clock: () => new Date(`${toDate}T12:00:00.000Z`),
  });
  return engine.reschedule({
    planId,
    move: { taskIds: [taskId], toDate },
    dryRun: true,
  });
}
