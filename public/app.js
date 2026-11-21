const TOKEN_KEY = 'localworkspace.token';

const state = {
  token: '',
  openMode: false,
  info: null,
  tree: null,
  currentPath: null,
  savedContent: '',
  saveTimer: null,
  saveInFlight: false,
  filter: ''
};

const el = (id) => document.getElementById(id);

const els = {
  wsInput: el('wsInput'),
  statusPill: el('statusPill'),
  tree: el('tree'),
  filter: el('filter'),
  editor: el('editor'),
  currentPath: el('currentPath'),
  langBadge: el('langBadge'),
  fileMeta: el('fileMeta'),
  cursorInfo: el('cursorInfo'),
  statLines: el('statLines'),
  statChars: el('statChars'),
  tokenModal: el('tokenModal'),
  tokenInput: el('tokenInput'),
  mcpModal: el('mcpModal'),
  cfgStdio: el('cfgStdio'),
  cfgHttp: el('cfgHttp'),
  toasts: el('toasts')
};

/* ---------- helpers ---------- */

function toast(message, kind = '') {
  const node = document.createElement('div');
  node.className = 'toast ' + kind;
  node.textContent = message;
  els.toasts.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function setStatus(kind, text) {
  const map = { idle: 'idle', saving: 'saving', saved: 'saved', error: 'error' };
  els.statusPill.dataset.state = kind;
  els.statusPill.textContent = text || map[kind] || kind;
}

function fmtBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(2) + ' MB';
}

function extOf(p) {
  const m = /\.([a-zA-Z0-9]+)$/.exec(p || '');
  return m ? m[1].toLowerCase() : '';
}

const LANG_BY_EXT = {
  html: 'HTML', htm: 'HTML', css: 'CSS', js: 'JS', mjs: 'JS', cjs: 'JS',
  jsx: 'JSX', ts: 'TS', tsx: 'TSX', json: 'JSON', md: 'MD', txt: 'TXT',
  svg: 'SVG', xml: 'XML', yml: 'YAML', yaml: 'YAML', py: 'PY', sql: 'SQL',
  sh: 'SH', php: 'PHP', go: 'GO', rs: 'RS', java: 'JAVA', c: 'C', h: 'H',
  cpp: 'C++', cs: 'C#', rb: 'RB', csv: 'CSV', env: 'ENV', toml: 'TOML'
};

function langOf(p) {
  return LANG_BY_EXT[extOf(p)] || (extOf(p) ? extOf(p).toUpperCase() : 'TEXT');
}

async function api(pathname, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  if (state.token) headers.authorization = 'Bearer ' + state.token;
  if (options.body) headers['content-type'] = 'application/json';

  const res = await fetch(pathname, Object.assign({}, options, { headers }));
  if (res.status === 401) {
    if (!state.openMode) openTokenModal();
    throw new Error('Invalid token. Enter a token and try again.');
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-json */
  }
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'HTTP ' + res.status);
  }
  return data;
}

/* ---------- token ---------- */

function readTokenFromUrl() {
  const url = new URL(window.location.href);
  const t = url.searchParams.get('token');
  if (!t) return;
  localStorage.setItem(TOKEN_KEY, t);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? '?' + url.searchParams : ''));
}

function openTokenModal() {
  els.tokenModal.hidden = false;
  els.tokenInput.value = state.token || '';
  setTimeout(() => els.tokenInput.focus(), 30);
}

function saveToken() {
  const value = els.tokenInput.value.trim();
  if (!value) {
    toast('Token cannot be empty', 'error');
    return;
  }
  state.token = value;
  localStorage.setItem(TOKEN_KEY, value);
  els.tokenModal.hidden = true;
  boot();
}

/* ---------- tree ---------- */

function nodeMatches(node, q) {
  if (!q) return true;
  if (node.name.toLowerCase().includes(q)) return true;
  return (node.children || []).some((child) => nodeMatches(child, q));
}

