# Local Workspace MCP

<p align="center">
  <img src="docs/hero.png" alt="Local Workspace MCP: one local workspace connected over MCP to ChatGPT, Claude, Gemini, Copilot, DeepSeek, Perplexity and Llama" width="100%">
</p>

<p align="center">
  <strong>Satu folder di PC kamu, bisa dibaca dan ditulis oleh AI mana pun.</strong><br>
  <strong>One folder on your machine that any AI can read and write.</strong>
</p>

<p align="center">
  <a href="#bahasa-indonesia">Bahasa Indonesia</a> &nbsp;·&nbsp; <a href="#english">English</a>
</p>

---

## Bahasa Indonesia

### Apa ini?

Local Workspace MCP berjalan sepenuhnya di komputermu. Ada dua bagian:

1. **Editor web** di `http://127.0.0.1:43787` — file tree, edit, autosave, buat/rename/hapus file.
2. **Server MCP** — protokol yang dipakai Claude, ChatGPT, Gemini, Copilot, opencode, Cursor dan lainnya untuk memanggil *tools*. Lewat MCP, AI bisa membaca file, menulis kode, mengedit sebagian, menyusun struktur folder, mencari teks, dan menghapus file — langsung di disk kamu.

Tidak ada cloud, tidak ada akun, tidak ada database, tidak ada telemetri. Hanya Node.js dan dua dependency.

Supaya bisa dipakai dari ChatGPT atau Claude di perangkat lain, nyalakan satu tunnel gratis dengan `cloudflared` — tanpa akun, tanpa domain, tanpa membuka port router.

### Kelebihan

| Kelebihan | Penjelasan |
|---|---|
| **Satu workspace, banyak AI** | Semua client MCP memakai folder yang sama. Ganti AI tanpa memindahkan file. |
| **Langsung ke disk** | AI menulis file asli, bukan potongan kode di chat. Penulisan atomik, folder induk dibuat otomatis. |
| **11 tool siap pakai** | Baca, tulis, edit sebagian, scaffold struktur, cari, pindah, hapus. |
| **Dua mode koneksi** | `stdio` (paling aman, tanpa jaringan) dan HTTP `/mcp` untuk remote. |
| **Publik tanpa akun** | Cloudflare quick tunnel: tanpa domain, tanpa akun, tanpa build step. |
| **Editor yang tidak mengganggu** | Autosave 700 ms, Ctrl+S, Tab = 2 spasi, indikator Ln/Col. |
| **Sandbox** | Semua operasi dikunci ke satu folder; path traversal dan symlink keluar ditolak. |
| **Bisa diaudit** | Setiap tulis, edit, pindah, dan hapus dicatat di `.logs/activity.jsonl`. |
| **Ringan** | Tanpa framework, tanpa DB, tanpa bundler. `npm install` lalu `npm start`. |
| **Lintas OS** | Windows, macOS, Linux. |

### Cara menjalankan (langkah pemula)

**Yang perlu disiapkan:** komputer Windows/macOS/Linux, koneksi internet, dan **Node.js 18.17 atau lebih baru**. Unduh versi **LTS** di https://nodejs.org, klik Next sampai selesai. Cek dengan membuka terminal dan mengetik `node -v`.

**1. Ambil kodenya**

Paling mudah: buka halaman repo di GitHub → tombol **Code** → **Download ZIP** → ekstrak ke folder biasa (misalnya `Dokumen\local-workspace-mcp`). Jangan taruh di `C:\Windows` atau `C:\Program Files`.

Kalau sudah punya git:

```bash
git clone https://github.com/rinaldisign/local-workspace-mcp.git
```

**2. Pasang dependency (sekali saja)**

Buka terminal di folder tadi, lalu:

```bash
npm install
```

Windows: kalau muncul pesan `npm.ps1 cannot be loaded`, jalankan `npm.cmd install`.

**3. Jalankan aplikasi**

- Windows: klik dua kali **`start.bat`**, lalu biarkan jendelanya terbuka.
- macOS/Linux: `chmod +x start.sh` lalu `./start.sh`.
- Atau dari terminal mana pun: `npm start`.

Di jendela itu akan muncul:

```
Editor UI   : http://127.0.0.1:43787
MCP (local) : http://127.0.0.1:43787/mcp
Workspace   : ...
TOKEN       : 3f9c...
```

