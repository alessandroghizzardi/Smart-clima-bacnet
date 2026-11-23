const data = require('./config').leggiFile('units');
const ambienti = require('./repo/ambienti');
const unita = data.unita;
const byId = Object.fromEntries(unita.map(u => [u.id, u]));
ambienti.imposta(unita.map(u => u.id));
function risolvi(target) {            // 'all' | 'group:<id ambiente>' | 'unit:15'
  if (target === 'all') return unita.map(u => u.id);
  const [tipo, id] = String(target).split(':');
  if (tipo === 'unit') { if (!byId[id]) throw new Error('unità sconosciuta ' + id); return [id]; }
  if (tipo === 'group') { const g = ambienti.trova(id); if (!g) throw new Error('ambiente sconosciuto ' + id); return g.unita; }
  throw new Error('target non valido: ' + target);
}
module.exports = { unita, byId, risolvi, gruppi: ambienti.elenco };
