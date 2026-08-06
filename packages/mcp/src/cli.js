#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';
import { JsonFileRepository } from '../../core/src/nodeStore.js';
import { TrackerEngine } from '../../core/src/index.js';
import { startHttpServer } from './http.js';
import { buildMcpServer } from './server.js';

export function parseArgs(args) {
  if (!args.length) return { transport: 'stdio' };
  if (args[0] !== '--http') throw new Error('Usage: soupz-tracker-mcp [--http --port PORT]');
  const portIndex = args.indexOf('--port');
  if (portIndex < 0 || !args[portIndex + 1]) throw new Error('HTTP mode requires a user-chosen --port');
  const allowed = new Set(['--http', '--port', args[portIndex + 1]]);
  if (args.some(value => !allowed.has(value))) throw new Error('Only --http and --port are supported');
  return { transport: 'http', port: Number(args[portIndex + 1]) };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const engine = new TrackerEngine(new JsonFileRepository());
  if (options.transport === 'http') {
    await startHttpServer({ engine, port: options.port, token: process.env.SOUPZ_MCP_TOKEN });
    console.error(`Soupz Tracker MCP listening on http://127.0.0.1:${options.port}/mcp`);
    return;
  }
  const server = buildMcpServer(engine);
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
