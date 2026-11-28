// Motore degli scenari: un solo scenario attivo; ogni CONTROL_MINUTES legge l'impianto, decide per unità e scrive solo il necessario.
// Lo stato del run sta in SQLite (kv 'run') e sopravvive al riavvio.
const cfg = require('../config');
const mode = require('../mode');
const bac = require('../plant');
const { addLog, kvGet, kvSet } = require('../db');
const { adesso, giorniDa } = require('../clock');
const { nonTrovato, conflitto, nonValido, impianto } = require('../errori');
const L = require('./logic');
const repo = require('../repo/scenari');
const { eseguiPiano } = require('../scenes');

const attivo = (r) => r && !r.concluso;
const run = () => kvGet('run');

// Un solo ciclo alla volta (CODE_POLICY §1): timer, avvio, salto di fase e stop passano tutti da qui, in coda.
// Il timer salta il giro se c'è già qualcosa in corso, le azioni dall'app invece aspettano il loro turno.
let coda = Promise.resolve(), occupato = false;
function esclusivo(fn) {
  const r = coda.then(async () => { occupato = true; try { return await fn(); } finally { occupato = false; } });
  coda = r.catch(() => {});
  return r;
}

const minutiDa = (r, n = adesso()) => (giorniDa(n.data) - giorniDa(r.giorno)) * 1440 + L.minuti(n.ora);

// Spegne le unità indicate (stato letto ora se non passato). Ritorna l'esito dei comandi.
const spegniUnita = async (ids, stato, etichetta) =>
  eseguiPiano(Object.fromEntries(ids.map(u => [u, { power: 'off' }])), stato || await bac.leggiStato(), etichetta);

const scenarioSparito = () => nonTrovato('Scenario non trovato: forse è stato eliminato da un altro telefono');

function concludi(r, motivo) { r.concluso = true; r.motivo = motivo; kvSet('run', r); addLog('comando', `scenario "${r.nome}" ${motivo}`); }
// Fine ciclo: lo scenario resta attivo e aspetta il prossimo giorno previsto (non salva: lo fa chi chiama).
function attendi(r, motivo, esito = { comandi: [] }) { r.inAttesa = true; r.unita = {}; addLog('comando', `scenario "${r.nome}" ${motivo}`); return esito; }

// Un passo del motore sul run `r` (modificato sul posto, non salvato): legge l'impianto, sceglie la fase e invia i comandi.
// Ritorna l'esito dei comandi; se l'impianto non risponde l'errore sale a chi chiama.
async function passo(r, sc) {
  const stato = await bac.leggiStato();
  let i = L.faseCorrente(sc, minutiDa(r), r.minFase); if (i === -1) i = 0;       // avvio a mano prima dell'ora: parte subito
  if (i >= sc.fasi.length) return attendi(r, 'ciclo terminato: in attesa del prossimo avvio');
  if (i !== r.fase) { addLog('comando', `scenario "${sc.nome}": fase ${i + 1} di ${sc.fasi.length}`); r.fase = i; }
  const fase = sc.fasi[i], piano = {};
  if (fase.tipo === 'off') {
    const esito = await spegniUnita(sc.unita, stato, `scenario "${sc.nome}": spegni impianto`);
    return attendi(r, 'ciclo terminato (impianto spento): in attesa del prossimo avvio', esito);
  }
  if (L.MODO_FASE[fase.tipo]) {                    // ventilazione / deumidificazione: accende e imposta la modalità, niente setpoint
    for (const u of sc.unita) if (stato[u]) piano[u] = { power: 'on', modo: L.MODO_FASE[fase.tipo] };
    r.unita = {};
  } else {
    const nuoveUnita = {};
    for (const u of sc.unita) {
      const s = stato[u]; if (!s) continue;
      const d = L.decidiUnita(fase, sc.modo, s.temp, r.unita[u]);
      nuoveUnita[u] = { stato: d.stato, setpoint: d.setpoint, temp: s.temp, ...(d.spento ? { spento: true } : {}) };
      piano[u] = d.spento ? { power: 'off' }                                  // mantenimento "si spegne": solo questa unità
        : { power: 'on', modo: sc.modo, setpoint: d.setpoint, ...(fase.oscillazione !== undefined ? { oscillazione: fase.oscillazione } : {}) };
    }
    r.unita = nuoveUnita;
  }
  r.ultimo_controllo = Date.now();
  return eseguiPiano(piano, stato, `scenario "${sc.nome}" fase ${i + 1}`);
}

