// Genera config/bacnet-map.json dall'elenco oggetti letto da AC Smart 5 (scripts/oggetti-bacnet-letti.json)
const fs = require('fs'), path = require('path');
const TYPES = {'analog-input':0,'analog-output':1,'analog-value':2,'binary-input':3,'binary-output':4,'binary-value':5,'multi-state-input':13,'multi-state-output':14,'device':8};
const righe = JSON.parse(fs.readFileSync(path.join(__dirname,'oggetti-bacnet-letti.json'),'utf8'));
const VOCI = {
  startStopCmd:'StartStopCommand', startStopStatus:'StartStopStatus',
  setTempCmd:'SetRoomTemp', setTempStatus:'SetTempStatus', roomTemp:'RoomTemp',
  modeCmd:'AirConModeCommand', modeStatus:'AirConModeStatus',
  fanCmd:'FanSpeedCommand', fanStatus:'FanSpeedStatus',
  swingCmd:'SwingCommand', swingStatus:'SwingStatus',
  alarm:'Alarm', malfunction:'MalfunctionCode'
};
const unita = {};
for (const [oid, p] of righe) {
  const m = /^ac_(.+)_(\d+)$/.exec(p['object-name'] || '');
  if (!m) continue;
  const [tipo, inst] = oid.split(',');
  (unita[m[2]] ||= {})[m[1]] = { type: TYPES[tipo], instance: Number(inst) };
}
const mappa = {};
for (const [addr, oggetti] of Object.entries(unita)) {
  mappa[addr] = {};
  for (const [chiave, nome] of Object.entries(VOCI)) {
    if (!oggetti[nome]) throw new Error(`manca ${nome} per unità ${addr}`);
    mappa[addr][chiave] = oggetti[nome];
  }
}
fs.writeFileSync(path.join(__dirname,'..','config','bacnet-map.json'), JSON.stringify(mappa, null, 1));
console.log('unità:', Object.keys(mappa).join(','), '— voci per unità:', Object.keys(VOCI).length);
