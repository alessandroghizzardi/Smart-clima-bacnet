// Motore degli scenari: un solo scenario attivo; ogni CONTROL_MINUTES legge l'impianto, decide per unità e scrive solo il necessario.
// Lo stato del run sta in SQLite (kv 'run') e sopravvive al riavvio.
const cfg = require('../config');
const mode = require('../mode');
const bac = require('../plant');
const { db, addLog, kvGet, kvSet } = require('../db');
const { adesso, giorniDa } = require('../clock');
const L = require('./logic');
const repo = require('../repo/scenari');
const { eseguiPiano } = require('../scenes');

const attivo = (r) => r && !r.concluso;
let occupato = false;                         // evita due cicli sovrapposti
const run = () => kvGet('run');

const minutiDa = (r, n = adesso()) => (giorniDa(n.data) - giorniDa(r.giorno)) * 1440 + L.minuti(n.ora);

// Uno scenario parte solo quando lo si avvia: da lì si ripete nei suoi giorni finché non lo si interrompe.
// Con `sostituisci` interrompe quello attivo e spegne le sue unità che il nuovo scenario non usa.
async function avvia(scenarioId, { sostituisci = false } = {}) {
  const sc = repo.trova(scenarioId); if (!sc) throw new Error('scenario non trovato');
  mode.richiedi();
  const r = run();
  if (attivo(r)) {
    if (r.scenario_id === sc.id) throw new Error(`"${sc.nome}" è già avviato`);
    if (!sostituisci) throw new Error(`c'è già uno scenario attivo: "${r.nome}"`);
    const vecchio = repo.trova(r.scenario_id), piano = {};
    (vecchio ? vecchio.unita : []).filter(u => !sc.unita.includes(u)).forEach(u => piano[u] = { power: 'off' });
    if (Object.keys(piano).length) await eseguiPiano(piano, await bac.leggiStato(), `scenario "${r.nome}": interrotto, spegni le unità non usate da "${sc.nome}"`);
    concludi(r, `interrotto: avviato "${sc.nome}"`);
  }
  const n = adesso();
  const nuovo = { scenario_id: sc.id, nome: sc.nome, giorno: n.data, minFase: 0, manuale: true, fase: -1, unita: {}, avviato: Date.now(), ultimo_controllo: null, concluso: false, motivo: null };
  kvSet('run', nuovo);
  kvSet('auto:' + sc.id, n.data);                // il ciclo di oggi è già partito
  addLog('comando', `scenario "${sc.nome}" avviato`);
  return nuovo;
}

function concludi(r, motivo) { r.concluso = true; r.motivo = motivo; kvSet('run', r); addLog('comando', `scenario "${r.nome}" ${motivo}`); }

// Lo scenario resta attivo finché non lo si interrompe: finito il ciclo (fase "spegni" o tempo scaduto) aspetta e riparte
// il prossimo giorno previsto all'ora di inizio della prima fase.
const giornoPrevisto = (sc, n) => sc.giorni.includes(n.giorno) && kvGet('auto:' + sc.id) !== n.data;
const riparte = (sc, n) => giornoPrevisto(sc, n) && L.minuti(n.ora) >= L.minuti(sc.fasi[0].inizio);
function prossimoAvvio(sc, n = adesso()) {
  for (let d = 0; d < 8; d++) {
    const g = (n.giorno + d) % 7; if (!sc.giorni.includes(g)) continue;
    if (d === 0 && !(giornoPrevisto(sc, n) && L.minuti(n.ora) < L.minuti(sc.fasi[0].inizio))) continue;
    return { giorno: g, oggi: d === 0, ora: sc.fasi[0].inizio };
  }
  return null;
}
function attendi(r, motivo) { r.inAttesa = true; r.unita = {}; kvSet('run', r); addLog('comando', `scenario "${r.nome}" ${motivo}`); }

