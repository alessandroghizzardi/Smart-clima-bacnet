// Adattatore dell'impianto: BACnet reale oppure simulato (MOCK=on). Il resto dell'app dipende solo da questo modulo.
const cfg = require('./config');
module.exports = cfg.mock ? require('./mock-plant') : require('./bacnet');
