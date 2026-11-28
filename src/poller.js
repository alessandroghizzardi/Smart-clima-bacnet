const cfg = require('./config');
const bac = require('./plant');
const { db, tx, addLog } = require('./db');
const push = require('./push');
const { byId } = require('./units');

let ultimo = { ts: null, stato: null, errore: null };    // ts e stato dell'ultima lettura riuscita; errore dell'ultima fallita
let raggiungibile = null;      // null = non ancora noto
let fallite = 0;               // letture fallite di fila: si avvisa solo dalla seconda
let koDa = null;               // quando è iniziata la serie di letture fallite
const avvisi = new Map();      // chiave -> timestamp ultimo avviso
const RIPETI_MS = 12 * 3600e3;

// Storico dei tentativi delle ultime 2 ore (solo in memoria): alimenta la barra "Connessione" della schermata offline.
const STORIA_MS = 2 * 3600e3, SLOT_MS = 4 * 60e3;   // 30 barre, come nel design
let storia = [];
const segna = (ok) => { const t = Date.now(); storia.push({ ts: t, ok }); storia = storia.filter(x => x.ts > t - STORIA_MS); };

const insLettura = db.prepare('INSERT INTO readings (ts,unit,temp,setpoint,acceso,modo,allarme) VALUES (?,?,?,?,?,?,?)');

async function avvisa(chiave, titolo, testo) {
  const t = avvisi.get(chiave);
  if (t && Date.now() - t < RIPETI_MS) return;
  avvisi.set(chiave, Date.now());
  addLog('avviso', `${titolo}: ${testo}`);
  await push.invia(titolo, testo).catch(() => {});
}

async function leggi(salva = true) {
  try {
    const stato = await bac.leggiStato();
    const ts = Date.now();
    ultimo = { ts, stato, errore: null };
    segna(true);
    if (raggiungibile === false) { addLog('avviso', 'Impianto di nuovo raggiungibile'); push.invia('Impianto ok', 'Letture ripristinate').catch(() => {}); }
    raggiungibile = true; fallite = 0; koDa = null;
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
    fallite++; koDa ||= Date.now();
    if (raggiungibile !== false && fallite >= 2) { addLog('avviso', 'Impianto non raggiungibile: ' + e.message); push.invia('Impianto non raggiungibile', 'Ultima lettura ' + (ultimo.ts ? new Date(ultimo.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: cfg.timezone }) : 'mai')).catch(() => {}); }
    if (fallite >= 2) raggiungibile = false;
    throw e;
  }
}
const avvia = () => {
  leggi().catch(() => {});
  setInterval(() => leggi().catch(() => {}), cfg.pollMinutes * 60e3);
};
// Lettura "viva" per l'app aperta: riusa una lettura in corso o recentissima, così più schermate non martellano l'impianto.
let inVolo = null;
function leggiViva(maxEtaMs = 4000) {
  if (ultimo.ts && !ultimo.errore && Date.now() - ultimo.ts < maxEtaMs) return Promise.resolve(ultimo);
  return inVolo ||= leggi(false).finally(() => { inVolo = null; });
}

// Stato della connessione con l'impianto per l'app: tentativi falliti di fila, da quando, e 30 slot da 4 minuti
// (dal più vecchio al più recente): 'ok', 'ko' (almeno un tentativo fallito) o null (nessun tentativo in quello slot).
function connessione(ora = Date.now()) {
  const n = STORIA_MS / SLOT_MS, inizio = ora - STORIA_MS, slot = Array(n).fill(null);
  for (const x of storia) {
    const i = Math.floor((x.ts - inizio) / SLOT_MS); if (i < 0 || i >= n) continue;
    slot[i] = !x.ok ? 'ko' : slot[i] || 'ok';
  }
  return { fallite, koDa, slot, slotMinuti: SLOT_MS / 60e3, da: inizio };
}

module.exports = { leggi, leggiViva, avvia, ultimo: () => ultimo, connessione };
