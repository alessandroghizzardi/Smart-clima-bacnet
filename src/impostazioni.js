// Impostazioni di sistema modificabili dall'app. I valori stanno nella tabella `impostazioni` (SQLite);
// all'avvio sovrascrivono i default di config.js (che a loro volta vengono dalle variabili d'ambiente).
const cfg = require('./config');

// riavvio: true = il valore viene letto solo all'avvio del server
const DEF = [
  // indirizzo e porta del server NON sono modificabili da qui: un valore errato renderebbe l'app irraggiungibile (restano in config.js / variabili d'ambiente)
  { k: 'bacnet_ip', gruppo: 'Impianto (BACnet)', label: 'IP del gateway', tipo: 'testo', path: ['bacnet', 'ip'], riavvio: true, ip: true },
  { k: 'bacnet_porta_locale', gruppo: 'Impianto (BACnet)', label: 'Porta locale UDP', tipo: 'int', min: 1, max: 65535, path: ['bacnet', 'localPort'], riavvio: true, aiuto: 'Diversa dalla 47808 dell\'impianto' },
  { k: 'bacnet_timeout', gruppo: 'Impianto (BACnet)', label: 'Timeout risposta (ms)', tipo: 'int', min: 500, max: 60000, path: ['bacnet', 'timeoutMs'], riavvio: true },
  { k: 'poll_minuti', gruppo: 'Cicli automatici', label: 'Lettura storico (minuti)', tipo: 'int', min: 1, max: 240, path: ['pollMinutes'], riavvio: true },
  { k: 'controllo_minuti', gruppo: 'Cicli automatici', label: 'Ciclo scenario attivo (minuti)', tipo: 'int', min: 1, max: 60, path: ['controlMinutes'], riavvio: true },
  { k: 'gelo', gruppo: 'Avvisi e limiti', label: 'Allerta gelo: notifica sotto (°C)', tipo: 'num', min: -10, max: 15, path: ['frostAlertC'] },
  { k: 'sp_min', gruppo: 'Avvisi e limiti', label: 'Setpoint minimo (°C)', tipo: 'num', min: 5, max: 30, path: ['setpoint', 'min'] },
  { k: 'sp_max', gruppo: 'Avvisi e limiti', label: 'Setpoint massimo (°C)', tipo: 'num', min: 5, max: 35, path: ['setpoint', 'max'] },
];

const prendi = (p) => p.reduce((o, k) => o[k], cfg);
const metti = (p, v) => { const o = p.slice(0, -1).reduce((o, k) => o[k], cfg); o[p[p.length - 1]] = v; };

function pulisci(d, raw) {
  if (d.tipo === 'testo') {
    const s = String(raw ?? '').trim();
    if (!s) throw new Error(`${d.label}: valore vuoto`);
    if (d.ip && !/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) throw new Error(`${d.label}: indirizzo IP non valido`);
    return s;
  }
  const n = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(n) || n < d.min || n > d.max || (d.tipo === 'int' && !Number.isInteger(n))) throw new Error(`${d.label}: deve essere tra ${d.min} e ${d.max}`);
  return n;
}

function applica(db) {
  db.exec('CREATE TABLE IF NOT EXISTS impostazioni (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL, aggiornato INTEGER NOT NULL)');
  for (const r of db.prepare('SELECT chiave, valore FROM impostazioni').all()) {
    const d = DEF.find(x => x.k === r.chiave); if (!d) continue;
    try { metti(d.path, pulisci(d, JSON.parse(r.valore))); } catch { /* valore non valido: resta il default */ }
  }
}

// Valori attuali + quelli all'avvio (per capire se serve riavviare)
const avvio = {};
function elenco() {
  return DEF.map(d => ({ k: d.k, gruppo: d.gruppo, label: d.label, tipo: d.tipo, aiuto: d.aiuto || null, riavvio: !!d.riavvio, min: d.min, max: d.max, valore: prendi(d.path), daRiavviare: d.riavvio && avvio[d.k] !== prendi(d.path) }));
}
function ricordaAvvio() { for (const d of DEF) avvio[d.k] = prendi(d.path); }

function salva(db, patch) {
  const nuovi = {};
  for (const [k, raw] of Object.entries(patch || {})) {
    const d = DEF.find(x => x.k === k); if (!d) throw new Error('impostazione sconosciuta: ' + k);
    nuovi[k] = pulisci(d, raw);
  }
  const get = (k, p) => k in nuovi ? nuovi[k] : prendi(p);
  if (get('sp_min', ['setpoint', 'min']) >= get('sp_max', ['setpoint', 'max'])) throw new Error('Il setpoint minimo deve essere inferiore al massimo');
  const ins = db.prepare('INSERT INTO impostazioni (chiave,valore,aggiornato) VALUES (?,?,?) ON CONFLICT(chiave) DO UPDATE SET valore=excluded.valore, aggiornato=excluded.aggiornato');
  const cambi = [];
  for (const [k, v] of Object.entries(nuovi)) {
    const d = DEF.find(x => x.k === k);
    if (prendi(d.path) === v) continue;
    cambi.push(`${d.label}: ${prendi(d.path)} → ${v}`);
    ins.run(k, JSON.stringify(v), Date.now()); metti(d.path, v);
  }
  return cambi;
}
module.exports = { applica, elenco, salva, ricordaAvvio };
