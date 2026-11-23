const test = require('node:test'), assert = require('node:assert/strict');
const { valida } = require('../src/engine/ambienti');
const note = { 11: true, 12: true, 13: true }, es = [{ id: '1', nome: 'Soggiorno', unita: ['11'] }];

test('ambiente valido: nome ripulito, unità senza doppioni', () => {
  assert.deepEqual(valida({ nome: '  Zona   notte ', unita: ['11', 11, '12'] }, note, es), { nome: 'Zona notte', unita: ['11', '12'] });
});
test('rifiuta nome vuoto, duplicato, nessuna unità o unità ignota', () => {
  assert.throws(() => valida({ nome: ' ', unita: ['11'] }, note, es), /nome/);
  assert.throws(() => valida({ nome: 'soggiorno', unita: ['11'] }, note, es), /già/);
  assert.throws(() => valida({ nome: 'A', unita: [] }, note, es), /almeno/);
  assert.throws(() => valida({ nome: 'A', unita: ['99'] }, note, es), /sconosciuta/);
});
test('in modifica il proprio nome non è un duplicato', () => {
  assert.equal(valida({ nome: 'Soggiorno', unita: ['12'] }, note, es, '1').nome, 'Soggiorno');
});
