const bac = require('./plant');
const cfg = require('./config');
const mode = require('./mode');
const { risolvi, byId } = require('./units');
const { addLog } = require('./db');
const { impianto } = require('./errori');
const { comandi: diff, limita } = require('./engine/logic');
const nomi = require('./engine/nomi');

// Costruisce il piano di comandi per unità: le azioni successive sovrascrivono le precedenti
function pianifica(azioni) {
  const per = {};
  for (const a of azioni) {
    for (const u of risolvi(a.target)) {
      per[u] ||= {};
      if (a.power === 'on' || a.power === 'off') per[u].power = a.power;
      if (a.setpoint !== null && a.setpoint !== undefined && a.setpoint !== '') per[u].setpoint = Number(a.setpoint);
      if (a.modo) per[u].modo = Number(a.modo);
      if (a.ventola) per[u].ventola = Number(a.ventola);
      if (a.oscillazione === true || a.oscillazione === false) per[u].oscillazione = a.oscillazione;
    }
  }
  return per;
}


// Piano desiderato → lista dei soli comandi necessari, confrontando con lo stato letto.
function daPiano(piano, stato, accendiInRiscaldamento) {
  const out = [];
  for (const [u, c] of Object.entries(piano)) {
    const s = stato[u]; if (!s) continue;
    const voluto = { ...c };
    if (voluto.setpoint !== undefined) voluto.setpoint = limita(voluto.setpoint, cfg.setpoint);
    if (accendiInRiscaldamento && c.power === 'on' && voluto.modo === undefined && !s.modo) voluto.modo = 5;   // accendendo si riparte dall'ultima modalità; riscaldamento solo se sconosciuta
    out.push(...diff(u, s, voluto));
    if (voluto.oscillazione !== undefined && !!s.oscillazione !== voluto.oscillazione) out.push({ unita: u, cosa: 'oscillazione', da: !!s.oscillazione, a: voluto.oscillazione });
    if (voluto.ventola !== undefined && s.ventola !== voluto.ventola) out.push({ unita: u, cosa: 'ventola', da: s.ventola, a: voluto.ventola });
  }
  return out;
}

// Frase leggibile per un comando, es. "Camera 1: spenta" / "Cucina: setpoint 20 → 21 °C".
function frase(c) {
  const u = byId[c.unita]?.nome || c.unita;
  const f = {
    power: c.a === 'on' ? 'accesa' : 'spenta',
    setpoint: `setpoint ${c.da ?? '?'} → ${c.a} °C`,
    modo: `modalità ${nomi.modi[c.a] || c.a}`,
    ventola: `ventola ${(nomi.ventola[c.a] || String(c.a)).toLowerCase()}`,
    oscillazione: c.a ? 'oscillazione attiva' : 'oscillazione ferma',
  }[c.cosa];
  return `${u}: ${f}`;
}

// Invia i comandi uno alla volta (o li simula se la scrittura è disattivata).
async function invia(comandi, etichetta) {
  mode.richiedi();
  const esiti = [];
  for (const c of comandi) {
    try {
      if (c.cosa === 'setpoint') await bac.imposta(c.unita, c.a);
      else if (c.cosa === 'modo') await bac.modo(c.unita, c.a);
      else if (c.cosa === 'ventola') await bac.ventola(c.unita, c.a);
      else if (c.cosa === 'oscillazione') await bac.oscillazione(c.unita, c.a);
      else await bac.accendi(c.unita, c.a === 'on');
      esiti.push({ ...c, ok: true });
    } catch (e) { esiti.push({ ...c, ok: false, errore: e.message }); }
  }
  if (!esiti.length) addLog('comando', `${etichetta}: nessuna modifica, l'impianto è già così`);
  else {
    const ok = esiti.filter(e => e.ok).map(frase), ng = esiti.filter(e => !e.ok).map(e => `${frase(e)} (fallito: ${e.errore})`);
    const elenco = (l) => l.length > 3 ? `${l.slice(0, 3).join('; ')}; … +${l.length - 3}` : l.join('; ');
    if (ok.length) addLog('comando', `Inviato — ${elenco(ok)}`);
    if (ng.length) addLog('errore', `Non riuscito — ${elenco(ng)}`);
  }
  return { comandi: esiti };
}

async function esegui(azioni, etichetta = 'comando') {
  const piano = pianifica(azioni);
  mode.richiedi();
  let stato;
  try { stato = await bac.leggiStato(); }
  catch (e) { addLog('errore', `${etichetta}: impianto non raggiungibile — ${e.message}`); throw impianto('L\'impianto non risponde: comando non inviato. Riprova tra poco'); }
  return invia(daPiano(piano, stato, true), etichetta);
}
// Per il motore scenari: piano per unità già calcolato, stato già letto (niente doppia lettura).
const eseguiPiano = (piano, stato, etichetta) => invia(daPiano(piano, stato, false), etichetta);

module.exports = { esegui, eseguiPiano, pianifica, daPiano };
