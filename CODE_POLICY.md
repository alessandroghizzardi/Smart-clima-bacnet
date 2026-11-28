# Code policy · Smart Clima

Regole per chi scrive codice in questo progetto (persone e Claude). Completano
[ARCHITETTURA.md](ARCHITETTURA.md), che descrive *com'è fatto* il sistema; qui
c'è *come si scrive*. In caso di dubbio vince la sicurezza dell'impianto.

## 1. Impianto e BACnet

- **Ogni comando verso l'impianto passa da un solo punto**: `src/plant.js` → `bacnet.js`
  (o `mock-plant.js`). Nessun altro modulo parla con BACnet.
- **Mai scrivere un valore non validato.** Prima di qualsiasi scrittura: numero finito,
  dentro i limiti di `cfg.setpoint`, arrotondato a 0,5 °C. Il limite si calcola con
  **una sola funzione condivisa**, mai riscritta a mano.
- **Rispettare la sola lettura**: ogni scrittura passa da `mode.richiedi()`.
- **Un solo ciclo di controllo alla volta**: tutto ciò che chiama `runner.controlla()`
  (timer, avvio, salto di fase, stop) passa dallo stesso blocco esclusivo: `runner.esclusivo()`.
- Le letture possono mancare o arrivare incomplete: il codice tratta `null`/`undefined`
  come "lettura mancante", non va in errore.

## 2. API (Express)

- **Validare l'input al bordo** (`server.js` o il modulo `valida` del dominio): tipi,
  intervalli, campi ammessi. Mai salvare un body così com'è.
- **Codici HTTP**: 400 dati non validi · 403 scrittura disattivata · 404 non trovato ·
  409 conflitto (es. scenario già attivo) · 503 impianto non raggiungibile · 500 solo per gli
  imprevisti. Gli errori si creano con gli helper di `src/errori.js`, che `wrap` riconosce.
- **Stato coerente anche se qualcosa fallisce**: si salva lo stato *dopo* che
  l'operazione è riuscita, oppure si chiude lo stato in un `finally` (es. una run
  interrotta non resta mai "attiva").
- Risposta d'errore sempre `{ errore: "<messaggio per l'utente>" }`.

## 3. Database (`node:sqlite`)

- Statement **preparati una volta** al caricamento del modulo, non a ogni chiamata.
- Più scritture che vanno insieme → **una transazione** (`BEGIN … COMMIT`, `ROLLBACK` in errore).
- Ogni tabella che cresce nel tempo ha una **potatura** (registro e letture: 3 mesi, `CONSERVA_GIORNI`).

## 4. Client (`public/`)

- Ogni riferimento a dati che possono sparire (ambienti, scenari, unità) è difensivo:
  `grp(id)?.nome`, con ritorno a una vista valida.
- Le chiamate di rete hanno sempre un `catch` che mostra un messaggio all'utente.
- Niente lavoro costoso a ogni poll: il grafico si aggiorna (`chart.update`) e si ricrea solo se
  cambiano serie o periodo; lo scenario attivo non si rilegge con la pagina nascosta.
- Le costanti di dominio (modalità, ventola, limiti) arrivano da `/api/config`,
  non si copiano nel client.
- Icone solo da `IC`; testi e misure seguono il design (Claude Design + `NOTE_SCENARI.md`).
- La versione della cache in `sw.js` è automatica (impronta dei file calcolata dal server):
  non va toccata a mano.

## 5. Messaggi all'utente

- **Italiano, frase completa, dice cosa fare**: «Scegli almeno un giorno», non «giorni mancanti».
- Mai testo tecnico o in inglese a schermo («Failed to fetch», «unità sconosciuta 15»,
  stack trace). Il dettaglio tecnico va nel registro (`db.addLog`) o in console.
- Toast: `ok` per conferme, `warn` per azioni non fatte, `err` per errori.
- Il registro usa lo stesso tono: cosa è successo e su quale unità/scenario.

## 6. Riuso e semplicità

- Prima di scrivere una funzione, cercare se esiste già (`limita`, `minuti`, `hhmm`, `fmt`…).
- Logica pura (decisioni, validazioni, calcolo fasi) in `src/engine/`, senza I/O, così si testa.
- Due blocchi quasi uguali → una funzione con un parametro.
- Nessun codice morto: variabili inutilizzate e funzioni non chiamate si tolgono (ESLint le segnala).

## 7. Test e controlli

- `npm test` e `npm run lint` devono passare prima di ogni PR (lo controlla la CI).
- Ogni bug corretto in `runner`, `scenes` o nelle API ha un test che lo riproduce,
  usando `mock-plant` al posto dell'impianto.
- Nuova logica in `src/engine/` → nuovi test in `test/`.

## 8. Git

- Si lavora su branch (`feature/…`, `fix/…`, `chore/…`) e si entra in `main` solo con PR.
- Commit e PR in italiano, al presente, che dicono cosa cambia per l'utente.
- Mai committare `.env`, `data/`, `config/units.json`, `config/bacnet-map.json`.
