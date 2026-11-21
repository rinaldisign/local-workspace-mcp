import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_FILE_BYTES,
  MAX_TREE_ENTRIES,
  ALLOWED_EXTENSIONS,
  CATEGORY_MAP,
  ROOT_DIR,
  PORT,
  HOST,
  runtime,
  DEFAULT_WORKSPACE_DIR,
  CONFIG_FILE_PATH,
  saveWorkspaceSetting
} from './config.js';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', '.next', 'dist', '.tmp']);

function ws() {
  return runtime.workspace;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let realRootCache = { root: null, promise: null };
function realRoot() {
  const current = ws();
  if (realRootCache.root !== current) {
    realRootCache = { root: current, promise: fsp.realpath(current) };
  }
  return realRootCache.promise;
}

export function normalizeRel(input) {
  return String(input ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

export function safeResolve(relPath) {
  const rootPath = ws();
  const rel = normalizeRel(relPath);
  const abs = path.resolve(rootPath, rel);
  const inside = path.relative(rootPath, abs);
  if (inside === '') return abs;
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new HttpError(400, `Path escapes the workspace: ${relPath}`);
  }
  return abs;
}

async function assertRealInside(abs) {
  const root = await realRoot();
  let cursor = abs;
  for (let i = 0; i < 64; i += 1) {
    try {
      const real = await fsp.realpath(cursor);
      const rel = path.relative(root, real);
      if (rel !== '' && (rel.startsWith('..') || path.isAbsolute(rel))) {
        throw new HttpError(400, 'Path escapes the workspace (symlink)');
      }
      return;
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        const parent = path.dirname(cursor);
        if (parent === cursor) throw err;
        cursor = parent;
        continue;
      }
      throw err;
    }
  }
  throw new HttpError(400, 'Path is too deep');
}

export function extOf(abs) {
  return path.extname(abs).toLowerCase();
}

export function relativeOf(abs) {
  const rel = path.relative(ws(), abs).split(path.sep).join('/');
  return rel || '.';
}

function assertExtensionAllowed(abs) {
  const ext = extOf(abs);
  if (!ext) return;
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new HttpError(400, `Extension ${ext} is not allowed. Update ALLOWED_EXTENSIONS in .env`);
  }
}

export function suggestRelativePath(name, language, folder) {
  const cleanName = String(name || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleanName) throw new HttpError(400, 'name is required');

  const lang = String(language || '').trim().toLowerCase().replace(/^\./, '');
  const langExt = {
    html: '.html',
    htm: '.html',
    css: '.css',
    scss: '.css',
    js: '.js',
    javascript: '.js',
    mjs: '.js',
    jsx: '.jsx',
    ts: '.ts',
    typescript: '.ts',
    tsx: '.tsx',
    json: '.json',
    md: '.md',
    markdown: '.md',
    txt: '.txt',
    svg: '.svg',
    yaml: '.yml',
    yml: '.yml'
  }[lang];

  let rel = cleanName;
  if (!path.extname(rel) && langExt) rel += langExt;

  const ext = path.extname(rel).toLowerCase();
  const baseFolder = folder ? normalizeRel(folder) : CATEGORY_MAP[ext] || 'misc';
  return baseFolder ? `${baseFolder}/${rel.replace(/^\/+/, '')}` : rel;
}

export async function logActivity(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  try {
    await fsp.appendFile(path.join(ROOT_DIR, '.logs', 'activity.jsonl'), line, 'utf8');
  } catch {
    /* logging must never break a write */
  }
}

