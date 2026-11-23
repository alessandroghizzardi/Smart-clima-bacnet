// Impianto simulato in memoria, stessa interfaccia di bacnet.js. Non apre alcun socket: sicuro per le prove.
const mappa = require('./config').leggiFile('bacnet-map');

const stato = {};
for (const u of Object.keys(mappa)) stato[u] = { acceso: false, setpoint: 19, temp: 14 + (Number(u) % 5) * 0.6, modo: 5, ventola: 4, oscillazione: false, allarme: false };
let ultimoTick = Date.now();

// ogni lettura fa evolvere la temperatura verso il setpoint (se acceso) o verso 12 °C (se spento)
function evolvi() {
  const dt = Math.min((Date.now() - ultimoTick) / 60000, 30); ultimoTick = Date.now();
  for (const s of Object.values(stato)) {
    const meta = s.acceso ? s.setpoint : 12;
    s.temp = Math.round((s.temp + (meta - s.temp) * Math.min(1, 0.04 * dt)) * 10) / 10;
  }
}
const clone = () => JSON.parse(JSON.stringify(stato));
const leggiStato = async () => { evolvi(); return clone(); };
const prendi = (u) => { if (!stato[u]) throw new Error(`unità sconosciuta: ${u}`); return stato[u]; };
const accendi = async (u, on) => { prendi(u).acceso = !!on; };
const imposta = async (u, t) => { const v = Math.round(Math.min(26, Math.max(16, Number(t))) * 2) / 2; prendi(u).setpoint = v; return v; };
const modo = async (u, m) => { prendi(u).modo = m; };
const ventola = async (u, f) => { prendi(u).ventola = f; };
const oscillazione = async (u, on) => { prendi(u).oscillazione = !!on; };
// solo per i test: forza la temperatura di una unità
const _forza = (u, temp) => { prendi(u).temp = temp; };
module.exports = { leggiStato, accendi, imposta, modo, ventola, oscillazione, unita: () => Object.keys(stato), chiudi: () => {}, _forza };
