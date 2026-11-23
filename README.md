# Smart Clima

App web (PWA) per controllare un impianto di climatizzazione **LG VRF via BACnet/IP** dal telefono: stato delle unità, comandi, grafico delle temperature, scenari a fasi con orari, notifiche push (gelo, allarmi, impianto non raggiungibile).

- Backend Node.js (Express 5, `node:sqlite`, `node-bacnet`, `web-push`), frontend HTML/CSS/JS senza build, Chart.js.
- Tutto in locale: nessun servizio esterno, database SQLite in un solo file.
- Parte in **sola lettura**: i comandi all'impianto vanno abilitati esplicitamente dall'app.
- Pensata per un impianto con più unità interne collegate a un gateway BACnet LG (testata con 13 unità).

Come funziona nel dettaglio: [ARCHITETTURA.md](ARCHITETTURA.md). Scenari e fasi: [NOTE_SCENARI.md](NOTE_SCENARI.md).

## Requisiti

- **Node.js 24 o superiore** (serve `node:sqlite`).
- Un computer o un Raspberry Pi nella stessa rete del gateway BACnet LG (UDP, porta 47808 dell'impianto).
- Per le notifiche push: l'app deve essere servita in **HTTPS** (vedi sotto).

## Installazione

```bash
git clone https://github.com/alessandroghizzardi/Smart-clima-bacnet.git
cd Smart-clima-bacnet
npm install
npm run setup
```

`npm run setup` prepara una installazione nuova e si può rilanciare senza rischi (non sovrascrive nulla):

| Crea | Da | Contenuto |
|---|---|---|
| `.env` | `.env.example` | nome del sito, IP del gateway, porta |
| `config/units.json` | `config/units.example.json` | elenco delle unità interne (id, nome, piano, potenza) |
| `config/bacnet-map.json` | `config/bacnet-map.example.json` | indirizzi BACnet dei punti di ogni unità |
| `data/smart-clima.db` | – | **database vuoto** con lo schema già pronto e le chiavi VAPID per le notifiche |

Il database non fa parte del repository: viene creato dallo script (o al primo avvio, se non esiste).

## Configurazione

1. **`.env`**: imposta almeno `AC_IP` (IP del gateway BACnet). Opzionali: `SITE_NAME` (nome mostrato in app, titolo, icona PWA, notifiche), `PORT`, `HOST`, `TZ`, `DB_PATH`, `VAPID_SUBJECT`. Tutte le voci sono commentate in `.env.example`.
2. **`config/units.json`**: un elemento per unità interna. `id` è l'indirizzo dell'unità sul gateway; `nome`, `stanza`, `piano` e `kw` sono etichette tue.
3. **`config/bacnet-map.json`**: per ogni `id`, il tipo e l'istanza BACnet dei punti (accensione, setpoint, temperatura, modo, ventola, oscillazione, allarme…). L'esempio usa la numerazione standard dei gateway LG; se il tuo impianto è diverso puoi rigenerare il file dall'elenco degli oggetti letto dal gateway:
   ```bash
   # metti l'elenco in scripts/oggetti-bacnet-letti.json, poi:
   node scripts/gen-map.js
   ```
   Il file è un array di coppie `["tipo,istanza", {"object-name": "ac_<Voce>_<id>", ...}]`.
4. Dopo l'avvio, **IP, porta locale UDP, timeout, intervalli e soglie** si possono cambiare anche dall'app (*Altro → Impostazioni*, protette da una conferma): quei valori sono salvati nel database e hanno la precedenza su `.env`.

I file `.env`, `config/units.json`, `config/bacnet-map.json` e `data/` sono nel `.gitignore`: la configurazione del tuo impianto resta sulla tua macchina.

## Avvio

```bash
npm start
```

Apri `http://<ip-del-computer>:3000` dal telefono (stessa rete). Dal browser del telefono puoi poi *Aggiungi a Home* per installarla come app.

### Provare senza impianto

```bash
npm run mock
```

Avvia l'app sulla porta 3100 con un **impianto simulato in memoria** e un database temporaneo: non apre alcun socket BACnet e non tocca l'impianto reale. Ideale per provare l'interfaccia e gli scenari.

### Prima prova sull'impianto reale

L'app parte in sola lettura. Per controllare che la connessione funzioni senza inviare comandi:

```bash
node --env-file-if-exists=.env scripts/prova-lettura.js
```

Per inviare comandi all'impianto occorre attivare la scrittura dall'app (*Altro → modalità*). Fallo con calma, un comando alla volta.

## Modalità sola lettura / scrittura

Ogni comando (setpoint, accensione, modo, scenari) passa dal server, che lo blocca con errore 403 finché la scrittura non è attiva. In sola lettura il motore degli scenari è in pausa.

## Notifiche push e accesso da fuori casa

- Le notifiche push richiedono **HTTPS** (con l'eccezione di `localhost`). Per usarle dal telefono serve un indirizzo HTTPS, per esempio tramite un reverse proxy o un tunnel con dominio fisso.
- **L'app non ha un login.** Con la scrittura attiva chiunque raggiunga l'indirizzo può comandare l'impianto: non esporla su internet senza un'autenticazione davanti (autenticazione del proxy/tunnel, OAuth, basic auth) o una VPN.
- Le chiavi VAPID vengono generate al primo avvio e salvate nel database. Se perdi il database, i telefoni dovranno riattivare le notifiche.

## Installazione su Raspberry Pi

Installa Node 24 (per esempio con `nvm`, senza `sudo`), poi ripeti i passi di installazione. Per l'avvio automatico, un servizio systemd di esempio:

```ini
[Unit]
Description=Smart Clima
After=network-online.target

[Service]
WorkingDirectory=/home/pi/Smart-clima-bacnet
ExecStart=/home/pi/.nvm/versions/node/v24.0.0/bin/node --env-file-if-exists=.env src/server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Adatta percorsi, utente e versione di Node al tuo sistema.

## Aggiornare

```bash
git pull
npm install
```

Poi riavvia il server. Se l'app sembra non aggiornarsi, ricarica la pagina senza cache (Cmd/Ctrl+Shift+R): la PWA tiene una copia dei file.

## Deploy automatico (Raspberry)

Scheletro in `.github/workflows/`: `ci.yml` esegue i test su ogni PR; il deploy parte **solo quando si pubblica un tag `v*`** (es. `git tag v1.0.0 && git push origin v1.0.0`, da `main`): `deploy.sh` (via `deploy.yml`) copia il codice sul Raspberry e riavvia il servizio, tramite un runner GitHub self-hosted con label `smart-clima`. Il deploy resta spento finché non imposti le variabili di repository `DEPLOY_ENABLED=true` e `DEPLOY_DIR`. Configurazione, dati e `.env` sul Raspberry non vengono mai sovrascritti.

## Sviluppo

Si lavora su branch `feature/<nome>` e si porta in `main` con una pull request.

```bash
npm test        # test della logica degli scenari (nessun impianto necessario)
npm run mock    # app completa con impianto simulato
```

Struttura: `src/` (server, motore scenari, adattatori BACnet e simulato), `public/` (PWA), `config/` (esempi di configurazione), `scripts/` (setup e strumenti), `test/`.
