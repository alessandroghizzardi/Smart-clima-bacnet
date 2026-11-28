const cfg = require('./config');
const { db, tx, addLog } = require('./db');
const ambienti = require('./repo/ambienti');
const { nonValido, nonTrovato } = require('./errori');

// Le unità dell'impianto stanno nel database (tabella `unita`). A tabella vuota (primo avvio) si crea un'unità
// per ogni id di bacnet-map, con nome provvisorio ("Unità 11"): nomi e ordine si cambiano poi nel database.
const q = {
  tutte: db.prepare('SELECT id, nome FROM unita ORDER BY ordine, CAST(id AS INTEGER), id'),
  ins: db.prepare('INSERT INTO unita (id, nome, ordine) VALUES (?, ?, ?)'),
};
if (!q.tutte.all().length) {
  const ids = Object.keys(cfg.leggiFile('bacnet-map'));
  tx(() => ids.forEach((id, i) => q.ins.run(id, `Unità ${id}`, i + 1)));
  addLog('avviso', `${ids.length} unità create da bacnet-map con nomi provvisori`);
}

const unita = q.tutte.all().map(r => ({ id: r.id, nome: r.nome }));
const byId = Object.fromEntries(unita.map(u => [u.id, u]));
ambienti.imposta(unita.map(u => u.id));
function risolvi(target) {            // 'all' | 'group:<id ambiente>' | 'unit:15'
  if (target === 'all') return unita.map(u => u.id);
  const [tipo, id] = String(target).split(':');
  if (tipo === 'unit') { if (!byId[id]) throw nonTrovato(`L'unità ${id} non fa parte dell'impianto: ricarica la pagina e riprova`); return [id]; }
  if (tipo === 'group') { const g = ambienti.trova(id); if (!g) throw nonTrovato('Ambiente non trovato: forse è stato eliminato da un altro telefono. Ricarica la pagina'); return g.unita; }
  throw nonValido('Comando senza destinazione: scegli un\'unità, un ambiente o tutto l\'impianto');
}
module.exports = { unita, byId, risolvi, gruppi: ambienti.elenco };