function renderTree() {
  els.tree.textContent = '';
  const q = state.filter.trim().toLowerCase();

  const rootChildren = state.tree?.children || [];
  const visible = rootChildren.filter((node) => nodeMatches(node, q));

  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = q ? 'No matches.' : 'Workspace is empty. Create a new file.';
    els.tree.appendChild(empty);
    return;
  }

  els.tree.appendChild(buildList(visible, q));
  highlightActive();
}

function buildList(nodes, q) {
  const wrap = document.createElement('div');

  for (const node of nodes) {
    const item = document.createElement('div');
    item.className = 'node';

    const row = document.createElement('div');
    row.className = 'node-row';
    row.dataset.path = node.path;
    row.dataset.name = node.name;
    row.dataset.type = node.type;

    const arrow = document.createElement('span');
    arrow.className = 'tw';
    arrow.textContent = node.type === 'dir' ? '\u25B8' : '';
    row.appendChild(arrow);

    const name = document.createElement('span');
    name.className = 'nm';
    name.textContent = node.type === 'dir' ? node.name + '/' : node.name;
    row.appendChild(name);

    if (node.type === 'file' && node.size > 0) {
      const size = document.createElement('span');
      size.className = 'sz';
      size.textContent = fmtBytes(node.size);
      row.appendChild(size);
    }

    item.appendChild(row);

    if (node.type === 'dir') {
      const children = buildList((node.children || []).filter((c) => nodeMatches(c, q)), q);
      children.className = 'children hidden';
      arrow.textContent = '\u25B8';

      row.addEventListener('click', () => {
        const isHidden = children.classList.contains('hidden');
        children.classList.toggle('hidden', !isHidden);
        row.classList.toggle('open', isHidden);
        arrow.textContent = isHidden ? '\u25BE' : '\u25B8';
      });

      if (q) {
        children.classList.remove('hidden');
        arrow.textContent = '\u25BE';
      }

      item.appendChild(children);
    } else {
      row.addEventListener('click', () => openFile(node.path));
    }

    wrap.appendChild(item);
  }

  return wrap;
}

function highlightActive() {
  for (const row of els.tree.querySelectorAll('.node-row')) {
    row.classList.toggle('active', row.dataset.path === state.currentPath);
  }
}

