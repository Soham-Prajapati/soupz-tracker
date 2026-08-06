import { progressValue } from './progressKeys.js';

export const HACKATHON_SCHEMA_VERSION = 1;
export const HACKATHON_MODE = 'hackathon';
export const STANDARD_MODE = 'standard';

const WORKSTREAM_COLOURS = ['#D4553A', '#2F8C86', '#7FA23C', '#B2456F', '#E2963C', '#6A5B4A'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (value) => String(value ?? '').trim();
const clone = (value) => JSON.parse(JSON.stringify(value));

function defaultId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}_${random.replaceAll('-', '')}`;
}

function edited(plan, now) {
  return {
    ...plan,
    revision: Number(plan.revision || 0) + 1,
    updatedAt: now(),
  };
}

export function normalizeTrackerMode(mode) {
  return mode === HACKATHON_MODE ? HACKATHON_MODE : STANDARD_MODE;
}

export function viewForTrackerMode(mode, currentView = 'today') {
  return normalizeTrackerMode(mode) === HACKATHON_MODE
    ? 'hackathon'
    : currentView === 'hackathon' ? 'today' : currentView;
}

export function createHackathonPlan(metadata = {}, {
  idFactory = defaultId,
  now = () => new Date().toISOString(),
} = {}) {
  const createdAt = now();
  const start = clean(metadata.start) || createdAt.slice(0, 10);
  const end = clean(metadata.deadline);

  return {
    schemaVersion: HACKATHON_SCHEMA_VERSION,
    id: idFactory('pln'),
    title: clean(metadata.title) || 'Hackathon plan',
    kind: 'hackathon',
    timezone: clean(metadata.timezone) || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    window: { start, end: end || null },
    createdAt,
    updatedAt: createdAt,
    revision: 1,
    source: 'ui',
    tracks: [],
    phases: [],
    recurrences: [],
    schedule: [],
    events: [],
    ext: {
      hackathon: {
        demoGoal: clean(metadata.demoGoal),
      },
    },
  };
}

export function updateHackathonMetadata(plan, patch, {
  now = () => new Date().toISOString(),
} = {}) {
  if (!plan) return plan;
  const next = edited(clone(plan), now);
  const currentExt = next.ext?.hackathon || {};

  if ('title' in patch) next.title = clean(patch.title) || 'Hackathon plan';
  if ('start' in patch) next.window = { ...next.window, start: clean(patch.start) || next.window.start };
  if ('deadline' in patch) next.window = { ...next.window, end: clean(patch.deadline) || null };
  if ('demoGoal' in patch) {
    next.ext = { ...next.ext, hackathon: { ...currentExt, demoGoal: clean(patch.demoGoal) } };
  }
  if (!ISO_DATE.test(next.window.start) || (next.window.end && (!ISO_DATE.test(next.window.end) || next.window.end < next.window.start))) return plan;
  return next;
}

export function addHackathonWorkstream(plan, input, {
  idFactory = defaultId,
  now = () => new Date().toISOString(),
} = {}) {
  const name = clean(input?.name);
  if (!plan || !name) return plan;
  const next = edited(clone(plan), now);
  const color = clean(input.color) || WORKSTREAM_COLOURS[next.tracks.length % WORKSTREAM_COLOURS.length];
  next.tracks.push({ id: idFactory('trk'), name, color });
  return next;
}

export function addHackathonMilestone(plan, input, {
  idFactory = defaultId,
  now = () => new Date().toISOString(),
} = {}) {
  const title = clean(input?.title);
  const date = clean(input?.date);
  if (!plan || !title || !date) return plan;
  const next = edited(clone(plan), now);
  next.events.push({
    id: idFactory('evt'),
    date,
    title,
    kind: 'milestone',
    why: clean(input.why),
    fixed: true,
    track: clean(input.track) || null,
    links: [],
  });
  return next;
}

export function addHackathonTask(plan, input, {
  idFactory = defaultId,
  now = () => new Date().toISOString(),
} = {}) {
  const title = clean(input?.title);
  const date = clean(input?.date);
  if (!plan || !title || !date) return plan;
  const next = edited(clone(plan), now);
  let day = next.schedule.find(item => item.date === date);
  if (!day) {
    day = { date, phase: null, phaseNote: '', tasks: [] };
    next.schedule.push(day);
    next.schedule.sort((a, b) => a.date.localeCompare(b.date));
  }
  day.tasks.push({
    id: idFactory('tsk'),
    track: clean(input.track) || null,
    title,
    why: clean(input.why),
    meta: clean(input.meta),
    weight: 1,
    pin: Boolean(input.demoCritical),
    fixed: false,
    estSeconds: null,
    links: [],
    tags: [],
    ext: {
      hackathon: {
        demoCritical: Boolean(input.demoCritical),
        blockedBy: clean(input.blockedBy),
      },
    },
  });
  return next;
}

export function removeHackathonItem(plan, id, {
  now = () => new Date().toISOString(),
} = {}) {
  if (!plan || !id) return plan;
  const next = clone(plan);
  const before = JSON.stringify({ tracks: next.tracks, events: next.events, schedule: next.schedule });
  const removingTrack = next.tracks.some(track => track.id === id);
  next.tracks = next.tracks.filter(track => track.id !== id);
  next.events = next.events.filter(event => event.id !== id);
  next.schedule = next.schedule
    .map(day => ({
      ...day,
      tasks: day.tasks
        .filter(task => task.id !== id)
        .map(task => removingTrack && task.track === id ? { ...task, track: null } : task),
    }))
    .filter(day => day.tasks.length > 0);
  const after = JSON.stringify({ tracks: next.tracks, events: next.events, schedule: next.schedule });
  return before === after ? plan : edited(next, now);
}

export function hackathonTasksForDate(plan, date) {
  if (!plan || !date) return [];
  const tracks = new Map((plan.tracks || []).map(track => [track.id, track]));
  const day = (plan.schedule || []).find(item => item.date === date);
  return (day?.tasks || []).map(task => {
    const track = tracks.get(task.track);
    return {
      ...task,
      date,
      trackName: track?.name || 'Unassigned',
      trackColor: track?.color || '#6A5B4A',
    };
  });
}

export function projectHackathonPlan(plan, done = {}, today = '') {
  if (!plan) {
    return {
      taskCount: 0, doneCount: 0, openCount: 0, workstreams: [], milestones: [],
      blockers: [], demoCriticalRemaining: [], readiness: 'setup', todayTasks: [],
    };
  }

  const tasks = (plan.schedule || []).flatMap(day => (day.tasks || []).map(task => ({ ...task, date: day.date })));
  const workstreams = (plan.tracks || []).map(track => {
    const members = tasks.filter(task => task.track === track.id);
    return {
      ...track,
      taskCount: members.length,
      doneCount: members.filter(task => progressValue(done, plan.id, task.id)).length,
    };
  });
  const open = tasks.filter(task => !progressValue(done, plan.id, task.id));
  const blockers = open.filter(task => clean(task.ext?.hackathon?.blockedBy));
  const demoCriticalRemaining = open.filter(task => task.ext?.hackathon?.demoCritical);
  const deadlinePassed = Boolean(plan.window?.end && today && plan.window.end < today);
  const readiness = tasks.length === 0 ? 'setup'
    : blockers.length ? 'blocked'
    : deadlinePassed && open.length ? 'at-risk'
    : tasks.length > 0 && open.length === 0 ? 'ready'
    : 'building';

  return {
    taskCount: tasks.length,
    doneCount: tasks.length - open.length,
    openCount: open.length,
    workstreams,
    milestones: [...(plan.events || [])].sort((a, b) => a.date.localeCompare(b.date)),
    blockers,
    demoCriticalRemaining,
    readiness,
    todayTasks: hackathonTasksForDate(plan, today),
  };
}
