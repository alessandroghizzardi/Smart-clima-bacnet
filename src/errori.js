// Errori con un codice che `wrap` (server.js) traduce nello stato HTTP giusto. Un Error senza codice è un imprevisto (500).
// Il messaggio è per l'utente: frase completa in italiano che dice cosa fare (CODE_POLICY §5).
const HTTP = { VALIDAZIONE: 400, WRITES_OFF: 403, NON_TROVATO: 404, CONFLITTO: 409, IMPIANTO: 503 };
const crea = (code) => (msg) => Object.assign(new Error(msg), { code });

module.exports = {
  HTTP,
  nonValido: crea('VALIDAZIONE'),      // dati ricevuti non validi
  nonTrovato: crea('NON_TROVATO'),     // scenario, ambiente o unità che non esiste (più)
  conflitto: crea('CONFLITTO'),        // azione non possibile nello stato attuale (es. scenario già avviato)
  impianto: crea('IMPIANTO'),          // l'impianto non risponde o non accetta i comandi
};
