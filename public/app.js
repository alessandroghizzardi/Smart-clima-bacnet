'use strict';
// ===== Smart Clima — front-end (HTML+JS semplice, nessuna build). Le viste sono funzioni che ritornano HTML.
const $ = (s, r = document) => r.querySelector(s);
const MODI = { 1: 'Raff.', 2: 'Deum.', 3: 'Vent.', 4: 'Auto', 5: 'Risc.' }, ORDINE_MODI = [1, 5, 3, 2, 4];
const VENT = { 1: 'Min', 2: 'Med', 3: 'Max', 4: 'Auto' };
const GG = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'], GG_ORD = [1, 2, 3, 4, 5, 6, 0], GG_L = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
const MES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const COL = ['#e0824f', '#5aa9d6', '#7fc27a', '#a597e0', '#f0dc7a', '#4fc3b5', '#d4604a', '#9aa7b4'];

let CFG, STATO = {}, ORA = null, TS = null, ERR = null, RUN = { attivo: false }, SC = [], LOG = [];
let TAB = 'stato', SUB = null, SHEET = null, FILTRO = 'tutti', chart = null;
const S = { pt: { pw: null, sp: null, modo: null, vent: null, osc: null }, ud: null, wz: null, ph: null, am: null,
  g: { range: '7', sel: ['all'], altre: false, hist: null, applied: false }, dt: { f: null, t: null, m: null } };

const I = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
const IC = {
  cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  1: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17L19.1 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>',
  2: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  3: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1-7 4-7 3 0 3 4 0 6l-2.5 1.5M14 12c4 0 7 1 7 4 0 3-4 3-6 0l-1.5-2.5M12 14c0 4-1 7-4 7-3 0-3-4 0-6l2.5-1.5M10 12c-4 0-7-1-7-4 0-3 4-3 6 0l1.5 2.5"/>',
  4: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  5: '<path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', loop: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>',
  power: '<path d="M12 3v9M6.3 6.8a8 8 0 1 0 11.4 0"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>', play: '<path d="M7 4l13 8-13 8z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>', right: '<path d="M9 5l7 7-7 7"/>', left: '<path d="M15 5l-7 7 7 7"/>',
  osc: '<path d="M7 5l-4 4 4 4M17 11l4 4-4 4M3 9h13M21 15H8"/>', fermo: '<path d="M5 12h14"/>',
  tStato: '<path d="M4 11l8-7 8 7v9H4z"/>', tGraf: '<path d="M3 17l5-6 4 3 8-9"/>', tScen: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>', tAmb: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>', tAltro: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
};
const ic = (k, s) => `<span style="display:inline-flex;${s ? `width:${s}px;height:${s}px` : ''}">${I(IC[k])}</span>`;

// ---- utilità
const api = async (url, method = 'GET', body) => {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.errore || r.statusText); return j;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n, d = 1) => n == null || Number.isNaN(n) ? '–' : Number(n).toFixed(d).replace('.', ',');
const hm = (ts) => new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const W = () => CFG.scrittura ? '' : ' dis';
const LIM = () => [CFG.setpoint?.min ?? 16, CFG.setpoint?.max ?? 26];
const clamp = (v) => Math.min(LIM()[1], Math.max(LIM()[0], v));
const unita = (id) => CFG.unita.find(u => u.id === id) || { id, nome: id };
const grp = (id) => CFG.gruppi.find(g => g.id === id);
const gruppiVisibili = () => CFG.gruppi;
// Banner di notifica a fascia dall'alto: tipo 'ok' | 'err' | 'warn', titolo + dettaglio opzionale.
const TOAST_IC = { ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', err: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.8v.01"/>', warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>' };
function toast(t, tipo = 'ok', d = '') {
  const e = $('#toast'), ms = tipo === 'ok' ? 5000 : 9000;
  e.className = 't-' + tipo; e.style.setProperty('--dur', ms + 'ms');
  e.innerHTML = `<div class="ti"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${TOAST_IC[tipo]}</svg></div><div class="tx"><b>${esc(t)}</b>${d ? `<span>${esc(d)}</span>` : ''}</div><div class="tclose"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></div><div class="tbar"><i></i></div>`;
  e.style.display = 'flex'; void e.offsetWidth; e.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(chiudiToast, ms);
}
function chiudiToast() { const e = $('#toast'); e.classList.remove('show'); clearTimeout(toast.h); toast.h = setTimeout(() => { if (!e.classList.contains('show')) e.style.display = 'none'; }, 250); }
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dm = (s) => { const [, m, d] = s.split('-'); return `${Number(d)} ${MES[Number(m) - 1]}`; };
const dmg = (s) => { const [y, m, d] = s.split('-').map(Number); return `${GG[new Date(y, m - 1, d).getDay()]} ${d} ${MES[m - 1]}`; };
const minuti = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const nomeGruppoDi = (ids) => { if (ids.length === CFG.unita.length) return 'Tutto l\'impianto'; const g = gruppiVisibili().find(g => g.unita.length === ids.length && g.unita.every(x => ids.includes(x))); return g ? g.nome : 'Selezione'; };

async function ctl(target, f, ok) {
  const [tipo, id] = target.split(':'), pw = f.power === 'on' ? true : f.power === 'off' ? false : null;
  const prima = tipo === 'unit' && STATO[id] ? { ...STATO[id] } : null;
  if (prima) {                                        // aggiornamento immediato: il tasto risponde subito
    if (pw !== null) STATO[id].acceso = pw;
    if (f.setpoint !== undefined && f.setpoint !== null) STATO[id].setpoint = f.setpoint;
    ATTESA[id] = { acceso: pw, setpoint: f.setpoint ?? null, fino: Date.now() + 25000 };   // finché l'impianto non conferma, le letture vecchie non sovrascrivono
    rerender();
  }
  try {
    const r = await api('/api/control', 'POST', { target, ...f });
    const n = (r.comandi || []).length, ko = (r.comandi || []).filter(c => !c.ok).length;
    const c0 = (r.comandi || [])[0], nome = id && CFG.unita.find(u => u.id === id)?.nome;
    if (ko) toast('Comando non riuscito', 'err', (r.comandi.find(c => !c.ok) || {}).errore || 'L\'impianto non ha risposto');
    else if (!n) toast('Già così', 'warn', 'Nessuna modifica da inviare');
    else toast(ok || 'Comando inviato', 'ok', n === 1 && nome ? nome : `${n} modifiche inviate`);
    if (ko && prima) { delete ATTESA[id]; STATO[id] = prima; rerender(); }
    // verifica: rilegge dall'impianto a 3, 8 e 15 s; avvisa solo se alla fine non ha ancora eseguito
    if (prima && !ko && pw !== null) {
      const nome = CFG.unita.find(u => u.id === id)?.nome || 'Unità';
      for (const t of [3000, 5000, 7000]) {
        await new Promise(r => setTimeout(r, t));
        await caricaStato(true);
        if (!ATTESA[id]) { caricaLog(); return; }
      }
      delete ATTESA[id]; await caricaStato(true);
      toast(`${nome} non risulta ${pw ? 'accesa' : 'spenta'}`, 'warn', 'L\'impianto non ha ancora confermato: controlla l\'unità o riprova');
      caricaLog();
    } else setTimeout(() => { caricaStato(true); caricaLog(); }, 3000);
  } catch (e) { if (prima) { delete ATTESA[id]; STATO[id] = prima; rerender(); } toast(e.message, 'err'); }
}
const aggiorna = () => Promise.all([caricaStato(), caricaRun()]);
// Conferma in sovraimpressione (al posto di window.confirm): tocca fuori o "Annulla" per chiudere.
let CONF = null;
const conferma = (t, fn, o = {}) => { CONF = { fn }; const d = $('#dlg'); d.innerHTML = `<div class="dim" data-a="confNo"></div><div class="dlg" role="dialog" aria-modal="true"><b>${esc(o.titolo || 'Confermi?')}</b><p>${esc(t)}</p><div class="r"><button class="cta g" data-a="confNo">Annulla</button><button class="cta${o.pericolo ? ' bad' : ''}" data-a="confSi">${esc(o.ok || 'Conferma')}</button></div></div>`; };
const chiudiConf = () => { $('#dlg').innerHTML = ''; const c = CONF; CONF = null; return c; };

// ---- caricamento dati
const ATTESA = {};   // comandi inviati e non ancora confermati dall'impianto: id -> valori attesi
function applicaAttese(stato) {
  for (const [id, a] of Object.entries(ATTESA)) {
    const u = stato[id];
    if (!u || Date.now() > a.fino) { delete ATTESA[id]; continue; }
    const okP = a.acceso === null || !!u.acceso === a.acceso, okS = a.setpoint === null || Number(u.setpoint) === Number(a.setpoint);
    if (okP && okS) delete ATTESA[id];                       // confermato
    else { if (a.acceso !== null) u.acceso = a.acceso; if (a.setpoint !== null) u.setpoint = a.setpoint; }
  }
  return stato;
}
async function caricaStato(live) {
  try {
    const s = await api('/api/state' + (live === true ? '?live=1' : ''));
    STATO = applicaAttese(s.stato || {}); ORA = s.ora; TS = s.ts; ERR = s.errore || null; CFG.scrittura = s.scrittura;
  } catch (e) { ERR = e.message; }
  rerender();
}
async function caricaRun() {
  try { RUN = await api('/api/run'); } catch { RUN = { attivo: false }; }
  if (TAB === 'scenari' || SUB?.k === 'scd') { try { SC = await api('/api/scenari'); } catch {} }
  rerender();
}
let LOGFINE = false, LOGBUSY = false, LOGSC = [];
let IMP = [], IMPD = {}, PERIC = false;
async function caricaImp() { try { IMP = await api('/api/impostazioni'); } catch {} rerender(); }
function vImp() {
  const gr = [...new Set(IMP.map(i => i.gruppo))], riav = IMP.some(i => i.daRiavviare);
  return `<div class="lb">Impostazioni di sistema</div>
  <div class="panel danger"><div class="row"><div><b>Zona pericolo</b><span>Sblocca per modificare server, porta e impianto. Un valore errato può far perdere il collegamento.</span></div><button class="sw ${PERIC ? 'on' : ''}" data-a="peric"></button></div>
  ${riav ? '<div class="note" style="color:var(--bad)">Modifiche salvate: riavvia il server per applicarle.</div>' : ''}
  ${IMP.length ? gr.map(g => `<div class="lbl">${esc(g)}</div>${IMP.filter(i => i.gruppo === g).map(i => `<label class="fld${PERIC ? '' : ' lock'}"><small>${esc(i.label)}${i.riavvio ? ' · al riavvio' : ''}</small><input data-imp="${i.k}" value="${esc(String(IMPD[i.k] ?? i.valore).replace('.', i.tipo === 'num' ? ',' : '.'))}" ${PERIC ? '' : 'disabled'} inputmode="${i.tipo === 'testo' ? 'text' : 'decimal'}">${i.aiuto ? `<span class="cap">${esc(i.aiuto)}</span>` : ''}</label>`).join('')}`).join('') : '<div class="note">Caricamento…</div>'}
  <button class="cta bad${PERIC ? '' : ' off'}" data-a="impsalva">Salva impostazioni</button></div>`;
}
async function caricaLog() {          // prima pagina (le voci più vecchie già caricate restano)
  try {
    const f = await api('/api/log?limit=30'), min = f.length ? f[f.length - 1].id : 0;
    LOG = f.concat(LOG.filter(l => l.id < min)); if (!LOG.length || f.length < 30) LOGFINE = LOG.length <= f.length;
  } catch {} rerender();
}
async function altroLog() {           // scorrimento continuo: 30 voci alla volta
  if (LOGFINE || LOGBUSY || !LOG.length) return; LOGBUSY = true;
  try { const p = await api('/api/log?limit=30&before=' + LOG[LOG.length - 1].id); LOG = LOG.concat(p); if (p.length < 30) LOGFINE = true; } catch {}
  LOGBUSY = false; rerender();
}
async function logScenario(nome) { try { LOGSC = await api('/api/log?limit=5&q=' + encodeURIComponent(`"${nome}"`)); } catch {} rerender(); }
function rerender() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT') && (SUB || a.dataset.imp)) return;      // non cancellare ciò che si sta scrivendo
  const y = scrollY, lb = document.querySelector('.logbox'), t = lb ? lb.scrollTop : 0; render(); scrollTo(0, y);
  const nb = document.querySelector('.logbox'); if (nb) nb.scrollTop = t;
}

