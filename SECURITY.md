# Security

Local Workspace MCP gives an AI client read/write access to one folder on your machine. Treat it like handing someone a shell inside that folder.

## Threat model

| Risk | Mitigation |
|---|---|
| Path traversal (`../../etc/passwd`) | Every path is resolved against the workspace root and rejected if it escapes; symlinks are resolved with `realpath` and checked too. |
| Drive/OS roots | `setWorkspace` refuses filesystem roots and common system folders. |
| Unauthenticated access | Bearer token required by default, compared with `timingSafeEqual`. |
| Oversized writes | `MAX_FILE_BYTES` (2 MB default) and `ALLOWED_EXTENSIONS` restrict what can be written. |
| Silent changes | All mutations are appended to `.logs/activity.jsonl`. |
| Network exposure | Server binds `127.0.0.1` only; any public reachability comes from a tunnel you start yourself. |

## Known limitations

- **`OPEN_MODE=true` disables auth.** Anyone who can reach the port can read, write, and delete files in the workspace. Never use it with a public tunnel.
- **A tunnel URL is not a credential.** localhost.run URLs are random and short-lived, but public. Only the token provides access control.
- **localhost.run terminates TLS** at its edge. Workspace contents and tokens pass through a third party.
- **The sandbox is path-based, not a container.** Code running as your user is not contained; only the MCP/HTTP file operations are restricted to the workspace.
- **No rate limiting.** Do not expose the app to the open internet without an additional access layer (VPN, reverse proxy with auth, or Cloudflare Access).

## Reporting

Open a GitHub issue for security bugs. Do not include your token, workspace paths, or file contents in the report.
