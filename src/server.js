const fs = require('fs'), path = require('path'), crypto = require('crypto');
const express = require('express');
const cfg = require('./config');
const { db, addLog, pota } = require('./db');
const units = require('./units');
const bac = require('./plant');
const poller = require('./poller');
const scenes = require('./scenes');
const runner = require('./engine/runner');
const repoScenari = require('./repo/scenari');
const repoAmbienti = require('./repo/ambienti');
const vAmbiente = require('./engine/ambienti').valida;
const logic = require('./engine/logic');
const mode = require('./mode');
const push = require('./push');
const clock = require('./clock');
const impostazioni = require('./impostazioni');
const nomi = require('./engine/nomi');
const { HTTP, nonValido, nonTrovato, conflitto } = require('./errori');

const app = express();
app.use(express.json());
// Errori con codice (errori.js) → 400/403/404/409/503 con il loro messaggio, già scritto per l'utente.
// Tutto il resto è un imprevisto: dettaglio nel registro, a schermo un messaggio generico (CODE_POLICY §2 e §5).
const IMPREVISTO = 'Errore imprevisto del server: riprova. Se si ripete, guarda il registro in Altro';
function rispondiErrore(e, req, res) {
  const stato = HTTP[e.code];
  if (stato) return res.status(stato).json({ errore: e.message });
  console.error(e);
  addLog('errore', `${req.method} ${req.path}: ${e.message}`);
  res.status(500).json({ errore: IMPREVISTO });
}
const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch(e => rispondiErrore(e, req, res));

// ---- configurazione e stato
app.get('/api/config', (req, res) => res.json({
  nome: cfg.siteName, unita: units.unita, gruppi: repoAmbienti.elenco(), scrittura: mode.attiva(), pollMinutes: cfg.pollMinutes, controlMinutes: cfg.controlMinutes,
  setpoint: cfg.setpoint, frostAlertC: cfg.frostAlertC, push: { publicKey: push.publicKey(), iscritti: push.quanti() }, nomi,
}));
app.post('/api/scrittura', wrap((req, res) => res.json({ scrittura: mode.imposta(!!req.body.attiva) })));
// Con l'impianto offline risponde comunque 200: ultimo stato noto + `errore`, storico della connessione e ultimi
// avvisi/errori del registro, per la schermata «Impianto non raggiungibile».
const qErrori = db.prepare("SELECT rowid AS id, ts, tipo, testo FROM log WHERE tipo IN ('avviso','errore') ORDER BY rowid DESC LIMIT ?");
app.get('/api/state', wrap(async (req, res) => {
  const u = req.query.live === '1' ? await poller.leggiViva().catch(() => poller.ultimo()) : poller.ultimo();
  const offline = u.errore ? { connessione: poller.connessione(), erroriRecenti: qErrori.all(9) } : {};
  res.json({ ...u, ...offline, ora: clock.adesso(), tz: cfg.timezone, scrittura: mode.attiva() });
}));

// ---- storico temperature
// Una query per numero di unità richieste, preparata la prima volta e poi riusata.
const qStorico = new Map();
const storico = (n) => qStorico.get(n) || qStorico.set(n, db.prepare(`SELECT ts, unit, temp, setpoint, acceso FROM readings WHERE ts BETWEEN ? AND ? AND unit IN (${Array(n).fill('?').join(',')}) ORDER BY ts`)).get(n);
app.get('/api/history', (req, res) => {
  const a = Number(req.query.from) || Date.now() - 7 * 86400e3, b = Number(req.query.to) || Date.now();
  const lista = [...new Set(String(req.query.units || '').split(','))].filter(u => units.byId[u]);
  const ids = lista.length ? lista : units.unita.map(u => u.id);
  const q = storico(ids.length);
  const out = {}; ids.forEach(i => out[i] = []);
  for (const r of q.all(a, b, ...ids)) out[r.unit].push([r.ts, r.temp, r.setpoint, r.acceso]);
  res.json({ from: a, to: b, serie: out });
});

