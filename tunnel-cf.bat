@echo off
cd /d "%~dp0"
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared was not found.
  echo.
  echo Install it first, then run this file again:
  echo    winget install --id Cloudflare.cloudflared
  echo.
  pause
  exit /b 1
)
echo Starting a free Cloudflare tunnel for http://127.0.0.1:43787
echo.
echo Keep this window open. Wait for the line that looks like:
echo    https://something-random.trycloudflare.com
echo.
echo Your MCP URL is that address plus /mcp?token=YOUR_TOKEN
echo (the token is in the .token file in this folder).
echo.
cloudflared tunnel --url http://127.0.0.1:43787
pause
