// Logica pura del motore scenari: nessun I/O, nessun orologio implicito → facile da testare.
// Modo: 5 = riscaldamento, 1 = raffrescamento. "Meglio" = più caldo in riscaldamento, più freddo in raffrescamento.

const RISC = 5;
const minuti = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const hhmm = (m) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const arrotonda = (v) => Math.round(v * 2) / 2;

// Confini delle fasi in minuti dalla mezzanotte del giorno di avvio. Ogni "fino" è dopo il precedente (se no, giorno dopo).
// Le fasi 'vent' e 'deum' (solo ventilazione / deumidificazione) hanno orario ma nessuna temperatura.
// L'ultima fase di tipo 'off' non ha orario proprio: inizia quando finisce la precedente.
function confini(scenario) {
  const out = []; let t = minuti(scenario.fasi[0].inizio);
  for (const f of scenario.fasi) {
    const inizio = t;
    if (f.tipo === 'off') { out.push({ inizio, fine: Infinity }); continue; }
    let fine = minuti(f.fino); while (fine <= t) fine += 1440; t = fine;
    out.push({ inizio, fine });
  }
  return out;
}

// Indice della fase attiva ora (nowMin = minuti dalla mezzanotte del giorno di avvio), o -1 se non ancora iniziata,
// o fasi.length se conclusa (nessuna fase 'off' e tempo scaduto).
function faseCorrente(scenario, nowMin, minFase = 0) {
  const c = confini(scenario);
  if (nowMin < c[0].inizio) return -1;
  let i = c.findIndex(x => nowMin >= x.inizio && nowMin < x.fine);
  if (i === -1) i = c.length;
  return Math.max(i, Math.min(minFase, scenario.fasi.length - 1));
}

const raggiunto = (modo, temp, obiettivo) => modo === RISC ? temp >= obiettivo : temp <= obiettivo;

// "Mantieni temperatura" (fase.mant = {target, temp, ritorno}): quando la stanza raggiunge `target` le unità passano al setpoint
// di mantenimento `temp` e lo tengono finché la stanza non arriva a `ritorno`; allora tornano al programma (fase.target).
// Riscaldamento: temp ≤ ritorno < target. Raffrescamento: target < ritorno ≤ temp. Una mant senza queste soglie (vecchio formato) è ignorata.
const mantenimento = (fase) => fase.mant && fase.mant.target != null && fase.mant.ritorno != null ? fase.mant : null;

// Decide setpoint e stato di UNA unità in una fase 'temp'.
// prev: stato precedente {stato:'salita'|'target'|'mant'} (per isteresi). Ritorna {stato, setpoint}.
function decidiUnita(fase, modo, temp, prev) {
  const t = fase.target, m = mantenimento(fase);
  if (temp === null || temp === undefined) return { stato: prev?.stato || 'salita', setpoint: prev?.stato === 'mant' && m ? m.temp : t };   // lettura mancante: stato invariato
  if (m) {
    const tornato = modo === RISC ? temp <= m.ritorno : temp >= m.ritorno;
    const inMant = prev?.stato === 'mant' ? !tornato : raggiunto(modo, temp, m.target);
    if (inMant) return { stato: 'mant', setpoint: m.temp };
  }
  return { stato: raggiunto(modo, temp, t) ? 'target' : 'salita', setpoint: t };
}

// Confronta stato letto e desiderato → lista comandi minimi (isteresi: nessuna scrittura se già giusto).
function comandi(unitaId, letto, voluto) {
  const out = [];
  if (voluto.modo !== undefined && letto.modo !== voluto.modo) out.push({ unita: unitaId, cosa: 'modo', da: letto.modo, a: voluto.modo });
  if (voluto.setpoint !== undefined && letto.setpoint !== voluto.setpoint) out.push({ unita: unitaId, cosa: 'setpoint', da: letto.setpoint, a: voluto.setpoint });
  if (voluto.power === 'on' && !letto.acceso) out.push({ unita: unitaId, cosa: 'power', da: 'off', a: 'on' });
  if (voluto.power === 'off' && letto.acceso) out.push({ unita: unitaId, cosa: 'power', da: 'on', a: 'off' });
  return out;
}

