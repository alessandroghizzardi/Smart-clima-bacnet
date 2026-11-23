// Prova di SOLA LETTURA dell'impianto
const b = require('../src/bacnet');
b.leggiStato().then(s => { console.table(s); b.chiudi(); process.exit(0); })
  .catch(e => { console.error('ERRORE', e.message); process.exit(1); });