// ---- struttura
function hdr() {
  const eta = TS ? (Date.now() - TS) / 60000 : null, offline = !!ERR, cls = eta == null ? 'bad' : eta > 10 ? 'old' : '';
  const [, m, g] = ORA ? ORA.data.split('-') : [], giorno = ORA ? `${GG[ORA.giorno]} ${Number(g)} ${MES[Number(m) - 1]}` : '';
  const h = $('#hd'); h.classList.toggle('off', offline); document.body.classList.toggle('offl', offline);
  h.innerHTML = offline
    ? `<span class="oi">${I(IC.warn)}</span><div class="ot"><b>Impianto non raggiungibile</b><span>${esc(CFG?.nome)} · ultima lettura ${TS ? hm(TS) : 'mai'}${giorno && ' · ' + giorno}</span></div><button class="ob" data-a="live">Riprova</button>`
    : `<span class="lv"><i class="${cls}"></i>Impianto · ${esc(CFG?.nome)}</span><span>·</span><span>${ORA ? `<b>${giorno}</b> · ${ORA.ora}` : ''}</span>`;
}
function navBar() {
  const t = [['stato', 'Stato', 'tStato'], ['grafico', 'Grafico', 'tGraf'], ['scenari', 'Scenari', 'tScen'], ['ambienti', 'Ambienti', 'tAmb'], ['altro', 'Altro', 'tAltro']];
  $('#nav').innerHTML = t.map(([k, n, i]) => `<button class="${TAB === k ? 'on' : ''}" data-a="tab" data-t="${k}">${I(IC[i])}${n}</button>`).join('');
}
function render() {
  if (!CFG || DRAG) return;   // durante il trascinamento il DOM non va ricostruito
  document.body.classList.toggle('ro', !CFG.scrittura);
  hdr(); navBar();
  let h;
  if (SUB) h = { unit: vUnit, scd: vScd, wiz: vWiz, ph: vFase, amb: vAmb }[SUB.k](); else h = { stato: vStato, grafico: vGrafico, scenari: vScenari, ambienti: vAmbienti, altro: vAltro }[TAB]();
  $('#v').innerHTML = h;
  $('#ov').innerHTML = SHEET ? vSheet() : '';
  if (!SUB && TAB === 'grafico') disegna();
}
const wh = (t, s, extra = '') => `<div class="wh"><button class="bk" data-a="back">${I(IC.back)}</button><div><b>${esc(t)}</b><span>${esc(s || '')}</span></div>${extra}</div>`;

// ---- elementi comuni
const seg = (opts, cur, act, cls = '') => `<div class="seg ${cls}">${opts.map(([k, l]) => `<button class="${String(cur) === String(k) ? 'on' : ''}" data-a="${act}" data-v="${k}">${l}</button>`).join('')}</div>`;
const modiGrid = (cur, act) => `<div class="mg">${ORDINE_MODI.map(m => `<button class="mc m${m} ${cur === m ? 'on' : ''}" data-a="${act}" data-v="${m}">${I(IC[m])}${MODI[m]}</button>`).join('')}</div>`;
const bars = (v) => { const n = v === 4 ? 3 : v; return `<span class="fb">${[5, 9, 14].map((h, i) => `<i style="height:${h}px;opacity:${i < n ? 1 : .3}"></i>`).join('')}</span>`; };
const stepSp = (v, act, data = '') => `<div class="step"><button data-a="${act}" data-d="-0.5" ${data}>${I(IC.minus)}</button><span data-a="spsheet" data-k="${act}" ${data}>${v == null ? '–' : fmt(v) + ' °C'}</span><button data-a="${act}" data-d="0.5" ${data}>${I(IC.plus)}</button></div>`;
const bst = (v, act, unit = '°C', extra = '') => `<div class="bst"><button data-a="${act}" data-d="-0.5" ${extra}>${I(IC.minus)}</button><div data-a="spsheet" data-k="${act}" ${extra}><b>${fmt(v)}</b> <small>${unit}</small></div><button data-a="${act}" data-d="0.5" ${extra}>${I(IC.plus)}</button></div>`;
const oscSeg = (cur, act) => `<div class="seg">${[[false, 'Ferma'], [true, 'Su–giù']].map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-a="${act}" data-v="${k}">${l}</button>`).join('')}</div>`;

// ===== STATO
const idsFiltro = () => FILTRO === 'tutti' ? CFG.unita.map(u => u.id) : (grp(FILTRO)?.unita || []);
function vStato() {
  const all = CFG.unita.map(u => STATO[u.id]).filter(Boolean), t = all.map(s => s.temp).filter(v => v != null);
  const on = all.filter(s => s.acceso).length, avg = t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
  
  const h = ORA ? Number(ORA.ora.slice(0, 2)) : 12, saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const titolo = on === 0 ? 'La casa è spenta' : avg != null && avg < 17 ? 'La casa è fredda' : avg != null && avg < 21 ? 'La casa si sta scaldando' : 'La casa è in temperatura';
  const ids = idsFiltro(), nome = FILTRO === 'tutti' ? 'Tutte' : grp(FILTRO).nome, PT = S.pt;
  return `<div class="hero"><div class="l"><span>${saluto}</span><button class="badge ${CFG.scrittura ? '' : 'w'}" data-a="sheetModo"><i></i>${CFG.scrittura ? 'Scrittura attiva' : 'Sola lettura'}</button></div>
    <h2>${titolo}</h2><div class="big"><div><b>${avg != null ? fmt(avg).split(',')[0] : '–'}</b><sup>${avg != null ? ',' + fmt(avg).split(',')[1] + '°' : ''}</sup></div><small>media interna<br>${TS ? 'aggiornato ' + hm(TS) : 'in attesa lettura'}</small></div>
    <div class="stat"><div><b>${on} / ${CFG.unita.length}</b><span>unità accese</span></div><div><b>${all.filter(s => s.allarme).length}</b><span>allarmi</span></div></div></div>
  ${schedaScenario()}
  <div class="quick"><button class="q" data-a="live">${I(IC.refresh)}Aggiorna ora</button></div>
  <div class="segw"><div class="seg x">${[['tutti', 'Tutte'], ...gruppiVisibili().map(g => [g.id, g.nome])].map(([k, l]) => `<button class="${FILTRO === k ? 'on' : ''}" data-a="filtro" data-v="${k}">${esc(l)}</button>`).join('')}</div></div>
  ${!CFG.scrittura ? '' : `<div class="panel"><div class="t"><b>Modifica</b><span class="chip">${esc(nome)} · ${ids.length} unità</span></div>
    <div class="prow${W()}"><div class="pp">${[['on', 'Accendi'], ['off', 'Spegni']].map(([k, l]) => `<button class="${PT.pw === k ? 'on' : ''}" data-a="ptpw" data-v="${k}">${k === 'on' ? I(IC.power) : ''}${l}</button>`).join('')}</div>${stepSp(PT.sp, 'ptsp')}</div>
    <div class="lbl">Modalità</div><div class="${W()}">${modiGrid(PT.modo, 'ptmodo')}</div>
    <div class="lbl">Ventilatore</div><div class="${W()}">${seg(Object.entries(VENT), PT.vent, 'ptvent')}</div>
    <div class="lbl">Oscillazione</div><div class="${W()}">${oscSeg(PT.osc, 'ptosc')}</div>
    <button class="cta${W()}" style="--c:var(--c${PT.modo || 5})" data-a="ptapplica">Applica a ${ids.length} unità</button><div class="note">Poi puoi comunque ritoccare ogni stanza</div></div>`}
  <div class="list">${ids.map(id => cardUnita(unita(id), STATO[id] || {})).join('')}</div>`;
}
// Anello: quanto manca al setpoint (solo unità accese in Raff./Risc.; negli altri modi resta vuoto)
const RING_SPAN = 5;
const ringP = (s) => {
  if (!s.acceso || s.temp == null || s.setpoint == null || (s.modo !== 1 && s.modo !== 5)) return 0;
  const manca = s.modo === 5 ? s.setpoint - s.temp : s.temp - s.setpoint;
  return Math.round(Math.max(0, Math.min(1, 1 - manca / RING_SPAN)) * 100);
};
function cardUnita(u, s) {
  const c = s.acceso ? `var(--c${s.modo || 5})` : 'var(--muted)', p = ringP(s);
  return `<div class="u ${s.acceso ? 'on' : ''}" style="--c:${c}"><div class="rw"><div class="ring" style="--p:${p}"><div>${fmt(s.temp)}</div></div>${s.acceso ? `<span class="rb">${I(IC[s.modo || 5])}</span>` : ''}</div>
    <div class="m" data-a="unit" data-id="${u.id}"><b>${esc(u.nome)}</b><span>Gruppo ${u.id}${s.allarme ? ' · ⚠ allarme' : ''}</span>
      <div class="mi">${s.acceso ? `<span class="mf">${MODI[s.modo] || ''}</span><span class="mf">${bars(s.ventola)} ${VENT[s.ventola] || ''}</span>` : `<span class="mf">Spento</span>${s.modo ? `<span class="mf">${MODI[s.modo] || ''}</span><span class="mf">${bars(s.ventola)} ${VENT[s.ventola] || ''}</span>` : ''}`}</div>
      ${CFG.scrittura ? stepSp(s.setpoint, 'usp', `data-id="${u.id}"`) : (s.acceso ? `<span class="mf">Setpoint ${fmt(s.setpoint)} °C</span>` : '')}</div>
    ${CFG.scrittura ? `<button class="pwb ${s.acceso ? 'on' : ''}" data-a="upw" data-id="${u.id}">${I(IC.power)}</button>` : ''}</div>`;
}

// ===== DETTAGLIO UNITÀ
function apriUnita(id) {
  const s = STATO[id] || {};
  S.ud = { id, pw: !!s.acceso, sp: s.setpoint ?? 20, modo: s.modo ?? 5, vent: s.ventola ?? 4, osc: !!s.oscillazione };
  SUB = { k: 'unit' }; scrollTo(0, 0);
}
function vUnit() {
  const d = S.ud, u = unita(d.id), s = STATO[d.id] || {}, c = d.pw ? `var(--c${d.modo})` : 'var(--muted)', p = ringP(s);
  const mod = d.pw !== !!s.acceso || d.sp !== s.setpoint || d.modo !== s.modo || d.vent !== s.ventola || d.osc !== !!s.oscillazione;   // Applica attivo solo se c'è una modifica
  return `${wh(u.nome, 'Gruppo ' + u.id)}
  <div class="panel" style="--c:${c}"><div class="u" style="--c:${c};border:0;background:none;padding:0"><div class="rw"><div class="ring" style="--p:${p}"><div>${fmt(s.temp)}</div></div><span class="rb">${I(IC[d.modo])}</span></div>
    <div class="m" style="cursor:default"><b>${MODI[d.modo]}</b><span>Temperatura attuale · aggiornato ${TS ? hm(TS) : '–'}</span></div></div></div>
  <div class="panel${W()}"><div class="t"><b>Operazione</b><span>${d.pw ? 'Acceso' : 'Spento'}</span></div><div class="acts">${seg([['on', 'Acceso'], ['off', 'Spento']], d.pw ? 'on' : 'off', 'udpw')}<button class="pwb ${d.pw ? 'on' : ''}" style="--c:${c}" data-a="udpwt">${I(IC.power)}</button></div>
    <div class="lbl">Modalità</div>${modiGrid(d.modo, 'udmodo')}
    <div class="lbl">Temperatura impostata</div>${bst(d.sp, 'udsp')}
    <div class="lbl">Ventilatore</div>${seg(Object.entries(VENT), d.vent, 'udvent')}
    <div class="lbl">Oscillazione</div>${oscSeg(d.osc, 'udosc')}</div>
  <div class="panel"><div class="t"><b>Limiti temperatura</b><span>${fmt(LIM()[0])} – ${fmt(LIM()[1])} °C</span></div><div class="cap" style="margin:0">Gestiti da AC Smart · sola lettura</div></div>
  <button class="cta${W()}${mod ? '' : ' off'}" style="--c:var(--c${d.modo})" data-a="udapplica">Applica</button><div style="height:20px"></div>`;
}

// ===== GRAFICO
const idsSerie = (k) => k === 'all' ? CFG.unita.map(u => u.id) : k.startsWith('g:') ? grp(k.slice(2)).unita : [k.slice(2)];
const nomeSerie = (k) => k === 'all' ? 'Tutto' : k.startsWith('g:') ? grp(k.slice(2)).nome : unita(k.slice(2)).nome;
function periodo() {
  const g = S.g, b = Date.now();
  if (g.range === 'c') { if (!g.applied || !S.dt.f) return null; return [new Date(S.dt.f + 'T00:00').getTime(), new Date((S.dt.t || S.dt.f) + 'T23:59:59').getTime()]; }
  return [b - Number(g.range) * 86400e3, b];
}
async function caricaStorico() {
  const p = periodo(); if (!p) { S.g.hist = null; return rerender(); }
  try { const h = await api(`/api/history?from=${p[0] - 86400e3}&to=${p[1]}`); S.g.hist = { p, serie: h.serie }; } catch { S.g.hist = null; }
  rerender();
}
function calcola(k) {
  const H = S.g.hist; if (!H) return [];
  const m = new Map(); idsSerie(k).forEach(id => (H.serie[id] || []).forEach(([ts, t]) => { if (t == null) return; const e = m.get(ts) || [0, 0]; e[0] += t; e[1]++; m.set(ts, e); }));
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([ts, [s, n]]) => [ts, s / n]);
}
function vGrafico() {
  const g = S.g, R = [['1', '24 ore'], ['7', '7 giorni'], ['30', '30 giorni'], ['c', 'Date…']];
  let h = `<div class="h1">Temperature</div>${seg(R, g.range, 'range')}`;
  if (g.range === 'c' && !g.applied) return h + vDate();
  const prim = g.sel[0], pts = calcola(prim), p = periodo(), inP = p ? pts.filter(x => x[0] >= p[0]) : [];
  const ult = inP.length ? inP[inP.length - 1] : null;
  let conf = ''; if (ult) { const prima = pts.reduce((b, x) => Math.abs(x[0] - (ult[0] - 86400e3)) < Math.abs((b || x)[0] - (ult[0] - 86400e3)) ? x : b, null); if (prima && ult[0] - prima[0] > 20 * 3600e3 && ult[0] - prima[0] < 28 * 3600e3) { const d = ult[1] - prima[1]; conf = `<span class="dl ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}° vs ieri</span>`; } }
  const v = inP.map(x => x[1]);
  h += `<div class="panel"><div class="gh"><div><small>${esc(nomeSerie(prim))} · ora</small><b>${ult ? fmt(ult[1]) + '°' : '–'}</b></div>${conf}</div><div class="chart"><canvas id="chart"></canvas></div></div>
  <div class="lb">Ambienti · tocca per sovrapporre</div><div class="lgd">${[['all', 'Tutto'], ...gruppiVisibili().map(x => ['g:' + x.id, x.nome])].map(([k, l]) => chipSerie(k, l)).join('')}</div>
  <div class="lb">Singole unità</div><div class="lgd">${CFG.unita.slice(0, g.altre ? 99 : 6).map(u => chipSerie('u:' + u.id, u.nome)).join('')}${g.altre ? '' : `<button data-a="altre">+ altre</button>`}</div>
  <div class="panel"><div class="mm"><div><b>${v.length ? fmt(Math.min(...v)) + '°' : '–'}</b><br><span>min</span></div><div><b>${v.length ? fmt(v.reduce((a, b) => a + b, 0) / v.length) + '°' : '–'}</b><br><span>media</span></div><div><b>${v.length ? fmt(Math.max(...v)) + '°' : '–'}</b><br><span>max</span></div></div></div>
  <div class="cap">${v.length ? `${v.length} letture · una ogni ${CFG.pollMinutes} min` : 'Nessun dato nel periodo (la prima lettura può richiedere qualche minuto).'}</div>`;
  if (g.range === 'c') h += `<div class="cap">Periodo: ${dm(S.dt.f)}${S.dt.t && S.dt.t !== S.dt.f ? ' – ' + dm(S.dt.t) : ''}</div>`;
  return h;
}
function chipSerie(k, l) { const i = S.g.sel.indexOf(k), c = COL[(i < 0 ? 0 : i) % COL.length]; return `<button class="${i >= 0 ? 'on' : ''}" style="--c:${c}" data-a="serie" data-k="${k}"><i></i>${esc(l)}</button>`; }
function disegna() {
  const cv = $('#chart'); if (chart) { chart.destroy(); chart = null; } if (!cv || !S.g.hist) return;
  const p = S.g.hist.p, mu = getComputedStyle(document.body).getPropertyValue('--muted').trim(), ln = getComputedStyle(document.body).getPropertyValue('--line').trim();
  const ds = S.g.sel.map((k, i) => ({ label: nomeSerie(k), data: calcola(k).filter(x => x[0] >= p[0]).map(x => ({ x: x[0], y: x[1] })), borderColor: COL[i % COL.length], borderWidth: 2.5, pointRadius: 0, tension: .3, fill: i === 0 ? 'origin' : false, backgroundColor: i === 0 ? COL[0] + '30' : undefined }));
  chart = new Chart(cv, { type: 'line', data: { datasets: ds }, options: { responsive: true, maintainAspectRatio: false, parsing: false, animation: false, interaction: { mode: 'nearest', intersect: false },
    scales: { x: { type: 'linear', min: p[0], max: p[1], grid: { color: ln }, ticks: { color: mu, maxTicksLimit: 5, callback: v => new Date(v).toLocaleString('it-IT', S.g.range === '1' ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }) } }, y: { grid: { color: ln }, ticks: { color: mu, callback: v => fmt(v) } } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => new Date(i[0].parsed.x).toLocaleString('it-IT'), label: c => `${c.dataset.label}: ${fmt(c.parsed.y)} °C` } } } } });
}
function vDate() {
  const dt = S.dt; if (!dt.m) { const n = new Date(); dt.m = new Date(n.getFullYear(), n.getMonth(), 1); }
  const m = dt.m, primo = (m.getDay() + 6) % 7, giorni = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), celle = [];
  for (let i = primo; i > 0; i--) celle.push([new Date(m.getFullYear(), m.getMonth(), 1 - i), true]);
  for (let d = 1; d <= giorni; d++) celle.push([new Date(m.getFullYear(), m.getMonth(), d), false]);
  while (celle.length % 7) celle.push([new Date(m.getFullYear(), m.getMonth() + 1, celle.length - primo - giorni + 1), true]);
  const oggiS = ymd(new Date()), dmin = dt.f, dmax = dt.t || dt.f;
  const cal = celle.map(([d, fuori]) => { const s = ymd(d), est = s === dmin || s === dmax, dentro = dmin && s >= dmin && s <= dmax, cl = [fuori ? 'd' : '', dentro && dmin !== dmax ? 'r' : '', s === dmin && dmax !== dmin ? 'rs' : '', s === dmax && dmax !== dmin ? 're' : '', s === oggiS ? 't' : ''].join(' ');
    return `<span class="${cl}" data-a="giorno" data-d="${s}">${est ? `<b class="a">${d.getDate()}</b>` : d.getDate()}</span>`; }).join('');
  const lab = dt.f ? `${dm(dt.f)}${dt.t && dt.t !== dt.f ? ' – ' + dm(dt.t) : ''}` : '';
  return `<div class="dtr"><div class="fld"><small>Dal</small><b>${dt.f ? dmg(dt.f) : '–'}</b></div><div class="fld"><small>Al</small><b>${dt.t || dt.f ? dmg(dt.t || dt.f) : '–'}</b></div></div>
  <div class="panel"><div class="cm"><button data-a="mese" data-d="-1">${I(IC.left)}</button><b>${['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'][m.getMonth()]} ${m.getFullYear()}</b><button data-a="mese" data-d="1">${I(IC.right)}</button></div>
    <div class="cal">${['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => `<span class="h">${x}</span>`).join('')}${cal}</div></div>
  <div class="lb">Scorciatoie</div><div class="lgd">${[['we', 'Questo weekend'], ['wes', 'Weekend scorso'], ['14', 'Ultimi 14 giorni'], ['mese', 'Questo mese']].map(([k, l]) => `<button data-a="scorc" data-k="${k}">${l}</button>`).join('')}</div>
  <button class="cta ${dt.f ? '' : 'dis'}" style="--c:var(--warm)" data-a="mostra">${dt.f ? 'Mostra ' + lab : 'Scegli un periodo'}</button><div class="cap" style="text-align:center">${dt.f ? 'Letture nel periodo scelto' : ''}</div>`;
}
function scorciatoia(k) {
  const n = new Date(), oggi = new Date(n.getFullYear(), n.getMonth(), n.getDate()), dow = oggi.getDay();
  let f, t;
  if (k === 'we' || k === 'wes') { const sab = new Date(oggi); sab.setDate(oggi.getDate() - ((dow + 1) % 7)); if (k === 'wes') sab.setDate(sab.getDate() - 7); f = sab; t = new Date(sab); t.setDate(sab.getDate() + 1); }
  else if (k === '14') { t = oggi; f = new Date(oggi); f.setDate(oggi.getDate() - 13); }
  else { f = new Date(oggi.getFullYear(), oggi.getMonth(), 1); t = oggi; }
  S.dt.f = ymd(f); S.dt.t = ymd(t); S.dt.m = new Date(f.getFullYear(), f.getMonth(), 1);
}

