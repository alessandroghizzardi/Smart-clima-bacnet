const fs = require('fs'), path = require('path');
const { DatabaseSync } = require('node:sqlite');
const cfg = require('./config');

fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
const db = new DatabaseSync(cfg.dbPath);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA busy_timeout=3000;
CREATE TABLE IF NOT EXISTS readings (ts INTEGER NOT NULL, unit TEXT NOT NULL, temp REAL, setpoint REAL, acceso INTEGER, modo INTEGER, allarme INTEGER);
CREATE INDEX IF NOT EXISTS idx_readings ON readings(unit, ts);
CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);
-- scenari a fasi (modo: 1 raffrescamento, 5 riscaldamento; giorni/unita/fasi sono JSON)
CREATE TABLE IF NOT EXISTS scenari (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, modo INTEGER NOT NULL, giorni TEXT NOT NULL, gruppo TEXT, unita TEXT NOT NULL, fasi TEXT NOT NULL, creato INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, sub TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS log (ts INTEGER NOT NULL, tipo TEXT, testo TEXT);
CREATE INDEX IF NOT EXISTS idx_log_ts ON log(ts);
-- ambienti: gruppi di unità definiti dall'utente (usati in Stato, Grafico e Scenari)
CREATE TABLE IF NOT EXISTS ambienti (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, ordine INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ambienti_unita (ambiente INTEGER NOT NULL, unita TEXT NOT NULL, PRIMARY KEY (ambiente, unita));
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
`);

// Più scritture che vanno insieme: tutte o nessuna.
const tx = (fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };

const impostazioni = require('./impostazioni');
impostazioni.applica(db, tx); impostazioni.ricordaAvvio();

// Statement preparati una volta sola (CODE_POLICY §3): stessi risultati, meno lavoro a ogni chiamata.
const q = {
  log: db.prepare('INSERT INTO log (ts,tipo,testo) VALUES (?,?,?)'),
  kvGet: db.prepare('SELECT v FROM kv WHERE k=?'),
  kvSet: db.prepare('INSERT INTO kv (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'),
  potaLog: db.prepare('DELETE FROM log WHERE ts < ?'),
  potaLetture: db.prepare('DELETE FROM readings WHERE ts < ?'),
};
const addLog = (tipo, testo) => { q.log.run(Date.now(), tipo, testo); console.log(`[${tipo}] ${testo}`); };
const kvGet = (k) => { const r = q.kvGet.get(k); return r ? JSON.parse(r.v) : null; };
const kvSet = (k, v) => q.kvSet.run(k, JSON.stringify(v));

// Registro e letture storiche conservano gli ultimi 3 mesi (vedi ARCHITETTURA.md).
const CONSERVA_GIORNI = 90;
const pota = (ora = Date.now()) => {
  const limite = ora - CONSERVA_GIORNI * 86400e3;
  return { log: Number(q.potaLog.run(limite).changes), letture: Number(q.potaLetture.run(limite).changes) };
};

module.exports = { db, tx, addLog, kvGet, kvSet, pota, CONSERVA_GIORNI };
