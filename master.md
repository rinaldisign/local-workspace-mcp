# MASTER BUILD — MCP Workspace Lokal + Cloudflare Tunnel

Dokumen ini untuk **AI agent**. Tugasnya membangun ulang aplikasi MCP workspace lokal
dan mengeksposnya ke ChatGPT/Claude memakai **Cloudflare Tunnel (`cloudflared`)**.

## Hasil akhir

- Editor web: `http://127.0.0.1:43787`
- MCP publik: `https://<acak>.trycloudflare.com/mcp?token=<TOKEN>`
  (domain acak; berganti bila proses tunnel dijalankan ulang)
- AI bisa: baca, tulis, edit sebagian, buat struktur folder, cari, hapus file di workspace user
- Auto-save dari editor, sandbox ketat, log audit

## Prasyarat

- Node.js >= 18.17, npm
- `cloudflared` (tunnel publik). Windows: `winget install --id Cloudflare.cloudflared`;
  macOS: `brew install cloudflared`. Tanpa akun, tanpa domain
- Tanpa akun, tanpa domain, tanpa build step

## Langkah 0 — WAJIB tanya user sebelum menulis kode

Tanyakan, tunggu jawaban, lalu konfirmasi ulang:

1. Folder workspace absolut di PC user (mis. `D:\project\web`)
2. Port (default `43787`)
3. Mode akses: **terbuka** (tanpa token, Claude bisa langsung) atau **token**
4. Folder tempat kode aplikasi ini disimpan

Aturan:
- Jangan menebak path. Tampilkan path yang kamu pahami dan minta konfirmasi.
- Tolak root drive (`C:\`) dan folder sistem (`C:\Windows`, `C:\Program Files`, `C:\ProgramData`).
- Jelaskan bahwa mode terbuka = siapa pun yang tahu URL bisa menulis file. User memilih.

## Fase 1 — Scaffold

Buat struktur:

```
package.json      # ESM, deps: @modelcontextprotocol/sdk, zod
server.js         # HTTP: UI + REST + MCP
mcp-stdio.js      # transport stdio (opsional)
mcp-core.js       # 11 tool MCP
lib/config.js     # env, token, OPEN_MODE, config.json
lib/fs-service.js # inti filesystem
public/index.html
public/app.js
public/styles.css
.env .env.example .gitignore start.bat tunnel-cf.bat tunnel-cf.sh
```

`lib/config.js`: baca `.env` sendiri (tanpa dotenv), `runtime = {port, host, workspace}`,
prioritas workspace: `config.json` → `WORKSPACE_DIR` → `./workspace`, simpan lewat
`saveWorkspaceSetting()`. Token dari `AUTH_TOKEN` atau file `.token` (dibuat otomatis).

Tes: `node -e "import('./lib/config.js').then(m=>console.log(m.runtime))"`.

## Fase 2 — lib/fs-service.js

Fungsi wajib:
`safeResolve`, `assertRealInside`, `writeFile`, `readFile`, `editFile`, `listTree`,
`createFolder`, `createStructure`, `movePath`, `deletePath`, `searchFiles`,
`setWorkspace`, `workspaceInfo`, `logActivity`.

Aturan wajib:
- Sandbox: `path.resolve(root, rel)` + cek `path.relative` tidak diawali `..`; `realpath` blokir symlink keluar
- Tulis atomik: `file.tmp-PID-TS` lalu `rename`
- `editFile`: ganti `oldText` → `newText`; error bila tidak ada, atau muncul >1x kecuali `replaceAll=true`
- Whitelist ekstensi; file tanpa ekstensi boleh; batas 2 MB
- Log tiap operasi ke `.logs/activity.jsonl`
- `setWorkspace`: path absolut, tolak folder sistem, opsi `create`

## Fase 3 — mcp-core.js (11 tool)

| Tool | Fungsi |
|---|---|
| `workspace_info` | path, batas, kategori |
| `list_files` | tree rekursif |
| `read_file` | baca teks |
| `write_file` | tulis penuh (atomik) |
| `edit_file` | cari-ganti unik / replaceAll |
| `save_code` | simpan ke folder kategori otomatis |
| `create_tree` | scaffold banyak file/folder |
| `create_folder` | mkdir rekursif |
| `move_path` | rename/pindah |
| `delete_path` | hapus file/folder |
| `search_files` | cari teks |

Kategori `save_code`: html→`pages/`, css→`styles/`, js/ts→`scripts/`, json/csv→`data/`,
md/txt→`docs/`, svg/gambar→`assets/`, yml/toml→`config/`, lain→`misc/`.

Gunakan `McpServer` + `registerTool` (fallback ke `server.tool`). Semua error → `isError: true`
dengan pesan `status: message`. Jangan pernah menulis log ke stdout pada transport stdio.

## Fase 4 — server.js

REST (semua `/api`, JSON `{ok:true|false}`):

```
GET  /health            # publik, sertakan openMode
GET  /api/info
GET|POST /api/settings  # {workspace, create?}
GET  /api/tree?path=
GET  /api/file?path=
POST /api/file          # {path, content}
POST /api/edit          # {path, oldText, newText, replaceAll?}
POST /api/structure     # {entries:[{path,type,content}]}
POST /api/folder        # {path}
POST /api/move          # {from,to}
POST /api/delete        # {path}
POST /api/search        # {query,path?,maxResults?}
ALL  /mcp
```

Ketentuan:
- Bind `127.0.0.1` (tunnel menyambung lokal)
- Auth Bearer token, **dilewati bila `OPEN_MODE=true`**
- MCP: `StreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true})`, server baru per request (stateless)
- Static `public/` tanpa auth, `cache-control: no-cache`
- CORS longgar + `OPTIONS` 204 (dibutuhkan client MCP)
- Banner terminal: URL, token, perintah `cloudflared`, peringatan bila open mode

## Fase 5 — public/ (UI)

Satu halaman, tanpa CDN:
- Header: kolom **folder** + tombol `pakai` → `POST /api/settings`; bila folder tidak ada, konfirmasi lalu kirim `create:true`
- Sidebar: tree, filter, tombol file/folder baru, rename, hapus, refresh
- Editor: textarea mono, auto-save debounce 700 ms, Ctrl+S, Tab = 2 spasi, indikator `Ln/Col`, status tersimpan
- Badge merah `MODE TERBUKA` bila `health.openMode`
- Modal token (hanya bila bukan open mode) dan modal berisi config MCP siap-copy (stdio + HTTP)

## Fase 6 — Cloudflare Tunnel

Utama, tanpa akun dan tanpa domain:

```powershell
cloudflared tunnel --url http://127.0.0.1:43787
# atau: npm run tunnel   (atau klik tunnel-cf.bat)
```

- Tunggu baris `https://<acak>.trycloudflare.com`; catat dan tunjukkan ke user
- MCP: `https://<acak>.trycloudflare.com/mcp?token=<TOKEN>`
- URL berganti setiap proses tunnel dijalankan ulang; proses harus tetap terbuka
- Bila `cloudflared` tidak ada: pasang dulu, lalu ulangi
- Jangan menaruh URL tunnel asli, token, atau IP di repo/dokumentasi

