// Unità nel database: a tabella vuota si creano da bacnet-map con nomi provvisori, ordinate per id.
const os = require('node:os'), path = require('node:path'), fs = require('node:fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clima-unita-'));
Object.assign(process.env, { MOCK: 'on', CONFIG_ESEMPIO: 'on', DB_PATH: path.join(dir, 'test.db') });

const test = require('node:test'), assert = require('node:assert/strict');
const cfg = require('../src/config');
const { db } = require('../src/db');
const units = require('../src/units');

test('unità create da bacnet-map al primo avvio', () => {
  const ids = Object.keys(cfg.leggiFile('bacnet-map'));
  assert.deepEqual(units.unita.map(u => u.id), ids);
  assert.deepEqual(units.unita[0], { id: ids[0], nome: `Unità ${ids[0]}` });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM unita').get().n, ids.length);
  assert.deepEqual(units.risolvi('all'), ids);
  assert.throws(() => units.risolvi('unit:999'), /non fa parte/);
});
