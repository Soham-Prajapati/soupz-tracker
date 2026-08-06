import { PLAN_SCHEMA_VERSION } from './schema.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function error(errors, path, message) {
  errors.push({ path, message });
}

function isIsoDate(value) {
  if (!DATE.test(value || '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validatePlan(plan) {
  const errors = [];
  if (!isObject(plan)) return { ok: false, errors: [{ path: '$', message: 'must be an object' }] };
  if (plan.schemaVersion !== PLAN_SCHEMA_VERSION) error(errors, 'schemaVersion', `must equal ${PLAN_SCHEMA_VERSION}`);
  if (typeof plan.id !== 'string' || !plan.id.trim()) error(errors, 'id', 'must be a non-empty stable id');
  if (typeof plan.title !== 'string' || !plan.title.trim()) error(errors, 'title', 'must be non-empty');
  if (!['plan', 'habit', 'hackathon', 'pack'].includes(plan.kind)) error(errors, 'kind', 'must be plan, habit, hackathon, or pack');
  if (typeof plan.timezone !== 'string' || !plan.timezone) error(errors, 'timezone', 'must be non-empty');
  if (!Number.isInteger(plan.revision) || plan.revision < 1) error(errors, 'revision', 'must be a positive integer');
  if (!isIsoDate(plan.window?.start)) error(errors, 'window.start', 'must be a real ISO date');
  if (plan.window?.end != null && !isIsoDate(plan.window.end)) error(errors, 'window.end', 'must be a real ISO date or null');
  if (plan.window?.end && plan.window.end < plan.window.start) error(errors, 'window.end', 'must not be before window.start');

  for (const key of ['tracks', 'phases', 'recurrences', 'schedule', 'events']) {
    if (!Array.isArray(plan[key])) error(errors, key, 'must be an array');
  }
  const ids = new Set();
  const addId = (id, path) => {
    if (typeof id !== 'string' || !id) error(errors, path, 'must be a non-empty stable id');
    else if (ids.has(id)) error(errors, path, 'must be unique within the plan');
    else ids.add(id);
  };
  (plan.tracks || []).forEach((track, index) => {
    addId(track?.id, `tracks[${index}].id`);
    if (typeof track?.name !== 'string' || !track.name.trim()) error(errors, `tracks[${index}].name`, 'must be non-empty');
    if (!HEX.test(track?.color || '')) error(errors, `tracks[${index}].color`, 'must be a six-digit hex colour');
  });
  (plan.recurrences || []).forEach((recurrence, index) => {
    addId(recurrence?.id, `recurrences[${index}].id`);
    if (typeof recurrence?.title !== 'string' || !recurrence.title.trim()) error(errors, `recurrences[${index}].title`, 'must be non-empty');
    if (!isIsoDate(recurrence?.from)) error(errors, `recurrences[${index}].from`, 'must be a real ISO date');
    if (recurrence?.until != null && !isIsoDate(recurrence.until)) error(errors, `recurrences[${index}].until`, 'must be a real ISO date or null');
    if (recurrence?.until && recurrence.until < recurrence.from) error(errors, `recurrences[${index}].until`, 'must not be before from');
    if (!['daily', 'weekly', 'monthly', 'everyN'].includes(recurrence?.rule?.freq)) error(errors, `recurrences[${index}].rule.freq`, 'is unsupported');
    if (recurrence?.rule?.byDay?.some(day => !Number.isInteger(day) || day < 0 || day > 6)) error(errors, `recurrences[${index}].rule.byDay`, 'must contain weekdays 0 through 6');
  });
  const scheduleDates = new Set();
  (plan.schedule || []).forEach((day, dayIndex) => {
    if (!isIsoDate(day?.date)) error(errors, `schedule[${dayIndex}].date`, 'must be a real ISO date');
    else if (scheduleDates.has(day.date)) error(errors, `schedule[${dayIndex}].date`, 'must be unique within the schedule');
    else scheduleDates.add(day.date);
    if (!Array.isArray(day?.tasks)) error(errors, `schedule[${dayIndex}].tasks`, 'must be an array');
    (day?.tasks || []).forEach((task, taskIndex) => {
      addId(task?.id, `schedule[${dayIndex}].tasks[${taskIndex}].id`);
      if (typeof task?.title !== 'string' || !task.title.trim()) error(errors, `schedule[${dayIndex}].tasks[${taskIndex}].title`, 'must be non-empty');
    });
  });
  (plan.events || []).forEach((event, index) => {
    addId(event?.id, `events[${index}].id`);
    if (!isIsoDate(event?.date)) error(errors, `events[${index}].date`, 'must be a real ISO date');
    if (event?.fixed !== true) error(errors, `events[${index}].fixed`, 'must be true');
  });
  return { ok: errors.length === 0, errors };
}

export function assertIsoDate(value, path = 'date') {
  if (!isIsoDate(value)) throw new Error(`${path} must be a real ISO date`);
  return value;
}

export function clone(value) {
  return structuredClone(value);
}
