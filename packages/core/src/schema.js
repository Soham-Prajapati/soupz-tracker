export const PLAN_SCHEMA_VERSION = 1;

export const PLAN_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'soupz://schema/plan',
  title: 'Soupz Tracker plan',
  type: 'object',
  required: ['schemaVersion', 'id', 'title', 'kind', 'timezone', 'window', 'revision', 'tracks', 'phases', 'recurrences', 'schedule', 'events'],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: PLAN_SCHEMA_VERSION },
    id: { type: 'string', minLength: 1 },
    title: { type: 'string', minLength: 1 },
    kind: { enum: ['plan', 'habit', 'hackathon', 'pack'] },
    timezone: { type: 'string', minLength: 1 },
    window: {
      type: 'object',
      required: ['start'],
      additionalProperties: false,
      properties: { start: { type: 'string', format: 'date' }, end: { type: ['string', 'null'], format: 'date' } },
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    revision: { type: 'integer', minimum: 1 },
    source: { type: 'string' },
    tracks: { type: 'array', items: { $ref: '#/$defs/track' } },
    phases: { type: 'array', items: { $ref: '#/$defs/phase' } },
    recurrences: { type: 'array', items: { $ref: '#/$defs/recurrence' } },
    schedule: { type: 'array', items: { $ref: '#/$defs/day' } },
    events: { type: 'array', items: { $ref: '#/$defs/event' } },
    ext: { type: 'object' },
  },
  $defs: {
    track: {
      type: 'object', required: ['id', 'name', 'color'], additionalProperties: true,
      properties: { id: { type: 'string' }, name: { type: 'string' }, color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }, glyph: { type: 'string' } },
    },
    phase: {
      type: 'object', required: ['id', 'name', 'start', 'end'], additionalProperties: true,
      properties: { id: { type: 'string' }, name: { type: 'string' }, start: { type: 'string', format: 'date' }, end: { type: 'string', format: 'date' }, rate: { type: 'integer', minimum: 1 }, note: { type: 'string' } },
    },
    recurrence: {
      type: 'object', required: ['id', 'title', 'rule', 'from'], additionalProperties: true,
      properties: {
        id: { type: 'string' }, track: { type: 'string' }, title: { type: 'string', minLength: 1 }, why: { type: 'string' },
        rule: {
          type: 'object', required: ['freq'], additionalProperties: false,
          properties: { freq: { enum: ['daily', 'weekly', 'monthly', 'everyN'] }, byDay: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } }, interval: { type: 'integer', minimum: 1 } },
        },
        from: { type: 'string', format: 'date' }, until: { type: ['string', 'null'], format: 'date' }, target: { type: 'object' }, weight: { type: 'number' },
      },
    },
    task: {
      type: 'object', required: ['id', 'title'], additionalProperties: true,
      properties: { id: { type: 'string' }, track: { type: 'string' }, title: { type: 'string', minLength: 1 }, why: { type: 'string' }, weight: { type: 'number' }, pin: { type: 'boolean' }, fixed: { type: 'boolean' }, revisit: { type: 'object' }, links: { type: 'array' }, target: { type: 'object' }, ext: { type: 'object' } },
    },
    day: {
      type: 'object', required: ['date', 'tasks'], additionalProperties: true,
      properties: { date: { type: 'string', format: 'date' }, phase: { type: ['string', 'null'] }, phaseNote: { type: 'string' }, tasks: { type: 'array', items: { $ref: '#/$defs/task' } } },
    },
    event: {
      allOf: [{ $ref: '#/$defs/task' }, { type: 'object', required: ['date'], properties: { date: { type: 'string', format: 'date' }, fixed: { const: true } } }],
    },
  },
};

export const CONVENTIONS = `# Soupz Tracker plan conventions

- Plans are maintained, never authored by Soupz. Persist only work supplied by the user or their client.
- Task ids are opaque and stable. Never encode titles, dates, subjects, or track names into ids.
- Titles name the specific action. Prefer “Read chapter 4” over “Study”.
- Keep progress separate from plan structure so revisions cannot erase history.
- Use weight 0 for optional work and fixed true for work that deterministic rescheduling must not move.
- Use one revisit rule instead of hand-copying revision tasks.
- A missed day is neutral. Streaks are derived facts, never punishment.
- Dry-run structural replacement and rescheduling before committing large changes.
`;
