// Accesso ai dati degli scenari a fasi (SQLite). Nessuna logica di business qui.
const { db } = require('../db');

const leggi = (r) => r && ({ id: r.id, nome: r.nome, modo: r.modo, giorni: JSON.parse(r.giorni), gruppo: r.gruppo, unita: JSON.parse(r.unita), fasi: JSON.parse(r.fasi) });
const q = {
  tutti: db.prepare('SELECT * FROM scenari ORDER BY id'),
  uno: db.prepare('SELECT * FROM scenari WHERE id=?'),
  ins: db.prepare('INSERT INTO scenari (nome,modo,giorni,gruppo,unita,fasi,creato) VALUES (?,?,?,?,?,?,?)'),
  upd: db.prepare('UPDATE scenari SET nome=?,modo=?,giorni=?,gruppo=?,unita=?,fasi=? WHERE id=?'),
  del: db.prepare('DELETE FROM scenari WHERE id=?'),
};
const args = (s) => [s.nome, s.modo, JSON.stringify(s.giorni), s.gruppo, JSON.stringify(s.unita), JSON.stringify(s.fasi)];

module.exports = {
  elenco: () => q.tutti.all().map(leggi),
  trova: (id) => leggi(q.uno.get(id)),
  crea: (s) => Number(q.ins.run(...args(s), Date.now()).lastInsertRowid),
  aggiorna: (id, s) => q.upd.run(...args(s), id),
  elimina: (id) => q.del.run(id),
};
