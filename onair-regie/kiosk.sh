#!/bin/bash
# Script de démarrage mode kiosque pour OnAir Regie

# Désactiver l'économiseur d'écran et la mise en veille
xset s off
xset s noblank
xset -dpms

# Masquer le curseur de la souris après 0.5s d'inactivité
unclutter -idle 0.5 -root &

# Attendre que le serveur soit prêt
sleep 3

# Lancer Chromium en mode kiosk (SANS demande de mot de passe keyring)
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --no-first-run \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --password-store=basic \
  --disable-features=LockProfileCookieDatabase \
  --disable-background-networking \
  --disable-sync \
  http://localhost:8081/
