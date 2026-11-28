const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/engine/logic');

const sc = { modo: 5, fasi: [
  { tipo: 'temp', inizio: '08:00', fino: '22:00', target: 20, mant: { target: 20.5, temp: 18, ritorno: 18.5 } },
  { tipo: 'temp', fino: '06:00', target: 16 },
  { tipo: 'off' }] };
const m = (h, mi = 0) => h * 60 + mi;

test('confini: la fase dopo mezzanotte finisce il giorno dopo', () => {
  const c = L.confini(sc);
  assert.deepEqual(c[0], { inizio: m(8), fine: m(22) });
  assert.deepEqual(c[1], { inizio: m(22), fine: 1440 + m(6) });
  assert.equal(c[2].inizio, 1440 + m(6));
});
test('faseCorrente', () => {
  assert.equal(L.faseCorrente(sc, m(7)), -1);
  assert.equal(L.faseCorrente(sc, m(9)), 0);
  assert.equal(L.faseCorrente(sc, m(23)), 1);
  assert.equal(L.faseCorrente(sc, 1440 + m(7)), 2);
  assert.equal(L.faseCorrente(sc, m(9), 1), 1);            // salto alla fase 2
});
test('senza mantenimento: salita finché non raggiunge il target, poi target', () => {
  const f = { ...sc.fasi[0], mant: null };
  assert.deepEqual(L.decidiUnita(f, 5, 15, null), { stato: 'salita', setpoint: 20 });
  assert.deepEqual(L.decidiUnita(f, 5, 20, null), { stato: 'target', setpoint: 20 });
});
test('mantieni temperatura (riscaldamento 20 / target 20,5 / mant. 18 / ritorno 18,5)', () => {
  const f = sc.fasi[0], d = (t, prev) => L.decidiUnita(f, 5, t, prev);
  assert.deepEqual(d(20.4, null), { stato: 'target', setpoint: 20 });                       // sotto il target: programma
  assert.deepEqual(d(20.5, { stato: 'target' }), { stato: 'mant', setpoint: 18 });           // raggiunge il target: mantenimento
  assert.deepEqual(d(19, { stato: 'mant' }), { stato: 'mant', setpoint: 18 });               // scende ma sopra il ritorno: resta
  assert.deepEqual(d(18.6, { stato: 'mant' }), { stato: 'mant', setpoint: 18 });
  assert.deepEqual(d(18.5, { stato: 'mant' }), { stato: 'salita', setpoint: 20 });           // arriva al ritorno: programma
  assert.deepEqual(d(19.5, { stato: 'salita' }), { stato: 'salita', setpoint: 20 });         // risale, ma sotto il target: programma
  assert.equal(d(20.6, { stato: 'salita' }).stato, 'mant');                                  // di nuovo al target
  assert.equal(d(20.6, null).stato, 'mant');                                                 // primo controllo già oltre il target
});
test('mantieni temperatura (raffrescamento 24 / target 23,5 / mant. 26 / ritorno 25,5): segni invertiti', () => {
  const f = { tipo: 'temp', target: 24, mant: { target: 23.5, temp: 26, ritorno: 25.5 } }, d = (t, prev) => L.decidiUnita(f, 1, t, prev);
  assert.deepEqual(d(25, null), { stato: 'salita', setpoint: 24 });
  assert.deepEqual(d(23.5, { stato: 'salita' }), { stato: 'mant', setpoint: 26 });
  assert.equal(d(25, { stato: 'mant' }).stato, 'mant');
  assert.deepEqual(d(25.5, { stato: 'mant' }), { stato: 'salita', setpoint: 24 });
});
test('mantenimento "si spegne" (riscaldamento 20 / target 20,5 / ritorno 18,5): l\'unità si spegne e si riaccende', () => {
  const f = { tipo: 'temp', target: 20, mant: { target: 20.5, spegni: true, ritorno: 18.5 } }, d = (t, prev) => L.decidiUnita(f, 5, t, prev);
  const off = { stato: 'mant', setpoint: null, spento: true };
  assert.deepEqual(d(20, null), { stato: 'target', setpoint: 20 });
  assert.deepEqual(d(20.5, { stato: 'target' }), off);
  assert.deepEqual(d(19, { stato: 'mant' }), off);                                          // spenta finché non scende al ritorno
  assert.deepEqual(d(18.5, { stato: 'mant' }), { stato: 'salita', setpoint: 20 });           // ritorno: riaccende al programma
  assert.deepEqual(d(null, { stato: 'mant' }), off);                                         // lettura mancante: resta spenta
});
test('mantenimento "si spegne" (raffrescamento 24 / target 23,5 / ritorno 25,5)', () => {
  const f = { tipo: 'temp', target: 24, mant: { target: 23.5, spegni: true, ritorno: 25.5 } }, d = (t, prev) => L.decidiUnita(f, 1, t, prev);
  assert.equal(d(23.5, { stato: 'salita' }).spento, true);
  assert.equal(d(25, { stato: 'mant' }).spento, true);
  assert.deepEqual(d(25.5, { stato: 'mant' }), { stato: 'salita', setpoint: 24 });
});
test('mantenimento per singola unità: ogni unità segue la sua stanza', () => {
  const f = sc.fasi[0], prev = { '11': { stato: 'target' }, '12': { stato: 'target' } }, temp = { '11': 20.6, '12': 19.8 };
  const r = Object.fromEntries(Object.keys(temp).map(u => [u, L.decidiUnita(f, 5, temp[u], prev[u])]));
  assert.deepEqual(r['11'], { stato: 'mant', setpoint: 18 });                                // stanza arrivata: mantenimento
  assert.deepEqual(r['12'], { stato: 'salita', setpoint: 20 });                           // l'altra resta sul programma
});
test('mantenimento nel vecchio formato (senza target/ritorno) è ignorato', () => {
  assert.deepEqual(L.decidiUnita({ tipo: 'temp', target: 20, mant: { temp: 18, soglia: 18.5 } }, 5, 19, null), { stato: 'salita', setpoint: 20 });
});
test('lettura mancante: non cambia stato', () => {
  assert.equal(L.decidiUnita(sc.fasi[0], 5, null, { stato: 'mant' }, '11').stato, 'mant');
});
test('comandi: nessuna scrittura se già corretto', () => {
  const letto = { acceso: true, setpoint: 20, modo: 5 };
  assert.deepEqual(L.comandi('11', letto, { power: 'on', setpoint: 20, modo: 5 }), []);
  assert.equal(L.comandi('11', letto, { power: 'on', setpoint: 20.5, modo: 5 }).length, 1);
  assert.equal(L.comandi('11', { ...letto, acceso: false }, { power: 'on', setpoint: 20, modo: 1 }).length, 2);
});
test('valida: errori e normalizzazione', () => {
  const note = { 11: 1, 12: 1 };
  const ok = { nome: 'X', modo: 5, giorni: [5, 6], unita: ['11'], fasi: [{ tipo: 'temp', inizio: '08:00', fino: '22:00', target: 20 }, { tipo: 'off' }] };
  assert.equal(L.valida(ok, note).fasi.length, 2);
  assert.throws(() => L.valida({ ...ok, giorni: [] }, note), /giorno/);
  assert.throws(() => L.valida({ ...ok, unita: ['99'] }, note), /non fa parte/);
  assert.throws(() => L.valida({ ...ok, fasi: [{ tipo: 'off' }] }, note), /prima fase/);
  assert.throws(() => L.valida({ ...ok, fasi: [{ ...ok.fasi[0], target: 30 }] }, note), /16–26/);
  const mant = (m, modo = 5, t = 20) => L.valida({ ...ok, modo, fasi: [{ ...ok.fasi[0], target: t, mant: m }, ok.fasi[1]] }, note);
  assert.deepEqual(mant({ target: 20.5, temp: 18, ritorno: 18.5 }).fasi[0].mant, { target: 20.5, temp: 18, ritorno: 18.5 });
  assert.deepEqual(mant({ target: 23.5, temp: 26, ritorno: 25.5 }, 1, 24).fasi[0].mant.temp, 26);
  assert.throws(() => mant({ target: 19.5, temp: 18, ritorno: 18.5 }), /target del mantenimento/);     // target sotto il programma
  assert.throws(() => mant({ target: 20.5, temp: 18, ritorno: 20.5 }), /ritorno/);                      // ritorno non sotto il target
  assert.throws(() => mant({ target: 20.5, temp: 19, ritorno: 18.5 }), /mantenimento non può/);         // mantenimento sopra il ritorno
  assert.throws(() => mant({ target: 23.5, temp: 25, ritorno: 25.5 }, 1, 24), /mantenimento non può/);
  assert.deepEqual(mant({ target: 20.5, spegni: true, temp: 25, ritorno: 18.5 }).fasi[0].mant, { target: 20.5, spegni: true, ritorno: 18.5 });   // si spegne: temp ignorata
  assert.throws(() => mant({ target: 20.5, spegni: true, ritorno: 21 }), /ritorno/);
});
test('valida: fase notturna, oscillazione e limiti da config', () => {
  const note = { 11: 1 };
  const b = { nome: 'N', modo: 5, giorni: [1], unita: ['11'], fasi: [{ tipo: 'temp', inizio: '20:00', fino: '06:00', target: 20, oscillazione: true }, { tipo: 'off' }] };
  const v = L.valida(b, note);
  assert.equal(v.fasi[0].oscillazione, true);
  assert.deepEqual(L.confini(v).map(x => x.fine), [30 * 60, Infinity]);
  assert.equal(L.faseCorrente(v, 23 * 60), 0);
  assert.equal(L.faseCorrente(v, 31 * 60), 1);
  assert.throws(() => L.valida({ ...b, fasi: [{ ...b.fasi[0], target: 24 }] }, note, { min: 16, max: 22 }), /16–22/);
});

