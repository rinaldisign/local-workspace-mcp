# MASTER BUILD — MCP Workspace Lokal + localhost.run

Dokumen ini untuk **AI agent**. Tugasnya membangun ulang aplikasi MCP workspace lokal
dan mengeksposnya ke Claude memakai **localhost.run** (bukan Cloudflare).

## Hasil akhir

- Editor web: `http://127.0.0.1:43787`
- MCP publik: `https://<acak>.lhr.life/mcp` (berubah tiap sesi)
- AI bisa: baca, tulis, edit sebagian, buat struktur folder, cari, hapus file di workspace user
- Auto-save dari editor, sandbox ketat, log audit

## Prasyarat

- Node.js >= 18.17, npm
- OpenSSH client (`ssh -V`). Windows: aktifkan *OpenSSH Client* di Optional Features
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
.env .env.example .gitignore start.bat
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
- Banner terminal: URL, token, perintah localhost.run, peringatan bila open mode

## Fase 5 — public/ (UI)

Satu halaman, tanpa CDN:
- Header: kolom **folder** + tombol `pakai` → `POST /api/settings`; bila folder tidak ada, konfirmasi lalu kirim `create:true`
- Sidebar: tree, filter, tombol file/folder baru, rename, hapus, refresh
- Editor: textarea mono, auto-save debounce 700 ms, Ctrl+S, Tab = 2 spasi, indikator `Ln/Col`, status tersimpan
- Badge merah `MODE TERBUKA` bila `health.openMode`
- Modal token (hanya bila bukan open mode) dan modal berisi config MCP siap-copy (stdio + HTTP)

## Fase 6 — localhost.run

```powershell
ssh -o ServerAliveInterval=30 -R 80:localhost:43787 nokey@localhost.run
```

- Terminal menampilkan URL `https://<acak>.lhr.life`; catat dan tunjukkan ke user
- MCP: `https://<acak>.lhr.life/mcp`
- URL berubah setiap koneksi; proses harus tetap terbuka
- Bila `ssh` tidak ada: aktifkan OpenSSH Client, ulangi
- Alternatif cepat bila sesi terputus: jalankan ulang perintah yang sama

## Fase 7 — Verifikasi (wajib sebelum serah terima)

```powershell
Invoke-RestMethod http://127.0.0.1:43787/api/info -Headers @{Authorization="Bearer <TOKEN>"}
Invoke-RestMethod http://127.0.0.1:43787/api/tree  -Headers @{Authorization="Bearer <TOKEN>"}
```

MCP (tanpa header bila open mode):

```powershell
$b='{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
Invoke-RestMethod https://<url>/mcp -Method Post -Headers @{Accept='application/json, text/event-stream'} -ContentType 'application/json' -Body $b
```

Checklist: 11 tool muncul; tulis file di folder user; path `../../` ditolak; edit ambigu ditolak;
folder baru lewat UI berfungsi; Claude bisa menambah connector `<url>/mcp`.

## Serah terima

Berikan ke user: URL editor, URL MCP, cara tambah connector di Claude
(Settings → Connectors → Add custom connector), dan cara menjalankan ulang (2 terminal:
`npm start` + perintah ssh). Ingatkan: PC dan kedua proses harus hidup.

## Aturan kerja AI

1. Kerjakan **per fase**, jelaskan singkat, jalankan tes, lalu minta konfirmasi user sebelum lanjut.
2. Jika tes gagal, perbaiki dulu; jangan menumpuk fitur.
3. Ikuti bahasa user. Tampilkan perintah yang bisa langsung dijalankan.
4. Jangan menambah fitur di luar dokumen ini, jangan pakai database/framework/build tool.
5. Jangan menulis di luar workspace. Jangan menaruh token/path pribadi di dokumentasi.
6. Mode terbuka hanya untuk testing; sebutkan risikonya sekali, tanpa menggurui.
