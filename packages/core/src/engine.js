import { MemoryRepository } from './repository.js';
import { assertIsoDate, clone, validatePlan } from './validation.js';

const DEFAULT_COLOURS = ['#D4553A', '#4E8C3F', '#2F8C86', '#6C63A8', '#B5842B', '#B2456F'];
const DAY_MS = 86_400_000;

const parseDate = value => new Date(`${assertIsoDate(value)}T00:00:00.000Z`);
export const isoDate = date => date.toISOString().slice(0, 10);
export const addDays = (value, count) => isoDate(new Date(parseDate(value).getTime() + count * DAY_MS));
const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / DAY_MS);

function randomId(prefix) {
  const value = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${value.replaceAll('-', '').slice(0, 16)}`;
}

function stableId(prefix, seed) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function recurrenceMatches(recurrence, date) {
  if (date < recurrence.from || (recurrence.until && date > recurrence.until)) return false;
  const weekday = parseDate(date).getUTCDay();
  const interval = Math.max(1, recurrence.rule.interval || 1);
  if (recurrence.rule.freq === 'daily') return daysBetween(recurrence.from, date) % interval === 0;
  if (recurrence.rule.freq === 'weekly') {
    const byDay = recurrence.rule.byDay?.length ? recurrence.rule.byDay : [parseDate(recurrence.from).getUTCDay()];
    return byDay.includes(weekday) && Math.floor(daysBetween(recurrence.from, date) / 7) % interval === 0;
  }
  if (recurrence.rule.freq === 'monthly') {
    const from = parseDate(recurrence.from);
    const current = parseDate(date);
    const months = (current.getUTCFullYear() - from.getUTCFullYear()) * 12 + current.getUTCMonth() - from.getUTCMonth();
    return current.getUTCDate() === from.getUTCDate() && months % interval === 0;
  }
  return daysBetween(recurrence.from, date) % interval === 0;
}

export function tasksForDate(plan, date, progress = {}) {
  assertIsoDate(date);
  if (date < plan.window.start || (plan.window.end && date > plan.window.end)) return [];
  const explicit = (plan.schedule || []).find(day => day.date === date)?.tasks || [];
  const recurring = (plan.recurrences || [])
    .filter(recurrence => recurrenceMatches(recurrence, date))
    .map(recurrence => ({
      id: stableId('tsk', `${plan.id}:${recurrence.id}:${date}`),
      recurrenceId: recurrence.id,
      track: recurrence.track,
      title: recurrence.title,
      why: recurrence.why,
      target: recurrence.target,
      weight: recurrence.weight ?? 1,
    }));
  const events = (plan.events || []).filter(event => event.date === date);
  return [...events, ...explicit, ...recurring]
    .filter(task => (progress[task.id]?.pushedTo || date) === date)
    .map(task => ({ ...clone(task), date }));
}

function allTasksForDate(plan, date, progress) {
  const own = tasksForDate(plan, date, progress);
  const moved = [];
  for (const [taskId, entry] of Object.entries(progress)) {
    if (entry.pushedTo !== date || own.some(task => task.id === taskId)) continue;
    const task = findTask(plan, taskId, progress);
    if (task) moved.push({ ...task, date });
  }
  return [...own, ...moved];
}

function findTask(plan, taskId, progress = {}) {
  for (const event of plan.events || []) if (event.id === taskId) return { ...event, date: event.date };
  for (const day of plan.schedule || []) {
    const task = day.tasks.find(item => item.id === taskId);
    if (task) return { ...task, date: progress[taskId]?.pushedTo || day.date, homeDate: day.date };
  }
  const start = progress[taskId]?.homeDate || plan.window.start;
  const end = plan.window.end || addDays(start, 3660);
  const pushedDate = progress[taskId]?.pushedTo;
  const from = start;
  const to = pushedDate || end;
  for (let date = from, guard = 0; date <= to && guard < 3661; date = addDays(date, 1), guard += 1) {
    const task = tasksForDate(plan, date, {})
      .find(item => item.id === taskId);
    if (task) return { ...task, date: pushedDate || date, homeDate: date };
  }
  return null;
}

function taskIds(plan) {
  return new Set([
    ...(plan.schedule || []).flatMap(day => day.tasks.map(task => task.id)),
    ...(plan.events || []).map(event => event.id),
    ...(plan.recurrences || []).map(recurrence => recurrence.id),
  ]);
}

function planDiff(previous, next, progress = {}) {
  const before = previous ? taskIds(previous) : new Set();
  const after = taskIds(next);
  const tasksAdded = [...after].filter(id => !before.has(id));
  const tasksKept = [...after].filter(id => before.has(id));
  const tasksRemoved = [...before].filter(id => !after.has(id));
  return {
    tasksAdded: tasksAdded.length,
    tasksKept: tasksKept.length,
    tasksRemoved: tasksRemoved.length,
    progressOrphaned: tasksRemoved.filter(id => progress[id]),
  };
}

function ensureProgress(state, planId) {
  state.progress[planId] ||= { schemaVersion: 1, planId, entries: {} };
  return state.progress[planId].entries;
}

export function createHabitPlan({ title, from, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', frequency = 'daily', byDay, target, color = '#D4553A' }) {
  const now = new Date().toISOString();
  const planId = randomId('pln');
  const trackId = randomId('trk');
  return {
    schemaVersion: 1,
    id: planId,
    title: title.trim(),
    kind: 'habit',
    timezone,
    window: { start: assertIsoDate(from), end: null },
    createdAt: now,
    updatedAt: now,
    revision: 1,
    source: 'ui',
    tracks: [{ id: trackId, name: title.trim(), color }],
    phases: [],
    recurrences: [{
      id: randomId('rec'),
      track: trackId,
      title: title.trim(),
      rule: { freq: frequency, ...(byDay?.length ? { byDay } : {}) },
      from,
      until: null,
      ...(target ? { target } : {}),
      weight: 1,
    }],
    schedule: [],
    events: [],
  };
}

export class TrackerEngine {
  constructor(repository = new MemoryRepository(), { clock = () => new Date(), idFactory = randomId } = {}) {
    this.repository = repository;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  async getState({ today = isoDate(this.clock()) } = {}) {
    const state = await this.repository.read();
    const plans = Object.values(state.plans);
    const todayTasks = [];
    const overdueTasks = [];
    let overdueTruncated = false;
    for (const plan of plans) {
      const progress = state.progress[plan.id]?.entries || {};
      todayTasks.push(...allTasksForDate(plan, today, progress).map(task => ({ ...task, planId: plan.id })));
      const age = daysBetween(plan.window.start, today);
      const overdueStart = age > 3661 ? addDays(today, -3661) : plan.window.start;
      if (age > 3661) overdueTruncated = true;
      for (let date = overdueStart, guard = 0; date < today && guard < 3661; date = addDays(date, 1), guard += 1) {
        for (const task of allTasksForDate(plan, date, progress)) {
          if (!progress[task.id]?.done && !task.fixed) overdueTasks.push({ ...task, planId: plan.id });
        }
      }
    }
    const last14 = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset);
      let done = 0;
      let total = 0;
      for (const plan of plans) {
        const progress = state.progress[plan.id]?.entries || {};
        const tasks = allTasksForDate(plan, date, progress);
        total += tasks.length;
        done += tasks.filter(task => progress[task.id]?.done).length;
      }
      last14.push({ date, done, total });
    }
    let streak = 0;
    if (!plans.length) return {
      today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      plans: [],
      todayTasks,
      overdue: { count: 0, oldest: null },
      streaks: [{ trackId: 'all', name: 'All tracked work', days: 0 }],
      last14,
    };
    for (let date = today, guard = 0; guard < 3661; date = addDays(date, -1), guard += 1) {
      const day = last14.find(item => item.date === date);
      let total = day?.total || 0;
      let completed = day ? day.done > 0 : false;
      if (!day) {
        const tasks = plans.flatMap(plan => {
          const progress = state.progress[plan.id]?.entries || {};
          return allTasksForDate(plan, date, progress).map(task => ({ task, progress }));
        });
        total = tasks.length;
        completed = tasks.some(({ task, progress }) => progress[task.id]?.done);
      }
      if (total === 0) continue;
      if (!completed) break;
      streak += 1;
    }
    return {
      today,
      timezone: plans[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      plans: plans.map(plan => ({
        id: plan.id,
        title: plan.title,
        kind: plan.kind,
        window: plan.window,
        taskCount: taskIds(plan).size,
        openCount: todayTasks.filter(task => task.planId === plan.id && !state.progress[plan.id]?.entries?.[task.id]?.done).length,
      })),
      todayTasks,
      overdue: { count: overdueTasks.length, oldest: overdueTasks.sort((a, b) => a.date.localeCompare(b.date))[0]?.date || null, truncated: overdueTruncated },
      streaks: [{ trackId: 'all', name: 'All tracked work', days: streak }],
      last14,
    };
  }

  async getPlan({ planId, from, to, query, trackId, status } = {}) {
    const state = await this.repository.read();
    const plan = state.plans[planId];
    if (!plan) throw new Error(`Unknown plan: ${planId}`);
    const progress = state.progress[planId]?.entries || {};
    if (!from && !to && !query && !trackId && !status) {
      return { plan: { ...clone(plan), schedule: [] }, truncated: plan.schedule.length > 0, matched: taskIds(plan).size };
    }
    const lower = from || plan.window.start;
    const upper = to || plan.window.end || addDays(lower, 30);
    const schedule = [];
    let matched = 0;
    let nextDate = lower;
    for (let date = lower, guard = 0; date <= upper && guard < 3661; date = addDays(date, 1), guard += 1) {
      const tasks = allTasksForDate(plan, date, progress).filter(task => {
        if (query && !`${task.title} ${task.why || ''}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (trackId && task.track !== trackId) return false;
        const done = Boolean(progress[task.id]?.done);
        if (status === 'done' && !done) return false;
        if (status === 'open' && done) return false;
        if (status === 'overdue' && (done || date >= isoDate(this.clock()))) return false;
        return true;
      });
      if (tasks.length) schedule.push({ date, tasks });
      matched += tasks.length;
      nextDate = addDays(date, 1);
    }
    return { plan: { ...clone(plan), schedule }, truncated: nextDate <= upper, matched };
  }

  async writePlan({ plan, mode, dryRun = false }) {
    const validation = validatePlan(plan);
    if (!validation.ok) return { planId: plan?.id, revision: plan?.revision, diff: null, validation };
    if (!['create', 'replace'].includes(mode)) throw new Error('mode must be create or replace');
    const apply = state => {
      const previous = state.plans[plan.id];
      if (mode === 'create' && previous) throw new Error(`Plan already exists: ${plan.id}`);
      if (mode === 'replace' && !previous) throw new Error(`Cannot replace unknown plan: ${plan.id}`);
      const next = clone(plan);
      if (previous) next.revision = previous.revision + 1;
      next.updatedAt = this.clock().toISOString();
      const diff = planDiff(previous, next, state.progress[plan.id]?.entries || {});
      state.plans[next.id] = next;
      ensureProgress(state, next.id);
      return { planId: next.id, revision: next.revision, diff, validation: { ok: true, errors: [] }, dryRun };
    };
    if (dryRun) return apply(await this.repository.read());
    return this.repository.update(apply);
  }

  async addTasks({ planId, tasks }) {
    if (!Array.isArray(tasks) || !tasks.length) return { created: [], warnings: ['No tasks supplied.'] };
    return this.repository.update(state => {
      const plan = state.plans[planId];
      if (!plan) throw new Error(`Unknown plan: ${planId}`);
      const created = [];
      const warnings = [];
      for (const input of tasks) {
        if (!input?.title?.trim()) { warnings.push('Skipped a task with no title.'); continue; }
        let track = plan.tracks.find(item => item.id === input.track || item.name.toLowerCase() === input.track?.toLowerCase());
        if (input.track && !track) {
          track = { id: this.idFactory('trk'), name: input.track, color: DEFAULT_COLOURS[plan.tracks.length % DEFAULT_COLOURS.length] };
          plan.tracks.push(track);
          warnings.push(`Created track ${input.track}.`);
        }
        if (input.recur) {
          const recurrence = {
            id: this.idFactory('rec'),
            track: track?.id,
            title: input.title.trim(),
            why: input.why,
            rule: input.recur.rule || input.recur,
            from: input.recur.from || isoDate(this.clock()),
            until: input.recur.until ?? null,
            weight: input.weight ?? 1,
            revisit: input.revisit,
          };
          plan.recurrences.push(recurrence);
          created.push({ id: recurrence.id, date: recurrence.from });
        } else {
          const date = assertIsoDate(input.date, 'tasks[].date');
          let day = plan.schedule.find(item => item.date === date);
          if (!day) { day = { date, tasks: [] }; plan.schedule.push(day); }
          const task = {
            id: this.idFactory('tsk'),
            track: track?.id,
            title: input.title.trim(),
            why: input.why,
            weight: input.weight ?? 1,
            revisit: input.revisit,
            links: input.links,
          };
          day.tasks.push(task);
          created.push({ id: task.id, date });
        }
      }
      plan.schedule.sort((a, b) => a.date.localeCompare(b.date));
      plan.revision += 1;
      plan.updatedAt = this.clock().toISOString();
      return { created, warnings };
    });
  }

  async reschedule({ planId, move, dryRun = false }) {
    const state = await this.repository.read();
    const plan = state.plans[planId];
    if (!plan) throw new Error(`Unknown plan: ${planId}`);
    const progress = clone(state.progress[planId]?.entries || {});
    const moves = [];
    const skipped = [];
    const place = (task, to) => {
      if (!task) return false;
      if (task.fixed) { skipped.push({ taskId: task.id, reason: 'fixed tasks cannot move' }); return false; }
      progress[task.id] = { ...progress[task.id], homeDate: task.homeDate || task.date, pushedTo: to, at: this.clock().toISOString() };
      moves.push({ taskId: task.id, from: task.date, to });
      return true;
    };

    if (move?.taskIds && move.toDate) {
      assertIsoDate(move.toDate, 'move.toDate');
      move.taskIds.forEach(id => {
        const task = findTask(plan, id, progress);
        if (!task) skipped.push({ taskId: id, reason: 'unknown task' }); else place(task, move.toDate);
      });
    } else if (move?.fromDate && move.toDate) {
      allTasksForDate(plan, move.fromDate, progress).forEach(task => place(task, move.toDate));
    } else if (move?.strategy === 'catchUp') {
      const today = isoDate(this.clock());
      const horizon = Math.max(1, move.horizonDays || 14);
      const overdue = [];
      for (let date = plan.window.start, guard = 0; date < today && guard < 3661; date = addDays(date, 1), guard += 1) {
        overdue.push(...allTasksForDate(plan, date, progress).filter(task => !progress[task.id]?.done));
      }
      const occupancy = new Map();
      for (const task of overdue) {
        if (task.fixed) { place(task, today); continue; }
        let placed = false;
        for (let offset = 0; offset < horizon; offset += 1) {
          const date = addDays(today, offset);
          const phase = (plan.phases || []).find(item => date >= item.start && date <= item.end);
          const rate = phase?.rate || 3;
          const count = occupancy.get(date) || allTasksForDate(plan, date, progress).length;
          if (count < rate && place(task, date)) {
            occupancy.set(date, count + 1);
            placed = true;
            break;
          }
        }
        if (!placed) skipped.push({ taskId: task.id, reason: 'no capacity inside catch-up horizon' });
      }
    } else if (move?.strategy === 'spread') {
      const dates = [];
      for (let date = move.from, guard = 0; date <= move.to && guard < 3661; date = addDays(date, 1), guard += 1) {
        if (!(move.skipDow || []).includes(parseDate(date).getUTCDay())) dates.push(date);
      }
      if (!dates.length) throw new Error('spread has no eligible dates');
      (move.taskIds || []).forEach((id, index) => {
        const task = findTask(plan, id, progress);
        if (!task) skipped.push({ taskId: id, reason: 'unknown task' }); else place(task, dates[index % dates.length]);
      });
    } else {
      throw new Error('Unsupported reschedule move');
    }

    if (!dryRun) {
      await this.repository.update(draft => {
        ensureProgress(draft, planId);
        draft.progress[planId].entries = progress;
      });
    }
    return { moves, skipped, dryRun };
  }

  async setProgress({ planId, entries }) {
    return this.repository.update(state => {
      if (!state.plans[planId]) throw new Error(`Unknown plan: ${planId}`);
      const progress = ensureProgress(state, planId);
      for (const entry of entries || []) {
        if (!entry.taskId) continue;
        progress[entry.taskId] = {
          ...progress[entry.taskId],
          ...(typeof entry.done === 'boolean' ? { done: entry.done } : {}),
          ...(Number.isFinite(entry.count) ? { count: entry.count } : {}),
          at: entry.at || this.clock().toISOString(),
        };
      }
      return entries?.filter(entry => entry.taskId).length || 0;
    }).then(async updated => ({ updated, streaks: (await this.getState()).streaks }));
  }
}
