import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PORT, HOST, TOKEN, MAX_FILE_BYTES, runtime, OPEN_MODE, ensureWorkspace } from './lib/config.js';
import * as svc from './lib/fs-service.js';
import { buildServer } from './mcp-core.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const VERSION = '1.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

function setCors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'authorization, content-type, mcp-session-id, mcp-protocol-version, accept, last-event-id');
  res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('access-control-expose-headers', 'mcp-session-id, mcp-protocol-version');
}

function tokenMatches(candidate) {
  if (!candidate) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function isAuthorized(req, url) {
  const header = req.headers['authorization'] || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const query = url.searchParams.get('token') || '';
  return tokenMatches(bearer) || tokenMatches(query);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        reject(new svc.HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req, MAX_FILE_BYTES + 1024 * 1024);
  if (buf.length === 0) return undefined;
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new svc.HttpError(400, 'Invalid JSON');
  }
}

async function serveStatic(req, res, pathname) {
  const target = pathname === '/' ? '/index.html' : pathname;
  const abs = path.resolve(PUBLIC_DIR, '.' + target);
  const rel = path.relative(PUBLIC_DIR, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  let data;
  try {
    data = await fsp.readFile(abs);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': 'no-cache',
    'content-length': data.length
  });
  res.end(data);
}

async function handleMcp(req, res) {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  res.on('close', () => {
    Promise.resolve(transport.close()).catch(() => {});
    Promise.resolve(server.close()).catch(() => {});
  });

  await server.connect(transport);
  let body;
  if (req.method === 'POST') {
    body = await readJsonBody(req);
  }
  await transport.handleRequest(req, res, body);
}

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api/, '') || '/';

  if (req.method === 'GET' && route === '/health') {
    return sendJson(res, 200, { ok: true, version: VERSION, workspace: runtime.workspace, openMode: OPEN_MODE });
  }

  if (req.method === 'GET' && route === '/settings') {
    return sendJson(res, 200, await svc.workspaceInfo());
  }

  if (req.method === 'POST' && route === '/settings') {
    const body = await readJsonBody(req);
    if (!body || typeof body.workspace !== 'string') {
      throw new svc.HttpError(400, 'workspace is required');
    }
    return sendJson(res, 200, await svc.setWorkspace(body.workspace, body.create === true));
  }

  if (req.method === 'GET' && route === '/tree') {
    return sendJson(res, 200, await svc.listTree(url.searchParams.get('path') || ''));
  }

  if (req.method === 'GET' && route === '/file') {
    return sendJson(res, 200, await svc.readFile(url.searchParams.get('path') || ''));
  }

  if (req.method === 'GET' && route === '/info') {
    return sendJson(res, 200, await svc.workspaceInfo());
  }

  if (req.method === 'POST' && route === '/file') {
    const body = await readJsonBody(req);
    if (!body || typeof body.path !== 'string') throw new svc.HttpError(400, 'path is required');
    return sendJson(res, 200, await svc.writeFile(body.path, body.content ?? ''));
  }

  if (req.method === 'POST' && route === '/edit') {
    const body = await readJsonBody(req);
    if (!body || typeof body.path !== 'string') throw new svc.HttpError(400, 'path is required');
    return sendJson(
      res,
      200,
      await svc.editFile(body.path, body.oldText, body.newText, body.replaceAll === true)
    );
  }

  if (req.method === 'POST' && route === '/structure') {
    const body = await readJsonBody(req);
    return sendJson(res, 200, await svc.createStructure(body?.entries));
  }

  if (req.method === 'POST' && route === '/folder') {
    const body = await readJsonBody(req);
    if (!body || typeof body.path !== 'string') throw new svc.HttpError(400, 'path is required');
    return sendJson(res, 200, await svc.createFolder(body.path));
  }

  if (req.method === 'POST' && route === '/move') {
    const body = await readJsonBody(req);
    return sendJson(res, 200, await svc.movePath(body?.from, body?.to));
  }

  if (req.method === 'POST' && route === '/delete') {
    const body = await readJsonBody(req);
    if (!body || typeof body.path !== 'string') throw new svc.HttpError(400, 'path is required');
    return sendJson(res, 200, await svc.deletePath(body.path));
  }

  if (req.method === 'POST' && route === '/search') {
    const body = await readJsonBody(req);
    return sendJson(res, 200, await svc.searchFiles(body?.query, body?.path || '', body?.maxResults));
  }

  throw new svc.HttpError(404, `Unknown route: ${req.method} ${url.pathname}`);
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }

  if (url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, version: VERSION, openMode: OPEN_MODE });
  }

  const needsAuth = url.pathname.startsWith('/api') || url.pathname.startsWith('/mcp');
  if (needsAuth && !OPEN_MODE && !isAuthorized(req, url)) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized: invalid token' });
  }

  try {
    if (url.pathname === '/mcp') {
      return await handleMcp(req, res);
    }
    if (url.pathname.startsWith('/api')) {
      return await handleApi(req, res, url);
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    const status = error instanceof svc.HttpError ? error.status : 500;
    if (status === 500) console.error('[error]', error);
    if (res.headersSent) {
      res.end();
      return;
    }
    sendJson(res, status, { ok: false, error: error?.message || 'Internal error' });
  }
});

ensureWorkspace();

function printBanner(port) {
  const line = '-'.repeat(68);
  console.log(line);
  console.log('  Local Workspace MCP - ready');
  console.log(line);
  console.log(`  Editor UI   : http://${HOST}:${port}`);
  console.log(`  MCP (local) : http://${HOST}:${port}/mcp`);
  console.log(`  Workspace   : ${runtime.workspace}`);
  console.log('');
  console.log(`  TOKEN       : ${TOKEN}`);
  console.log('');
  if (OPEN_MODE) {
    console.log('  !!! OPEN MODE: no token required. Anyone who can reach this URL');
    console.log('  !!! can read, write and delete files in your workspace.');
    console.log('  !!! Never expose it publicly in this mode. Set OPEN_MODE=false to enable the token.');
    console.log('');
  }
  console.log('  Open the UI and paste the token (it is stored in your browser).');
  console.log(`  Or go straight to: http://${HOST}:${port}/?token=${TOKEN}`);
  console.log(line);
  console.log('  Expose it publicly with localhost.run:');
  console.log(`    ssh -o ServerAliveInterval=30 -R 80:localhost:${port} nokey@localhost.run`);
  console.log('  Then use the printed https://<random>.lhr.life/mcp as your MCP URL.');
  console.log(line);
}

let activePort = PORT;

function startServer(port) {
  activePort = port;
  runtime.port = port;
  server.listen(port, HOST, () => printBanner(port));
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[server] Port ${activePort} is already in use. Change PORT in .env and restart.`);
    process.exitCode = 1;
    return;
  }
  console.error('[server]', error.message);
  process.exitCode = 1;
});

startServer(PORT);