**4. Buka editor di browser**

Buka `http://127.0.0.1:43787`. Saat diminta token, salin baris `TOKEN` dari jendela tadi (atau isi file `.token`). Token disimpan di browser, jadi cukup sekali.

**5. Pilih folder kerja**

Isi path absolut folder yang mau dipakai AI di kolom `folder` pada header, lalu klik **use**. Kalau foldernya belum ada, kamu akan ditanya apakah mau dibuat. Pilihan disimpan di `config.json` dan dipakai lagi saat start berikutnya.

Urutan prioritas: `config.json` → `WORKSPACE_DIR` di `.env` → `./workspace`. Root drive (`C:\`) dan folder sistem ditolak.

**6. Hubungkan AI** — lihat bagian *Hubungkan AI* di bawah. Untuk AI di perangkat lain (misalnya ChatGPT di web), nyalakan tunnel dulu.

### Akses publik (Cloudflare Tunnel)

Server ini hanya mendengarkan di `127.0.0.1`, jadi AI dari internet butuh jembatan. Jembatannya **Cloudflare Tunnel**: gratis, tanpa akun, tanpa domain, dan tidak perlu membuka port di router.

**1. Pasang `cloudflared` (sekali saja)**

- Windows: `winget install --id Cloudflare.cloudflared`
- macOS: `brew install cloudflared`
- Linux: unduh paket `.deb`/`.rpm` dari https://github.com/cloudflare/cloudflared/releases

Cek dengan `cloudflared --version`.

**2. Nyalakan tunnel (jendela baru, biarkan terbuka)**

- Windows: klik dua kali **`tunnel-cf.bat`**
- macOS/Linux: `./tunnel-cf.sh`
- Atau dari terminal mana pun: `npm run tunnel`

Tunggu beberapa detik sampai muncul baris seperti ini:

```
Your quick Tunnel has been created! Visit it at:
https://kata-kata-acak.trycloudflare.com
```

**3. Susun URL MCP**

```
https://kata-kata-acak.trycloudflare.com/mcp?token=<TOKEN>
```

`<TOKEN>` sama dengan isi file `.token`.

**4. Tes cepat (opsional)**

```bash
curl "https://kata-kata-acak.trycloudflare.com/health"
```

Balasan yang benar: `{"ok":true,...}`. Kalau `502` atau `no tunnel`, tunggu beberapa detik lalu coba lagi.

**Catatan penting**

- URL quick tunnel **berganti** setiap `cloudflared` dijalankan ulang. Kalau berganti, perbarui URL di connector AI.
- Tunnel mati kalau jendelanya ditutup, PC sleep, atau internet putus.
- Mau URL yang tidak berubah? Buat **named tunnel** di Cloudflare (perlu akun + domain) atau pakai Tailscale Funnel.
- Alternatif tanpa Cloudflare: `npm run tunnel:ssh` (localhost.run). Tanpa akun juga, tapi URL berganti tiap sesi dan layanannya kadang membalas `502 no tunnel`.

### Hubungkan AI

**opencode — stdio (paling aman)**, `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "local-workspace": {
      "type": "local",
      "command": ["node", "/path/ke/local-workspace-mcp/mcp-stdio.js"],
      "enabled": true
    }
  }
}
```

**opencode — remote lewat tunnel:**

```json
{
  "mcp": {
    "local-workspace-http": {
      "type": "remote",
      "url": "https://kata-kata-acak.trycloudflare.com/mcp",
      "headers": { "Authorization": "Bearer <TOKEN>" },
      "enabled": true
    }
  }
}
```

**Claude Desktop — stdio:**

```json
{
  "mcpServers": {
    "local-workspace": {
      "command": "node",
      "args": ["/path/ke/local-workspace-mcp/mcp-stdio.js"]
    }
  }
}
```

**Claude / client lain — remote:** *Settings → Connectors → Add custom connector*, isi `https://kata-kata-acak.trycloudflare.com/mcp`. Kalau UI-nya punya kolom header, tambahkan `Authorization: Bearer <TOKEN>`. Kalau tidak ada, pakai `.../mcp?token=<TOKEN>`.

**ChatGPT — connector:**