// ---- comandi diretti (unità, gruppo, tutto)
// Ogni campo è validato qui, al bordo: niente NaN, stringhe o valori fuori elenco verso l'impianto.
// Codice di modalità/ventola: solo un intero (numero o stringa numerica) presente nell'elenco. Object.hasOwn evita che
// nomi ereditati da ogni oggetto ("constructor", "toString") risultino validi; il controllo sul tipo esclude true → 1 e [2] → 2.
const codice = (v, elenco) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''))
  && Number.isInteger(Number(v)) && Object.hasOwn(elenco, Number(v));
function comandoValido(b) {
  const { target, power = null, setpoint = null, modo = null, ventola = null, oscillazione = null } = b || {};
  if (typeof target !== 'string' || !target) throw nonValido('Comando senza destinazione: scegli un\'unità, un ambiente o tutto l\'impianto');
  if (power !== null && power !== 'on' && power !== 'off') throw nonValido('Comando di accensione non valido: usa acceso o spento');
  if (setpoint !== null && (setpoint === '' || typeof setpoint === 'boolean' || !Number.isFinite(Number(setpoint)))) throw nonValido('Temperatura non valida: scegli un valore in gradi, per esempio 20,5');
  if (modo !== null && !codice(modo, nomi.modi)) throw nonValido('Modalità non valida: scegli tra raffrescamento, riscaldamento, ventilazione, deumidificazione e auto');
  if (ventola !== null && !codice(ventola, nomi.ventola)) throw nonValido('Velocità della ventola non valida: scegli tra bassa, media, alta e auto');
  if (oscillazione !== null && typeof oscillazione !== 'boolean') throw nonValido('Oscillazione non valida: può essere solo attiva o ferma');
  if ([power, setpoint, modo, ventola, oscillazione].every(v => v === null)) throw nonValido('Nessun comando da inviare');
  return { target, power, setpoint: setpoint === null ? null : Number(setpoint), modo: modo === null ? null : Number(modo), ventola: ventola === null ? null : Number(ventola), oscillazione };
}
app.post('/api/control', wrap(async (req, res) => {
  const c = comandoValido(req.body);
  const r = await scenes.esegui([c], `manuale ${c.target}`);
  poller.leggi(false).catch(() => {});
  res.json(r);
}));

const noteUnita = Object.fromEntries(units.unita.map(u => [u.id, true]));
const AMBIENTE_SPARITO = 'Ambiente non trovato: forse è stato eliminato da un altro telefono';
const SCENARIO_SPARITO = 'Scenario non trovato: forse è stato eliminato da un altro telefono';

// ---- ambienti (gruppi di unità, tutti modificabili)
app.get('/api/ambienti', (req, res) => res.json(repoAmbienti.elenco()));
app.post('/api/ambienti', wrap((req, res) => { const v = vAmbiente(req.body, noteUnita, repoAmbienti.elenco()); res.json({ id: repoAmbienti.crea(v.nome, v.unita) }); }));
app.put('/api/ambienti/ordine', wrap((req, res) => {
  const ids = (req.body.ids || []).map(String), ora = repoAmbienti.elenco().map(a => a.id);
  if (ids.length !== ora.length || ora.some(i => !ids.includes(i))) throw conflitto('L\'elenco degli ambienti è cambiato da un altro telefono: ricarica la pagina e riprova');
  repoAmbienti.riordina(ids); res.json({ ok: true });
}));
app.put('/api/ambienti/:id', wrap((req, res) => {
  if (!repoAmbienti.trova(req.params.id)) throw nonTrovato(AMBIENTE_SPARITO);
  const v = vAmbiente(req.body, noteUnita, repoAmbienti.elenco(), req.params.id); repoAmbienti.aggiorna(req.params.id, v.nome, v.unita); res.json({ ok: true });
}));
app.delete('/api/ambienti/:id', wrap((req, res) => { if (!repoAmbienti.trova(req.params.id)) throw nonTrovato(AMBIENTE_SPARITO); repoAmbienti.elimina(req.params.id); res.json({ ok: true }); }));

