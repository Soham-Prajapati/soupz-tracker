import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { MemoryRepository, TrackerEngine } from '../../core/src/index.js';
import { parseArgs } from '../src/cli.js';
import { requestIsAllowed } from '../src/http.js';
import { buildMcpServer, TOOL_NAMES } from '../src/server.js';

async function connectedPair() {
  const engine = new TrackerEngine(new MemoryRepository(), { clock: () => new Date('2026-07-31T12:00:00.000Z') });
  const server = buildMcpServer(engine);
  const client = new Client({ name: 'soupz-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

test('MCP exposes exactly the audited six tools and two contract resources', async t => {
  const pair = await connectedPair();
  t.after(() => Promise.all([pair.client.close(), pair.server.close()]));
  const tools = await pair.client.listTools();
  assert.deepEqual(tools.tools.map(tool => tool.name), TOOL_NAMES);
  const resources = await pair.client.listResources();
  assert.deepEqual(resources.resources.map(resource => resource.uri), ['soupz://schema/plan', 'soupz://conventions']);
  const schema = await pair.client.readResource({ uri: 'soupz://schema/plan' });
  assert.equal(JSON.parse(schema.contents[0].text).properties.schemaVersion.const, 1);
});

test('write_plan tool honors dry run and leaves get_state empty', async t => {
  const pair = await connectedPair();
  t.after(() => Promise.all([pair.client.close(), pair.server.close()]));
  const plan = {
    schemaVersion: 1, id: 'pln_mcp', title: 'Read', kind: 'habit', timezone: 'UTC',
    window: { start: '2026-07-31', end: null }, createdAt: '2026-07-31T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z', revision: 1, source: 'mcp',
    tracks: [], phases: [], recurrences: [], schedule: [], events: [],
  };
  const preview = await pair.client.callTool({ name: 'write_plan', arguments: { plan, mode: 'create', dryRun: true } });
  assert.equal(preview.structuredContent.dryRun, true);
  const state = await pair.client.callTool({ name: 'get_state', arguments: {} });
  assert.deepEqual(state.structuredContent.plans, []);
});

test('HTTP mode is explicit, loopback-host checked and bearer protected', () => {
  assert.deepEqual(parseArgs([]), { transport: 'stdio' });
  assert.deepEqual(parseArgs(['--http', '--port', '43121']), { transport: 'http', port: 43121 });
  assert.throws(() => parseArgs(['--http']), /user-chosen --port/);
  const token = 'x'.repeat(24);
  assert.equal(requestIsAllowed({ headers: { host: '127.0.0.1:43121', authorization: `Bearer ${token}` } }, { port: 43121, token }), true);
  assert.equal(requestIsAllowed({ headers: { host: 'localhost:43121', authorization: `Bearer ${token}` } }, { port: 43121, token }), false);
  assert.equal(requestIsAllowed({ headers: { host: '127.0.0.1:43121', authorization: 'Bearer wrong' } }, { port: 43121, token }), false);
});

test('CLI defaults to a clean stdio MCP transport', async t => {
  const client = new Client({ name: 'soupz-stdio-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['packages/mcp/src/cli.js'],
    cwd: process.cwd(),
    stderr: 'pipe',
  });
  t.after(() => client.close());
  await client.connect(transport);
  assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), TOOL_NAMES);
});