export async function writeFile(relPath, content) {
  const abs = safeResolve(relPath);
  if (abs === ws()) throw new HttpError(400, 'Invalid target');

  assertExtensionAllowed(abs);
  await assertRealInside(abs);

  const text = content === undefined || content === null ? '' : String(content);
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_FILE_BYTES) {
    throw new HttpError(
      413,
      `File is ${(bytes / 1024 / 1024).toFixed(2)} MB, limit is ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(2)} MB`
    );
  }

  await fsp.mkdir(path.dirname(abs), { recursive: true });

  const tmp = `${abs}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(tmp, text, 'utf8');
  await fsp.rename(tmp, abs);

  const stat = await fsp.stat(abs);
  const rel = relativeOf(abs);
  await logActivity({ op: 'write', path: rel, bytes });

  return { ok: true, path: rel, bytes, mtime: stat.mtimeMs };
}

export async function readFile(relPath) {
  const abs = safeResolve(relPath);
  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    throw new HttpError(404, `File not found: ${relPath}`);
  }
  if (stat.isDirectory()) throw new HttpError(400, 'That is a folder, not a file');
  if (stat.size > MAX_FILE_BYTES) {
    throw new HttpError(413, `File is ${(stat.size / 1024 / 1024).toFixed(2)} MB, too large to open`);
  }

  const buf = await fsp.readFile(abs);
  const probe = buf.subarray(0, Math.min(buf.length, 8192));
  const binary = probe.includes(0);
  if (binary) {
    throw new HttpError(415, 'Binary file cannot be opened in the text editor');
  }

  return {
    ok: true,
    path: relativeOf(abs),
    content: buf.toString('utf8'),
    size: stat.size,
    mtime: stat.mtimeMs
  };
}

export async function listTree(relPath = '') {
  const baseAbs = safeResolve(relPath);
  let baseStat;
  try {
    baseStat = await fsp.stat(baseAbs);
  } catch {
    throw new HttpError(404, `Path not found: ${relPath || '/'}`);
  }
  if (!baseStat.isDirectory()) throw new HttpError(400, 'Path is not a folder');

  let count = 0;

  async function walk(dirAbs, depth) {
    if (depth > 12) return [];
    let entries;
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const out = [];
    for (const entry of entries) {
      if (count >= MAX_TREE_ENTRIES) break;
      if (entry.name.startsWith('.tmp-')) continue;
      const childAbs = path.join(dirAbs, entry.name);
      const rel = relativeOf(childAbs);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          out.push({ name: entry.name, path: rel, type: 'dir', skipped: true, children: [] });
          count += 1;
          continue;
        }
        count += 1;
        out.push({
          name: entry.name,
          path: rel,
          type: 'dir',
          children: await walk(childAbs, depth + 1)
        });
      } else if (entry.isFile()) {
        let size = 0;
        let mtime = 0;
        try {
          const st = await fsp.stat(childAbs);
          size = st.size;
          mtime = st.mtimeMs;
        } catch {
          /* ignore */
        }
        count += 1;
        out.push({ name: entry.name, path: rel, type: 'file', size, mtime });
      }
    }
    return out;
  }

  return {
    ok: true,
    root: ws(),
    path: relativeOf(baseAbs),
    truncated: count >= MAX_TREE_ENTRIES,
    children: await walk(baseAbs, 0)
  };
}

export async function createFolder(relPath) {
  const abs = safeResolve(relPath);
  if (abs === ws()) return { ok: true, path: '.', created: false };
  await assertRealInside(abs);
  await fsp.mkdir(abs, { recursive: true });
  const rel = relativeOf(abs);
  await logActivity({ op: 'mkdir', path: rel });
  return { ok: true, path: rel, created: true };
}

export async function createStructure(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new HttpError(400, 'entries must be a non-empty array');
  }
  if (entries.length > 200) throw new HttpError(400, 'Maximum 200 entries per request');

  const created = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') throw new HttpError(400, 'Invalid entry');
    const type = entry.type === 'dir' || entry.type === 'directory' ? 'dir' : 'file';
    if (type === 'dir') {
      created.push(await createFolder(entry.path));
    } else {
      created.push(await writeFile(entry.path, entry.content ?? ''));
    }
  }
  await logActivity({ op: 'structure', count: created.length });
  return { ok: true, created };
}

export async function movePath(fromRel, toRel) {
  const fromAbs = safeResolve(fromRel);
  const toAbs = safeResolve(toRel);
  if (fromAbs === ws() || toAbs === ws()) throw new HttpError(400, 'Cannot move the workspace root');
  await assertRealInside(fromAbs);
  await assertRealInside(toAbs);
  assertExtensionAllowed(toAbs);

  try {
    await fsp.access(fromAbs);
  } catch {
    throw new HttpError(404, `Not found: ${fromRel}`);
  }
  await fsp.mkdir(path.dirname(toAbs), { recursive: true });
  await fsp.rename(fromAbs, toAbs);
  await logActivity({ op: 'move', from: relativeOf(fromAbs), to: relativeOf(toAbs) });
  return { ok: true, from: relativeOf(fromAbs), to: relativeOf(toAbs) };
}

export async function deletePath(relPath) {
  const abs = safeResolve(relPath);
  if (abs === ws()) throw new HttpError(400, 'Cannot delete the workspace root');
  await assertRealInside(abs);

  let stat;
  try {
    stat = await fsp.lstat(abs);
  } catch {
    throw new HttpError(404, `Not found: ${relPath}`);
  }

  if (stat.isDirectory()) {
    await fsp.rm(abs, { recursive: true, force: false });
  } else {
    await fsp.unlink(abs);
  }
  await logActivity({ op: 'delete', path: relativeOf(abs), kind: stat.isDirectory() ? 'dir' : 'file' });
  return { ok: true, path: relativeOf(abs), kind: stat.isDirectory() ? 'dir' : 'file' };
}

export async function searchFiles(query, relPath = '', maxResults = 50) {
  const needle = String(query || '').trim();
  if (!needle) throw new HttpError(400, 'query is required');
  const limit = Math.min(Math.max(Number(maxResults) || 50, 1), 200);
  const baseAbs = safeResolve(relPath);

  const results = [];
  let scanned = 0;

  async function walk(dirAbs, depth) {
    if (results.length >= limit || depth > 10) return;
    let entries;
    try {
      entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= limit) return;
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.tmp-')) continue;
      const childAbs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extOf(childAbs);
      if (ext && !ALLOWED_EXTENSIONS.has(ext)) continue;
      let st;
      try {
        st = await fsp.stat(childAbs);
      } catch {
        continue;
      }
      if (st.size > 512 * 1024) continue;
      scanned += 1;
      let text;
      try {
        text = await fsp.readFile(childAbs, 'utf8');
      } catch {
        continue;
      }
      if (!text.includes(needle)) continue;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length && results.length < limit; i += 1) {
        if (lines[i].includes(needle)) {
          results.push({ path: relativeOf(childAbs), line: i + 1, text: lines[i].slice(0, 300) });
        }
      }
    }
  }

  await walk(baseAbs, 0);
  return { ok: true, query: needle, scanned, count: results.length, truncated: results.length >= limit, results };
}

export async function editFile(relPath, oldText, newText, replaceAll = false) {
  if (typeof oldText !== 'string' || oldText.length === 0) {
    throw new HttpError(400, 'oldText is required and must not be empty');
  }
  if (typeof newText !== 'string') {
    throw new HttpError(400, 'newText must be a string');
  }

  const file = await readFile(relPath);
  const content = file.content;

  const positions = [];
  let cursor = 0;
  for (;;) {
    const found = content.indexOf(oldText, cursor);
    if (found === -1) break;
    positions.push(found);
    cursor = found + oldText.length;
    if (cursor > content.length) break;
  }

  if (positions.length === 0) {
    throw new HttpError(409, `Text not found in ${file.path}`);
  }

  if (positions.length > 1 && !replaceAll) {
    const first = positions[0];
    const line = content.slice(0, first).split(/\r?\n/).length;
    throw new HttpError(
      409,
      `Text appears ${positions.length}x (first at line ${line}). Narrow oldText or set replaceAll=true`
    );
  }

  let next;
  if (replaceAll) {
    next = content.split(oldText).join(newText);
  } else {
    next = content.slice(0, positions[0]) + newText + content.slice(positions[0] + oldText.length);
  }

  const result = await writeFile(file.path, next);
  await logActivity({
    op: 'edit',
    path: file.path,
    replacements: replaceAll ? positions.length : 1,
    occurrences: positions.length
  });

  return {
    ok: true,
    path: result.path,
    replacements: replaceAll ? positions.length : 1,
    occurrences: positions.length,
    bytes: result.bytes,
    mtime: result.mtime
  };
}

const BLOCKED_PATHS = [
  'c:/windows',
  'c:/program files',
  'c:/program files (x86)',
  'c:/programdata',
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/boot',
  '/var',
  '/sys',
  '/proc',
  '/dev',
  '/system',
  '/library',
  '/applications',
  '/private/etc'
];

function assertSafeRoot(abs) {
  const resolved = path.resolve(abs);
  if (resolved === path.parse(resolved).root) {
    throw new HttpError(400, 'Refusing to use a filesystem root. Pick a subfolder.');
  }

  const normalized = resolved.toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '');
  for (const dir of BLOCKED_PATHS) {
    if (normalized === dir || normalized.startsWith(dir + '/')) {
      throw new HttpError(400, 'System folders are not allowed');
    }
  }
}

export async function setWorkspace(newPath, create = false) {
  const raw = String(newPath || '').trim();
  if (!raw) throw new HttpError(400, 'Target folder is required');
  if (!path.isAbsolute(raw)) {
    throw new HttpError(400, 'Use an absolute path, e.g. /home/you/project or D:\\project\\web');
  }

  const abs = path.resolve(raw);
  assertSafeRoot(abs);

  let stat = null;
  try {
    stat = await fsp.stat(abs);
  } catch {
    stat = null;
  }

  if (!stat) {
    if (!create) {
      throw new HttpError(404, 'Folder does not exist. Enable "create folder" to create it.');
    }
    await fsp.mkdir(abs, { recursive: true });
    stat = await fsp.stat(abs);
  }

  if (!stat.isDirectory()) throw new HttpError(400, 'That path is a file, not a folder');

  runtime.workspace = abs;
  realRootCache = { root: null, promise: null };
  saveWorkspaceSetting(abs);
  await logActivity({ op: 'set_workspace', path: abs });

  return { ok: true, workspace: abs };
}

export async function workspaceInfo() {
  return {
    ok: true,
    workspace: ws(),
    defaultWorkspace: DEFAULT_WORKSPACE_DIR,
    configFile: CONFIG_FILE_PATH,
    projectRoot: ROOT_DIR,
    stdioEntry: path.join(ROOT_DIR, 'mcp-stdio.js'),
    host: runtime.host || HOST,
    port: runtime.port || PORT,
    maxFileBytes: MAX_FILE_BYTES,
    allowedExtensions: [...ALLOWED_EXTENSIONS].sort(),
    categories: CATEGORY_MAP
  };
}
