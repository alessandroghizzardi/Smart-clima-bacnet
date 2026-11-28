const fs = require('fs'), path = require('path');
const express = require('express');
const cfg = require('./config');
const { db, addLog, potaLog } = require('./db');
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

const app = express();
app.use(express.json());
const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch(e => res.status(e.code === 'WRITES_OFF' ? 403 : 500).json({ errore: e.message }));

// ---- configurazione e stato
app.get('/api/config', (req, res) => res.json({
  nome: cfg.siteName, unita: units.unita, gruppi: repoAmbienti.elenco(), scrittura: mode.attiva(), pollMinutes: cfg.pollMinutes, controlMinutes: cfg.controlMinutes,
  setpoint: cfg.setpoint, frostAlertC: cfg.frostAlertC, push: { publicKey: push.publicKey(), iscritti: push.quanti() },
}));
app.post('/api/scrittura', wrap((req, res) => res.json({ scrittura: mode.imposta(!!req.body.attiva) })));
app.get('/api/state', wrap(async (req, res) => {
  const u = req.query.live === '1' ? await poller.leggiViva() : poller.ultimo();
  res.json({ ...u, ora: clock.adesso(), tz: cfg.timezone, scrittura: mode.attiva() });
}));

// ---- storico temperature
app.get('/api/history', (req, res) => {
  const a = Number(req.query.from) || Date.now() - 7 * 86400e3, b = Number(req.query.to) || Date.now();
  const lista = (req.query.units || '').split(',').filter(Boolean);
  const ids = lista.length ? lista : units.unita.map(u => u.id);
  const q = db.prepare(`SELECT ts, unit, temp, setpoint, acceso FROM readings WHERE ts BETWEEN ? AND ? AND unit IN (${ids.map(() => '?').join(',')}) ORDER BY ts`);
  const out = {}; ids.forEach(i => out[i] = []);
  for (const r of q.all(a, b, ...ids)) out[r.unit].push([r.ts, r.temp, r.setpoint, r.acceso]);
  res.json({ from: a, to: b, serie: out });
});

// ---- comandi diretti (unità, gruppo, tutto)
app.post('/api/control', wrap(async (req, res) => {
  const { target, power = null, setpoint = null, modo = null, ventola = null, oscillazione = null } = req.body;
  if (modo !== null && ![1, 2, 3, 4, 5].includes(Number(modo))) throw new Error('modalità non valida');
  if (ventola !== null && ![1, 2, 3, 4].includes(Number(ventola))) throw new Error('ventola non valida');
  const r = await scenes.esegui([{ target, power, setpoint, modo, ventola, oscillazione }], `manuale ${target}`);
  poller.leggi(false).catch(() => {});
  res.json(r);
}));

const noteUnita = Object.fromEntries(units.unita.map(u => [u.id, true]));

// ---- ambienti (gruppi di unità, tutti modificabili)
app.get('/api/ambienti', (req, res) => res.json(repoAmbienti.elenco()));
app.post('/api/ambienti', wrap((req, res) => { const v = vAmbiente(req.body, noteUnita, repoAmbienti.elenco()); res.json({ id: repoAmbienti.crea(v.nome, v.unita) }); }));
app.put('/api/ambienti/ordine', wrap((req, res) => {
  const ids = (req.body.ids || []).map(String), ora = repoAmbienti.elenco().map(a => a.id);
  if (ids.length !== ora.length || ora.some(i => !ids.includes(i))) throw new Error('elenco ambienti non aggiornato: ricarica');
  repoAmbienti.riordina(ids); res.json({ ok: true });
}));
app.put('/api/ambienti/:id', wrap((req, res) => {
  if (!repoAmbienti.trova(req.params.id)) throw new Error('ambiente non trovato');
  const v = vAmbiente(req.body, noteUnita, repoAmbienti.elenco(), req.params.id); repoAmbienti.aggiorna(req.params.id, v.nome, v.unita); res.json({ ok: true });
}));
app.delete('/api/ambienti/:id', wrap((req, res) => { if (!repoAmbienti.trova(req.params.id)) throw new Error('ambiente non trovato'); repoAmbienti.elimina(req.params.id); res.json({ ok: true }); }));

