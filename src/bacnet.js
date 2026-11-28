const Bacnet = require('node-bacnet');
const cfg = require('./config');
const mode = require('./mode');
const { limita } = require('./engine/logic');
const mappa = cfg.leggiFile('bacnet-map');

const PRESENT_VALUE = 85;
// tag applicativi BACnet: 4 = REAL, 9 = ENUMERATED, 2 = UNSIGNED_INT
// modeCmd e fanCmd sono multi-state-value (tipo 14): il valore si scrive come UNSIGNED, non ENUMERATED (altrimenti INVALID_DATA_TYPE)
const TAG = { UNSIGNED: 2, REAL: 4, ENUM: 9 };

const ipImpianto = () => { if (!cfg.bacnet.ip) throw new Error('IP del gateway BACnet non configurato (AC_IP nel file .env o Impostazioni nell\'app)'); return cfg.bacnet.ip; };

// Il client UDP si crea alla prima richiesta. Dopo ERRORI_RICREA errori di fila (o un errore del socket) si chiude
// e il successivo si ricrea da zero: così un socket rimasto in uno stato strano non blocca l'app fino al riavvio.
const ERRORI_RICREA = 3;
let client, errori = 0;
function chiudiClient() { try { client && client.close(); } catch { /* già chiuso */ } client = null; errori = 0; }
function getClient() {
  if (!client) {
    const o = { port: cfg.bacnet.localPort, apduTimeout: cfg.bacnet.timeoutMs };
    if (cfg.bacnet.iface) o.interface = cfg.bacnet.iface;
    client = new Bacnet(o);
    client.on('error', e => { console.error('[bacnet] errore del socket:', e.message); chiudiClient(); });
  }
  return client;
}
const p = (fn) => new Promise((res, rej) => fn((err, v) => err ? rej(err) : res(v)));
const conta = (pr) => pr.then(v => { errori = 0; return v; }, e => { if (++errori >= ERRORI_RICREA) chiudiClient(); throw e; });

// Coda: una richiesta BACnet alla volta, per non affollare l'impianto
let coda = Promise.resolve();
const serializza = (fn) => { const r = coda.then(() => conta(fn())); coda = r.catch(() => {}); return r; };

// Valore di una proprietà letta; null se manca o non è un valore semplice (lettura mancante, non un errore).
function valoreDa(entry) {
  const v = entry?.value?.[0]?.value;
  return v === undefined || v === null || typeof v === 'object' ? null : v;
}

// Legge lo stato di tutte le unità con una sola richiesta ReadPropertyMultiple
async function leggiStato() {
  const unita = Object.keys(mappa);
  const voci = ['startStopStatus', 'setTempStatus', 'roomTemp', 'modeStatus', 'fanStatus', 'swingStatus', 'alarm'];
  const richiesta = [];
  for (const u of unita) for (const v of voci)
    richiesta.push({ objectId: { type: mappa[u][v].type, instance: mappa[u][v].instance }, properties: [{ id: PRESENT_VALUE }] });
  // la lettura è idempotente: un timeout isolato si ritenta una volta (le scritture invece mai)
  const leggi = () => serializza(() => p(cb => getClient().readPropertyMultiple(ipImpianto(), richiesta, cb)));
  const res = await leggi().catch(e => /TIMEOUT/.test(e.message) ? leggi() : Promise.reject(e));
  if (!res || !Array.isArray(res.values)) throw new Error('risposta BACnet incompleta (nessun valore)');
  const perOggetto = new Map();
  for (const o of res.values) if (o?.objectId) perOggetto.set(`${o.objectId.type}:${o.objectId.instance}`, valoreDa(o.values?.[0]));
  const out = {};
  for (const u of unita) {
    const g = (v) => perOggetto.get(`${mappa[u][v].type}:${mappa[u][v].instance}`) ?? null;
    const num = (v) => { const x = g(v); return typeof x === 'number' && Number.isFinite(x) ? x : null; };
    out[u] = {
      acceso: g('startStopStatus') === 1,
      setpoint: num('setTempStatus'),
      temp: num('roomTemp'),
      modo: g('modeStatus'),      // 1 COOL, 2 DRY, 3 FAN, 4 AUTO, 5 HEAT
      ventola: g('fanStatus'),    // 1 LOW, 2 MIDDLE, 3 HIGH, 4 AUTO
      oscillazione: g('swingStatus') === 1,   // solo on/off: l'impianto non espone "Auto"
      allarme: g('alarm') === 1,
    };
  }
  return out;
}

async function scrivi(unita, voce, tag, valore) {
  mode.richiedi();
  const o = mappa[unita] && mappa[unita][voce];
  if (!o) throw new Error(`unità o voce sconosciuta: ${unita}/${voce}`);
  if (!Number.isFinite(valore)) throw new Error(`valore non valido per ${unita}/${voce}: ${valore}`);   // mai NaN verso l'impianto
  await serializza(() => p(cb => getClient().writeProperty(ipImpianto(),
    { type: o.type, instance: o.instance }, PRESENT_VALUE, [{ type: tag, value: valore }], cb)));
}

const accendi = (u, on) => scrivi(u, 'startStopCmd', TAG.ENUM, on ? 1 : 0);
const imposta = (u, t) => {
  const v = limita(t, cfg.setpoint);              // ultima difesa: numero finito, dentro i limiti, passi da 0,5
  return scrivi(u, 'setTempCmd', TAG.REAL, v).then(() => v);
};
const modo = (u, m) => scrivi(u, 'modeCmd', TAG.UNSIGNED, m);
const ventola = (u, f) => scrivi(u, 'fanCmd', TAG.UNSIGNED, f);
const oscillazione = (u, on) => scrivi(u, 'swingCmd', TAG.ENUM, on ? 1 : 0);

module.exports = { leggiStato, accendi, imposta, modo, ventola, oscillazione, unita: () => Object.keys(mappa), chiudi: chiudiClient };
