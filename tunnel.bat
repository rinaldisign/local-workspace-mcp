@echo off
cd /d "%~dp0"
echo Starting a public tunnel for http://localhost:43787
echo Keep this window open. Copy the https://xxxx.lhr.life URL it prints.
echo.
ssh -o ServerAliveInterval=30 -R 80:localhost:43787 nokey@localhost.run
pause
