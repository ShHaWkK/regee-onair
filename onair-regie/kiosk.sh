#!/bin/bash
set -euo pipefail
URL="http://127.0.0.1:8081/"
for i in $(seq 1 60); do
  if wget -q --spider "$URL"; then
    break
  fi
  sleep 1
done
CHROME_BIN="chromium-browser"
if ! command -v "$CHROME_BIN" >/dev/null 2>&1; then
  CHROME_BIN="chromium"
fi
if ! command -v "$CHROME_BIN" >/dev/null 2>&1; then
  CHROME_BIN="google-chrome"
fi
"$CHROME_BIN" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --start-fullscreen \
  --no-first-run \
  --no-default-browser-check \
  --disable-features=TranslateUI \
  --disable-translate \
  --lang=fr \
  --accept-languages=fr-FR \
  --password-store=basic \
  "$URL"
