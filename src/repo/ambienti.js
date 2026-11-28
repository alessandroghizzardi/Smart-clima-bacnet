// Accesso ai dati degli ambienti (gruppi di unità) in SQLite. Nessuna logica di business qui.
const { db, tx } = require('../db');

const q = {
  tutti: db.prepare('SELECT id, nome FROM ambienti ORDER BY ordine, id'),
  legami: db.prepare('SELECT ambiente, unita FROM ambienti_unita'),
  uno: db.prepare('SELECT id, nome FROM ambienti WHERE id=?'),
  unitaDi: db.prepare('SELECT unita FROM ambienti_unita WHERE ambiente=?'),
  ins: db.prepare('INSERT INTO ambienti (nome, ordine) VALUES (?, (SELECT COALESCE(MAX(ordine), 0) + 1 FROM ambienti))'),
  ord: db.prepare('UPDATE ambienti SET ordine=? WHERE id=?'),
  ren: db.prepare('UPDATE ambienti SET nome=? WHERE id=?'),
  del: db.prepare('DELETE FROM ambienti WHERE id=?'),
  insU: db.prepare('INSERT INTO ambienti_unita (ambiente, unita) VALUES (?,?)'),
  delU: db.prepare('DELETE FROM ambienti_unita WHERE ambiente=?'),
};
// ordine delle unità = ordine dell'impianto, non quello di inserimento
let ordine = [];
const ordina = (ids) => [...ids].sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b));
const scriviUnita = (id, unita) => { q.delU.run(id); for (const u of unita) q.insU.run(id, u); };

module.exports = {
  imposta: (ids) => { ordine = ids; },
  elenco() {
    const per = {}; for (const r of q.legami.all()) (per[r.ambiente] ||= []).push(r.unita);
    return q.tutti.all().map(a => ({ id: String(a.id), nome: a.nome, unita: ordina(per[a.id] || []) }));
  },
  trova(id) { const a = q.uno.get(id); return a && { id: String(a.id), nome: a.nome, unita: ordina(q.unitaDi.all(id).map(r => r.unita)) }; },
  crea: (nome, unita) => tx(() => { const id = Number(q.ins.run(nome).lastInsertRowid); scriviUnita(id, unita); return String(id); }),
  aggiorna: (id, nome, unita) => tx(() => { q.ren.run(nome, id); scriviUnita(id, unita); }),
  riordina: (ids) => tx(() => ids.forEach((id, i) => q.ord.run(i + 1, id))),
  elimina: (id) => tx(() => { q.delU.run(id); q.del.run(id); }),
};
