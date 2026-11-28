// Prepara una installazione nuova: crea .env e i file di configurazione dagli esempi, poi il database vuoto.
// Si può rilanciare senza rischi: non sovrascrive mai nulla di esistente.
const fs = require('fs'), path = require('path');
const radice = path.join(__dirname, '..');

const copiaSeManca = (da, a) => {
  const dest = path.join(radice, a);
  if (fs.existsSync(dest)) return console.log(`= ${a} esiste già`);
  fs.copyFileSync(path.join(radice, da), dest);
  console.log(`+ ${a} creato da ${da}`);
};

copiaSeManca('.env.example', '.env');
copiaSeManca('config/bacnet-map.example.json', 'config/bacnet-map.json');

if (fs.existsSync(path.join(radice, '.env'))) process.loadEnvFile(path.join(radice, '.env'));   // DB_PATH ecc. dal .env appena creato
const cfg = require('../src/config');
const nuovo = !fs.existsSync(cfg.dbPath);
require('../src/push');                                  // carica src/db.js (schema) e genera le chiavi VAPID al primo avvio
require('../src/units');                                 // crea le unità da bacnet-map (nomi provvisori)
console.log(nuovo ? `+ database vuoto creato in ${cfg.dbPath}` : `= database già presente in ${cfg.dbPath}`);

console.log('\nFatto. Prossimi passi:\n  1. se serve, adatta config/bacnet-map.json al tuo impianto\n  2. imposta AC_IP (e SITE_NAME) in .env\n  3. npm start   (oppure npm run mock per provare senza impianto)');
process.exit(0);