async function loadTree() {
  try {
    state.tree = await api('/api/tree');
    renderTree();
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------- editor ---------- */

function updateStats() {
  const value = els.editor.value;
  const lines = value ? value.split('\n').length : 0;
  els.statLines.textContent = lines + ' lines';
  els.statChars.textContent = value.length + ' chars';
  updateCursorInfo();
}

function updateCursorInfo() {
  const pos = els.editor.selectionStart || 0;
  const before = els.editor.value.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  els.cursorInfo.textContent = `Ln ${line}, Col ${col}`;
}

function setEditorEnabled(enabled) {
  els.editor.disabled = !enabled;
  el('btnSave').disabled = !enabled;
  el('btnRename').disabled = !enabled;
  el('btnDelete').disabled = !enabled;
}

async function openFile(path) {
  if (state.saveTimer) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
  }
  if (state.currentPath && els.editor.value !== state.savedContent) {
    await saveNow();
  }

  try {
    const data = await api('/api/file?path=' + encodeURIComponent(path));
    state.currentPath = data.path;
    state.savedContent = data.content;
    els.editor.value = data.content;
    els.editor.disabled = false;
    els.currentPath.textContent = data.path;
    els.langBadge.textContent = langOf(data.path);
    els.fileMeta.textContent = fmtBytes(data.size);
    setEditorEnabled(true);
    updateStats();
    setStatus('saved', 'saved');
    document.title = data.path + ' \u2014 Local Workspace';
    highlightActive();
    els.editor.focus();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function scheduleSave() {
  if (!state.currentPath) return;
  setStatus('saving', 'unsaved');
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    state.saveTimer = null;
    saveNow();
  }, 700);
}

async function saveNow() {
  if (!state.currentPath) return;
  if (state.saveInFlight) return;

  const path = state.currentPath;
  const content = els.editor.value;
  if (content === state.savedContent) {
    setStatus('saved', 'saved');
    return;
  }

  state.saveInFlight = true;
  setStatus('saving');
  try {
    const result = await api('/api/file', {
      method: 'POST',
      body: JSON.stringify({ path, content })
    });
    if (state.currentPath === path) {
      state.savedContent = content;
      els.fileMeta.textContent = fmtBytes(result.bytes);
      setStatus('saved', 'saved ' + new Date().toLocaleTimeString());
      updateTreeEntry(path, result.bytes);
    }
  } catch (error) {
    setStatus('error');
    toast(error.message, 'error');
  } finally {
    state.saveInFlight = false;
    if (state.currentPath === path && els.editor.value !== state.savedContent) {
      scheduleSave();
    }
  }
}

function updateTreeEntry(path, size) {
  const row = els.tree.querySelector(`.node-row[data-path="${CSS.escape(path)}"]`);
  if (!row) return;
  let sizeEl = row.querySelector('.sz');
  if (!sizeEl) {
    sizeEl = document.createElement('span');
    sizeEl.className = 'sz';
    row.appendChild(sizeEl);
  }
  sizeEl.textContent = fmtBytes(size);
}

/* ---------- actions ---------- */

async function newFile() {
  const value = prompt('New file path (e.g. pages/index.html, styles/main.css, scripts/app.js)');
  if (!value) return;
  try {
    await api('/api/file', { method: 'POST', body: JSON.stringify({ path: value.trim(), content: '' }) });
    await loadTree();
    await openFile(value.trim());
    toast('Created: ' + value.trim(), 'ok');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function newFolder() {
  const value = prompt('New folder path (e.g. assets/img)');
  if (!value) return;
  try {
    await api('/api/folder', { method: 'POST', body: JSON.stringify({ path: value.trim() }) });
    await loadTree();
    toast('Folder created: ' + value.trim(), 'ok');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function renameCurrent() {
  if (!state.currentPath) return;
  const value = prompt('New path:', state.currentPath);
  if (!value || value === state.currentPath) return;
  try {
    const result = await api('/api/move', {
      method: 'POST',
      body: JSON.stringify({ from: state.currentPath, to: value.trim() })
    });
    await loadTree();
    await openFile(result.to);
    toast('Moved to ' + result.to, 'ok');
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function deleteCurrent() {
  if (!state.currentPath) return;
  if (!confirm(`Delete "${state.currentPath}"? This cannot be undone.`)) return;
  try {
    await api('/api/delete', { method: 'POST', body: JSON.stringify({ path: state.currentPath }) });
    const removed = state.currentPath;
    state.currentPath = null;
    state.savedContent = '';
    els.editor.value = '';
    els.currentPath.textContent = 'No file open';
    els.langBadge.textContent = '\u2014';
    els.fileMeta.textContent = '';
    setEditorEnabled(false);
    updateStats();
    await loadTree();
    setStatus('idle');
    toast('Deleted: ' + removed, 'ok');
  } catch (error) {
    toast(error.message, 'error');
  }
}

/* ---------- modals ---------- */

function openMcpModal() {
  const projectRoot = state.info?.projectRoot || '<path-to-this-project>';
  const stdioEntry = state.info?.stdioEntry || projectRoot + '/mcp-stdio.js';
  const port = state.info?.port || 43787;
  const host = state.info?.host || '127.0.0.1';

  const stdioConfig = {
    mcp: {
      'local-workspace': {
        type: 'local',
        command: ['node', stdioEntry],
        enabled: true
      }
    }
  };

  const httpConfig = {
    mcp: {
      'local-workspace-http': {
        type: 'remote',
        url: `https://<random>.lhr.life/mcp`,
        headers: { Authorization: 'Bearer ' + (state.token || '<TOKEN>') },
        enabled: true
      }
    }
  };

  els.cfgStdio.textContent = JSON.stringify(stdioConfig, null, 2);
  els.cfgHttp.textContent = JSON.stringify(httpConfig, null, 2);
  els.mcpModal.hidden = false;
}

function resetEditor() {
  state.currentPath = null;
  state.savedContent = '';
  els.editor.value = '';
  els.currentPath.textContent = 'No file open';
  els.langBadge.textContent = '\u2014';
  els.fileMeta.textContent = '';
  setEditorEnabled(false);
  updateStats();
  document.title = 'Local Workspace \u2014 AI Editor';
  highlightActive();
}

async function applyWorkspace(createAllowed = false) {
  const workspace = els.wsInput.value.trim();
  if (!workspace) {
    toast('Enter the folder path on your computer', 'error');
    els.wsInput.focus();
    return;
  }

  try {
    const result = await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ workspace, create: createAllowed })
    });
    resetEditor();
    await loadInfo();
    await loadTree();
    toast('Workspace: ' + result.workspace, 'ok');
  } catch (error) {
    const missing = /does not exist|not found/i.test(error.message);
    if (missing && !createAllowed) {
      if (confirm(`Folder "${workspace}" does not exist. Create it now?`)) {
        await applyWorkspace(true);
      }
      return;
    }
    toast(error.message, 'error');
  }
}

async function copyFrom(id) {
  const text = el(id).textContent;
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'ok');
  } catch {
    toast('Copy failed, select it manually', 'error');
  }
}

/* ---------- boot ---------- */

async function loadInfo() {
  try {
    state.info = await api('/api/info');
    els.wsInput.value = state.info.workspace;
    els.wsInput.title = state.info.workspace;
  } catch (error) {
    if (state.token || state.openMode) toast(error.message, 'error');
  }
}

async function checkOpenMode() {
  try {
    const res = await fetch('/health', { cache: 'no-store' });
    const data = await res.json();
    state.openMode = data.openMode === true;
  } catch {
    state.openMode = false;
  }
  el('openWarn').hidden = !state.openMode;
}

async function boot() {
  await checkOpenMode();
  if (!state.openMode && !state.token) {
    openTokenModal();
    return;
  }
  await loadInfo();
  await loadTree();
  setStatus('idle');
  setEditorEnabled(false);
}

function bind() {
  el('btnSave').addEventListener('click', saveNow);

  els.editor.addEventListener('input', () => {
    updateStats();
    scheduleSave();
  });

  els.editor.addEventListener('keyup', updateCursorInfo);
  els.editor.addEventListener('click', updateCursorInfo);

  els.editor.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = els.editor.selectionStart;
      const end = els.editor.selectionEnd;
      const value = els.editor.value;
      els.editor.value = value.slice(0, start) + '  ' + value.slice(end);
      els.editor.selectionStart = els.editor.selectionEnd = start + 2;
      updateStats();
      scheduleSave();
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (state.saveTimer) {
        clearTimeout(state.saveTimer);
        state.saveTimer = null;
      }
      saveNow();
    }
    if (event.key === 'Escape') {
      els.tokenModal.hidden = true;
      els.mcpModal.hidden = true;
    }
  });

  els.filter.addEventListener('input', () => {
    state.filter = els.filter.value;
    renderTree();
  });

  el('btnRefresh').addEventListener('click', loadTree);
  el('btnNewFile').addEventListener('click', newFile);
  el('btnNewFolder').addEventListener('click', newFolder);
  el('btnRename').addEventListener('click', renameCurrent);
  el('btnDelete').addEventListener('click', deleteCurrent);

  el('btnToken').addEventListener('click', openTokenModal);
  el('btnTokenCancel').addEventListener('click', () => (els.tokenModal.hidden = true));
  el('btnTokenSave').addEventListener('click', saveToken);
  els.tokenInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveToken();
  });

  el('btnMcp').addEventListener('click', openMcpModal);
  el('btnMcpClose').addEventListener('click', () => (els.mcpModal.hidden = true));

  el('btnWsApply').addEventListener('click', () => applyWorkspace(false));
  els.wsInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyWorkspace(false);
    }
  });

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => copyFrom(button.dataset.copy));
  });

  window.addEventListener('beforeunload', (event) => {
    if (state.currentPath && els.editor.value !== state.savedContent) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

readTokenFromUrl();
state.token = localStorage.getItem(TOKEN_KEY) || '';
bind();
boot();
