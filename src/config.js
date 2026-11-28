const fs = require('fs'), path = require('path');
const env = process.env;

// File di configurazione dell'impianto (config/<nome>.json). Non stanno nel repository: si creano con `npm run setup`.
// CONFIG_ESEMPIO=on usa i file *.example.json (test e CI, dove i file dell'impianto non ci sono).
function leggiFile(nome) {
  const f = path.join(__dirname, '..', 'config', nome + (env.CONFIG_ESEMPIO === 'on' ? '.example' : '') + '.json');
  if (!fs.existsSync(f)) throw new Error(`manca config/${nome}.json: esegui "npm run setup" e adattalo al tuo impianto`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

module.exports = {
  leggiFile,
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  bacnet: {
    ip: env.AC_IP || '',                                    // IP del gateway BACnet: da .env (AC_IP) o dalle impostazioni nell'app
    localPort: Number(env.BACNET_LOCAL_PORT || 47809),   // porta locale UDP (diversa dalla 47808 dell'impianto)
    iface: env.BACNET_IFACE || undefined,                 // IP locale da usare, se serve
    timeoutMs: Number(env.BACNET_TIMEOUT_MS || 6000),
  },
  // MOCK=on: impianto simulato in memoria, nessun socket BACnet aperto (per sviluppo e prove)
  mock: (env.MOCK || 'off').toLowerCase() === 'on',
  controlMinutes: Number(env.CONTROL_MINUTES || 5),      // ciclo di controllo dello scenario attivo
  pollMinutes: Number(env.POLL_MINUTES || 30),
  dbPath: env.DB_PATH || path.join(__dirname, '..', 'data', 'smart-clima.db'),
  siteName: env.SITE_NAME || 'Smart Clima',               // nome mostrato in app, titolo della scheda, PWA e notifiche
  setpoint: { min: 16, max: 26, step: 0.5 },
  frostAlertC: Number(env.FROST_ALERT_C || 10),           // avviso se una stanza scende sotto questa temperatura
  vapidSubject: env.VAPID_SUBJECT || 'mailto:admin@localhost',
  timezone: env.TZ || 'Europe/Rome',
};