// ---- scenari a fasi e motore
app.get('/api/scenari', (req, res) => res.json(repoScenari.elenco()));
app.post('/api/scenari', wrap((req, res) => res.json({ id: repoScenari.crea(logic.valida(req.body, noteUnita, cfg.setpoint)) })));
app.put('/api/scenari/:id', wrap((req, res) => {
  if (!repoScenari.trova(req.params.id)) throw nonTrovato(SCENARIO_SPARITO);
  repoScenari.aggiorna(req.params.id, logic.valida(req.body, noteUnita, cfg.setpoint)); res.json({ ok: true });
}));
app.delete('/api/scenari/:id', wrap((req, res) => {
  const r = runner.run(); if (r && !r.concluso && String(r.scenario_id) === req.params.id) throw conflitto('Lo scenario è in corso: interrompilo prima di eliminarlo');
  repoScenari.elimina(req.params.id); res.json({ ok: true });
}));
app.get('/api/run', (req, res) => res.json(runner.situazione()));
// Avvio, stop e salto passano dal blocco esclusivo del runner; `avviso` = fatto, ma con qualche comando non riuscito.
app.post('/api/run/start', wrap(async (req, res) => { const e = await runner.avvia(Number(req.body.id), { sostituisci: !!req.body.sostituisci }); res.json({ ...runner.situazione(), avviso: e.avviso }); }));
app.post('/api/run/stop', wrap(async (req, res) => { const e = await runner.ferma({ spegni: !!req.body.spegni }); poller.leggi(false).catch(() => {}); res.json({ ...runner.situazione(), avviso: e.avviso }); }));
app.post('/api/run/salta', wrap(async (req, res) => { await runner.salta(Number(req.body.fase)); res.json(runner.situazione()); }));

// ---- notifiche push
app.post('/api/push/subscribe', wrap((req, res) => { push.salva(req.body); res.json({ ok: true }); }));
app.post('/api/push/unsubscribe', wrap((req, res) => { push.rimuovi(req.body.endpoint); res.json({ ok: true }); }));
app.post('/api/push/test', wrap(async (req, res) => res.json({ inviate: await push.invia('Prova notifica', 'Le notifiche funzionano') })));

// ---- impostazioni di sistema (tabella `impostazioni`); la modifica richiede la conferma esplicita "zona pericolo"
app.get('/api/impostazioni', (req, res) => res.json(impostazioni.elenco()));
app.put('/api/impostazioni', wrap((req, res) => {
  if (req.body.pericolo !== true) throw nonValido('Sblocca la zona pericolo per modificare le impostazioni');
  const cambi = impostazioni.salva(db, req.body.valori);
  if (cambi.length) addLog('impostazioni', 'Impostazioni modificate — ' + cambi.join('; '));
  res.json({ cambi: cambi.length, impostazioni: impostazioni.elenco() });
}));

// ---- registro
// Paginato a cursore: ?before=<id> per proseguire, ?q=<testo> per filtrare, 30 voci per pagina.
const qLog = db.prepare('SELECT rowid AS id, ts, tipo, testo FROM log WHERE rowid < ? AND testo LIKE ? ESCAPE \'\\\' ORDER BY rowid DESC LIMIT ?');
app.get('/api/log', (req, res) => {
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER, n = Math.min(Number(req.query.limit) || 30, 100), q = String(req.query.q || '');
  res.json(qLog.all(before, '%' + q.replace(/[\\%_]/g, '\\$&') + '%', n));
});

