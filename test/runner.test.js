// Motore scenari, validazioni del server e pulizia del DB contro l'impianto simulato (nessun socket BACnet).
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clima-test-'));
Object.assign(process.env, { MOCK: 'on', CONFIG_ESEMPIO: 'on', DB_PATH: path.join(dir, 'test.db'), MOCK_OFFLINE: 'off' });

const test = require('node:test'), assert = require('node:assert/strict');
const mode = require('../src/mode');
const plant = require('../src/mock-plant');
const repo = require('../src/repo/scenari');
const runner = require('../src/engine/runner');
const { db, kvSet, addLog, pota, CONSERVA_GIORNI } = require('../src/db');
const { comandoValido } = require('../src/server');
const { pulisci } = require('../src/push');
const { limita } = require('../src/engine/logic');

const scenario = (fasi = [{ tipo: 'temp', inizio: '00:00', fino: '23:59', target: 20 }, { tipo: 'off' }]) =>
  repo.crea({ nome: 'Prova', modo: 5, giorni: [0, 1, 2, 3, 4, 5, 6], gruppo: null, unita: ['11', '12'], fasi });
const pulito = () => { kvSet('run', null); plant._offline(false); };

test.before(() => mode.imposta(true));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));
test.beforeEach(pulito);

test('avvio con impianto offline: errore IMPIANTO e nessuno scenario attivo', async () => {
  const id = scenario(); plant._offline(true);
  await assert.rejects(runner.avvia(id), e => e.code === 'IMPIANTO');
  assert.equal(runner.situazione().attivo, false);
});

test('avvio riuscito e doppio avvio rifiutato', async () => {
  const id = scenario();
  assert.deepEqual(await runner.avvia(id), { avviso: null });
  assert.equal(runner.situazione().attivo, true);
  await assert.rejects(runner.avvia(id), e => e.code === 'CONFLITTO');
});

test('stop con impianto offline: lo scenario si chiude comunque e avvisa', async () => {
  await runner.avvia(scenario()); plant._offline(true);
  const r = await runner.ferma({ spegni: true });
  assert.match(r.avviso, /non risponde/);
  assert.equal(runner.situazione().attivo, false);
});

test('salto di fase: fase fuori intervallo e scenario eliminato', async () => {
  const id = scenario(); await runner.avvia(id);
  await assert.rejects(runner.salta(9), e => e.code === 'VALIDAZIONE');
  await assert.rejects(runner.salta('1'), e => e.code === 'VALIDAZIONE');
  repo.elimina(id);
  await assert.rejects(runner.salta(0), e => e.code === 'NON_TROVATO');
  assert.equal(runner.situazione().attivo, false);
});

test('situazione con fase salvata fuori intervallo: solo la parte base', async () => {
  const id = scenario(); await runner.avvia(id);
  kvSet('run', { ...runner.run(), fase: 7 });
  const s = runner.situazione();
  assert.equal(s.attivo, true); assert.equal(s.fase, undefined);
});

test('azioni in parallelo passano in coda, una alla volta', async () => {
  const ordine = [];
  await Promise.all([1, 2, 3].map(n => runner.esclusivo(async () => { ordine.push('in' + n); await new Promise(r => setTimeout(r, 5)); ordine.push('out' + n); })));
  assert.deepEqual(ordine, ['in1', 'out1', 'in2', 'out2', 'in3', 'out3']);
});

test('pulizia: registro e letture più vecchi di 3 mesi', () => {
  assert.equal(CONSERVA_GIORNI, 90);
  const vecchio = Date.now() - 91 * 86400e3;
  db.prepare('INSERT INTO log (ts,tipo,testo) VALUES (?,?,?)').run(vecchio, 'info', 'vecchio');
  db.prepare('INSERT INTO readings (ts,unit,temp,setpoint,acceso,modo,allarme) VALUES (?,?,?,?,?,?,?)').run(vecchio, '11', 20, 20, 1, 5, 0);
  addLog('info', 'recente');
  const r = pota();
  assert.ok(r.log >= 1 && r.letture === 1);
  assert.ok(db.prepare("SELECT COUNT(*) n FROM log WHERE testo='recente'").get().n === 1);
});

test('comando manuale: valori non validi rifiutati', () => {
  assert.throws(() => comandoValido({ power: 'on' }), /destinazione/);
  assert.throws(() => comandoValido({ target: '11', power: 'acceso' }), /accensione/);
  assert.throws(() => comandoValido({ target: '11', setpoint: NaN }));
  assert.throws(() => comandoValido({ target: '11', setpoint: 'abc' }));
  assert.throws(() => comandoValido({ target: '11', modo: 99 }), /Modalità/);
  for (const v of ['constructor', 'toString', '__proto__', true, [2], '', ' ', 1.5, '2.5', false])
    assert.throws(() => comandoValido({ target: '11', modo: v }), /Modalità/, String(v));
  assert.throws(() => comandoValido({ target: '11', ventola: 'constructor' }), /ventola/);
  assert.equal(comandoValido({ target: '11', modo: '3' }).modo, 3);
  assert.equal(comandoValido({ target: '11', ventola: 2 }).ventola, 2);
  assert.throws(() => comandoValido({ target: '11' }), /Nessun/);
  assert.throws(() => comandoValido({ target: '11', oscillazione: 'si' }));
  assert.equal(comandoValido({ target: '11', setpoint: '21.5' }).setpoint, 21.5);
});

test('iscrizione push: solo https e chiavi, nient\'altro', () => {
  const ok = { endpoint: 'https://push.example/x', keys: { p256dh: 'a', auth: 'b' }, extra: 1 };
  assert.deepEqual(pulisci(ok), { endpoint: ok.endpoint, keys: { p256dh: 'a', auth: 'b' } });
  assert.throws(() => pulisci({ ...ok, endpoint: 'http://push.example/x' }), /non valida/);
  assert.throws(() => pulisci({ endpoint: ok.endpoint }), /non valida/);
  assert.throws(() => pulisci(null), /non valida/);
});

test('limita: NaN e fuori scala', () => {
  const r = { min: 16, max: 30 };
  assert.equal(limita(40, r), 30); assert.equal(limita(10, r), 16);
  assert.throws(() => limita(NaN, r));
});
