#!/usr/bin/env sh
set -e
echo "Starting a public tunnel for http://localhost:43787"
echo "Keep this terminal open. Copy the https://xxxx.lhr.life URL it prints."
ssh -o ServerAliveInterval=30 -R 80:localhost:43787 nokey@localhost.run