// index.html e manifest.json portano il nome configurato (SITE_NAME)
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const conNome = (file, fmt) => { const t = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8').replaceAll('{{NOME}}', fmt(cfg.siteName)); return t; };
const pagina = { html: conNome('index.html', esc), manifest: conNome('manifest.json', s => JSON.stringify(s).slice(1, -1)) };
app.get(['/', '/index.html'], (req, res) => res.type('html').send(pagina.html));
app.get('/manifest.json', (req, res) => res.type('application/manifest+json').send(pagina.manifest));
// Versione della cache del service worker: impronta dei file statici, così cambia da sola a ogni modifica (niente vNN a mano).
const pub = path.join(__dirname, '..', 'public');
const impronta = crypto.createHash('sha1');
for (const f of fs.readdirSync(pub).filter(f => fs.statSync(path.join(pub, f)).isFile()).sort()) impronta.update(f).update(fs.readFileSync(path.join(pub, f)));
const CHART_JS = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js');
impronta.update(cfg.siteName).update(fs.readFileSync(CHART_JS));
const VERSIONE = impronta.digest('hex').slice(0, 10);
const sw = fs.readFileSync(path.join(pub, 'sw.js'), 'utf8').replaceAll('{{VER}}', VERSIONE).replaceAll("'{{NOME}}'", JSON.stringify(cfg.siteName));
app.get('/sw.js', (req, res) => res.type('application/javascript').set('Cache-Control', 'no-cache').send(sw));
app.use('/vendor/chart.js', express.static(CHART_JS));
app.use(express.static(pub));
app.use('/api', (req, res) => res.status(404).json({ errore: 'Funzione non disponibile: aggiorna l\'app e riprova' }));
// JSON non valido nel body e altri errori di Express: sempre { errore } in italiano, mai una pagina HTML.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ errore: 'Richiesta non valida: ricarica la pagina e riprova' });
  rispondiErrore(err, req, res);
});

// Potatura di registro e letture storiche (ultimi 3 mesi), all'avvio e ogni 6 ore.
const potatura = () => { const n = pota(); if (n.log || n.letture) console.log(`[pulizia] tolte ${n.log} voci di registro e ${n.letture} letture oltre i 3 mesi`); };

function avviaServer() {
  const server = app.listen(cfg.port, cfg.host, () => {
    addLog('avvio', `app clima su http://${cfg.host}:${cfg.port} — scrittura ${mode.attiva() ? 'ATTIVA' : 'disattivata (sola lettura)'} — impianto ${cfg.mock ? 'simulato' : cfg.bacnet.ip || 'IP non configurato'}`);
    potatura(); setInterval(potatura, 6 * 3600e3).unref();
    poller.avvia(); runner.avviaTimer();
  });
  server.on('error', e => {
    console.error(e.code === 'EADDRINUSE' ? `La porta ${cfg.port} è già in uso: chiudi l'altra istanza o cambia PORT nel file .env` : `Avvio del server non riuscito: ${e.message}`);
    process.exit(1);
  });
  // Chiusura pulita (systemd, Ctrl+C): smette di accettare richieste, aspetta il ciclo scenario in corso (max 5 s),
  // poi chiude il socket BACnet e il database.
  let chiusura = false;
  const chiudi = async (segnale) => {
    if (chiusura) return; chiusura = true;
    addLog('avvio', `arresto dell'app (${segnale})`);
    server.close();
    await Promise.race([runner.fermaTimer(), new Promise(r => setTimeout(r, 5000).unref())]);
    try { bac.chiudi(); } catch { /* già chiuso */ }
    try { db.close(); } catch { /* già chiuso */ }
    process.exit(0);
  };
  process.on('SIGTERM', () => chiudi('SIGTERM'));
  process.on('SIGINT', () => chiudi('SIGINT'));
  process.on('unhandledRejection', e => { try { addLog('errore', 'errore non gestito: ' + (e?.message || e)); } catch { console.error(e); } });
}
if (require.main === module) avviaServer();
module.exports = { app, comandoValido };
