# Publishing the server for a web-based AI agent

This server binds to `127.0.0.1`, so a **hosted web agent** can only reach it
through a public HTTPS URL. That is what this page covers: publishing the server
to the internet.

## Choose a public path

```text
A hosted web agent needs a public HTTPS URL.
|
+-- Owns a domain that can use Cloudflare nameservers?
|     -> Path 1: Cloudflare Named Tunnel (permanent URL)
|
+-- No domain
      -> Path 2: Cloudflare Quick Tunnel (no account, URL changes)
      -> Path 3: Tailscale Funnel (free account, stable URL)
      -> Path 4: ngrok (free account, limits)
      -> Path 5: VPS + Caddy (most control, most work)
```

| Path | Account | Domain | Stable URL | Notes |
|---|---|---|---|---|
| 1 Cloudflare Named | Cloudflare free | yes, NS at Cloudflare | yes | best permanent option |
| 2 Cloudflare Quick | none | no | no | fastest way to get a URL |
| 3 Tailscale Funnel | Tailscale free | no (`*.ts.net`) | yes | stable without a domain |
| 4 ngrok | ngrok free | no | paid only | free tier has limits |
| 5 VPS + Caddy | VPS + domain | yes | yes | you own the endpoint |

Every path keeps `OPEN_MODE=false`. The token is the only gate.

## Path 1: Cloudflare Named Tunnel (stable URL)

**Requires:** Cloudflare account (free), a domain whose nameservers point to
Cloudflare, `cloudflared` installed.

```bash
cloudflared tunnel login
cloudflared tunnel create local-workspace
cloudflared tunnel route dns local-workspace mcp.example.com
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: local-workspace
credentials-file: <path to the .json printed by tunnel create>
ingress:
  - hostname: mcp.example.com
    service: http://127.0.0.1:43787
  - service: http_status:404
```

Run `cloudflared tunnel run local-workspace`. MCP URL:
`https://mcp.example.com/mcp?token=<TOKEN>`.

The hostname never changes. The domain must already use Cloudflare nameservers;
a CNAME alone is not enough for `tunnel route dns`. To keep it running, install
it as a service (`cloudflared service install`).

## Path 2: Cloudflare Quick Tunnel (no account)

**Requires:** `cloudflared` only.

```bash
cloudflared tunnel --url http://127.0.0.1:43787
# or: npm run tunnel
```

Wait for `https://<random>.trycloudflare.com`, then use
`https://<random>.trycloudflare.com/mcp?token=<TOKEN>`.

The hostname is random and changes on every restart, so update the connector
each time. It dies when the window closes, the machine sleeps, or the network
drops. Some networks block `trycloudflare.com`; test `/health`.

## Path 3: Tailscale Funnel (stable, public)

**Requires:** Tailscale account, HTTPS certificates enabled, Funnel enabled for
the device in the admin console.

```bash
tailscale funnel 43787
```

Result: a stable `https://<machine>.<tailnet>.ts.net` reachable from the public
internet. MCP URL:
`https://<machine>.<tailnet>.ts.net/mcp?token=<TOKEN>`.

Good when you want a stable URL without owning a domain. Treat it as public:
keep the token strong and disable Funnel when unused. Only one Funnel per
device, and only ports 443, 8443, and 10000 are allowed.

## Path 4: ngrok

**Requires:** ngrok account and authtoken; a paid plan for a stable domain.

```bash
ngrok config add-authtoken <TOKEN_FROM_DASHBOARD>
ngrok http 43787
```

Use the printed `https://....ngrok-free.app` URL with `/mcp?token=<TOKEN>`.

The free tier adds a browser interstitial and connection limits, which can break
some clients even when `curl` works. Free URLs change on restart.

## Path 5: VPS + reverse proxy

**Requires:** a VPS, a domain, and TLS termination (Caddy or nginx).

Run the app on the VPS (the workspace lives there):

```caddy
mcp.example.com {
    reverse_proxy 127.0.0.1:43787
}
```

Or keep the workspace on your machine and bridge to the VPS:

```bash
ssh -N -R 127.0.0.1:43787:127.0.0.1:43787 user@vps
```

Most work, most control. The first shape changes the trust model: the files live
on the VPS, not on your computer.

## Verify the chosen path

```bash
curl https://<host>/health
curl "https://<host>/mcp?token=<TOKEN>" \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

`/health` must return `{"ok":true,...}` and `tools/list` must list 11 tools. If
`/health` fails, the tunnel is not reaching the app. If `/health` works but
`/mcp` fails, the token or the `/mcp` path is wrong.

## Security

| Path | Who can reach it | Extra precaution |
|---|---|---|
| 1 Named tunnel | internet | rotate the token if leaked |
| 2 Quick tunnel | internet | public hostname; rotate after sharing |
| 3 Tailscale Funnel | internet | disable when unused |
| 4 ngrok | internet | do not rely on the free interstitial |
| 5 VPS | internet | patch the VPS; restrict SSH |

Never enable `OPEN_MODE=true` behind any public URL, and never inside the
workspace while a tunnel is live.