1. *Settings → Connectors → Advanced / Developer mode → **Add custom connector***.
2. Nama bebas. MCP Server URL: `https://kata-kata-acak.trycloudflare.com/mcp?token=<TOKEN>`
3. Authentication: **No authentication** (token sudah ikut di URL).
4. Simpan, lalu buka chat baru dan panggil tool-nya.

Connector ChatGPT tidak menyediakan kolom header, jadi token harus lewat `?token=`. Karena itu token ikut tercatat di log tunnel — cocok untuk pemakaian pribadi, bukan untuk produksi.

**Client lain (Gemini, Copilot, Cursor, DeepSeek, Perplexity):** sama — pakai URL `.../mcp` dan kirim token sebagai header `Authorization: Bearer <TOKEN>` atau query `?token=<TOKEN>`, sesuai yang didukung client.

Setelah tersambung, cukup minta: *"buat landing page di workspace saya"* — AI memanggil `create_tree` / `save_code` dan file benar-benar muncul di disk.

### Keamanan

- Default-nya **token aktif** (`OPEN_MODE=false`). Pertahankan begitu.
- `OPEN_MODE=true` mematikan auth sepenuhnya: siapa pun yang bisa mencapai URL itu bisa membaca, menulis, dan menghapus file. Hanya untuk uji lokal — **jangan** dipakai bersamaan dengan tunnel publik.
- URL tunnel itu publik, bukan rahasia. Hanya token yang membatasi akses.
- Token di query (`?token=`) ikut tercatat di log tunnel. Untuk pemakaian pribadi itu wajar; ganti token dengan menghapus `.token` lalu restart.
- Server hanya bind ke `127.0.0.1`, jadi tidak terbuka ke LAN.
- Jangan menaruh kredensial di folder workspace selama tunnel hidup; trafik melewati server pihak ketiga.
- Persempit permukaan dengan `ALLOWED_EXTENSIONS` dan `MAX_FILE_BYTES`. Semua perubahan tercatat di `.logs/activity.jsonl`.

Detail lengkap: [SECURITY.md](SECURITY.md).

---

## English

### What is this?

Local Workspace MCP runs entirely on your computer. Two parts:

1. **Web editor** at `http://127.0.0.1:43787` — file tree, editing, autosave, create/rename/delete.
2. **MCP server** — the protocol Claude, ChatGPT, Gemini, Copilot, opencode, Cursor and others use to call *tools*. Over MCP an AI can read files, write code, patch part of a file, scaffold folders, search text, and delete files directly on your disk.

No cloud, no account, no database, no telemetry. Just Node.js and two dependencies.

To use it from ChatGPT or Claude on another device, start one free `cloudflared` tunnel — no account, no domain, no router port forwarding.

### Why use it

| Advantage | Details |
|---|---|
| **One workspace, many AIs** | Every MCP client shares the same folder. Switch AI without moving files. |
| **Straight to disk** | The AI writes real files, not chat snippets. Atomic writes, parent folders created. |
| **11 ready-made tools** | Read, write, patch, scaffold, search, move, delete. |
| **Two transports** | `stdio` (safest, no network) and HTTP `/mcp` for remote. |
| **Public without an account** | Cloudflare quick tunnel: no domain, no signup, no build step. |
| **Editor that stays out of the way** | 700 ms autosave, Ctrl+S, Tab = 2 spaces, Ln/Col. |
| **Sandboxed** | Locked to one folder; path traversal and escaping symlinks are rejected. |
| **Auditable** | Every write, edit, move and delete is appended to `.logs/activity.jsonl`. |
| **Lightweight** | No framework, no DB, no bundler. `npm install` then `npm start`. |
| **Cross-platform** | Windows, macOS, Linux. |

### How to run (beginner steps)

**What you need:** a Windows/macOS/Linux computer, internet, and **Node.js 18.17 or newer**. Download the **LTS** build from https://nodejs.org and click Next until it finishes. Check by opening a terminal and typing `node -v`.

**1. Get the code**

Easiest: open the repo page on GitHub → **Code** → **Download ZIP** → extract to a normal folder (for example `Documents\local-workspace-mcp`). Do not put it in `C:\Windows` or `C:\Program Files`.

If you already have git:

```bash
git clone https://github.com/rinaldisign/local-workspace-mcp.git
```

**2. Install dependencies (once)**

Open a terminal in that folder, then:

```bash
npm install
```

Windows: if you see `npm.ps1 cannot be loaded`, run `npm.cmd install` instead.

**3. Start the app**

- Windows: double-click **`start.bat`** and leave the window open.
- macOS/Linux: `chmod +x start.sh` then `./start.sh`.
- Or from any terminal: `npm start`.

It prints something like:

```
Editor UI   : http://127.0.0.1:43787
MCP (local) : http://127.0.0.1:43787/mcp
Workspace   : ...
TOKEN       : 3f9c...
```

**4. Open the editor in a browser**

Go to `http://127.0.0.1:43787`. When it asks for the token, copy the `TOKEN` line from the window (or the `.token` file). The browser keeps it, so this is a one-time step.

**5. Pick your working folder**

Put an absolute path in the `folder` box in the header and click **use**. If the folder does not exist you will be asked whether to create it. The choice is saved to `config.json` and reused next time.

Priority: `config.json` → `WORKSPACE_DIR` in `.env` → `./workspace`. Drive roots (`C:\`) and system folders are refused.

**6. Connect an AI** — see *Connect an AI* below. For an AI on another device (for example ChatGPT on the web), start the tunnel first.

### Public access (Cloudflare Tunnel)

The server only listens on `127.0.0.1`, so an AI on the internet needs a bridge. The bridge is **Cloudflare Tunnel**: free, no account, no domain, and no router port forwarding.

**1. Install `cloudflared` (once)**

- Windows: `winget install --id Cloudflare.cloudflared`
- macOS: `brew install cloudflared`
- Linux: download the `.deb`/`.rpm` from https://github.com/cloudflare/cloudflared/releases

Check with `cloudflared --version`.

**2. Start the tunnel (new window, keep it open)**

- Windows: double-click **`tunnel-cf.bat`**
- macOS/Linux: `./tunnel-cf.sh`
- Or from any terminal: `npm run tunnel`

Wait a few seconds for a line like:

```
Your quick Tunnel has been created! Visit it at:
https://random-words.trycloudflare.com
```

**3. Build the MCP URL**

```
https://random-words.trycloudflare.com/mcp?token=<TOKEN>
```

`<TOKEN>` is the contents of `.token`.

**4. Quick test (optional)**

```bash
curl "https://random-words.trycloudflare.com/health"
```

A good answer is `{"ok":true,...}`. If you get `502` or `no tunnel`, wait a few seconds and try again.

**Important notes**

- The quick-tunnel URL **changes** every time `cloudflared` restarts. Update the connector when it does.
- The tunnel dies if its window is closed, the computer sleeps, or the network drops.
- Want a URL that never changes? Create a **named tunnel** in Cloudflare (needs an account + domain) or use Tailscale Funnel.
- Fallback without Cloudflare: `npm run tunnel:ssh` (localhost.run). Also account-free, but the URL changes every session and the service sometimes answers `502 no tunnel`.

### Connect an AI

**opencode — stdio (safest)**, `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "local-workspace": {
      "type": "local",
      "command": ["node", "/path/to/local-workspace-mcp/mcp-stdio.js"],
      "enabled": true
    }
  }
}
```

**opencode — remote through the tunnel:**

```json
{
  "mcp": {
    "local-workspace-http": {
      "type": "remote",
      "url": "https://random-words.trycloudflare.com/mcp",
      "headers": { "Authorization": "Bearer <TOKEN>" },
      "enabled": true
    }
  }
}
```

**Claude Desktop — stdio:**

```json
{
  "mcpServers": {
    "local-workspace": {
      "command": "node",
      "args": ["/path/to/local-workspace-mcp/mcp-stdio.js"]
    }
  }
}
```

**Claude / other clients — remote:** *Settings → Connectors → Add custom connector* and paste `https://random-words.trycloudflare.com/mcp`. If the UI has a header field, add `Authorization: Bearer <TOKEN>`. If not, use `.../mcp?token=<TOKEN>`.

**ChatGPT — connector:**

1. *Settings → Connectors → Advanced / Developer mode → **Add custom connector***.
2. Any name. MCP Server URL: `https://random-words.trycloudflare.com/mcp?token=<TOKEN>`
3. Authentication: **No authentication** (the token is already in the URL).
4. Save, then open a new chat and call the tools.