// Validazione di uno scenario ricevuto dall'API. Ritorna lo scenario normalizzato o lancia Error.
function valida(b, unitaNote, lim = { min: 16, max: 26 }) {
  const nome = String(b.nome || '').trim(); if (!nome) throw new Error('nome mancante');
  const modo = Number(b.modo); if (![1, 2, 3, 5].includes(modo)) throw new Error('modalità non valida (1 raff, 2 deum, 3 vent, 5 risc)');
  const giorni = [...new Set((b.giorni || []).map(Number))].filter(g => g >= 0 && g <= 6).sort(); if (!giorni.length) throw new Error('scegli almeno un giorno');
  const unita = [...new Set((b.unita || []).map(String))]; if (!unita.length) throw new Error('scegli almeno una unità');
  unita.forEach(u => { if (!unitaNote[u]) throw new Error('unità sconosciuta ' + u); });
  if (!Array.isArray(b.fasi) || !b.fasi.length) throw new Error('servono delle fasi');
  const ora = (v, c) => { if (!/^\d\d:\d\d$/.test(v || '') || minuti(v) > 1439) throw new Error(`orario non valido (${c})`); return v; };
  const num = (v, c) => { const n = Number(v); if (!(n >= lim.min && n <= lim.max)) throw new Error(`${c}: temperatura fuori da ${lim.min}–${lim.max}`); return arrotonda(n); };
  if (b.fasi[0].tipo === 'off') throw new Error('la prima fase non può essere solo “Spegni impianto”');
  const fisso = TIPO_MODO[modo];                           // scenario Vent./Deum.: le fasi sono solo vent, deum o off (di default il tipo dello scenario)
  const fasi = b.fasi.map((f, i) => {
    if (f.tipo === 'off') { if (i !== b.fasi.length - 1) throw new Error("'Spegni impianto' può essere solo l'ultima fase"); return { tipo: 'off', ...(i === 0 ? { inizio: ora(f.inizio, 'inizio') } : {}) }; }
    if (fisso || f.tipo === 'vent' || f.tipo === 'deum') {      // ventilazione / deumidificazione: nessuna temperatura
      const v = { tipo: f.tipo === 'vent' || f.tipo === 'deum' ? f.tipo : fisso, nome: String(f.nome || `Fase ${i + 1}`), fino: ora(f.fino, `fase ${i + 1}`) };
      if (i === 0) v.inizio = ora(f.inizio, 'inizio');
      return v;
    }
    const o = { tipo: 'temp', nome: String(f.nome || `Fase ${i + 1}`), fino: ora(f.fino, `fase ${i + 1}`), target: num(f.target, `fase ${i + 1}`) };
    if (i === 0) o.inizio = ora(f.inizio, 'inizio');
    if (f.oscillazione !== undefined && f.oscillazione !== null) o.oscillazione = !!f.oscillazione;
    if (f.mant) {
      const m = { target: num(f.mant.target, 'target mantenimento'), temp: num(f.mant.temp, 'temperatura di mantenimento'), ritorno: num(f.mant.ritorno, 'ritorno al programma') };
      const risc = modo === RISC, oltre = (x, y) => risc ? x > y : x < y;                  // "x è più verso il caldo/freddo di y"
      if (oltre(o.target, m.target)) throw new Error('il target del mantenimento non può essere ' + (risc ? 'sotto' : 'sopra') + ' la temperatura della fase');
      if (!oltre(m.target, m.ritorno)) throw new Error('il ritorno al programma deve essere ' + (risc ? 'sotto' : 'sopra') + ' il target');
      if (oltre(m.temp, m.ritorno)) throw new Error('la temperatura di mantenimento non può essere ' + (risc ? 'sopra' : 'sotto') + ' il ritorno');
      o.mant = m;
    }
    return o;
  });
  return { nome, modo, giorni, gruppo: b.gruppo ? String(b.gruppo) : null, unita, fasi };
}

const MODO_FASE = { vent: 3, deum: 2 };
const TIPO_MODO = { 3: 'vent', 2: 'deum' };            // modalità dello scenario → tipo delle sue fasi (solo vent/deum)
module.exports = { MODO_FASE, TIPO_MODO, RISC, minuti, hhmm, confini, faseCorrente, decidiUnita, comandi, valida, raggiunto };
