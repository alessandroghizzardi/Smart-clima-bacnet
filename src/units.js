const data = require('./config').leggiFile('units');
const ambienti = require('./repo/ambienti');
const { nonValido, nonTrovato } = require('./errori');
const unita = data.unita;
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
