const cfg = require('./config');
const bac = require('./plant');
const { db, tx, addLog, kvGet, kvSet } = require('./db');
const push = require('./push');
const { byId } = require('./units');

const insLettura = db.prepare('INSERT INTO readings (ts,unit,temp,setpoint,acceso,modo,allarme) VALUES (?,?,?,?,?,?,?)');
const qUltimoTs = db.prepare('SELECT MAX(ts) ts FROM readings'), qLettureDi = db.prepare('SELECT * FROM readings WHERE ts=?');

// L'ultima lettura riuscita e lo storico della connessione sopravvivono al riavvio (kv), così con l'impianto fermo
// la schermata offline mostra ancora l'ultimo valore noto e i tentativi di prima del riavvio.
// Ultima lettura: kv 'ultimaLettura' (completa, salvata al più una volta al minuto); se manca, l'ultima riga dello storico.
function ultimaSalvata() {
  const k = kvGet('ultimaLettura'); if (k?.ts && k.stato) return k;
  const ts = qUltimoTs.get()?.ts; if (!ts) return null;
  const stato = {};
  for (const x of qLettureDi.all(ts)) stato[x.unit] = { temp: x.temp, setpoint: x.setpoint, acceso: !!x.acceso, modo: x.modo, allarme: !!x.allarme };
  return { ts, stato };
}
const salvata = ultimaSalvata();
let ultimo = { ts: salvata?.ts ?? null, stato: salvata?.stato ?? null, errore: null };   // ts e stato dell'ultima lettura riuscita; errore dell'ultima fallita
let salvataTs = salvata?.ts ?? 0;
const SALVA_ULTIMA_MS = 60e3;

// Connessione: letture fallite di fila (si avvisa solo dalla seconda), da quando, e l'esito per slot (barra "Connessione").
const STORIA_MS = 2 * 3600e3, SLOT_MS = 4 * 60e3;   // 30 barre, come nel design
const conn = { fallite: 0, koDa: null, slot: {}, ...kvGet('connessione') };
let raggiungibile = conn.fallite >= 2 ? false : null;   // null = non ancora noto; false dopo il riavvio = non si riavvisa
const avvisi = new Map();      // chiave -> timestamp ultimo avviso
const RIPETI_MS = 12 * 3600e3;

// Registra l'esito di un tentativo. Scrive su SQLite solo quando qualcosa cambia (nuovo slot, ok→ko, contatore fallite).
function segna(ok, t = Date.now()) {
  const k = Math.floor(t / SLOT_MS) * SLOT_MS, prima = conn.slot[k], esito = ok ? prima || 'ok' : 'ko';
  let cambia = prima !== esito;
  if (ok) { cambia ||= conn.fallite > 0; conn.fallite = 0; conn.koDa = null; }
  else { conn.fallite++; conn.koDa ||= t; cambia = true; }
  if (!cambia) return;
  conn.slot[k] = esito;
  for (const x of Object.keys(conn.slot)) if (Number(x) < t - STORIA_MS - SLOT_MS) delete conn.slot[x];
  kvSet('connessione', conn);
}

async function avvisa(chiave, titolo, testo) {
  const t = avvisi.get(chiave);
  if (t && Date.now() - t < RIPETI_MS) return;
  avvisi.set(chiave, Date.now());
  addLog('avviso', `${titolo}: ${testo}`);
  await push.invia(titolo, testo).catch(() => {});
}

// Una sola lettura alla volta: chi chiede mentre ce n'è una in corso (poll periodico o app aperta) aspetta quella,
// invece di accodarne un'altra (con l'impianto fermo ogni tentativo dura fino a 2 × timeout).
let inVolo = null, verificato = false;   // verificato: almeno un tentativo concluso da quando il server è partito
function leggi(salva = true) {
  const pr = leggiOra(salva).finally(() => { verificato = true; if (inVolo === pr) inVolo = null; });
  inVolo = pr;
  return pr;
}
async function leggiOra(salva) {
  try {
    const stato = await bac.leggiStato();
    const ts = Date.now();
    ultimo = { ts, stato, errore: null };
    segna(true, ts);
    if (salva || ts - salvataTs >= SALVA_ULTIMA_MS) { kvSet('ultimaLettura', { ts, stato }); salvataTs = ts; }
    if (raggiungibile === false) { addLog('avviso', 'Impianto di nuovo raggiungibile'); push.invia('Impianto ok', 'Letture ripristinate').catch(() => {}); }
    raggiungibile = true;
    if (salva) {
      addLog('lettura', `${Object.keys(stato).length} unità lette`);
      tx(() => { for (const [u, s] of Object.entries(stato)) insLettura.run(ts, u, s.temp, s.setpoint, s.acceso ? 1 : 0, s.modo, s.allarme ? 1 : 0); });
      for (const [u, s] of Object.entries(stato)) {
        const nome = byId[u] ? byId[u].nome : u;
        if (s.allarme) await avvisa(`allarme-${u}`, 'Allarme unità', `${nome} segnala un allarme`);
        if (s.temp !== null && s.temp < cfg.frostAlertC) await avvisa(`gelo-${u}`, 'Temperatura bassa', `${nome}: ${s.temp} °C`);
      }
    }
    return ultimo;
  } catch (e) {
    ultimo = { ...ultimo, errore: e.message };
    segna(false);
    if (raggiungibile !== false && conn.fallite >= 2) { addLog('avviso', 'Impianto non raggiungibile: ' + e.message); push.invia('Impianto non raggiungibile', 'Ultima lettura ' + (ultimo.ts ? new Date(ultimo.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: cfg.timezone }) : 'mai')).catch(() => {}); }
    if (conn.fallite >= 2) raggiungibile = false;
    throw e;
  }
}
const avvia = () => {
  leggi().catch(() => {});
  setInterval(() => leggi().catch(() => {}), cfg.pollMinutes * 60e3);
};
// Lettura "viva" per l'app aperta: riusa una lettura in corso o recentissima, così più schermate non martellano l'impianto.
function leggiViva(maxEtaMs = 4000) {
  if (ultimo.ts && !ultimo.errore && Date.now() - ultimo.ts < maxEtaMs) return Promise.resolve(ultimo);
  return inVolo || leggi(false);
}

// Stato della connessione con l'impianto per l'app: tentativi falliti di fila, da quando, e 30 slot da 4 minuti
// (dal più vecchio al più recente, l'ultimo è quello in corso): 'ok', 'ko' (almeno un tentativo fallito) o null (nessun tentativo).
function connessione(ora = Date.now()) {
  const n = STORIA_MS / SLOT_MS, da = Math.floor(ora / SLOT_MS) * SLOT_MS - (n - 1) * SLOT_MS;
  const slot = Array.from({ length: n }, (_, i) => conn.slot[da + i * SLOT_MS] || null);
  return { fallite: conn.fallite, koDa: conn.koDa, slot, slotMinuti: SLOT_MS / 60e3, da };
}

module.exports = { leggi, leggiViva, avvia, ultimo: () => ultimo, connessione, inVerifica: () => !verificato };
