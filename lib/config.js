import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

export const PORT = Number(process.env.PORT || 43787);
export const HOST = process.env.HOST || '127.0.0.1';

export const CONFIG_FILE_PATH = path.join(ROOT_DIR, 'config.json');
export const DEFAULT_WORKSPACE_DIR = path.resolve(ROOT_DIR, 'workspace');

function readConfigFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function initialWorkspace() {
  const fileValue = readConfigFile().workspace;
  const envValue = process.env.WORKSPACE_DIR;
  const chosen =
    (typeof fileValue === 'string' && fileValue.trim()) ||
    (typeof envValue === 'string' && envValue.trim()) ||
    DEFAULT_WORKSPACE_DIR;
  return path.resolve(chosen);
}

export const runtime = { port: PORT, host: HOST, workspace: initialWorkspace() };

export function saveWorkspaceSetting(workspace) {
  const data = readConfigFile();
  data.workspace = workspace;
  fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export const OPEN_MODE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.OPEN_MODE || '').trim().toLowerCase()
);

export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 2 * 1024 * 1024);
export const MAX_TREE_ENTRIES = Number(process.env.MAX_TREE_ENTRIES || 5000);

const DEFAULT_EXTENSIONS = [
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.json', '.md', '.txt', '.svg', '.xml', '.yml', '.yaml', '.toml', '.ini',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.c', '.h', '.cpp', '.hpp',
  '.cs', '.php', '.sh', '.bat', '.ps1', '.sql', '.csv', '.env', '.gitignore'
];

export const ALLOWED_EXTENSIONS = new Set(
  (process.env.ALLOWED_EXTENSIONS
    ? process.env.ALLOWED_EXTENSIONS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_EXTENSIONS
  ).map((e) => (e.startsWith('.') ? e : '.' + e)).map((e) => e.toLowerCase())
);

export const CATEGORY_MAP = {
  '.html': 'pages',
  '.htm': 'pages',
  '.css': 'styles',
  '.js': 'scripts',
  '.mjs': 'scripts',
  '.cjs': 'scripts',
  '.jsx': 'scripts',
  '.ts': 'scripts',
  '.tsx': 'scripts',
  '.json': 'data',
  '.csv': 'data',
  '.sql': 'data',
  '.md': 'docs',
  '.txt': 'docs',
  '.svg': 'assets',
  '.png': 'assets',
  '.jpg': 'assets',
  '.jpeg': 'assets',
  '.gif': 'assets',
  '.webp': 'assets',
  '.yml': 'config',
  '.yaml': 'config',
  '.toml': 'config',
  '.ini': 'config',
  '.env': 'config'
};

export const SOURCE = process.env.APP_SOURCE || 'server';

function loadToken() {
  const fromEnv = (process.env.AUTH_TOKEN || '').trim();
  if (fromEnv) return fromEnv;

  const tokenPath = path.join(ROOT_DIR, '.token');
  try {
    const existing = fs.readFileSync(tokenPath, 'utf8').trim();
    if (existing.length >= 16) return existing;
  } catch {
    /* not created yet */
  }

  const token = crypto.randomBytes(24).toString('hex');
  fs.writeFileSync(tokenPath, token + '\n', { mode: 0o600 });
  return token;
}

export const TOKEN = loadToken();

export function ensureWorkspace() {
  const ws = runtime.workspace;
  fs.mkdirSync(ws, { recursive: true });

  if (path.resolve(ws) === DEFAULT_WORKSPACE_DIR) {
    const readme = path.join(ws, 'README.md');
    if (!fs.existsSync(readme)) {
      fs.writeFileSync(
        readme,
        [
          '# Workspace',
          '',
          'This folder is managed by Local Workspace MCP.',
          '',
          '- `pages/` for HTML',
          '- `styles/` for CSS',
          '- `scripts/` for JavaScript',
          '- `data/`, `docs/`, `assets/` for other categories',
          '',
          'Every file here can be read and written by the web editor or by an AI through MCP.',
          ''
        ].join('\n')
      );
    }
  }
  fs.mkdirSync(path.join(ROOT_DIR, '.logs'), { recursive: true });
}
