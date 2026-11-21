# Local Workspace MCP

A tiny local code workspace for AI: a **web editor** for you, and an **MCP server** so any AI client (Claude, opencode, Cursor, …) can read, write, and scaffold files on your own computer.

- **Editor** — file tree, autosave (atomic), create / rename / delete, Ctrl+S, `Ln/Col`.
- **11 MCP tools** — `read_file`, `write_file`, `edit_file`, `save_code`, `create_tree`, `search_files`, …
- **Two transports** — `stdio` (local, safest) and `HTTP` (`/mcp`) for a tunnel.
- **Sandboxed** — every operation is locked to one folder, with path-traversal and symlink protection.
- **Public access without an account** — one `ssh` command via [localhost.run](https://localhost.run). No domain, no Cloudflare, no build step.

> Everything runs on your machine. There is no cloud service, no database, and no telemetry. Node.js + two dependencies.

## Requirements

- **Node.js 18.17+** (tested on Node 22)
- **OpenSSH client** — only if you want the public tunnel. `ssh -V` should work.
  - Windows: *Settings → Apps → Optional Features → OpenSSH Client*.
- Windows, macOS, or Linux.

## Quick start

```bash
git clone https://github.com/<your-user>/local-workspace-mcp.git
cd local-workspace-mcp
npm install
npm start
```

On Windows, double-click **`start.bat`** instead (or run `npm.cmd install`).

The first run creates a token in `.token` and prints it:

```
Editor UI   : http://127.0.0.1:43787
MCP (local) : http://127.0.0.1:43787/mcp
Workspace   : /path/to/local-workspace-mcp/workspace
TOKEN       : 3f9c...   (paste this into the UI)
```

Open `http://127.0.0.1:43787`, paste the token once (it is kept in your browser).

### Choose the folder the AI may touch

Type the **absolute path** into the `folder` box in the header and click **use**. If the folder does not exist, you will be asked whether to create it. The choice is saved in `config.json` and reused on the next start.

Priority: `config.json` → `WORKSPACE_DIR` in `.env` → `./workspace`.

Drive roots (`C:\`) and system folders (`C:\Windows`, `/etc`, `/usr`, …) are refused.

## Expose it publicly with localhost.run

Two terminals:

```bash
# terminal 1 — the app
npm start

# terminal 2 — the tunnel
npm run tunnel
```

Equivalent raw command:

```bash
ssh -o ServerAliveInterval=30 -R 80:localhost:43787 nokey@localhost.run
```

The tunnel prints something like `https://a1b2c3d4.lhr.life`. Your MCP URL is:

```
https://a1b2c3d4.lhr.life/mcp
```

Notes:

- The URL is **random and changes every session**. Restart the same `ssh` command to get a new one.
- Both processes and your computer must stay running.
- Windows shortcuts: `start.bat` and `tunnel.bat`.
- If `ssh` is missing, enable the OpenSSH Client feature and retry.

## Connect an AI

### opencode — stdio (recommended)

`~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "local-workspace": {
      "type": "local",
      "command": ["node", "/absolute/path/to/local-workspace-mcp/mcp-stdio.js"],
      "enabled": true
    }
  }
}
```

### opencode — remote through the tunnel

```json
{
  "mcp": {
    "local-workspace-http": {
      "type": "remote",
      "url": "https://a1b2c3d4.lhr.life/mcp",
      "headers": { "Authorization": "Bearer <TOKEN>" },
      "enabled": true
    }
  }
}
```

### Claude Desktop — stdio

```json
{
  "mcpServers": {
    "local-workspace": {
      "command": "node",
      "args": ["/absolute/path/to/local-workspace-mcp/mcp-stdio.js"]
    }
  }
}
```

### Claude — custom connector (remote)

**Settings → Connectors → Add custom connector** and paste:

```
https://a1b2c3d4.lhr.life/mcp
```

Add the `Authorization: Bearer <TOKEN>` header if the connector UI supports it; otherwise run in token-free `OPEN_MODE` (see security below).

Other clients (Cursor, Windsurf, Cline, …) accept the same `{ type, command }` or `{ type, url, headers }` shapes.

Then just ask: *"make a landing page in my workspace"* — the AI calls `create_tree` / `save_code` and the files appear on disk.

## MCP tools

| Tool | What it does |
|---|---|
| `workspace_info` | absolute path, limits, allowed extensions, folder categories |
| `list_files` | recursive tree (bounded) |
| `read_file` | read one text file |
| `write_file` | write a full file (atomic, parent dirs created) |
| `edit_file` | replace unique text, or `replaceAll` |
| `save_code` | save into a category folder by extension |
| `create_tree` | scaffold many files/folders at once |
| `create_folder` | recursive `mkdir` |
| `move_path` | move / rename |
| `delete_path` | delete file or folder |
| `search_files` | text search across the workspace |

`save_code` category mapping:

| Extension | Folder |
|---|---|
| `.html` | `pages/` |
| `.css` | `styles/` |
| `.js` `.ts` `.jsx` `.tsx` | `scripts/` |
| `.json` `.csv` `.sql` | `data/` |
| `.md` `.txt` | `docs/` |
| `.svg` `.png` `.jpg` … | `assets/` |
| `.yml` `.toml` `.env` | `config/` |
| anything else | `misc/` |

## REST API

All `/api/*` routes need `Authorization: Bearer <TOKEN>` (skipped in `OPEN_MODE`) and return JSON `{ ok: true | false }`.

| Method | Path | Body |
|---|---|---|
| GET | `/health` | – (public, includes `openMode`) |
| GET | `/api/info` | – |
| GET \| POST | `/api/settings` | `{ workspace, create? }` |
| GET | `/api/tree?path=` | – |
| GET | `/api/file?path=` | – |
| POST | `/api/file` | `{ path, content }` |
| POST | `/api/edit` | `{ path, oldText, newText, replaceAll? }` |
| POST | `/api/structure` | `{ entries: [{ path, type, content }] }` |
| POST | `/api/folder` | `{ path }` |
| POST | `/api/move` | `{ from, to }` |
| POST | `/api/delete` | `{ path }` |
| POST | `/api/search` | `{ query, path?, maxResults? }` |
| ALL | `/mcp` | MCP JSON-RPC |

Quick checks:

```bash
curl http://127.0.0.1:43787/api/info -H "Authorization: Bearer <TOKEN>"
curl http://127.0.0.1:43787/api/tree -H "Authorization: Bearer <TOKEN>"
```

```bash
curl -s https://a1b2c3d4.lhr.life/mcp \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Configuration

Copy `.env.example` to `.env` and edit:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `43787` | HTTP port |
| `HOST` | `127.0.0.1` | bind address (keep it loopback for tunnels) |
| `WORKSPACE_DIR` | `./workspace` | initial workspace folder |
| `AUTH_TOKEN` | – | fixed token (otherwise generated into `.token`) |
| `OPEN_MODE` | `false` | `true` disables auth entirely |
| `MAX_FILE_BYTES` | `2097152` | max file size (2 MB) |
| `MAX_TREE_ENTRIES` | `5000` | max tree entries returned |
| `ALLOWED_EXTENSIONS` | built-in list | comma-separated writable extensions |

Files that are **never committed** (see `.gitignore`): `.env`, `.token`, `config.json`, `.logs/`, `workspace/`, `node_modules/`.

## Security

Read this before you expose the app.

- **The workspace is a write door to your disk.** The sandbox stops path traversal and symlinks, but the AI can still write any file *inside* the chosen folder. Never point it at a folder with secrets you would not share.
- **Token mode is the default.** Use it. `OPEN_MODE=true` means *anyone who reaches the URL* can read, write, and delete files. Use it only for local testing.
- **A tunnel URL is public, not secret.** localhost.run names are random and change per session, but they are not authentication. Anyone with the URL can reach the server; only the token stops them. Never combine `OPEN_MODE=true` with a public tunnel.
- **Tunnel traffic is third-party.** localhost.run terminates TLS on its side. Do not put credentials or private keys in the workspace while a tunnel is running.
- **Audit log.** Every write, edit, move, delete, and workspace change is appended to `.logs/activity.jsonl`.
- **Bind to loopback.** Keep `HOST=127.0.0.1` so the app is not reachable from your LAN.
- **Narrow the surface.** `ALLOWED_EXTENSIONS` and `MAX_FILE_BYTES` reduce what a client can write.

If you need stronger remote access, prefer `stdio` for the AI (nothing goes over the network) and use the tunnel only for the editor.

## Project layout

```
server.js         HTTP: static UI + REST + MCP
mcp-stdio.js      stdio transport entry point
mcp-core.js       11 MCP tools
lib/config.js     env loader, token, OPEN_MODE, config.json
lib/fs-service.js filesystem core (sandbox, atomic writes, search)
public/index.html single-page editor
public/app.js     editor logic (autosave, tree, modals)
public/styles.css theme
start.bat|.sh     start the app
tunnel.bat|.sh    start the localhost.run tunnel
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm.ps1 cannot be loaded` (Windows) | use `npm.cmd install`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Port already in use | change `PORT` in `.env` and restart |
| UI keeps asking for a token | paste the value from `.token`, or the `TOKEN` line in the terminal |
| AI writes but nothing appears | the AI writes to the workspace folder, not to this repo — check the `folder` box |
| `Extension .xyz is not allowed` | add it to `ALLOWED_EXTENSIONS` |
| Tunnel URL stopped working | the SSH session ended; rerun `npm run tunnel` (new URL) |
| `ssh: command not found` | install the OpenSSH client |

## License

MIT — see [LICENSE](LICENSE).