// ===== SCENARI
const giorniTxt = (s) => GG_ORD.filter(g => s.giorni.includes(g)).map(g => GG[g]).join(' · ');
const inizioFase = (sc, i) => i === 0 ? sc.fasi[0].inizio : sc.fasi[i - 1].fino;
const TAG_LOG = { comando: 'Comando', avvio: 'Comando', lettura: 'Lettura', avviso: 'Avviso', errore: 'Avviso' };
const NO_T = { vent: 'Vent.', deum: 'Deum.' }, TIPO_MODO = { 3: 'vent', 2: 'deum' };      // fasi senza temperatura
const etichettaFase = (modo, f) => NO_T[f.tipo] || `${MODI[modo]} ${fmt(f.target)}°`;
const fineFaseTxt = (sc, i) => { const f = sc.fasi[i]; return f.tipo === 'off' ? inizioFase(sc, i) : f.fino; };
const rigaFase = (r) => r.inAttesa ? `In attesa del prossimo avvio${r.prossimoAvvio ? ` · ${r.prossimoAvvio.oggi ? 'oggi' : GG[r.prossimoAvvio.giorno]} alle ${r.prossimoAvvio.ora}` : ''}`
  : r.fase >= 0 ? `Fase ${r.fase + 1} di ${r.nFasi} · ${esc(r.faseNome)}` : 'In attesa del primo controllo';