// Uno scenario parte solo quando lo si avvia: da lì si ripete nei suoi giorni finché non lo si interrompe.
// Si salva come attivo solo DOPO il primo comando riuscito: se l'impianto non risponde o rifiuta tutti i comandi,
// l'avvio fallisce e resta tutto com'era (si può riprovare o prenotarlo). Con `sostituisci` interrompe quello attivo
// e spegne le sue unità che il nuovo scenario non usa.
const avvia = (scenarioId, { sostituisci = false } = {}) => esclusivo(async () => {
  const sc = repo.trova(scenarioId); if (!sc) throw scenarioSparito();
  mode.richiedi();
  const r = run();
  if (attivo(r)) {
    if (r.scenario_id === sc.id) throw conflitto(`«${sc.nome}» è già avviato`);
    if (!sostituisci) throw conflitto(`C'è già uno scenario attivo («${r.nome}»): interrompilo o sostituiscilo`);
  }
  const n = adesso();
  const nuovo = { scenario_id: sc.id, nome: sc.nome, giorno: n.data, minFase: 0, manuale: true, fase: -1, unita: {}, avviato: Date.now(), ultimo_controllo: null, concluso: false, motivo: null };
  let esito;
  try { esito = await passo(nuovo, sc); }
  catch (e) {
    addLog('errore', `scenario "${sc.nome}" non avviato: ${e.message}`);
    throw impianto(`«${sc.nome}» non è partito: l'impianto non risponde. Riprova tra poco`);
  }
  const ko = esito.comandi.filter(c => !c.ok).length;
  if (ko && ko === esito.comandi.length) {
    addLog('errore', `scenario "${sc.nome}" non avviato: nessun comando accettato dall'impianto`);
    throw impianto(`«${sc.nome}» non è partito: l'impianto non ha accettato i comandi. Riprova tra poco`);
  }
  if (attivo(r)) {
    const vecchio = repo.trova(r.scenario_id), via = (vecchio ? vecchio.unita : []).filter(u => !sc.unita.includes(u));
    if (via.length) await spegniUnita(via, null, `scenario "${r.nome}": interrotto, spegni le unità non usate da "${sc.nome}"`)
      .catch(e => addLog('errore', `scenario "${r.nome}": spegnimento delle unità non usate non riuscito — ${e.message}`));
    concludi(r, `interrotto: avviato "${sc.nome}"`);
  }
  kvSet('run', nuovo);
  kvSet('auto:' + sc.id, n.data);                // il ciclo di oggi è già partito
  addLog('comando', `scenario "${sc.nome}" avviato`);
  return { avviso: ko ? `«${sc.nome}» è avviato, ma ${ko} comandi su ${esito.comandi.length} non sono riusciti: riprovo al prossimo controllo` : null };
});

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

// Un ciclo di controllo sullo scenario attivo. Da chiamare solo dentro `esclusivo`.
async function controlla() {
  const r = run(); if (!attivo(r) || !mode.attiva()) return null;   // in sola lettura il motore è in pausa
  const sc = repo.trova(r.scenario_id);
  if (!sc) { concludi(r, 'interrotto: scenario eliminato'); return null; }
  if (r.inAttesa) {
    const n = adesso(); if (!riparte(sc, n)) return r;
    Object.assign(r, { giorno: n.data, minFase: 0, fase: -1, unita: {}, inAttesa: false }); kvSet('auto:' + sc.id, n.data);
    addLog('comando', `scenario "${sc.nome}" riparte`);
  }
  try { await passo(r, sc); }
  catch (e) { addLog('errore', `scenario "${sc.nome}": ${e.message}`); }
  finally { kvSet('run', r); }                      // anche se l'impianto non risponde: la ripartenza di oggi non si perde
  return r;
}

// Nessun avvio automatico: gli scenari non avviati restano fermi; quello avviato riparte da solo nei suoi giorni (vedi controlla).
const tick = () => occupato ? Promise.resolve(null) : esclusivo(() => attivo(run()) ? controlla() : null);