ChatGPT connectors have no header field, so the token has to go in `?token=`. That means the token also shows up in the tunnel log — fine for personal use, not for production.

**Other clients (Gemini, Copilot, Cursor, DeepSeek, Perplexity):** same idea — use `.../mcp` and send the token as an `Authorization: Bearer <TOKEN>` header or a `?token=<TOKEN>` query, whichever the client supports.

Then just ask: *"make a landing page in my workspace"* — the AI calls `create_tree` / `save_code` and the files appear on disk.

### Security

- **Token mode is the default** (`OPEN_MODE=false`). Keep it.
- `OPEN_MODE=true` disables auth entirely: anyone who can reach the URL can read, write and delete files. Local testing only — **never** alongside a public tunnel.
- A tunnel URL is public, not secret. Only the token restricts access.
- A token in the query string (`?token=`) is recorded in the tunnel log. That is normal for personal use; rotate it by deleting `.token` and restarting.
- The server binds to `127.0.0.1` only, so it is not reachable from your LAN.
- Do not keep credentials in the workspace while a tunnel is live; traffic passes through a third-party server.
- Narrow the surface with `ALLOWED_EXTENSIONS` and `MAX_FILE_BYTES`. Every change is logged to `.logs/activity.jsonl`.

Full details: [SECURITY.md](SECURITY.md).

---

## Reference

### MCP tools

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

### REST API

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

Quick check:

```bash
curl http://127.0.0.1:43787/api/info -H "Authorization: Bearer <TOKEN>"
curl -s https://<tunnel-host>/mcp?token=<TOKEN> \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Configuration / Konfigurasi

Copy `.env.example` to `.env` and edit:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `43787` | HTTP port |
| `HOST` | `127.0.0.1` | bind address (keep loopback for tunnels) |
| `WORKSPACE_DIR` | `./workspace` | initial workspace folder |
| `AUTH_TOKEN` | – | fixed token (otherwise generated into `.token`) |
| `OPEN_MODE` | `false` | `true` disables auth entirely |
| `MAX_FILE_BYTES` | `2097152` | max file size (2 MB) |
| `MAX_TREE_ENTRIES` | `5000` | max tree entries returned |
| `ALLOWED_EXTENSIONS` | built-in list | comma-separated writable extensions |

Never committed (see `.gitignore`): `.env`, `.token`, `config.json`, `.logs/`, `workspace/`, `node_modules/`.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `npm.ps1 cannot be loaded` (Windows) | use `npm.cmd install`, or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `node` or `npm` not recognized | install Node.js LTS from https://nodejs.org, then reopen the terminal |
| Port already in use | change `PORT` in `.env` and restart |
| UI keeps asking for a token | paste the value from `.token`, or the `TOKEN` line in the terminal |
| AI writes but nothing appears | the AI writes to the workspace folder, not this repo — check the `folder` box |
| `Extension .xyz is not allowed` | add it to `ALLOWED_EXTENSIONS` |
| `cloudflared` not recognized | install it (`winget install --id Cloudflare.cloudflared`, `brew install cloudflared`), then reopen the terminal |
| Tunnel URL stopped working / `502` | the tunnel window closed or the machine slept. Start it again and use the new URL |
| ChatGPT: *"A service needed to create the app is temporarily unavailable"* | it could not reach the MCP URL. Check, in order: tunnel window is open, `curl <url>/health` returns `{"ok":true}`, `?token=<TOKEN>` is in the URL, and the URL is the newest one |
| `502 no tunnel` from localhost.run | their service refused the hostname. Use the Cloudflare tunnel (`npm run tunnel`) instead |
| `ssh: command not found` | only needed for the localhost.run fallback; install the OpenSSH client or just use Cloudflare |

## Project layout / Struktur proyek

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
tunnel-cf.bat|.sh start the Cloudflare tunnel (recommended)
tunnel.bat|.sh    start the localhost.run tunnel (fallback)
docs/hero.png     repository banner
```

## License / Lisensi

MIT — see [LICENSE](LICENSE).

## Disclaimer

The banner image is fan art that includes third-party AI product names and logos for illustration only. This project is not affiliated with, endorsed by, or sponsored by OpenAI, Anthropic, Google, Microsoft, DeepSeek, Perplexity, or Meta. Cloudflare and localhost.run are independent services with their own terms.
