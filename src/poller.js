const cfg = require('./config');
const bac = require('./plant');
const { db, addLog } = require('./db');
const push = require('./push');
const { byId } = require('./units');

let ultimo = { ts: null, stato: null, errore: null };
let raggiungibile = null;      // null = non ancora noto
let fallite = 0;               // letture fallite di fila: si avvisa solo dalla seconda
const avvisi = new Map();      // chiave -> timestamp ultimo avviso
const RIPETI_MS = 12 * 3600e3;

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
    if (raggiungibile === false) { addLog('avviso', 'Impianto di nuovo raggiungibile'); push.invia('Impianto ok', 'Letture ripristinate').catch(() => {}); }
    raggiungibile = true; fallite = 0;
    if (salva) {
      addLog('lettura', `${Object.keys(stato).length} unità lette`);
      const ins = db.prepare('INSERT INTO readings (ts,unit,temp,setpoint,acceso,modo,allarme) VALUES (?,?,?,?,?,?,?)');
      for (const [u, s] of Object.entries(stato)) ins.run(ts, u, s.temp, s.setpoint, s.acceso ? 1 : 0, s.modo, s.allarme ? 1 : 0);
      for (const [u, s] of Object.entries(stato)) {
        const nome = byId[u] ? byId[u].nome : u;
        if (s.allarme) await avvisa(`allarme-${u}`, 'Allarme unità', `${nome} segnala un allarme`);
        if (s.temp !== null && s.temp < cfg.frostAlertC) await avvisa(`gelo-${u}`, 'Temperatura bassa', `${nome}: ${s.temp} °C`);
      }
    }
    return ultimo;
  } catch (e) {
    ultimo = { ...ultimo, errore: e.message };
    fallite++;
    if (raggiungibile !== false && fallite >= 2) { addLog('avviso', 'Impianto non raggiungibile: ' + e.message); push.invia('Impianto non raggiungibile', 'Ultima lettura ' + (ultimo.ts ? new Date(ultimo.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : 'mai')).catch(() => {}); }
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

module.exports = { leggi, leggiViva, avvia, ultimo: () => ultimo };
