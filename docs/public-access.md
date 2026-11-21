# Public access: choosing how an AI client reaches your workspace

This server binds to `127.0.0.1` by default, so only the local machine can reach
it. To use it from another device you need a bridge. There is no single best
bridge: each option has different requirements. Pick the one that matches where
your client runs and what accounts or domains you already have.

This page is vendor-neutral. Any MCP client works: a desktop app, a CLI agent,
an IDE extension, or a hosted web agent.

## Choose by where the client runs

| Where the client runs | Recommended path | Why |
|---|---|---|
| Same computer | [stdio](#path-0-stdio-no-network) | no port, no token, no tunnel |
| Your own phone or laptop | [Tailscale Serve](#path-1-tailscale-serve-private-stable) | private and stable |
| Another device on the same Wi-Fi | [LAN](#path-2-lan-only) | no account needed |
| A hosted web agent, with a domain | [Cloudflare Named Tunnel](#path-3-cloudflare-named-tunnel-stable-url) | permanent URL |
| A hosted web agent, without a domain | [Cloudflare Quick Tunnel](#path-4-cloudflare-quick-tunnel-no-account) or [Tailscale Funnel](#path-5-tailscale-funnel-stable-public-url) | free, no domain |
| A hosted web agent, other options | [ngrok](#path-6-ngrok), [localhost.run](#path-7-localhostrun-last-resort), [VPS](#path-8-vps--reverse-proxy) | fallbacks and full control |

| Path | Account | Domain | Stable URL | Public |
|---|---|---|---|---|
| 0 stdio | none | no | n/a | no |
| 1 Tailscale Serve | Tailscale free | no (`*.ts.net`) | yes | no, tailnet only |
| 2 LAN | none | no | local IP | LAN only |
| 3 Cloudflare Named | Cloudflare free | yes | yes | yes |
| 4 Cloudflare Quick | none | no | no | yes |
| 5 Tailscale Funnel | Tailscale free | no (`*.ts.net`) | yes | yes |
| 6 ngrok | ngrok free | no | paid only | yes |
| 7 localhost.run | none | no | no | yes |
| 8 VPS + Caddy | VPS + domain | yes | yes | yes |

Keep `OPEN_MODE=false` on every path. The token is the only gate.

## Path 0: stdio (no network)

**Requires:** Node.js 18.17 or newer. Nothing else.

Point the client at `mcp-stdio.js` in your clone:

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

No port, no token, no tunnel. This is the safest default for any client on the
same computer. Do not open a tunnel "just in case".

## Path 1: Tailscale Serve (private, stable)

**Requires:** a Tailscale account (free personal plan), Tailscale on both the
server machine and the client device, both in the same tailnet, HTTPS
certificates enabled.

```bash
tailscale up
tailscale serve 43787
```

Result: `https://<machine>.<tailnet>.ts.net`. MCP URL:
`https://<machine>.<tailnet>.ts.net/mcp?token=<TOKEN>`.

Stable URL, automatic HTTPS, and nothing exposed to the public internet. A
hosted web agent cannot use it, because it cannot join your tailnet.

## Path 2: LAN only

**Requires:** no account. Same network, and the host firewall must allow the
port.

```bash
# .env
HOST=0.0.0.0
PORT=43787
```

Restart, then use `http://<host-lan-ip>:43787/mcp?token=<TOKEN>`. The LAN IP can
change, and anyone on that network can reach the server. Revert `HOST` to
`127.0.0.1` when done.

## Path 3: Cloudflare Named Tunnel (stable URL)

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

## Path 4: Cloudflare Quick Tunnel (no account)

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

## Path 5: Tailscale Funnel (stable, public)

**Requires:** Tailscale account, HTTPS certificates enabled, Funnel enabled for
the device in the admin console.

```bash
tailscale funnel 43787
```

Result: a stable `https://<machine>.<tailnet>.ts.net` reachable from the public
internet. MCP URL:
`https://<machine>.<tailnet>.ts.net/mcp?token=<TOKEN>`.

Good when you want a stable URL without owning a domain. Treat it as public:
keep the token strong and disable Funnel when unused. Only one Funnel per device,
and only ports 443, 8443, and 10000 are allowed.

## Path 6: ngrok

**Requires:** ngrok account and authtoken; a paid plan for a stable domain.

```bash
ngrok config add-authtoken <TOKEN_FROM_DASHBOARD>
ngrok http 43787
```

Use the printed `https://....ngrok-free.app` URL with `/mcp?token=<TOKEN>`.

The free tier adds a browser interstitial and connection limits, which can break
some clients even when `curl` works. Free URLs change on restart.

## Path 7: localhost.run (last resort)

**Requires:** an SSH client only.

```bash
ssh -o ServerAliveInterval=30 -R 80:localhost:43787 nokey@localhost.run
```

Use the `https://<random>.lhr.life` URL with `/mcp?token=<TOKEN>`.

This service often answers `502 no tunnel` or refuses hostnames, and the URL
changes every session. Use it only when Cloudflare and Tailscale are not
possible.

## Path 8: VPS + reverse proxy

**Requires:** a VPS, a domain, and TLS termination (Caddy or nginx).

Run the app on the VPS (workspace lives there):

```caddy
mcp.example.com {
    reverse_proxy 127.0.0.1:43787
}
```

Or keep the workspace on your machine and bridge to the VPS:

```bash
ssh -N -R 127.0.0.1:43787:127.0.0.1:43787 user@vps
```

Most work, most control. Note that the first shape changes the trust model: the
files live on the VPS, not on your computer.

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
| 0 stdio | the client process | none needed |
| 1 Tailscale Serve | your tailnet | keep invites tight |
| 2 LAN | everyone on that LAN | firewall the port; revert `HOST` |
| 3 Named tunnel | internet | rotate the token if leaked |
| 4 Quick tunnel | internet | public hostname; rotate after sharing |
| 5 Tailscale Funnel | internet | disable when unused |
| 6 ngrok | internet | do not rely on the free interstitial |
| 7 localhost.run | internet | least reliable |
| 8 VPS | internet | patch the VPS; restrict SSH |

Never enable `OPEN_MODE=true` on any path except stdio, and even then only
briefly for local debugging.