test('valida: fasi vent/deum senza temperatura', () => {
  const r = L.valida({ nome: 'x', modo: 5, giorni: [1], unita: ['11'], fasi: [{ tipo: 'vent', inizio: '08:00', fino: '10:00' }, { tipo: 'temp', fino: '12:00', target: 20 }, { tipo: 'deum', fino: '14:00' }, { tipo: 'off' }] }, { 11: 1 });
  assert.deepEqual(r.fasi.map(f => f.tipo), ['vent', 'temp', 'deum', 'off']);
  assert.equal(r.fasi[0].target, undefined);
  assert.equal(L.MODO_FASE.vent, 3); assert.equal(L.MODO_FASE.deum, 2);
});

test('valida: scenario solo ventilazione o deumidificazione', () => {
  const note = { 11: 1 };
  const b = (modo, tipo) => ({ nome: 'Deu', modo, giorni: [1], unita: ['11'], fasi: [{ tipo, inizio: '10:00', fino: '12:00' }, { tipo: 'off' }] });
  assert.equal(L.valida(b(2, 'temp'), note).fasi[0].tipo, 'deum');                 // il tipo segue la modalità dello scenario
  assert.equal(L.valida(b(3, 'deum'), note).fasi[0].tipo, 'deum');                 // in uno scenario Vent./Deum. le fasi possono essere dell'uno o dell'altro
  assert.equal(L.valida(b(2, 'vent'), note).fasi[0].tipo, 'vent');
  assert.equal(L.valida(b(2, 'deum'), note).fasi[0].target, undefined);
  assert.throws(() => L.valida(b(4, 'temp'), note), /modalità/);
});
