#!/usr/bin/env sh
set -e
cd "$(dirname "$0")"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared was not found."
  echo ""
  echo "Install it first, then run this file again:"
  echo "  macOS:  brew install cloudflared"
  echo "  Linux:  https://github.com/cloudflare/cloudflared/releases"
  exit 1
fi

echo "Starting a free Cloudflare tunnel for http://127.0.0.1:43787"
echo ""
echo "Keep this terminal open. Wait for the line that looks like:"
echo "   https://something-random.trycloudflare.com"
echo ""
echo "Your MCP URL is that address plus /mcp?token=YOUR_TOKEN"
echo "(the token is in the .token file in this folder)."
echo ""
exec cloudflared tunnel --url http://127.0.0.1:43787
