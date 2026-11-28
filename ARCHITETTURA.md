# Smart Clima — Architettura e scelte

PWA per controllare un impianto di climatizzazione LG VRF via BACnet/IP (testata con 13 unità interne). Pensata per l'uso da smartphone; gira su un PC o su un Raspberry Pi.

## 1. Principi guida
| Principio | Come è applicato |
|---|---|
| Divisione delle competenze | Ogni strato fa una cosa sola (vedi §2); la logica di decisione è pura e non conosce rete, database o orologio. |
| Stabilità | L'impianto è l'unica risorsa "pericolosa": scrive solo con la *scrittura attiva* (si cambia dall'interfaccia, di default sola lettura, e viene ricordata al riavvio), solo i comandi *necessari* (diff con lo stato letto), con limiti 16–26 °C. Un solo ciclo di controllo alla volta. Lo stato dello scenario è su disco e sopravvive ai riavvii. |
| Velocità | SQLite locale (WAL, `synchronous=NORMAL`, `busy_timeout`), query preparate, nessuna chiamata di rete nelle letture dell'app: la pagina legge l'ultima fotografia in memoria. |
| Scalabilità | Strati sostituibili: un altro impianto = un altro adapter con la stessa interfaccia; più scenari = solo righe nel DB. Non serve altro: è un'app personale a 13 unità. |
| Codice pulito | JS semplice senza framework né build, moduli piccoli, nomi in italiano coerenti col dominio, test sulla logica pura. |

## 2. Strati
```
public/ (PWA: HTML+CSS+JS)  ──HTTP/JSON──>  src/server.js (route Express, validazione input)
                                              │
        ┌─────────────────────────────────────┼──────────────────────────────┐
  engine/runner.js (ciclo 5 min)       scenes.js (pianifica + esegue)   mode.js (sola lettura/scrittura)
        │  usa                               │ usa
  engine/logic.js (PURA)               plant.js ──> bacnet.js (reale)  |  mock-plant.js (simulato, MOCK=on)
        │                                     
  repo/scenari.js ─┐   poller.js ─┐   push.js ─┐
                   └──── db.js (node:sqlite, WAL) ────┘
```
- **plant.js** sceglie l'adapter: l'intero resto del codice parla con la stessa interfaccia (`leggiStato, accendi, imposta, modo, ventola`). Con `MOCK=on` non apre alcun socket: è la rete di sicurezza per provare tutto senza toccare l'impianto.
- **engine/logic.js** — funzioni pure: fasi a orario, "mantieni temperatura" con isteresi, lista minima di comandi, validazione. Testabile senza impianto (`npm test`).
- **engine/runner.js** — orchestrazione: legge, decide, esegue, salva lo stato (`kv.run`). Un solo scenario attivo, ciclo ogni `CONTROL_MINUTES` (5), flag anti-sovrapposizione. **Nessun avvio automatico**: uno scenario parte solo con `avvia()` ("Avvia ora"); da lì resta attivo e, finito il ciclo, attende (`inAttesa`) e riparte da solo nei suoi giorni all'ora della prima fase, finché non lo si interrompe. `avvia(id, {sostituisci:true})` interrompe lo scenario in corso, spegne le sue unità che il nuovo non usa e avvia il nuovo. Con la sola lettura il ciclo è in pausa; l'orario di riferimento è quello del server.
- **scenes.js** — traduce "voluto" in comandi minimi e li invia (`mode.richiedi()` blocca ogni comando in sola lettura, HTTP 403), scrivendo nel registro.
- **clock.js** — data/ora nel fuso dell'impianto (Europe/Rome); unica fonte di "adesso".
- **poller.js** — lettura periodica per lo storico (grafico) e avvisi (gelo, allarmi) con notifiche push.
- **public/app.js** — interfaccia senza framework: lo stato della vista (`TAB`, `SUB`, `SHEET`) si traduce in una rotta con hash (`#/stato`, `#/grafico`, `#/scenari`, `#/scenari/<id>`, `#/ambienti`, `#/altro`, `#/unita/<id>`). Ricaricando si torna alla stessa pagina; avanti/indietro del browser e il tasto ← dell'app usano la cronologia. Gli editor (scenario, fase, ambiente) non hanno rotta propria: ricaricando si torna alla pagina di partenza.

## 3. Dati (SQLite)
Tabelle: `readings` (storico), `scenari` (nome, modo, giorni, unità, fasi come JSON), `push_subs`, `log`, `kv` (stato run, giorno dell'ultimo ciclo partito per scenario). Le fasi sono JSON dentro lo scenario perché si leggono e scrivono sempre insieme: una tabella per fase darebbe solo join inutili. WAL = letture non bloccate dalle scritture; un solo processo scrive, quindi nessun conflitto.

## 4. Comportamento dello scenario
- Fase corrente dall'ora (`faseCorrente`); l'avanzamento può essere forzato ("Salta qui").
- Una fase è `{tipo:'temp', nome, fino, target, [inizio solo la prima], [mant:{target,temp,ritorno} oppure {target,spegni:true,ritorno}], [oscillazione]}` oppure `{tipo:'off'}`. **Spegnimento = fase** (una sola, ultima, senza orario proprio): spegne le unità dello scenario e lo scenario attende il prossimo giorno previsto. Le fasi possono **attraversare la mezzanotte** (sera → mattina): `confini()` aggiunge 24 h finché la fine non è dopo l'inizio. L'**oscillazione lamelle** (ferma / su–giù) è per fase; se assente non viene toccata.
- Modalità dello scenario: Raffrescamento o Riscaldamento (il motore ragiona su una temperatura da raggiungere). Le singole fasi possono essere anche `vent` o `deum` (a tempo, senza temperatura: accende e imposta la modalità, nessun setpoint) oppure `off`. Auto è esclusa. Auto resta nei comandi manuali.
- Per unità: **salita** (programma, sotto il target), **target**, **mantenimento** (raggiunto `mant.target` tiene `mant.temp`, oppure con `mant.spegni` spegne solo quell'unità; torna al programma, riaccesa, quando la stanza arriva a `mant.ritorno`). Tutto per singola unità, con la temperatura della sua stanza. Temperatura mancante = nessuna modifica.
- "Interrompi": chiede se spegnere (le unità dello scenario) o lasciare così.
- Avviare uno scenario mentre un altro è attivo apre il pannello "Cambiare scenario?": un solo tocco interrompe il vecchio, spegne le unità che il nuovo non usa e avvia il nuovo.
- **In sola lettura gli scenari sono solo consultabili**: non si creano, avviano o fermano e il motore resta in pausa. Nessuna simulazione.

## 5. Sicurezza
- Nessun comando in sola lettura (default all'avvio; modalità scelta dall'interfaccia, salvata in SQLite, controllata lato server in `src/mode.js`).
- L'app **non ha login**: prima di esporla con un tunnel o un reverse proxy va protetta (autenticazione del proxy, OAuth o basic auth).
- Input validati lato server (target, modalità 1–5, ventola 1–4, setpoint 16–26 passi 0,5, struttura scenari).

## 6. Limiti noti / scelte
- **Oscillazione lamelle**: punto BACnet presente (`config/bacnet-map.json`), ma solo binario: Ferma / Su–giù. "Auto" di AC Smart non è esposto via BACnet.
- L'ora in alto viene dal server (fuso impianto) + età dell'ultima lettura; non è letta dall'orologio dell'impianto.
- Funzioni classiche (programmi, weekend, scene) rimosse. "Altro" contiene notifiche push, registro eventi e stato impianto (ok / non raggiungibile).
- Ambienti (gruppi di unità) nel database: tabelle `ambienti` e `ambienti_unita`, gestiti dalla scheda «Ambienti» (API `/api/ambienti`, repo `src/repo/ambienti.js`, validazione `src/engine/ambienti.js`; ordine manuale col trascinamento (tocco prolungato), colonna `ordine`, `PUT /api/ambienti/ordine`). Non c'è codice di importazione: i gruppi storici sono stati inseriti nel database una volta a mano e `config/units.json` contiene solo le unità. Stato, Grafico e Scenari leggono l'elenco da `/api/config`. BACnet non espone i gruppi di AC Smart (vedi BACKLOG).
- **Aggiornamento dell'app**: con l'app aperta lo stato si rilegge dall'impianto ogni `POLL_S` secondi (solo se la pagina è visibile) tramite `/api/state?live=1`, che riusa una lettura recente (< 4 s) per non martellare l'impianto. "Aggiorna ora" forza la lettura e mostra una rotellina almeno 0,7 s.
- **Risposta immediata dei comandi**: dopo un comando l'interfaccia mostra subito il nuovo valore (stato `ATTESA`, max 25 s); le letture più vecchie non lo sovrascrivono finché l'impianto non conferma. Se il comando fallisce si torna al valore precedente e compare un avviso (toast).
- **Registro**: tiene gli ultimi 30 giorni (potatura all'avvio e ogni 6 ore), `/api/log` paginato a cursore con ricerca.
- La home mostra "unità accese" e "allarmi" (il setpoint medio è stato tolto: poco significativo con setpoint diversi).
- "Altro → Stato impianto": "Riprova" compare solo in caso di errore.

## 7. Test e prove
`npm test` (logica pura) e `npm run mock` (app completa su porta 3100 con impianto simulato e DB temporaneo).

## 8. Notifiche push
`web-push` con chiavi VAPID generate una volta e salvate in `kv`. I dispositivi si iscrivono con `/api/push/subscribe` (tabella `push_subs`); `push.invia()` manda a tutti e cancella gli iscritti che rispondono 404/410. Il service worker `public/sw.js` le mostra. Le genera `poller.js`: allarme unità, temperatura sotto la soglia gelo (default 10 °C, impostazione `gelo`), impianto non raggiungibile / di nuovo raggiungibile. Lo stesso avviso (per chiave) non si ripete prima di 12 ore. "Invia prova" in Altro → `/api/push/test`. Servono HTTPS e, su iPhone, l'app installata come PWA.

## Impostazioni di sistema
Server, porta, IP/porta BACnet, intervalli di lettura e soglie sono in tabella SQLite `impostazioni` (chiave, valore JSON, aggiornato). All'avvio `src/impostazioni.js` li applica sopra i default di `config.js` (env). Etichette in italiano, raggruppate (Impianto, Cicli automatici, Avvisi e limiti). Il setpoint min/max è validato anche sulle fasi degli scenari. Si modificano da Altro → "Zona pericolo" (toggle di sblocco; l'API rifiuta la PUT senza `pericolo: true`, valida tipo/intervallo e registra le modifiche nel registro). I valori letti solo all'avvio richiedono il riavvio del server.
