const webpush = require('web-push');
const cfg = require('./config');
const { db, kvGet, kvSet, addLog } = require('./db');

let chiavi = kvGet('vapid');
if (!chiavi) { chiavi = webpush.generateVAPIDKeys(); kvSet('vapid', chiavi); }
webpush.setVapidDetails(cfg.vapidSubject, chiavi.publicKey, chiavi.privateKey);

const publicKey = () => chiavi.publicKey;
const salva = (sub) => db.prepare('INSERT OR REPLACE INTO push_subs (endpoint,sub) VALUES (?,?)').run(sub.endpoint, JSON.stringify(sub));
const rimuovi = (endpoint) => db.prepare('DELETE FROM push_subs WHERE endpoint=?').run(endpoint);
const quanti = () => db.prepare('SELECT COUNT(*) n FROM push_subs').get().n;

async function invia(titolo, testo) {
  const subs = db.prepare('SELECT endpoint, sub FROM push_subs').all();
  for (const s of subs) {
    try { await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify({ titolo, testo })); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) rimuovi(s.endpoint); else addLog('errore', 'push: ' + e.message); }
  }
  return subs.length;
}
module.exports = { publicKey, salva, rimuovi, quanti, invia };
