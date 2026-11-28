# Smart Clima

App web (PWA) per controllare 13 unità LG VRF via BACnet. Node 24, Express 5, `node:sqlite`, client vanilla JS.

- Leggi e segui **[CODE_POLICY.md](CODE_POLICY.md)** prima di scrivere codice.
- Architettura: [ARCHITETTURA.md](ARCHITETTURA.md). Logica degli scenari: [NOTE_SCENARI.md](NOTE_SCENARI.md).
- Rispondi e scrivi testi, commit e PR in italiano.
- Prova senza impianto: `npm run mock` (porta 3100). Prima di una PR: `npm test` e `npm run lint`.
- L'impianto è reale: nessun comando verso BACnet fuori da `src/plant.js`, mai valori non validati.
