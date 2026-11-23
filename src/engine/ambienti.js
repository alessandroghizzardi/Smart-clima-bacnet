// Validazione degli ambienti (pura, senza accesso al database).
function valida(b, noteUnita, esistenti, idCorrente = null) {
  const nome = String(b.nome ?? '').trim().replace(/\s+/g, ' ');
  if (!nome) throw new Error('Dai un nome all\'ambiente');
  if (nome.length > 40) throw new Error('Nome troppo lungo (max 40 caratteri)');
  if (esistenti.some(a => a.id !== String(idCorrente) && a.nome.toLowerCase() === nome.toLowerCase())) throw new Error('Esiste già un ambiente con questo nome');
  if (!Array.isArray(b.unita) || !b.unita.length) throw new Error('Scegli almeno un\'unità');
  const unita = [...new Set(b.unita.map(String))];
  const ignota = unita.find(u => !noteUnita[u]); if (ignota) throw new Error('unità sconosciuta ' + ignota);
  return { nome, unita };
}
module.exports = { valida };