// Scheda "Scenario attivo" della home: tocco = scheda dello scenario.
function schedaScenario() {
  const r = RUN, sc = SC.find(s => s.id === r.scenario_id); if (!r.attivo || !sc) return '';
  const f = r.fase >= 0 ? sc.fasi[r.fase] : null;
  return `<div class="ban tap" style="--c:var(--c${sc.modo})" data-a="scd" data-id="${sc.id}" role="button"><div class="bt"><span>${I(IC.cal)} Scenario attivo</span><span class="live"><i></i>${r.inPausa ? 'In pausa' : r.inAttesa ? 'In attesa' : 'In corso'}</span></div>
    <div class="bn"><div><b>${esc(sc.nome)}</b><span>${rigaFase(r)}${!r.inAttesa && r.fineFase ? ' · fino alle ' + r.fineFase : ''}</span></div><div class="go">${I(IC.chev)}</div></div>
    <div class="chs">${!r.inAttesa && f && f.tipo === 'temp' ? `<span class="chp c">${MODI[sc.modo]} ${fmt(f.target)}°</span>` : ''}<span class="chp">${sc.unita.length} unità</span>${r.inMant ? `<span class="chp c" style="--c:var(--m1)">${r.inMant} in mantenimento</span>` : ''}</div>
    ${r.inAttesa ? '' : `<div class="bar"><i style="width:${Math.round((r.progresso || 0) * 100)}%"></i></div>`}</div>`;
}
function bannerRun() {
  const r = RUN, sc = SC.find(s => s.id === r.scenario_id); if (!r.attivo || !sc) return '';
  const f = r.fase >= 0 ? sc.fasi[r.fase] : null;
  return `<div class="lb" style="margin-top:0">In esecuzione</div><div class="ban" style="--c:var(--c${sc.modo})"><div class="bt"><span>${I(IC.cal)} Scenario attivo</span><span class="live"><i></i>${r.inPausa ? 'In pausa · sola lettura' : r.inAttesa ? 'In attesa' : 'In corso'}</span></div>
    <div class="bn"><div><b>${esc(sc.nome)}</b><span>${rigaFase(r)}</span></div></div>
    <div class="chs"><span class="chp c">${giorniTxt(sc)}</span><span class="chp">${sc.unita.length} unità</span>${r.inMant ? `<span class="chp c" style="--c:var(--m1)">${r.inMant} in mantenimento</span>` : ''}</div>
    ${r.inAttesa ? '' : `<div class="bar"><i style="width:${Math.round((r.progresso || 0) * 100)}%"></i></div>`}<div class="bl"><span>${r.fineFase ? 'Fino alle ' + r.fineFase : ''}</span>${f && f.tipo === 'temp' ? `<b>${MODI[sc.modo]} ${fmt(f.target)}°</b>` : ''}</div></div>
  <div class="two"><button class="cta g" style="margin:0" data-a="scd" data-id="${sc.id}">Dettaglio</button><button class="cta bad${W()}" style="margin:0" data-a="sheetStop">${I(IC.stop)}Interrompi</button></div>`;
}
function vScenari() {
  const altri = SC.filter(s => !(RUN.attivo && RUN.scenario_id === s.id));
  return `<div class="h1">Scenari</div>${bannerRun()}
  <div class="lb">${RUN.attivo ? 'Altri scenari' : 'Scenari'}</div>
  ${altri.map(s => `<div class="sc2" style="--c:var(--c${s.modo})" data-a="scd" data-id="${s.id}"><div class="ico">${I(IC[s.modo])}</div><div><b>${esc(s.nome)}</b><span>${MODI[s.modo]} · ${giorniTxt(s)} · ${s.fasi.length} fasi<br>${esc(nomeGruppoDi(s.unita))} · ${s.unita.length} unità</span></div><div class="go">${I(IC.play)}</div></div>`).join('') || '<div class="note">Nessun altro scenario.</div>'}
  <div class="note">Un solo scenario è attivo alla volta: se ne avvii un altro, quello in corso viene interrotto (ti chiedo conferma).${CFG.scrittura ? '' : ' Con la scrittura disattivata gli scenari sono solo da consultare.'}</div>
  <button class="cta${W()}" data-a="nuovo" style="--c:var(--warm)">${I(IC.plus)}Nuovo scenario</button>`;
}
function vScd() {
  const sc = SC.find(s => s.id === SUB.id); if (!sc) return wh('Scenario non trovato', '') ;
  const run = RUN.attivo && RUN.scenario_id === sc.id, c = `var(--c${sc.modo})`, nTemp = sc.fasi.filter(f => f.tipo !== 'off');
  const f = run && RUN.fase >= 0 ? sc.fasi[RUN.fase] : null, ico14 = (k) => I(IC[k]).replace('<svg', '<svg style="width:14px;height:14px"');
  const tl = sc.fasi.map((p, i) => {
    const stato = run ? (i === RUN.fase ? 'now' : i < RUN.fase ? 'ok' : '') : '', dt = stato === 'ok' ? ico14('check') : p.tipo === 'off' ? ico14('power') : i + 1;
    if (p.tipo === 'off') return `<div class="tp ${stato}"><span class="dt">${dt}</span><b>Spegni impianto</b><span class="s">alle ${inizioFase(sc, i)}</span></div>`;
    return `<div class="tp ${stato}"><span class="dt">${dt}</span><b>${esc(p.nome)}</b><span class="s">${inizioFase(sc, i)} → ${p.fino} · ${etichettaFase(sc.modo, p)}</span>
      <div class="chs">${stato === 'now' ? '<span class="chp c">In corso</span>' : ''}${mantChips(p)}</div></div>`;
  }).join('');
  const dal = RUN.avviato ? `${GG[new Date(RUN.avviato).getDay()].toLowerCase()} ${hm(RUN.avviato)}` : '';
  const m = f?.mant && f.mant.target != null ? f.mant : null, sopra = sc.modo === 5 ? 'sotto' : 'sopra';
  const ban = !run ? '' : RUN.inAttesa || !f ? `<div class="ban" style="--c:${c};margin-top:6px"><div class="bt"><span>${I(IC.cal)} ${RUN.inPausa ? 'In pausa · sola lettura' : 'In attesa'}</span></div><div class="bn"><div><span>${rigaFase(RUN)}</span></div></div></div>`
    : `<div class="ban" style="--c:${c};margin-top:6px"><div class="bt"><span>${I(IC.cal)} ${RUN.inPausa ? 'In pausa · sola lettura' : 'Fase in corso'}</span><span class="live"><i></i>${dal ? 'Dal ' + dal : 'In corso'}</span></div>
      <div class="bn"><div><b>${RUN.fase + 1} · ${esc(RUN.faseNome || '')}</b><span>${etichettaFase(sc.modo, f)}${RUN.fineFase ? ' · fino alle ' + RUN.fineFase : ''}</span></div></div>
      <div class="bar"><i style="width:${Math.round((RUN.progresso || 0) * 100)}%"></i></div><div class="bl"><span>Ora <b>${hm(Date.now())}</b></span><span>Fine <b>${RUN.fineFase || '–'}</b></span></div></div>`;
  const adesso = !run || RUN.inAttesa || !f ? '' : `<div class="lb">Unità adesso</div><div class="panel" style="padding:4px 14px"><div class="lg"${m ? '' : ' style="border:0"'}><time>${(RUN.unita || []).filter(u => u.stato !== 'mant').length}</time><span class="k">Principale</span><span>${f.tipo === 'temp' ? `${MODI[sc.modo]} a ${fmt(f.target)}°` : NO_T[f.tipo] || ''}</span></div>${m ? `<div class="lg" style="border:0"><time>${RUN.inMant}</time><span class="k">Mantenim.</span><span>${MODI[sc.modo]} a ${fmt(m.temp)}° · tornano a ${fmt(f.target)}° ${sopra} ${fmt(m.ritorno)}°</span></div>` : ''}</div>`;
  return `${wh(sc.nome, `${{ 1: 'Raffreddamento', 5: 'Riscaldamento' }[sc.modo] || MODI[sc.modo]} · ${giorniTxt(sc)} · ${sc.unita.length} unità`)}
  ${ban}${adesso}
  <div class="lb">Fasi</div><div class="panel" style="--c:${c}"><div class="tl">${tl}</div></div>
  <div class="lb">Impianti</div><div class="panel" style="display:flex;justify-content:space-between;align-items:center"><div><b>${esc(nomeGruppoDi(sc.unita))}</b><div class="cap" style="margin:2px 0 0">${sc.unita.length} unità</div></div><span class="chp c">${sc.unita.length}</span></div>
  ${LOGSC.length ? `<div class="lb">Cronologia</div><div class="panel" style="padding:4px 14px">${LOGSC.map(l => `<div class="lg"><time>${hm(l.ts)}</time><span class="k ${l.tipo === 'avviso' || l.tipo === 'errore' ? 'a' : ''}">${TAG_LOG[l.tipo] || 'Comando'}</span><span>${esc(l.testo)}</span></div>`).join('')}</div>` : ''}
  ${run ? `<div class="two" style="margin-top:14px">${RUN.fase < nTemp.length && !RUN.inAttesa ? `<button class="cta g${W()}" data-a="salta" data-i="${RUN.fase + 1}">${I(IC.right)}Salta alla fase ${RUN.fase + 2}</button>` : ''}<button class="cta g${W()}" data-a="modifica" data-id="${sc.id}">${I(IC.edit)}Modifica</button></div>
    <button class="cta bad${W()}" data-a="sheetStop">${I(IC.stop)}Interrompi scenario</button>`
    : `<button class="cta${W()}" data-a="avvia" data-id="${sc.id}">Avvia ora</button><div class="two"><button class="cta g${W()}" data-a="modifica" data-id="${sc.id}">${I(IC.edit)}Modifica</button><button class="cta g${W()}" data-a="duplica" data-id="${sc.id}">${I(IC.copy)}Duplica</button></div><button class="cta bad${W()}" data-a="elimina" data-id="${sc.id}">Elimina</button>`}<div style="height:20px"></div>`;
}

// ===== AMBIENTI (gruppi di unità: elenco, nuovo, modifica)
function vAmbienti() {
  const l = CFG.gruppi;
  return `<div class="h1">Ambienti</div><div class="cap" style="margin:-8px 4px 14px">Gruppi di unità da usare in Stato, Scenari e comandi rapidi.</div>
  <button class="cta cfg" data-a="ambnuovo" style="--c:var(--warm);margin:0 0 6px">${I(IC.plus)}Crea nuovo ambiente</button>
  <div class="lb">Ambienti · ${l.length}</div>
  ${l.map(g => `<div class="amb" data-a="ambmod" data-id="${g.id}"><div class="ic">${I(IC.tAmb)}</div><div class="g"><b>${esc(g.nome)}</b><span class="s">${g.unita.length} unità${g.unita.length <= 4 ? ' · ' + g.unita.map(id => esc(unita(id).nome)).join(', ') : ''}</span></div><div class="ch">${I(IC.right)}</div></div>`).join('') || '<div class="note">Nessun ambiente: creane uno per comandare più unità insieme.</div>'}
  ${l.length > 1 ? '<div class="cap" style="margin:10px 4px 0">Tieni premuto un ambiente e trascinalo per cambiare l\'ordine.</div>' : ''}`;
}
function vAmb() {
  const a = S.am, tutte = CFG.unita.length;
  return `${wh(a.id ? 'Modifica ambiente' : 'Nuovo ambiente', '', '<button class="an" data-a="back">Annulla</button>')}
  <label class="fld"><small>Nome ambiente</small><input data-m="am.nome" value="${esc(a.nome)}" placeholder="Es. Zona notte" maxlength="40"></label>
  <div class="lb" style="display:flex;justify-content:space-between;align-items:center"><span>Unità · ${a.unita.length} di ${tutte}</span><button class="pillb" data-a="ambtutti"><i></i>${a.unita.length === tutte ? 'Deseleziona tutti' : 'Seleziona tutti'}</button></div>
  ${CFG.unita.map(u => { const on = a.unita.includes(u.id); return `<div class="row ${on ? 'sel' : ''}" style="--c:var(--warm)" data-a="ambun" data-id="${u.id}"><span class="ck ${on ? 'on' : ''}">${on ? I(IC.check) : ''}</span><div class="g"><b>${esc(u.nome)}</b><span class="s">${esc(u.stanza || '')}</span></div></div>`; }).join('')}
  ${a.id ? `<button class="cta bad" style="margin-top:6px" data-a="ambdel">Elimina ambiente</button><div class="cap" style="margin:10px 4px 0">Gli scenari che usano questo ambiente mantengono le unità già scelte.</div>` : ''}
  <div style="height:90px"></div><div class="foot"><button class="cta g" data-a="back">Annulla</button><button class="cta cfg" style="--c:var(--warm)" data-a="ambsalva">${a.id ? 'Salva modifiche' : 'Salva ambiente'}</button></div>`;
}
// Trascinamento: tocco prolungato (o mouse + movimento) sulla riga, poi si sposta; al rilascio l'ordine viene salvato.
let DRAG = null, PRESS = null, SOPPRIMI = 0;
const premiAnnulla = () => { if (PRESS) clearTimeout(PRESS.tm); PRESS = null; };
function dragInizio(row, y) {
  const r = row.getBoundingClientRect(); DRAG = { row, off: y - r.top }; row.classList.add('drag'); document.body.classList.add('dragging');
}
function dragMuovi(y) {
  const row = DRAG.row; row.style.transform = '';
  let nat = row.getBoundingClientRect(), cy = y - DRAG.off + nat.height / 2;
  for (let n; (n = row.nextElementSibling) && n.classList.contains('amb'); ) { const r = n.getBoundingClientRect(); if (cy <= r.top + r.height / 2) break; row.parentNode.insertBefore(n, row); }
  for (let n; (n = row.previousElementSibling) && n.classList.contains('amb'); ) { const r = n.getBoundingClientRect(); if (cy >= r.top + r.height / 2) break; row.parentNode.insertBefore(row, n); }
  nat = row.getBoundingClientRect(); row.style.transform = `translateY(${y - DRAG.off - nat.top}px)`;
}
async function dragFine() {
  const { row } = DRAG, ids = [...row.parentNode.querySelectorAll('.amb')].map(r => r.dataset.id), prima = CFG.gruppi;
  row.classList.remove('drag'); row.style.transform = ''; document.body.classList.remove('dragging'); DRAG = null; SOPPRIMI = Date.now();
  if (ids.every((id, i) => id === prima[i].id)) return;
  CFG.gruppi = ids.map(id => prima.find(g => g.id === id)); render();
  try { await api('/api/ambienti/ordine', 'PUT', { ids }); } catch (e) { CFG.gruppi = prima; toast(e.message, 'err'); render(); }
}
const inLista = () => TAB === 'ambienti' && !SUB && !SHEET;
document.addEventListener('touchstart', e => {
  const row = inLista() && e.target.closest('.amb'); if (!row || e.touches.length > 1) return; const t = e.touches[0];
  PRESS = { x: t.clientX, y: t.clientY, tm: setTimeout(() => { if (PRESS) { dragInizio(row, PRESS.y); navigator.vibrate?.(12); } }, 350) };
}, { passive: true });
document.addEventListener('touchmove', e => {
  const t = e.touches[0]; if (DRAG) { e.preventDefault(); dragMuovi(t.clientY); return; }
  if (PRESS && Math.hypot(t.clientX - PRESS.x, t.clientY - PRESS.y) > 8) premiAnnulla();
}, { passive: false });
for (const ev of ['touchend', 'touchcancel']) document.addEventListener(ev, () => { premiAnnulla(); if (DRAG) dragFine(); });
document.addEventListener('mousedown', e => { const row = inLista() && e.button === 0 && e.target.closest('.amb'); if (row) PRESS = { row, x: e.clientX, y: e.clientY, mouse: true }; });
document.addEventListener('mousemove', e => {
  if (DRAG) return dragMuovi(e.clientY);
  if (PRESS?.mouse && Math.hypot(e.clientX - PRESS.x, e.clientY - PRESS.y) > 5) { dragInizio(PRESS.row, PRESS.y); dragMuovi(e.clientY); }
});
document.addEventListener('mouseup', () => { if (PRESS?.mouse) PRESS = null; if (DRAG) dragFine(); });
async function caricaAmbienti() {
  CFG.gruppi = await api('/api/ambienti');
  if (FILTRO !== 'tutti' && !grp(FILTRO)) FILTRO = 'tutti';
  S.g.sel = S.g.sel.filter(k => !k.startsWith('g:') || grp(k.slice(2)));
  if (!S.g.sel.length) S.g.sel = ['all'];
}

