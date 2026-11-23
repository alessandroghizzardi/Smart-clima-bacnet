#!/usr/bin/env bash
# Copia il codice nella cartella di installazione e riavvia il servizio.
# Non tocca mai .env, data/ e config/*.json (configurazione e dati dell'impianto).
set -euo pipefail

: "${DEPLOY_DIR:?imposta DEPLOY_DIR (cartella di installazione)}"
SERVICE="${DEPLOY_SERVICE:-smart-clima}"

rsync -a --delete \
  --exclude='.git/' --exclude='.github/' --exclude='node_modules/' \
  --exclude='.env' --exclude='data/' \
  --exclude='config/units.json' --exclude='config/bacnet-map.json' \
  ./ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
npm ci --omit=dev
# TODO: riavvio del servizio (serve un permesso sudo mirato per l'utente del runner)
sudo systemctl restart "$SERVICE"
