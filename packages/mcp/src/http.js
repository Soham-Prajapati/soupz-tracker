import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer } from './server.js';

const HOST = '127.0.0.1';

function secureEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requestIsAllowed(request, { port, token }) {
  if (request.headers.host !== `${HOST}:${port}`) return false;
  const authorization = request.headers.authorization || '';
  return authorization.startsWith('Bearer ') && secureEqual(authorization.slice(7), token);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_048_576) throw new Error('Request body exceeds 1 MiB');
    chunks.push(chunk);
  }
  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function jsonError(response, status, message) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
}

export async function startHttpServer({ engine, port, token }) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('--port must be an integer from 1024 to 65535');
  if (typeof token !== 'string' || token.length < 24) throw new Error('SOUPZ_MCP_TOKEN must contain at least 24 characters');
  const server = createServer(async (request, response) => {
    if (request.url !== '/mcp') return jsonError(response, 404, 'Not found');
    if (!requestIsAllowed(request, { port, token })) return jsonError(response, 401, 'Unauthorized');
    try {
      const body = request.method === 'POST' ? await readJson(request) : undefined;
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcp = buildMcpServer(engine);
      await mcp.connect(transport);
      await transport.handleRequest(request, response, body);
      response.once('close', () => mcp.close().catch(() => {}));
    } catch (error) {
      if (!response.headersSent) jsonError(response, 400, error.message);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, resolve);
  });
  return server;
}