// ---- creazione / modifica scenario (4 passi)
// Fasi di partenza di un nuovo scenario: una fase di giorno nel tipo della modalità, poi lo spegnimento.
const fasiBase = (m) => [{ tipo: TIPO_MODO[m] || 'temp', nome: 'Giorno', inizio: '08:00', fino: '17:00', ...(TIPO_MODO[m] ? {} : { target: m === 5 ? 20 : 24, oscillazione: false }) }, { tipo: 'off' }];
// sc + duplica: copia di uno scenario esistente, non salvata finché non si preme Salva.
function nuovoWz(sc, duplica = false) {
  const tutte = CFG.unita.map(u => u.id);
  S.wz = sc ? { id: duplica ? null : sc.id, dup: duplica, da: sc.nome, nome: duplica ? `${sc.nome} copia` : sc.nome, modo: sc.modo, giorni: [...sc.giorni], unita: [...sc.unita], um: sc.unita.length === tutte.length ? 'tutto' : 'singole',
      fasi: JSON.parse(JSON.stringify(sc.fasi)), step: 1 }
    : { id: null, nome: '', modo: 5, giorni: [5, 6, 0], unita: tutte, um: 'tutto', fasi: fasiBase(5), step: 1 };
  SUB = { k: 'wiz' }; scrollTo(0, 0);
}
const wzInizio = (w, i) => i === 0 ? w.fasi[0].inizio : w.fasi[i - 1].fino;
// Selettore del tipo di fase, con le stesse icone delle modalità: dei due modi a temperatura resta attivo solo quello dello scenario;
// Vent. e Deum. sono sempre disponibili (anche in uno scenario Vent./Deum., dove Raff. e Risc. sono entrambi disattivati), Spento solo dopo la prima fase.
function tipiFase(w, i, cur) {
  const tile = (m) => { const temp = m === 1 || m === 5, k = temp ? 'temp' : TIPO_MODO[m], ok = !temp || m === w.modo;
    return `<button class="mc m${m} ${cur === k ? 'on' : ''}" ${ok ? `data-a="phtipo" data-v="${k}"` : 'disabled'}>${I(IC[m])}${MODI[m]}</button>`; };
  return `<div class="mg" style="margin-bottom:14px">${[1, 5, 3, 2].map(tile).join('')}${i > 0 ? `<button class="mc ${cur === 'off' ? 'on' : ''}" style="--c:var(--warm)" data-a="phtipo" data-v="off">${I(IC.power)}Spento</button>` : ''}</div>`;
}
function vWiz() {
  const w = S.wz, c = `var(--c${w.modo})`, titoli = ['Nome e giorni', 'Impianti', 'Fasi', 'Riepilogo'];
  let b = '';
  if (w.step === 1) {
    b = `<label class="fld"><small>Nome</small><input data-m="wz.nome" value="${esc(w.nome)}" placeholder="Es. Weekend freddo"></label>
    <div class="lb">Modalità</div><div class="mg">${[1, 5, 3, 2].map(m => `<button class="mc m${m} ${w.modo === m ? 'on' : ''}" data-a="wzmodo" data-v="${m}">${I(IC[m])}${MODI[m]}</button>`).join('')}</div>
    <div class="lb">Giorni</div><div class="days" style="--c:${c}">${GG_ORD.map(g => `<div class="${w.giorni.includes(g) ? 'on' : ''}" data-a="wzgg" data-v="${g}">${GG_L[g]}</div>`).join('')}</div>
    <div class="note">${w.dup ? `Parti da “${esc(w.da)}”: fasi e impianti restano uguali, puoi cambiare nome e giorni. Se cambi la modalità le fasi vengono azzerate. Lo scenario non viene creato finché non tocchi Salva nell’ultimo passo.` : 'I giorni valgono per tutte le fasi; l’ora di inizio si sceglie nella prima fase. Con Risc. o Raff. ogni fase può essere a temperatura, solo Vent., solo Deum. oppure Spento. Con Vent. o Deum. lo scenario fa solo quello, negli orari delle fasi.'}</div>`;
  } else if (w.step === 2) {
    b = `${seg([['tutto', 'Tutto'], ['ambiente', 'Per ambiente'], ['singole', 'Singole']], w.um, 'wzum')}
    ${w.um === 'ambiente' ? `<div class="lgd">${gruppiVisibili().map(g => { const on = g.unita.every(x => w.unita.includes(x)); return `<button class="${on ? 'on' : ''}" style="--c:var(--warm)" data-a="wzgr" data-id="${g.id}"><i></i>${esc(g.nome)}</button>`; }).join('')}</div>` : ''}
    ${w.um !== 'tutto' ? `<div class="lgd"><button data-a="wzall" style="--c:var(--warm)"><i></i>${w.unita.length === CFG.unita.length ? 'Deseleziona tutti' : 'Seleziona tutti'}</button></div>` : ''}
    ${w.um !== 'tutto' ? CFG.unita.map(u => { const on = w.unita.includes(u.id); return `<div class="row ${on ? 'sel' : ''}" style="--c:${c}" data-a="wzun" data-id="${u.id}"><span class="ck ${on ? 'on' : ''}">${on ? I(IC.check) : ''}</span><div><b>${esc(u.nome)}</b><span>${esc(u.stanza || '')}</span></div></div>`; }).join('') : ''}
    <div class="lb">Unità incluse · ${w.unita.length} di ${CFG.unita.length}</div><div class="note" style="margin-top:0">Le unità non incluse non vengono toccate dallo scenario.</div>`;
  } else if (w.step === 3) {
    let t = minuti(w.fasi[0].inizio), seg = '';
    w.fasi.forEach((f, i) => {
      if (f.tipo === 'off') return;
      const a = t; let z = minuti(f.fino); while (z <= t) z += 1440; t = z;
      const pezzi = z > 1440 ? [[a, 1440], [0, z - 1440]] : [[a, z]];
      seg += pezzi.map(([x, y]) => `<i style="left:${x / 14.4}%;width:${(y - x) / 14.4}%">${i + 1}</i>`).join('');
    });
    const spegni = (f, i) => `<div class="ph" style="--c:${c}"><span class="nn">${I(IC.power).replace('<svg', '<svg style="width:15px;height:15px"')}</span><div class="pb"><b>Spegni impianto</b><span>alle ${wzInizio(w, i)}</span></div><button class="ed" data-a="wzed" data-i="${i}">${I(IC.edit)}</button></div>`;
    b = `<div class="note" style="margin:0 4px 12px">${GG_ORD.filter(g => w.giorni.includes(g)).map(g => GG[g]).join(' · ')}. La prima fase parte all’ora che scegli; ogni altra parte quando finisce la precedente.</div>
    <div class="panel" style="--c:${c}"><div class="t"><b>Giornata</b><span>${MODI[w.modo]} · 00 – 24</span></div><div class="day">${seg}</div><div class="day-h"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div>
    <div class="lb">Fasi</div>
    ${w.fasi.map((f, i) => f.tipo === 'off' ? spegni(f, i) : `<div class="ph" style="--c:${c}"><span class="nn">${i + 1}</span><div class="pb"><b>${esc(f.nome)}</b><span>${wzInizio(w, i)} – ${f.fino}${minuti(f.fino) <= minuti(wzInizio(w, i)) ? ' (giorno dopo)' : ''}</span><div class="chs"><span class="chp c">${etichettaFase(w.modo, f)}</span>${mantChip(f)}${f.oscillazione ? '<span class="chp">Su–giù</span>' : ''}</div></div><button class="ed" data-a="wzed" data-i="${i}">${I(IC.edit)}</button></div>`).join('')}
    <button class="add" style="--c:${c}" data-a="wzadd">${I(IC.plus)}Aggiungi fase</button>
    <div class="note">Le fasi possono attraversare la mezzanotte (es. dalle 20:00 alle 06:00). Per spegnere l'impianto aggiungi la fase «Spento».</div>`;
  } else {
    const gg = GG_ORD.filter(g => w.giorni.includes(g)).map(g => GG[g]).join(' · ') || 'nessun giorno';
    b = `<div class="panel" style="--c:${c}"><div class="t"><b>${esc(w.nome || 'Senza nome')}</b><span>${MODI[w.modo]}</span></div><div class="cap" style="margin:0">${gg} · dalle ${w.fasi[0].inizio}</div>
    <div class="lb" style="margin:16px 0 6px">Impianti</div><div style="font-size:14px;font-weight:600">${esc(nomeGruppoDi(w.unita))} · ${w.unita.length} unità</div>
    <div class="lb" style="margin:14px 0 6px">Fasi</div>
    <div class="tl" style="margin-top:6px">${w.fasi.map((f, i) => f.tipo === 'off' ? `<div class="tp"><span class="dt">${I(IC.power).replace('<svg', '<svg style="width:14px;height:14px"')}</span><b>${wzInizio(w, i)}</b><span class="s">Spegni impianto</span></div>` : `<div class="tp"><span class="dt">${i + 1}</span><b>${wzInizio(w, i)} → ${f.fino}</b><span class="s">${etichettaFase(w.modo, f)}${f.mant ? ` · arriva a ${fmt(f.mant.target)}° → mantenimento ${fmt(f.mant.temp)}° fino a ${fmt(f.mant.ritorno)}°` : ''}${f.oscillazione ? ' · su–giù' : ''}</span></div>`).join('')}</div></div>
    ${CFG.scrittura ? '' : '<div class="note">Con la scrittura disattivata lo scenario si salva ma non invia comandi: per farlo partire attiva prima la scrittura.</div>'}`;
  }
  const foot = w.step < 4 ? `${w.step > 1 ? '<button class="cta g" data-a="wzprev">Indietro</button>' : ''}<button class="cta" style="--c:${c}" data-a="wznext">Avanti${w.step === 2 ? ` · ${w.unita.length} unità` : ''}</button>`
    : `<button class="cta g back" data-a="wzprev" aria-label="Indietro">${I(IC.back)}</button><button class="cta t" style="--c:${c}" data-a="wzsalva">Salva</button><button class="cta" style="--c:${c}" data-a="wzsalva" data-avvia="1">Salva e avvia</button>`;
  return `${wh(w.step === 1 ? (w.id ? 'Modifica scenario' : w.dup ? 'Duplica scenario' : 'Nuovo scenario') : titoli[w.step - 1], `Passo ${w.step} di 4`, '<button class="an" data-a="back">Annulla</button>')}
  <div class="stp" style="--c:${c}">${[1, 2, 3, 4].map(i => `<i class="${i <= w.step ? 'on' : ''}"></i>`).join('')}</div>${b}<div style="height:90px"></div><div class="foot">${foot}</div>`;
}
// Mantieni temperatura: tre soglie per fase. Riscaldamento: ritorno < target del mantenimento; raffrescamento: specchiato.
const mantChips = (f) => f.mant && f.mant.target != null ? `<span class="chp">${I(IC.bolt)}Arriva a ${fmt(f.mant.target)}°</span><span class="chp">${I(IC.loop)}Mant. ${fmt(f.mant.temp)}° → ${fmt(f.mant.ritorno)}°</span>` : '';
const mantChip = (f) => f.mant && f.mant.target != null ? `<span class="chp">Mant. ${fmt(f.mant.temp)}°</span>` : '';
const mantIniziale = (t, risc) => ({ target: clamp(t + (risc ? .5 : -.5)), temp: clamp(t + (risc ? -2 : 2)), ritorno: clamp(t + (risc ? -1.5 : 1.5)) });
function mantErrore(p, risc) {                    // stesse regole del server (logic.valida)
  const m = p.mant, oltre = (x, y) => risc ? x > y : x < y, sotto = risc ? 'sotto' : 'sopra';
  if (oltre(p.target, m.target)) return `Il target del mantenimento non può stare ${sotto} la temperatura della fase`;
  if (!oltre(m.target, m.ritorno)) return `Il ritorno al programma deve stare ${sotto} il target`;
  if (oltre(m.temp, m.ritorno)) return `La temperatura di mantenimento non può stare ${risc ? 'sopra' : 'sotto'} il ritorno`;
  return null;
}
const mst = (v, act) => `<div class="bst"><button data-a="${act}" data-d="-0.5">${I(IC.minus)}</button><div><b>${fmt(v)}</b> <small>°C</small></div><button data-a="${act}" data-d="0.5">${I(IC.plus)}</button></div>`;
function mantDiagramma(p, risc) {              // andamento della stanza a dente di sega tra target e ritorno
  const m = p.mant, W = 300, H = 120, hi = Math.max(p.target, m.target, m.ritorno, m.temp), lo = Math.min(p.target, m.target, m.ritorno, m.temp), sp = (hi - lo) || 1;
  const y = (v) => 14 + (hi - v) / sp * (H - 34), yT = y(m.target), yR = y(m.ritorno);
  const [a, b] = risc ? [yR, yT] : [yT, yR];      // estremi dell'oscillazione sul grafico
  const etT = risc ? yT - 5 : yT + 13, etR = risc ? yR + 13 : yR - 5;   // etichette sul lato esterno delle righe, staccate dal tratteggio
  const pts = `0,${a} 60,${a} 100,${b} 120,${b} 160,${a} 210,${a} 250,${b} ${W},${b}`.split(' ').map((q, k) => k === 1 || k === 5 ? q : q).join(' ');
  return `<svg class="dg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Andamento della temperatura della stanza">
  <line x1="0" x2="${W}" y1="${yT}" y2="${yT}" stroke="var(--warm)" stroke-dasharray="4 4" opacity=".6"/><text x="4" y="${etT}" fill="currentColor">target ${fmt(m.target)}°</text>
  <line x1="0" x2="${W}" y1="${yR}" y2="${yR}" stroke="var(--warm)" stroke-dasharray="4 4" opacity=".6"/><text x="4" y="${etR}" fill="currentColor">ritorno ${fmt(m.ritorno)}°</text>
  <polyline points="${pts}" fill="none" stroke="var(--warm)" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}
function mantPannello(p, risc, c) {      // grafico e passi usano i colori generici (--ac), non quelli della modalità
  const m = p.mant, err = mantErrore(p, risc), t = fmt(p.target), verso = risc ? 'sale' : 'scende', contro = risc ? 'scende' : 'sale';   // la stanza va verso il target, poi si allontana fino al ritorno
  const passo = (n, tit, v, act, sub) => `<div class="mps"><span class="mn">${n}</span><div class="mb"><b>${tit}</b>${mst(v, act)}<span class="cap">${sub}</span></div></div>`;
  return `<div class="panel" style="--c:${c}"><div class="t"><b>Come si comporta</b></div>${mantDiagramma(p, risc)}
    <div class="chs"><span class="chp c" style="--c:var(--warm)">Programma ${fmt(p.target)}°</span><span class="chp">Mantenimento ${fmt(m.temp)}°</span></div>
    <div class="cap" style="margin:8px 0 0">La linea è la temperatura della stanza. Il controllo è per singola unità, ogni ${CFG.controlMinutes || 5} minuti.</div></div>
  <div class="panel" style="--c:${c}"><div class="t"><b>Impostazioni</b></div>
    ${passo(1, 'Temperatura target per l\'impianto', m.target, 'mttarget', `Quando la stanza ${verso} a questa temperatura, passa al mantenimento.`)}
    ${passo(2, 'Imposta temperatura di mantenimento', m.temp, 'mttemp', 'Setpoint scritto sulle unità durante il mantenimento.')}
    ${passo(3, 'Torna al programma originale quando', m.ritorno, 'mtritorno', `Quando la stanza ${contro} a questa temperatura, le unità tornano a ${t}°.`)}
    <div class="okr ${err ? 'ko' : ''}">${err || (risc ? `Valori coerenti: mantenimento ${fmt(m.temp)} ≤ ritorno ${fmt(m.ritorno)} < target ${fmt(m.target)}.` : `Valori coerenti: target ${fmt(m.target)} < ritorno ${fmt(m.ritorno)} ≤ mantenimento ${fmt(m.temp)}.`)}</div></div>
  <div class="panel" style="--c:${c}"><div class="t"><b>Riepilogo</b></div><div class="chs"><span class="chp">${risc ? 'Risc.' : 'Raff.'} ${t}°</span><span class="chp">› a ${fmt(m.target)}° → ${fmt(m.temp)}°</span><span class="chp">› a ${fmt(m.ritorno)}° → ${t}°</span><span class="chp">› poi di nuovo a ${fmt(m.target)}°</span></div></div>`;
}
function vFase() {
  const w = S.wz, p = S.ph, i = SUB.i, c = `var(--c${w.modo})`, nuova = SUB.nuova, risc = w.modo === 5, off = p.tipo === 'off';
  const nTemp = w.fasi.filter(f => f.tipo !== 'off').length, nome = MODI[w.modo], t = fmt(p.target);
  const base = `<div class="panel" style="--c:${c};display:flex;align-items:center;gap:10px"><div class="chp c" style="--c:${c}">${I(IC[w.modo])}${nome}</div><span class="cap" style="margin:0">Modalità dello scenario · le altre fasi si scelgono qui sotto</span></div>
  <div class="lb">Cosa fa l'impianto</div>${tipiFase(w, i, p.tipo)}`;
  if (off) return `${wh(nuova ? 'Nuova fase' : 'Modifica fase', `Fase ${i + 1} · spegnimento`)}${base}
  <div class="panel"><div class="t"><b>Spegni impianto</b></div><div class="cap" style="margin:0">Le unità dello scenario si spengono quando finisce la fase precedente. Lo scenario resta in attesa del prossimo avvio.</div></div>
  <div class="fld"><small>Dalle</small><b style="font-size:18px">${wzInizio(w, i)}</b></div><div class="note" style="margin-top:0">Orario di fine dell'ultima fase · non modificabile</div>
  ${!nuova ? `<button class="cta bad" data-a="phdel">Elimina fase</button>` : ''}<div style="height:90px"></div>
  <div class="foot"><button class="cta g" data-a="back">Annulla</button><button class="cta" style="--c:${c}" data-a="phsalva">Salva fase</button></div>`;
  const nt = NO_T[p.tipo];
  if (nt) return `${wh(nuova ? 'Nuova fase' : 'Modifica fase', `Fase ${i + 1} · ${nt}`)}${base}
  <label class="fld"><small>Nome fase</small><input data-m="ph.nome" value="${esc(p.nome)}"></label>
  <div class="panel"><div class="t"><b>${p.tipo === 'vent' ? 'Solo ventilazione' : 'Deumidificazione'}</b></div><div class="cap" style="margin:0">Per tutta la fase le unità restano accese in modalità ${nt} Non serve nessuna temperatura.</div></div>
  <div class="dtr"><label class="fld"><small>Dalle</small>${i === 0 ? `<input type="time" data-m="ph.inizio" value="${p.inizio}">` : `<b style="font-size:18px">${wzInizio(w, i)}</b>`}</label><label class="fld"><small>Fino alle</small><input type="time" data-m="ph.fino" value="${p.fino}"></label></div>
  ${p.fino && minuti(p.fino) <= minuti(i > 0 ? wzInizio(w, i) : p.inizio) ? '<div class="note" style="margin-top:0">La fase finisce il giorno dopo. Può attraversare la mezzanotte.</div>' : ''}
  ${nTemp > 1 && !nuova ? `<button class="cta bad" data-a="phdel">Elimina fase</button>` : ''}<div style="height:90px"></div>
  <div class="foot"><button class="cta g" data-a="back">Annulla</button><button class="cta" style="--c:${c}" data-a="phsalva">Salva fase</button></div>`;
  return `${wh(nuova ? 'Nuova fase' : 'Modifica fase', `Fase ${i + 1}`)}${base}
  <label class="fld"><small>Nome fase</small><input data-m="ph.nome" value="${esc(p.nome)}"></label>
  <div class="panel" style="--c:${c}"><div class="t"><b>Temperatura target</b></div>${bst(p.target, 'phtarget')}</div>
  <div class="dtr"><label class="fld"><small>Dalle</small>${i === 0 ? `<input type="time" data-m="ph.inizio" value="${p.inizio}">` : `<b style="font-size:18px">${wzInizio(w, i)}</b>`}</label><label class="fld"><small>Fino alle</small><input type="time" data-m="ph.fino" value="${p.fino}"></label></div>
  ${p.fino && minuti(p.fino) <= minuti(wzInizio(w, i) && i > 0 ? wzInizio(w, i) : p.inizio) ? '<div class="note" style="margin-top:0">La fase finisce il giorno dopo. Può attraversare la mezzanotte.</div>' : ''}
  <div class="lb">Oscillazione</div>${oscSeg(!!p.oscillazione, 'phosc')}
  <div class="row" style="--c:${c}"><div><b>Mantieni temperatura</b><span>${p.mant ? `Quando la stanza ${risc ? 'sale' : 'scende'} al target, le unità passano al setpoint di mantenimento. Tornano al programma solo quando la stanza ${risc ? 'scende' : 'sale'} alla soglia di ritorno.` : 'Quando la stanza raggiunge il target, tieni un setpoint di mantenimento per risparmiare'}</span></div><button class="sw ${p.mant ? 'on' : ''}" data-a="phmant"></button></div>
  ${p.mant ? mantPannello(p, risc, c) : ''}
  ${nTemp > 1 && !nuova ? `<button class="cta bad" data-a="phdel">Elimina fase</button>` : ''}<div style="height:90px"></div>
  <div class="foot"><button class="cta g" data-a="back">Annulla</button><button class="cta" style="--c:${c}" data-a="phsalva">Salva fase</button></div>`;
}
function wzBody() {
  const w = S.wz, f = w.fasi.map((p, i) => {
    if (p.tipo === 'off') return { tipo: 'off' };
    if (NO_T[p.tipo]) { const v = { tipo: p.tipo, nome: p.nome || `Fase ${i + 1}`, fino: p.fino }; if (i === 0) v.inizio = p.inizio; return v; }
    const o = { tipo: 'temp', nome: p.nome || `Fase ${i + 1}`, fino: p.fino, target: p.target, oscillazione: !!p.oscillazione };
    if (i === 0) o.inizio = p.inizio; if (p.mant) o.mant = { ...p.mant }; return o;
  });
  return { nome: w.nome.trim() || 'Scenario', modo: w.modo, giorni: w.giorni, unita: w.unita, fasi: f };
}