// Interrompe lo scenario. Con `spegni` prova a spegnere le sue unità; lo scenario si chiude comunque (finally),
// e se lo spegnimento non riesce lo dice nel registro e nella risposta.
const ferma = ({ spegni = false } = {}) => esclusivo(async () => {
  mode.richiedi();
  const r = run(); if (!attivo(r)) throw conflitto('Nessuno scenario attivo da interrompere');
  const sc = repo.trova(r.scenario_id);
  let avviso = null;
  try {
    if (spegni && sc) {
      const esito = await spegniUnita(sc.unita, null, `scenario "${r.nome}": interrotto, spegni tutto`);
      const ko = esito.comandi.filter(c => !c.ok).length;
      if (ko) avviso = `Scenario interrotto, ma ${ko} unità non si sono spente: controllale dalla schermata Stato`;
    }
  } catch (e) {
    addLog('errore', `scenario "${r.nome}": spegnimento non riuscito — ${e.message}`);
    avviso = 'Scenario interrotto, ma l\'impianto non risponde: le unità potrebbero essere ancora accese';
  } finally {
    concludi(r, !spegni ? 'interrotto (unità lasciate come sono)' : avviso ? 'interrotto (spegnimento non riuscito)' : 'interrotto (impianto spento)');
  }
  return { avviso };
});

const salta = (fase) => esclusivo(async () => {
  mode.richiedi();
  const r = run(); if (!attivo(r)) throw conflitto('Nessuno scenario attivo');
  const sc = repo.trova(r.scenario_id);
  if (!sc) { concludi(r, 'interrotto: scenario eliminato'); throw scenarioSparito(); }
  if (!Number.isInteger(fase) || fase < 0 || fase >= sc.fasi.length) throw nonValido('Fase non valida: ricarica la pagina e riprova');
  r.minFase = fase; kvSet('run', r); await controlla();
});

// Fotografia per l'app (nessun I/O verso l'impianto). Se lo scenario è stato modificato e ha meno fasi, la fase
// salvata può essere fuori intervallo: si mostra solo la parte base finché il prossimo ciclo non la riallinea.
function situazione() {
  const r = run(); if (!r) return { attivo: false };
  const sc = repo.trova(r.scenario_id);
  const base = { attivo: attivo(r), concluso: !!r.concluso, motivo: r.motivo, scenario_id: r.scenario_id, nome: r.nome, inPausa: attivo(r) && !mode.attiva(), inAttesa: !!r.inAttesa, prossimoAvvio: r.inAttesa && sc ? prossimoAvvio(sc) : null, ultimo_controllo: r.ultimo_controllo, avviato: r.avviato };
  if (!sc || !(r.fase >= 0 && r.fase < sc.fasi.length)) return base;
  const c = L.confini(sc)[r.fase], nowMin = minutiDa(r), f = sc.fasi[r.fase];
  const prog = Number.isFinite(c.fine) ? Math.min(1, Math.max(0, (nowMin - c.inizio) / (c.fine - c.inizio))) : 1;
  const unita = sc.unita.map(id => ({ id, ...(r.unita[id] || {}) }));
  return { ...base, fase: r.fase, nFasi: sc.fasi.length, faseTipo: f.tipo, faseNome: f.nome || 'Spegni impianto',
    inizioFase: L.hhmm(c.inizio), fineFase: Number.isFinite(c.fine) ? L.hhmm(c.fine) : null, progresso: prog,
    inMant: unita.filter(u => u.stato === 'mant').length, spente: unita.filter(u => u.spento).length, unita };
}

let timer = null;
const avviaTimer = () => {
  timer = setInterval(() => tick().catch(e => addLog('errore', 'motore scenari: ' + e.message)), cfg.controlMinutes * 60e3);
  setTimeout(() => tick().catch(() => {}), 10e3).unref();     // riprende dopo un riavvio
};
const fermaTimer = () => { clearInterval(timer); return coda; };   // per la chiusura: aspetta il ciclo in corso

module.exports = { avvia, tick, ferma, salta, situazione, avviaTimer, fermaTimer, esclusivo, run };