// Un ciclo di controllo sullo scenario attivo.
async function controlla() {
  const r = run(); if (!attivo(r) || !mode.attiva()) return null;   // in sola lettura il motore è in pausa
  const sc = repo.trova(r.scenario_id);
  if (!sc) { concludi(r, 'interrotto: scenario eliminato'); return null; }
  if (r.inAttesa) {
    const n = adesso(); if (!riparte(sc, n)) return r;
    Object.assign(r, { giorno: n.data, minFase: 0, fase: -1, unita: {}, inAttesa: false }); kvSet('auto:' + sc.id, n.data);
    addLog('comando', `scenario "${sc.nome}" riparte`);
  }
  const stato = await bac.leggiStato();
  let i = L.faseCorrente(sc, minutiDa(r), r.minFase); if (i === -1) i = 0;       // avvio a mano prima dell'ora: parte subito
  if (i >= sc.fasi.length) { attendi(r, 'ciclo terminato: in attesa del prossimo avvio'); return r; }
  if (i !== r.fase) { addLog('comando', `scenario "${sc.nome}": fase ${i + 1} di ${sc.fasi.length}`); r.fase = i; }
  const fase = sc.fasi[i], piano = {};
  if (fase.tipo === 'off') {
    sc.unita.forEach(u => piano[u] = { power: 'off' });
    await eseguiPiano(piano, stato, `scenario "${sc.nome}": spegni impianto`);
    attendi(r, 'ciclo terminato (impianto spento): in attesa del prossimo avvio'); return r;
  }
  if (L.MODO_FASE[fase.tipo]) {                    // ventilazione / deumidificazione: accende e imposta la modalità, niente setpoint
    for (const u of sc.unita) if (stato[u]) piano[u] = { power: 'on', modo: L.MODO_FASE[fase.tipo] };
    r.unita = {}; r.ultimo_controllo = Date.now();
    try { await eseguiPiano(piano, stato, `scenario "${sc.nome}" fase ${i + 1}`); }
    catch (e) { addLog('errore', `scenario "${sc.nome}": ${e.message}`); }
    kvSet('run', r); return r;
  }
  const nuoveUnita = {};
  for (const u of sc.unita) {
    const s = stato[u]; if (!s) continue;
    const d = L.decidiUnita(fase, sc.modo, s.temp, r.unita[u]);
    nuoveUnita[u] = { stato: d.stato, setpoint: d.setpoint, temp: s.temp, ...(d.spento ? { spento: true } : {}) };
    piano[u] = d.spento ? { power: 'off' }                                    // mantenimento "si spegne": solo questa unità
      : { power: 'on', modo: sc.modo, setpoint: d.setpoint, ...(fase.oscillazione !== undefined ? { oscillazione: fase.oscillazione } : {}) };
  }
  r.unita = nuoveUnita; r.ultimo_controllo = Date.now();
  try { await eseguiPiano(piano, stato, `scenario "${sc.nome}" fase ${i + 1}`); }
  catch (e) { addLog('errore', `scenario "${sc.nome}": ${e.message}`); }
  kvSet('run', r);
  return r;
}

// Nessun avvio automatico: gli scenari non avviati restano fermi; quello avviato riparte da solo nei suoi giorni (vedi controlla).
async function tick() {
  if (occupato) return; occupato = true;
  try { if (attivo(run())) await controlla(); }
  finally { occupato = false; }
}

async function ferma({ spegni = false } = {}) {
  mode.richiedi();
  const r = run(); if (!attivo(r)) throw new Error('nessuno scenario attivo');
  const sc = repo.trova(r.scenario_id);
  if (spegni && sc) {
    const piano = {}; sc.unita.forEach(u => piano[u] = { power: 'off' });
    await eseguiPiano(piano, await bac.leggiStato(), `scenario "${r.nome}": interrotto, spegni tutto`);
  }
  concludi(r, spegni ? 'interrotto (impianto spento)' : 'interrotto (unità lasciate come sono)');
}

async function salta(fase) {
  mode.richiedi();
  const r = run(); if (!attivo(r)) throw new Error('nessuno scenario attivo');
  const sc = repo.trova(r.scenario_id);
  if (!Number.isInteger(fase) || fase < 0 || fase >= sc.fasi.length) throw new Error('fase non valida');
  r.minFase = fase; kvSet('run', r); await controlla();
}

// Fotografia per l'app (nessun I/O verso l'impianto).
function situazione() {
  const r = run(); if (!r) return { attivo: false };
  const sc = repo.trova(r.scenario_id);
  const base = { attivo: attivo(r), concluso: !!r.concluso, motivo: r.motivo, scenario_id: r.scenario_id, nome: r.nome, inPausa: attivo(r) && !mode.attiva(), inAttesa: !!r.inAttesa, prossimoAvvio: r.inAttesa && sc ? prossimoAvvio(sc) : null, ultimo_controllo: r.ultimo_controllo, avviato: r.avviato };
  if (!sc || r.fase < 0) return base;
  const c = L.confini(sc)[r.fase], nowMin = minutiDa(r), f = sc.fasi[r.fase];
  const prog = Number.isFinite(c.fine) ? Math.min(1, Math.max(0, (nowMin - c.inizio) / (c.fine - c.inizio))) : 1;
  const unita = sc.unita.map(id => ({ id, ...(r.unita[id] || {}) }));
  return { ...base, fase: r.fase, nFasi: sc.fasi.length, faseTipo: f.tipo, faseNome: f.nome || 'Spegni impianto',
    inizioFase: L.hhmm(c.inizio), fineFase: Number.isFinite(c.fine) ? L.hhmm(c.fine) : null, progresso: prog,
    inMant: unita.filter(u => u.stato === 'mant').length, spente: unita.filter(u => u.spento).length, unita };
}

const avviaTimer = () => {
  setInterval(() => tick().catch(e => addLog('errore', 'motore scenari: ' + e.message)), cfg.controlMinutes * 60e3);
  setTimeout(() => tick().catch(() => {}), 10e3);              // riprende dopo un riavvio
};
module.exports = { avvia, controlla, tick, ferma, salta, situazione, avviaTimer, run };
