// Nomi di modalità e ventola: unica fonte per il server (registro) e per l'app (arrivano con /api/config).
// Codici dell'impianto LG: modo 1 COOL, 2 DRY, 3 FAN, 4 AUTO, 5 HEAT · ventola 1 LOW, 2 MIDDLE, 3 HIGH, 4 AUTO.
const MODO_FASE = { vent: 3, deum: 2 };                 // tipo di fase senza temperatura → modalità da impostare
const TIPO_MODO = { 3: 'vent', 2: 'deum' };             // modalità dello scenario → tipo delle sue fasi (solo vent/deum)

module.exports = {
  MODO_FASE, TIPO_MODO,
  modi: { 1: 'Raffrescamento', 2: 'Deumidificazione', 3: 'Ventilazione', 4: 'Auto', 5: 'Riscaldamento' },
  modiBrevi: { 1: 'Raff.', 2: 'Deum.', 3: 'Vent.', 4: 'Auto', 5: 'Risc.' },
  ordineModi: [1, 5, 3, 2, 4],
  ventola: { 1: 'Bassa', 2: 'Media', 3: 'Alta', 4: 'Auto' },
  ventolaBrevi: { 1: 'Min', 2: 'Med', 3: 'Max', 4: 'Auto' },
  senzaTemp: { vent: 'Vent.', deum: 'Deum.' },          // etichetta breve delle fasi senza temperatura
};