// ---- scenari a fasi e motore
app.get('/api/scenari', (req, res) => res.json(repoScenari.elenco()));
app.post('/api/scenari', wrap((req, res) => res.json({ id: repoScenari.crea(logic.valida(req.body, noteUnita, cfg.setpoint)) })));
app.put('/api/scenari/:id', wrap((req, res) => {
  if (!repoScenari.trova(req.params.id)) throw new Error('scenario non trovato');
  repoScenari.aggiorna(req.params.id, logic.valida(req.body, noteUnita, cfg.setpoint)); res.json({ ok: true });
}));
app.delete('/api/scenari/:id', wrap((req, res) => {
  const r = runner.run(); if (r && !r.concluso && String(r.scenario_id) === req.params.id) throw new Error('scenario in corso: interrompilo prima');
  repoScenari.elimina(req.params.id); res.json({ ok: true });
}));
app.get('/api/run', (req, res) => res.json(runner.situazione()));
app.post('/api/run/start', wrap(async (req, res) => { await runner.avvia(Number(req.body.id), { sostituisci: !!req.body.sostituisci }); await runner.controlla(); res.json(runner.situazione()); }));
app.post('/api/run/stop', wrap(async (req, res) => { await runner.ferma({ spegni: !!req.body.spegni }); poller.leggi(false).catch(() => {}); res.json(runner.situazione()); }));
app.post('/api/run/salta', wrap(async (req, res) => { await runner.salta(Number(req.body.fase)); res.json(runner.situazione()); }));

// ---- notifiche push
app.post('/api/push/subscribe', wrap((req, res) => { push.salva(req.body); res.json({ ok: true }); }));
app.post('/api/push/unsubscribe', wrap((req, res) => { push.rimuovi(req.body.endpoint); res.json({ ok: true }); }));
app.post('/api/push/test', wrap(async (req, res) => res.json({ inviate: await push.invia('Prova notifica', 'Le notifiche funzionano') })));

// ---- impostazioni di sistema (tabella `impostazioni`); la modifica richiede la conferma esplicita "zona pericolo"
app.get('/api/impostazioni', (req, res) => res.json(impostazioni.elenco()));
app.put('/api/impostazioni', wrap((req, res) => {
  if (req.body.pericolo !== true) throw new Error('Sblocca la zona pericolo per modificare le impostazioni');
  const cambi = impostazioni.salva(db, req.body.valori);
  if (cambi.length) addLog('impostazioni', 'Impostazioni modificate — ' + cambi.join('; '));
  res.json({ cambi: cambi.length, impostazioni: impostazioni.elenco() });
}));

// ---- registro
// Paginato a cursore: ?before=<id> per proseguire, ?q=<testo> per filtrare, 30 voci per pagina.
app.get('/api/log', (req, res) => {
  const before = Number(req.query.before) || Number.MAX_SAFE_INTEGER, n = Math.min(Number(req.query.limit) || 30, 100), q = String(req.query.q || '');
  res.json(db.prepare('SELECT rowid AS id, ts, tipo, testo FROM log WHERE rowid < ? AND testo LIKE ? ESCAPE \'\\\' ORDER BY rowid DESC LIMIT ?')
    .all(before, '%' + q.replace(/[\\%_]/g, '\\$&') + '%', n));
});

// index.html e manifest.json portano il nome configurato (SITE_NAME)
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const conNome = (file, fmt) => { const t = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8').replaceAll('{{NOME}}', fmt(cfg.siteName)); return t; };
const pagina = { html: conNome('index.html', esc), manifest: conNome('manifest.json', s => JSON.stringify(s).slice(1, -1)) };
app.get(['/', '/index.html'], (req, res) => res.type('html').send(pagina.html));
app.get('/manifest.json', (req, res) => res.type('application/manifest+json').send(pagina.manifest));
app.use('/vendor/chart.js', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js')));
app.use(express.static(path.join(__dirname, '..', 'public')));

if (require.main === module) app.listen(cfg.port, cfg.host, () => {
  addLog('avvio', `app clima su http://${cfg.host}:${cfg.port} — scrittura ${mode.attiva() ? 'ATTIVA' : 'disattivata (sola lettura)'} — impianto ${cfg.mock ? 'simulato' : cfg.bacnet.ip || 'IP non configurato'}`);
  potaLog(); setInterval(potaLog, 6 * 3600e3).unref();
  poller.avvia(); runner.avviaTimer();
});
