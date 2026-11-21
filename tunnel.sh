#!/usr/bin/env sh
set -e
echo "Fallback tunnel (localhost.run) for http://localhost:43787"
echo "Recommended instead: ./tunnel-cf.sh (Cloudflare, more reliable)."
echo "Keep this terminal open. Copy the https://xxxx.lhr.life URL it prints."
echo "The URL changes every session, and this service sometimes answers 502."
ssh -o ServerAliveInterval=30 -R 80:localhost:43787 nokey@localhost.run