## Fase 7 — Verifikasi (wajib sebelum serah terima)

```powershell
Invoke-RestMethod http://127.0.0.1:43787/api/info -Headers @{Authorization="Bearer <TOKEN>"}
Invoke-RestMethod http://127.0.0.1:43787/api/tree  -Headers @{Authorization="Bearer <TOKEN>"}
```

MCP (pakai `?token=`; atau header Bearer bila open mode):

```powershell
$b='{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
Invoke-RestMethod "https://<url>/mcp?token=<TOKEN>" -Method Post -Headers @{Accept='application/json, text/event-stream'} -ContentType 'application/json' -Body $b
```

Checklist: 11 tool muncul; tulis file di folder user; path `../../` ditolak; edit ambigu ditolak;
folder baru lewat UI berfungsi; ChatGPT/Claude bisa menambah connector `<url>/mcp?token=<TOKEN>`.

## Serah terima

Berikan ke user: URL editor, URL MCP (dengan `?token=`), dan cara menambah connector
(ChatGPT: Settings → Connectors → Developer mode → Add custom connector, auth None;
Claude: Settings → Connectors → Add custom connector). Jelaskan cara menjalankan ulang
(2 jendela: `npm start` + `tunnel-cf.bat` / `npm run tunnel`). Ingatkan: PC dan kedua
proses harus hidup, dan URL quick tunnel berganti bila tunnel di-restart.

## Aturan kerja AI

1. Kerjakan **per fase**, jelaskan singkat, jalankan tes, lalu minta konfirmasi user sebelum lanjut.
2. Jika tes gagal, perbaiki dulu; jangan menumpuk fitur.
3. Ikuti bahasa user. Tampilkan perintah yang bisa langsung dijalankan.
4. Jangan menambah fitur di luar dokumen ini, jangan pakai database/framework/build tool.
5. Jangan menulis di luar workspace. Jangan menaruh token/path pribadi di dokumentasi.
6. Mode terbuka hanya untuk testing; sebutkan risikonya sekali, tanpa menggurui.
