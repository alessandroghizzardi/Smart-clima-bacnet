const webpush = require('web-push');
const cfg = require('./config');
const { db, kvGet, kvSet, addLog } = require('./db');
const { nonValido } = require('./errori');

let chiavi = kvGet('vapid');
if (!chiavi) { chiavi = webpush.generateVAPIDKeys(); kvSet('vapid', chiavi); }
webpush.setVapidDetails(cfg.vapidSubject, chiavi.publicKey, chiavi.privateKey);

const publicKey = () => chiavi.publicKey;
const q = {
  salva: db.prepare('INSERT OR REPLACE INTO push_subs (endpoint,sub) VALUES (?,?)'),
  rimuovi: db.prepare('DELETE FROM push_subs WHERE endpoint=?'),
  quanti: db.prepare('SELECT COUNT(*) n FROM push_subs'),
  tutte: db.prepare('SELECT endpoint, sub FROM push_subs'),
};

// Dell'iscrizione ricevuta dal browser si salvano solo endpoint (https) e le due chiavi: nient'altro dal body.
const testo = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
function pulisci(sub) {
  const e = sub?.endpoint, k = sub?.keys;
  let ok = testo(e, 2048) && testo(k?.p256dh, 200) && testo(k?.auth, 100);
  if (ok) { try { ok = new URL(e).protocol === 'https:'; } catch { ok = false; } }
  if (!ok) throw nonValido('Iscrizione alle notifiche non valida: disattiva e riattiva le notifiche dal telefono');
  return { endpoint: e, keys: { p256dh: k.p256dh, auth: k.auth } };
}
const salva = (sub) => { const s = pulisci(sub); q.salva.run(s.endpoint, JSON.stringify(s)); };
const rimuovi = (endpoint) => q.rimuovi.run(String(endpoint ?? ''));
const quanti = () => q.quanti.get().n;

async function invia(titolo, testo) {
  const subs = q.tutte.all();
  for (const s of subs) {
    try { await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify({ titolo, testo })); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) rimuovi(s.endpoint); else addLog('errore', 'push: ' + e.message); }
  }
  return subs.length;
}
module.exports = { publicKey, salva, rimuovi, quanti, invia, pulisci };
