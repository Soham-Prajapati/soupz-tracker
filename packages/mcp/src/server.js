import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CONVENTIONS, PLAN_SCHEMA } from '../../core/src/index.js';

export const TOOL_NAMES = Object.freeze([
  'get_state',
  'get_plan',
  'write_plan',
  'add_tasks',
  'reschedule',
  'set_progress',
]);

const result = value => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  structuredContent: value,
});

export function buildMcpServer(engine) {
  const server = new McpServer(
    { name: 'soupz-tracker', version: '1.0.0' },
    { instructions: 'Read soupz://schema/plan and soupz://conventions before writing a plan. Use dry runs for replacement and rescheduling. Soupz maintains plans; it does not author them.' },
  );

  server.registerTool('get_state', {
    title: 'Get tracker state',
    description: 'Orient once: active plans, today, overdue work, streaks and the last 14 days.',
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => result(await engine.getState()));

  server.registerTool('get_plan', {
    title: 'Get a plan slice',
    description: 'Read plan metadata or a bounded, filtered schedule slice.',
    inputSchema: {
      planId: z.string().min(1),
      from: z.string().optional(),
      to: z.string().optional(),
      query: z.string().optional(),
      trackId: z.string().optional(),
      status: z.enum(['open', 'done', 'overdue']).optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async input => result(await engine.getPlan(input)));

  server.registerTool('write_plan', {
    title: 'Create or replace a plan',
    description: 'Validate and create or replace a complete user-authored plan. Dry-run returns the id diff without writing.',
    inputSchema: {
      plan: z.record(z.any()),
      mode: z.enum(['create', 'replace']),
      dryRun: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async input => result(await engine.writePlan(input)));

  server.registerTool('add_tasks', {
    title: 'Add tasks',
    description: 'Add explicit dated work or recurrence rules without resending the whole plan.',
    inputSchema: {
      planId: z.string().min(1),
      tasks: z.array(z.object({
        date: z.string().optional(),
        recur: z.record(z.any()).optional(),
        track: z.string().optional(),
        title: z.string().min(1),
        why: z.string().optional(),
        links: z.array(z.record(z.any())).optional(),
        weight: z.number().optional(),
        revisit: z.record(z.any()).optional(),
      })).min(1),
    },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async input => result(await engine.addTasks(input)));

  server.registerTool('reschedule', {
    title: 'Deterministically reschedule work',
    description: 'Move explicit tasks, a whole day, catch up within capacity, or spread across eligible dates. Fixed work never moves.',
    inputSchema: {
      planId: z.string().min(1),
      move: z.record(z.any()),
      dryRun: z.boolean().optional(),
    },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async input => result(await engine.reschedule(input)));

  server.registerTool('set_progress', {
    title: 'Set progress',
    description: 'Idempotently set boolean or count progress for stable task ids.',
    inputSchema: {
      planId: z.string().min(1),
      entries: z.array(z.object({
        taskId: z.string().min(1),
        done: z.boolean().optional(),
        count: z.number().optional(),
        at: z.string().optional(),
      })).min(1),
    },
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async input => result(await engine.setProgress(input)));

  server.registerResource('plan-schema', 'soupz://schema/plan', {
    title: 'Soupz plan JSON Schema',
    description: 'Versioned contract accepted by write_plan.',
    mimeType: 'application/schema+json',
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'application/schema+json', text: JSON.stringify(PLAN_SCHEMA, null, 2) }] }));

  server.registerResource('conventions', 'soupz://conventions', {
    title: 'Soupz plan conventions',
    description: 'Stable-id, progress, rescheduling and copy rules.',
    mimeType: 'text/markdown',
  }, async uri => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: CONVENTIONS }] }));

  return server;
}