// ===== ALTRO
function vAltro() {
  const eta = TS ? (Date.now() - TS) / 60000 : null, ok = !ERR && eta != null && eta <= 10;
  return `<div class="h1">Altro</div>
  <div class="panel"><div class="st ${ok ? '' : 'bad'}"><div class="ic">${I(ok ? IC.check : IC.warn)}</div><div><b>${ok ? 'Impianto ok' : 'Impianto non raggiungibile'}</b><span>${ok ? 'Tutte le unità rispondono' : 'Stato di errore'} · ultima lettura ${TS ? hm(TS) : 'mai'}</span></div></div>${ok ? '' : '<button class="cta g" data-a="live">Riprova</button>'}</div>
  <div class="panel"><b>Notifiche push</b><div class="note">Allarme di un'unità o temperatura sotto ${CFG.frostAlertC ?? 4} °C. Richiede HTTPS.${CFG.push.iscritti ? ` Dispositivi iscritti: ${CFG.push.iscritti}.` : ''}</div>
    <button class="cta" style="--c:var(--warm)" data-a="pushon">Attiva notifiche</button><button class="cta g" data-a="pushtest">Invia prova</button></div>
  <div class="lb">Registro</div>
  <div class="panel logbox" data-scroll="log">${LOG.map(l => `<div class="lg"><time>${hm(l.ts)}</time><span class="k ${l.tipo === 'avviso' || l.tipo === 'errore' ? 'a' : ''}">${TAG_LOG[l.tipo] || 'Comando'}</span><span>${esc(l.testo)}</span></div>`).join('') || '<div class="note">Nessun evento.</div>'}</div>
  ${vImp()}`;
}
const b64 = (s) => Uint8Array.from(atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// ===== FOGLI (bottom sheet)
function vSheet() {
  if (SHEET.k === 'sp') {
    const [lo, hi] = LIM(), cur = SHEET.v, vals = []; for (let x = lo; x <= hi + 1e-9; x += .5) vals.push(x);
    const n = idsFiltro().length, tutte = SHEET.t === 'ptsp';
    const tit = tutte ? (FILTRO === 'tutti' ? 'Temperatura per tutte le unità' : `Temperatura · ${esc(grp(FILTRO).nome)}`) : `${esc(unita(SHEET.id || S.ud.id).nome)} · temperatura`;
    return `<div class="dim" data-a="close"></div><div class="sheet"><div class="grab"></div><div class="sh"><b>${tit}</b><button data-a="close">Annulla</button></div>
    <div class="lim">${I(IC.info || IC.check)} Limiti impianto ${fmt(lo)} – ${fmt(hi)} °C · letti da AC Smart</div>
    <div class="sp">${vals.map(x => `<button class="${cur != null && Math.abs(x - cur) < .01 ? 'on' : ''}" data-a="spval" data-v="${x}">${fmt(x)}°</button>`).join('')}</div>
    ${tutte ? '' : '<div class="note">Tocca un valore per applicarlo' + (SHEET.t === 'usp' ? ' subito' : '') + '</div>'}</div>`;
  }
  if (SHEET.k === 'modo') {
    const sel = SHEET.sel;
    return `<div class="dim" data-a="close"></div><div class="sheet"><div class="grab"></div><div class="sh"><b>Modalità di controllo</b><button data-a="close">Annulla</button></div>
    <div class="opt ${sel ? '' : 'sel'}" data-a="modosel" data-v="0"><div class="ic">${I(IC.eye)}</div><div><b>Sola lettura</b><span>Vedi stato e grafici. Nessun comando parte verso l'impianto.</span></div><span class="rd"></span></div>
    <div class="opt ${sel ? 'sel' : ''}" data-a="modosel" data-v="1"><div class="ic">${I(IC.pen)}</div><div><b>Scrittura attiva</b><span>Puoi accendere, spegnere e cambiare temperatura, modalità e ventola.</span></div><span class="rd"></span></div>
    <button class="cta keep${sel === CFG.scrittura ? ' off' : ''}" style="--c:var(--warm)" data-a="modoapplica">${sel ? 'Attiva scrittura' : 'Passa a sola lettura'}</button></div>`;
  }
  const sc = SC.find(x => x.id === RUN.scenario_id), spegni = SHEET.v !== '0', n = sc ? sc.unita.length : 0;
  const opt = (v, ic, t, d) => `<div class="opt ${(spegni ? '1' : '0') === v ? 'sel' : ''}" data-a="stopsel" data-v="${v}"><div class="ic">${I(ic)}</div><div><b>${t}</b><span>${d}</span></div></div>`;
  return `<div class="dim" data-a="close"></div><div class="sheet"><div class="grab"></div><div class="sh"><b>Interrompere “${esc(RUN.nome || '')}”?</b><button data-a="close">Annulla</button></div>
    <p>“${esc(RUN.nome || '')}” non girerà più. Cosa faccio con le unità dello scenario?</p>
    ${opt('1', IC.power, 'Spegni impianto e interrompi', `Spegne le ${n} unità dello scenario`)}${opt('0', IC.stop, 'Interrompi solo lo scenario', 'Le unità restano come sono adesso')}
    <button class="cta" style="--c:var(--warm);margin-top:16px" data-a="stop" data-v="${spegni ? '1' : '0'}">Conferma</button></div>`;
}

// ===== azioni (delegate)
const ACT = {
  confNo() { chiudiConf(); },
  confSi() { const c = chiudiConf(); if (c) c.fn(); },
  peric() { PERIC = !PERIC; if (!PERIC) IMPD = {}; render(); },
  async impsalva() {
    if (!PERIC) return;
    if (!Object.keys(IMPD).length) return toast('Nessuna modifica', 'warn', 'Cambia almeno un valore');
    try {
      const r = await api('/api/impostazioni', 'PUT', { pericolo: true, valori: IMPD });
      IMP = r.impostazioni; IMPD = {}; PERIC = false; caricaLog();
      toast(r.cambi ? 'Impostazioni salvate' : 'Nessuna modifica', r.cambi ? 'ok' : 'warn', IMP.some(i => i.daRiavviare) ? 'Riavvia il server per applicarle' : '');
    } catch (e) { toast(e.message, 'err'); }
    render();
  },
  tab(d) { TAB = d.t; SUB = null; SHEET = null; scrollTo(0, 0); if (TAB === 'grafico') caricaStorico(); if (TAB === 'scenari') caricaRun(); if (TAB === 'altro') { caricaLog(); caricaImp(); } render(); },
  back() { if (SUB?.k === 'ph') SUB = { k: 'wiz' }; else SUB = null; scrollTo(0, 0); render(); },
  close() { SHEET = null; render(); },
  spsheet(d) {
    if (!CFG.scrittura && d.k !== 'udsp') return;
    const v = d.k === 'ptsp' ? S.pt.sp : d.k === 'usp' ? (STATO[d.id] || {}).setpoint : S.ud.sp;
    SHEET = { k: 'sp', t: d.k, id: d.id, v }; render();
  },
  spval(d) {
    const x = clamp(Number(d.v)), t = SHEET.t, id = SHEET.id; SHEET = null;
    if (t === 'ptsp') { S.pt.sp = x; render(); } else if (t === 'usp') { ctl('unit:' + id, { setpoint: x }); render(); } else { S.ud.sp = x; render(); }
  },
  sheetModo() { SHEET = { k: 'modo', sel: CFG.scrittura }; render(); },
  stopsel(d) { SHEET.v = d.v; render(); },
  modosel(d) { SHEET.sel = d.v === '1'; render(); },
  async modoapplica() { if (SHEET.sel === CFG.scrittura) return; try { const r = await api('/api/scrittura', 'POST', { attiva: SHEET.sel }); CFG.scrittura = r.scrittura; SHEET = null; toast(r.scrittura ? 'Scrittura attiva' : 'Sola lettura'); aggiorna(); } catch (e) { toast(e.message, 'err'); } },
  // Se nessuna unità dello scenario è accesa non c'è nulla da spegnere: si interrompe senza chiedere.
  sheetStop() {
    const sc = SC.find(x => x.id === RUN.scenario_id), accese = sc && sc.unita.some(id => STATO[id] && STATO[id].acceso);
    if (sc && !accese) return ACT.stop({ v: '0' });
    SHEET = { k: 'stop', v: '1' }; render();
  },
  async stop(d) { try { RUN = await api('/api/run/stop', 'POST', { spegni: d.v === '1' }); SHEET = null; toast('Scenario interrotto'); setTimeout(aggiorna, 800); } catch (e) { toast(e.message, 'err'); } render(); },
  live() {
    const bs = [...document.querySelectorAll('[data-a="live"]')]; bs.forEach(b => b.classList.add('busy'));
    const t0 = Date.now(), fine = () => setTimeout(() => bs.forEach(b => b.classList.remove('busy')), Math.max(0, 700 - (Date.now() - t0)));
    caricaStato(true).then(() => toast('Aggiornato')).finally(fine);
  },
  filtro(d) { FILTRO = d.v; render(); },
  upw(d) {
    const s = STATO[d.id] || {}, on = !s.acceso;
    ctl('unit:' + d.id, { power: on ? 'on' : 'off' }, on ? `Accesa: ${MODI[s.modo] || 'Riscaldamento'}${s.ventola ? ', ventola ' + (VENT[s.ventola] || '') : ''}` : 'Spenta');
  },
  usp(d) { const s = STATO[d.id] || {}; ctl('unit:' + d.id, { setpoint: clamp((s.setpoint ?? 19) + Number(d.d)) }); },
  unit(d) { apriUnita(d.id); render(); },
  // modifica tutte
  ptpw(d) { S.pt.pw = S.pt.pw === d.v ? null : d.v; render(); },
  ptsp(d) { S.pt.sp = clamp((S.pt.sp ?? 20) + Number(d.d)); render(); },
  ptmodo(d) { S.pt.modo = S.pt.modo === Number(d.v) ? null : Number(d.v); render(); },
  ptvent(d) { S.pt.vent = S.pt.vent === Number(d.v) ? null : Number(d.v); render(); },
  ptosc(d) { const v = d.v === 'true'; S.pt.osc = S.pt.osc === v ? null : v; render(); },
  ptapplica() {
    const p = S.pt, ids = idsFiltro(); if (Object.values(p).every(v => v == null)) return toast('Scegli almeno una modifica', 'warn');
    const f = { power: p.pw, setpoint: p.sp, modo: p.modo, ventola: p.vent, oscillazione: p.osc };
    conferma(`Le modifiche vengono inviate a ${ids.length} unità.`, async () => { await ctl(FILTRO === 'tutti' ? 'all' : 'group:' + FILTRO, f, 'Applicato'); S.pt = { pw: null, sp: null, modo: null, vent: null, osc: null }; render(); }, { titolo: `Applicare a ${ids.length} unità?`, ok: 'Applica' });
  },
  // dettaglio unità
  udpw(d) { S.ud.pw = d.v === 'on'; render(); }, udpwt() { S.ud.pw = !S.ud.pw; render(); },
  udmodo(d) { S.ud.modo = Number(d.v); render(); }, udsp(d) { S.ud.sp = clamp(S.ud.sp + Number(d.d)); render(); },
  udvent(d) { S.ud.vent = Number(d.v); render(); }, udosc(d) { S.ud.osc = d.v === 'true'; render(); },
  async udapplica() {
    const d = S.ud, s = STATO[d.id] || {}, f = {};
    if (d.pw !== !!s.acceso) f.power = d.pw ? 'on' : 'off'; if (d.sp !== s.setpoint) f.setpoint = d.sp; if (d.modo !== s.modo) f.modo = d.modo;
    if (d.vent !== s.ventola) f.ventola = d.vent; if (d.osc !== !!s.oscillazione) f.oscillazione = d.osc;
    if (!Object.keys(f).length) return toast('Nessuna modifica', 'warn');
    await ctl('unit:' + d.id, f, 'Applicato');
  },
  // grafico
  range(d) { S.g.range = d.v; S.g.applied = false; if (d.v !== 'c') caricaStorico(); render(); },
  serie(d) { const s = S.g.sel, i = s.indexOf(d.k); if (i >= 0) { if (s.length > 1) s.splice(i, 1); } else s.push(d.k); render(); },
  altre() { S.g.altre = true; render(); },
  giorno(d) { const dt = S.dt; if (!dt.f || dt.t) { dt.f = d.d; dt.t = null; } else if (d.d < dt.f) { dt.t = dt.f; dt.f = d.d; } else dt.t = d.d; render(); },
  mese(d) { const m = S.dt.m; S.dt.m = new Date(m.getFullYear(), m.getMonth() + Number(d.d), 1); render(); },
  scorc(d) { scorciatoia(d.k); render(); },
  mostra() { S.g.applied = true; caricaStorico(); },
  // scenari
  scd(d) { SUB = { k: 'scd', id: Number(d.id) }; scrollTo(0, 0); LOGSC = []; logScenario(SC.find(s => s.id === Number(d.id))?.nome || ''); render(); },
  nuovo() { nuovoWz(null); render(); },
  modifica(d) { nuovoWz(SC.find(s => s.id === Number(d.id))); render(); },
  duplica(d) { nuovoWz(SC.find(s => s.id === Number(d.id)), true); render(); },
  elimina(d) { conferma('Lo scenario viene eliminato definitivamente.', async () => { try { await api('/api/scenari/' + d.id, 'DELETE'); SC = await api('/api/scenari'); SUB = null; render(); } catch (e) { toast(e.message, 'err'); } }, { titolo: 'Eliminare lo scenario?', ok: 'Elimina', pericolo: true }); },
  avvia(d) {
    const sc = SC.find(s => s.id === Number(d.id));
    conferma(RUN.attivo ? `Si interrompe "${RUN.nome}" e parte "${sc.nome}".` : `Lo scenario "${sc.nome}" parte subito.`, async () => {
      try { if (RUN.attivo) await api('/api/run/stop', 'POST', { spegni: false }); RUN = await api('/api/run/start', 'POST', { id: sc.id }); toast('Scenario avviato'); aggiorna(); } catch (e) { toast(e.message, 'err'); }
    }, { titolo: RUN.attivo ? 'Cambiare scenario?' : 'Avviare lo scenario?', ok: 'Avvia' });
  },
  salta(d) { conferma('Lo scenario passa subito alla fase scelta.', async () => { try { RUN = await api('/api/run/salta', 'POST', { fase: Number(d.i) }); toast('Fase cambiata'); render(); } catch (e) { toast(e.message, 'err'); } }, { titolo: 'Saltare alla fase?', ok: 'Salta' }); },
  // ambienti
  ambnuovo() { S.am = { id: null, nome: '', unita: [] }; SUB = { k: 'amb' }; scrollTo(0, 0); render(); },
  ambmod(d) { if (Date.now() - SOPPRIMI < 400) return; const g = grp(d.id); S.am = { id: g.id, nome: g.nome, unita: [...g.unita] }; SUB = { k: 'amb' }; scrollTo(0, 0); render(); },
  ambun(d) { const a = S.am, i = a.unita.indexOf(d.id); if (i >= 0) a.unita.splice(i, 1); else a.unita.push(d.id); render(); },
  ambtutti() { const a = S.am; a.unita = a.unita.length === CFG.unita.length ? [] : CFG.unita.map(u => u.id); render(); },
  async ambsalva() {
    const a = S.am; if (!a.nome.trim()) return toast('Dai un nome all\'ambiente', 'warn'); if (!a.unita.length) return toast('Scegli almeno un\'unità', 'warn');
    try { const b = { nome: a.nome, unita: a.unita }; if (a.id) await api('/api/ambienti/' + a.id, 'PUT', b); else await api('/api/ambienti', 'POST', b); await caricaAmbienti(); SUB = null; toast('Ambiente salvato'); render(); } catch (e) { toast(e.message, 'err'); }
  },
  ambdel() {
    const a = S.am;
    conferma(`L'ambiente "${a.nome}" viene eliminato. Le unità non vengono toccate.`, async () => { try { await api('/api/ambienti/' + a.id, 'DELETE'); await caricaAmbienti(); SUB = null; toast('Ambiente eliminato'); render(); } catch (e) { toast(e.message, 'err'); } }, { titolo: 'Eliminare l\'ambiente?', ok: 'Elimina' });
  },
  // wizard
  wzmodo(d) {
    if (S.wz.dup) {                             // in una copia, cambiare modalità azzera le fasi
      const m = Number(d.v); if (m === S.wz.modo) return;
      S.wz.modo = m; S.wz.fasi = fasiBase(m); toast('Fasi azzerate: ricreale nel passo 3', 'warn'); return render();
    }
    // verso uno scenario Vent./Deum. le fasi a temperatura diventano di quel tipo; all'indietro tornano a temperatura
    const w = S.wz, prima = TIPO_MODO[w.modo], ora = TIPO_MODO[Number(d.v)]; w.modo = Number(d.v);
    if (ora) w.fasi.forEach(f => { if (f.tipo === 'temp') f.tipo = ora; });
    else if (prima) w.fasi.forEach(f => { if (f.tipo !== 'off') Object.assign(f, { tipo: 'temp', target: w.modo === 5 ? 20 : 24, mant: null, oscillazione: false }); });
    render();
  },

  wzgg(d) { const g = Number(d.v), a = S.wz.giorni, i = a.indexOf(g); if (i >= 0) a.splice(i, 1); else a.push(g); render(); },
  wzum(d) { S.wz.um = d.v; if (d.v === 'tutto') S.wz.unita = CFG.unita.map(u => u.id); render(); },
  wzgr(d) { const w = S.wz, ids = grp(d.id).unita, tutte = ids.every(x => w.unita.includes(x)); w.unita = tutte ? w.unita.filter(x => !ids.includes(x)) : [...new Set([...w.unita, ...ids])]; render(); },
  wzall() { const w = S.wz; w.unita = w.unita.length === CFG.unita.length ? [] : CFG.unita.map(u => u.id); render(); },
  wzun(d) { const w = S.wz, i = w.unita.indexOf(d.id); if (i >= 0) w.unita.splice(i, 1); else w.unita.push(d.id); render(); },
  wzprev() { S.wz.step--; scrollTo(0, 0); render(); },
  wznext() {
    const w = S.wz; if (w.step === 1 && !w.nome.trim()) return toast('Dai un nome allo scenario', 'warn'); if (w.step === 1 && !w.giorni.length) return toast('Scegli almeno un giorno', 'warn');
    if (w.step === 2 && !w.unita.length) return toast('Scegli almeno un\'unità', 'warn'); w.step++; scrollTo(0, 0); render();
  },
  wzadd() {
    const w = S.wz, temp = w.fasi.filter(f => f.tipo !== 'off'), ult = temp[temp.length - 1], ini = ult ? ult.fino : '08:00', t = w.modo === 5 ? 20 : 24;
    S.ph = { tipo: TIPO_MODO[w.modo] || 'temp', nome: `Fase ${temp.length + 1}`, target: t, inizio: ini, fino: hhmm(minuti(ini) + 240), mant: null, oscillazione: false };
    SUB = { k: 'ph', i: temp.length, nuova: true }; scrollTo(0, 0); render();
  },
  wzed(d) { const i = Number(d.i), f = S.wz.fasi[i]; S.ph = JSON.parse(JSON.stringify({ mant: null, oscillazione: false, fino: hhmm(minuti(wzInizio(S.wz, i)) + 240), ...f, inizio: i === 0 ? f.inizio : wzInizio(S.wz, i) })); SUB = { k: 'ph', i }; scrollTo(0, 0); render(); },
  phtipo(d) { const p = S.ph; p.tipo = d.v; if (d.v !== 'off') { p.nome = p.nome || `Fase ${SUB.i + 1}`; if (p.target == null) p.target = S.wz.modo === 5 ? 20 : 24; if (!p.fino) p.fino = hhmm(minuti(wzInizio(S.wz, SUB.i)) + 240); } render(); }, phosc(d) { S.ph.oscillazione = d.v === 'true'; render(); },
  phtarget(d) { S.ph.target = clamp(S.ph.target + Number(d.d)); render(); },
  phmant() { const p = S.ph; p.mant = p.mant ? null : mantIniziale(p.target, S.wz.modo === 5); render(); },
  mttarget(d) { S.ph.mant.target = clamp(S.ph.mant.target + Number(d.d)); render(); },
  mttemp(d) { S.ph.mant.temp = clamp(S.ph.mant.temp + Number(d.d)); render(); },
  mtritorno(d) { S.ph.mant.ritorno = clamp(S.ph.mant.ritorno + Number(d.d)); render(); },
  phdel() { S.wz.fasi.splice(SUB.i, 1); if (S.wz.fasi[0] && !S.wz.fasi[0].inizio) S.wz.fasi[0].inizio = '08:00'; SUB = { k: 'wiz' }; render(); },
  phsalva() {
    const w = S.wz, p = S.ph, i = SUB.i, nuova = SUB.nuova, off = p.tipo === 'off';
    if (off) {
      if (w.fasi.some((f, k) => f.tipo === 'off' && (nuova || k !== i))) return toast('C\'è già una fase di spegnimento', 'warn');
      if (!nuova && i !== w.fasi.length - 1) return toast('Lo spegnimento deve essere l\'ultima fase', 'warn');
      const o = { tipo: 'off' }; if (nuova) w.fasi.push(o); else w.fasi[i] = o;
    } else {
      if (!p.fino) return toast('Scegli l\'ora di fine', 'warn');
      if (i === 0 && !p.inizio) return toast('Scegli l\'ora di inizio', 'warn');
      if (!NO_T[p.tipo] && p.mant) { const e = mantErrore(p, w.modo === 5); if (e) return toast(e, 'warn'); }
      const o = { ...p }; if (NO_T[o.tipo]) { delete o.target; delete o.mant; delete o.oscillazione; } if (i > 0) delete o.inizio; if (!o.mant) delete o.mant;
      if (nuova) { const k = w.fasi.findIndex(f => f.tipo === 'off'); w.fasi.splice(k < 0 ? w.fasi.length : k, 0, o); } else w.fasi[i] = o;
    }
    SUB = { k: 'wiz' }; scrollTo(0, 0); render();
  },
  async wzsalva(d, el) {
    try {
      const w = S.wz, body = wzBody(), r = w.id ? await api('/api/scenari/' + w.id, 'PUT', body) : await api('/api/scenari', 'POST', body), id = w.id || r.id;
      if (el.dataset.avvia) { if (RUN.attivo) await api('/api/run/stop', 'POST', { spegni: false }); await api('/api/run/start', 'POST', { id }); }
      SC = await api('/api/scenari'); SUB = null; toast('Scenario salvato'); aggiorna();
    } catch (e) { toast(e.message, 'err'); }
  },
  // notifiche
  async pushon() {
    try {
      if (!('serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext)) return toast('Servono HTTPS e, su iPhone, l\'app aggiunta alla Home', 'warn');
      const reg = await navigator.serviceWorker.ready; if (await Notification.requestPermission() !== 'granted') return toast('Permesso negato', 'warn');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(CFG.push.publicKey) });
      await api('/api/push/subscribe', 'POST', sub.toJSON()); toast('Notifiche attivate');
    } catch (e) { toast(e.message, 'err'); }
  },
  async pushtest() { try { await api('/api/push/test', 'POST'); toast('Notifica inviata'); } catch (e) { toast(e.message, 'err'); } },
};
document.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (a && !a.classList.contains('dis') && !a.closest('.dis') && ACT[a.dataset.a]) ACT[a.dataset.a](a.dataset, a); });
document.addEventListener('input', (e) => { if (e.target.dataset.imp) { IMPD[e.target.dataset.imp] = e.target.value; return; } const m = e.target.dataset.m; if (!m) return; const [o, k] = m.split('.'); S[o][k] = e.target.value; });

(async () => {
  CFG = await api('/api/config');
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('/sw.js').catch(() => {});
  await Promise.all([caricaStato(), caricaRun()]);
  try { SC = await api('/api/scenari'); } catch {}
  // Con l'app aperta: lettura dell'impianto ogni POLL_S secondi (solo se la pagina è visibile).
  const POLL_S = 10;
  setInterval(() => { if (!document.hidden) { caricaStato(true); if (TAB === 'altro') caricaLog(); } }, POLL_S * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { caricaStato(true); caricaRun(); } });
  setInterval(caricaRun, 30000);
})();

// registro: carica le 30 voci successive quando si arriva in fondo alla finestra
document.addEventListener('scroll', e => {
  const b = e.target;
  if (b.classList && b.classList.contains('logbox') && b.scrollTop + b.clientHeight >= b.scrollHeight - 40) altroLog();
}, true);

document.getElementById('toast').addEventListener('click', chiudiToast);   // tocca per chiudere
