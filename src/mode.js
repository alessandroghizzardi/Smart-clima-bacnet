// Modalità di controllo: "sola lettura" (default) oppure "scrittura attiva".
// Si cambia dall'interfaccia, viene salvata su SQLite e al riavvio si ritrova com'era.
const { kvGet, kvSet, addLog } = require('./db');

const attiva = () => kvGet('scrittura') === true;

function imposta(on) {
  kvSet('scrittura', !!on);
  addLog('comando', on ? 'modalità: scrittura attiva' : 'modalità: sola lettura');
  return attiva();
}

// Da chiamare prima di ogni comando verso l'impianto.
function richiedi() {
  if (!attiva()) throw Object.assign(new Error('Sola lettura: nessun comando inviato all\'impianto'), { code: 'WRITES_OFF' });
}

module.exports = { attiva, imposta, richiedi };
