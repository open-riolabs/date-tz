import { DateTz } from './lib/index.js';

// ─────────────────────── shared state / helpers ───────────────────────

const DEFAULT_CITIES = [
  'Etc/UTC',
  'Europe/London',
  'Europe/Rome',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
];

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Etc/UTC';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function offsetStr(ms) {
  const sign = ms < 0 ? '-' : '+';
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  return `UTC${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function show(el, content, isError = false) {
  el.classList.toggle('error', isError);
  if (typeof content === 'string') el.textContent = content;
  else { el.innerHTML = ''; el.append(content); }
}

function kvTable(entries) {
  const wrap = document.createElement('div');
  wrap.className = 'kv';
  for (const [k, v] of entries) {
    const kEl = document.createElement('div'); kEl.className = 'k'; kEl.textContent = k;
    const vEl = document.createElement('div'); vEl.className = 'v'; vEl.textContent = v;
    wrap.append(kEl, vEl);
  }
  return wrap;
}

function inspect(d) {
  return kvTable([
    ['toString()', d.toString()],
    ['timestamp', d.timestamp + ' ms'],
    ['timezone', d.timezone],
    ['timezoneOffset', `${d.timezoneOffset} ms (${offsetStr(d.timezoneOffset)})`],
    ['isDst', String(d.isDst)],
    ['isLeapYear', String(d.isLeapYear)],
    ['year / month / day', `${d.year} / ${d.month + 1} / ${d.day}`],
    ['hour : minute', `${String(d.hour).padStart(2,'0')} : ${String(d.minute).padStart(2,'0')}`],
    ['dayOfWeek', String(d.dayOfWeek)],
    ['UTC equivalents', `${d.yearUTC}-${String(d.monthUTC + 1).padStart(2,'0')}-${String(d.dayUTC).padStart(2,'0')} ${String(d.hourUTC).padStart(2,'0')}:${String(d.minuteUTC).padStart(2,'0')}`],
  ]);
}

// ─────────────────────── timezone datalist ───────────────────────

const tzList = $('#tzList');
const allTimezones = DateTz.timezones();
for (const tz of allTimezones) {
  const opt = document.createElement('option');
  opt.value = tz;
  tzList.append(opt);
}

// ─────────────────────── hero "now" ───────────────────────

const bigDate = $('#bigDate');
const bigMeta = $('#bigMeta');
const bigTs = $('#bigTs');
const bigTsSec = $('#bigTsSec');

function tickHero() {
  try {
    const d = DateTz.now(LOCAL_TZ);
    bigDate.textContent = d.toString('WL, DD LM YYYY · HH:mm:ss');
    bigMeta.textContent = `${d.timezone} · ${offsetStr(d.timezoneOffset)}${d.isDst ? ' · DST' : ''}`;
    bigTs.textContent = d.timestamp.toString();
    bigTsSec.textContent = `${Math.floor(d.timestamp / 1000)} s · ISO ${new Date(d.timestamp).toISOString()}`;
  } catch (err) { bigDate.textContent = '(err: ' + err.message + ')'; }
}

// ─────────────────────── world clock tiles ───────────────────────

const clockGrid = $('#clockGrid');
const clockFilter = $('#clockFilter');
const clockAdd = $('#clockAdd');

let cities = [...DEFAULT_CITIES];

function renderClockTiles() {
  const filter = clockFilter.value.trim().toLowerCase();
  clockGrid.innerHTML = '';
  for (const tz of cities) {
    if (filter && !tz.toLowerCase().includes(filter)) continue;
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.tz = tz;
    tile.innerHTML = `
      <button class="tz-del" title="Remove">×</button>
      <div class="tz-name">${tz}</div>
      <div class="tz-time" data-time>—</div>
      <div class="tz-meta"><span data-offset>—</span><span data-dst></span></div>
    `;
    tile.querySelector('.tz-del').addEventListener('click', () => {
      cities = cities.filter(c => c !== tz);
      renderClockTiles();
      updateClockTiles();
    });
    clockGrid.append(tile);
  }
  updateClockTiles();
}

function updateClockTiles() {
  for (const tile of $$('.tile', clockGrid)) {
    const tz = tile.dataset.tz;
    try {
      const d = DateTz.now(tz);
      tile.querySelector('[data-time]').textContent = d.toString('HH:mm:ss');
      tile.querySelector('[data-offset]').textContent = `${d.toString('WS DD SM')} · ${offsetStr(d.timezoneOffset)}`;
      const dstEl = tile.querySelector('[data-dst]');
      dstEl.innerHTML = d.isDst ? '<span class="chip dst">DST</span>' : '';
    } catch (err) {
      tile.querySelector('[data-time]').textContent = 'err';
    }
  }
}

clockFilter.addEventListener('input', renderClockTiles);
clockAdd.addEventListener('click', () => {
  const tz = prompt('IANA timezone to add (e.g. Africa/Nairobi):');
  if (!tz) return;
  try {
    DateTz.now(tz); // validate
    if (!cities.includes(tz)) {
      cities.push(tz);
      renderClockTiles();
    }
  } catch (err) { alert('Invalid timezone: ' + err.message); }
});

renderClockTiles();

// ─────────────────────── timestamp inspector ───────────────────────

const tsInput = $('#tsInput');
const tsUnit = $('#tsUnit');
const tsTz = $('#tsTz');
const tsResult = $('#tsResult');
const tsNowBtn = $('#tsNowBtn');

function runTs() {
  try {
    const raw = Number(tsInput.value);
    if (!Number.isFinite(raw)) return show(tsResult, 'Enter a numeric timestamp.', true);
    const ms = tsUnit.value === 's' ? raw * 1000 : raw;
    const d = new DateTz(ms, tsTz.value);
    show(tsResult, inspect(d));
  } catch (err) { show(tsResult, err.message, true); }
}

tsNowBtn.addEventListener('click', () => {
  tsInput.value = Date.now().toString();
  tsUnit.value = 'ms';
  runTs();
});
[tsInput, tsUnit, tsTz].forEach(el => el.addEventListener('input', runTs));
tsInput.value = Date.now().toString();
runTs();

// ─────────────────────── parse ───────────────────────

const parseStr = $('#parseStr');
const parsePattern = $('#parsePattern');
const parseTz = $('#parseTz');
const parseResult = $('#parseResult');

function runParse() {
  try {
    const d = DateTz.parse(parseStr.value, parsePattern.value, parseTz.value);
    show(parseResult, inspect(d));
  } catch (err) { show(parseResult, err.message, true); }
}
[parseStr, parsePattern, parseTz].forEach(el => el.addEventListener('input', runParse));
runParse();

// ─────────────────────── format ───────────────────────

const fmtTs = $('#fmtTs');
const fmtTz = $('#fmtTz');
const fmtPattern = $('#fmtPattern');
const fmtLocale = $('#fmtLocale');
const fmtResult = $('#fmtResult');

function runFmt() {
  try {
    const ms = Number(fmtTs.value);
    if (!Number.isFinite(ms)) return show(fmtResult, 'Enter a numeric timestamp.', true);
    const d = new DateTz(ms, fmtTz.value);
    const out = d.toString(fmtPattern.value, fmtLocale.value);
    show(fmtResult, kvTable([
      ['Formatted', out],
      ['Pattern', fmtPattern.value],
      ['Locale', fmtLocale.value],
      ['Timezone', d.timezone + ' · ' + offsetStr(d.timezoneOffset) + (d.isDst ? ' · DST' : '')],
      ['Default format', d.toString()],
    ]));
  } catch (err) { show(fmtResult, err.message, true); }
}
fmtTs.value = Date.now().toString();
[fmtTs, fmtTz, fmtPattern, fmtLocale].forEach(el => el.addEventListener('input', runFmt));
runFmt();

// ─────────────────────── cross-timezone convert ───────────────────────

const convSrc = $('#convSrc');
const convPattern = $('#convPattern');
const convTz = $('#convTz');
const convTargets = $('#convTargets');
const convResult = $('#convResult');

function runConv() {
  try {
    const src = DateTz.parse(convSrc.value, convPattern.value, convTz.value);
    const targets = convTargets.value.split(',').map(s => s.trim()).filter(Boolean);

    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Timezone</th><th>Local time</th><th>Offset</th><th>DST</th><th>Weekday</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    const source = document.createElement('tr');
    source.innerHTML = `<td><strong>${src.timezone}</strong> <small style="color:var(--muted)">(source)</small></td>
      <td>${src.toString()}</td><td>${offsetStr(src.timezoneOffset)}</td>
      <td>${src.isDst ? 'yes' : 'no'}</td><td>${src.toString('WL')}</td>`;
    tbody.append(source);

    for (const tz of targets) {
      try {
        const r = src.cloneToTimezone(tz);
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${r.timezone}</td><td>${r.toString()}</td>
          <td>${offsetStr(r.timezoneOffset)}</td><td>${r.isDst ? 'yes' : 'no'}</td>
          <td>${r.toString('WL')}</td>`;
        tbody.append(tr);
      } catch (err) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${tz}</td><td colspan="4" style="color:var(--bad)">${err.message}</td>`;
        tbody.append(tr);
      }
    }
    table.append(tbody);

    const meta = document.createElement('div');
    meta.style.marginBottom = '12px';
    meta.style.color = 'var(--muted)';
    meta.style.fontSize = '12px';
    meta.textContent = `Absolute instant: ${src.timestamp} ms (UTC ${new Date(src.timestamp).toISOString()})`;

    const wrap = document.createDocumentFragment();
    wrap.append(meta, table);
    show(convResult, wrap);
  } catch (err) { show(convResult, err.message, true); }
}
[convSrc, convPattern, convTz, convTargets].forEach(el => el.addEventListener('input', runConv));
runConv();

// ─────────────────────── manipulate ───────────────────────

const manSrc = $('#manSrc');
const manPattern = $('#manPattern');
const manTz = $('#manTz');
const manOp = $('#manOp');
const manValue = $('#manValue');
const manUnit = $('#manUnit');
const manTzArg = $('#manTzArg');
const manApply = $('#manApply');
const manReset = $('#manReset');
const manResult = $('#manResult');
const manHistory = $('#manHistory');

let currentDate = null;
let history = [];

function rebuildFromSource() {
  try {
    currentDate = DateTz.parse(manSrc.value, manPattern.value, manTz.value);
    history = [];
    renderManip();
  } catch (err) { show(manResult, err.message, true); }
}

function renderManip() {
  show(manResult, inspect(currentDate));
  manHistory.innerHTML = '';
  for (const entry of history) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="op">${entry.op}</span><span class="arrow">→</span><span class="res">${entry.result}</span>`;
    manHistory.append(li);
  }
}

manApply.addEventListener('click', () => {
  if (!currentDate) rebuildFromSource();
  if (!currentDate) return;
  const op = manOp.value;
  const val = Number(manValue.value);
  const unit = manUnit.value;
  const tzArg = manTzArg.value;
  try {
    let label;
    if (op === 'add') { currentDate.add(val, unit); label = `add(${val}, '${unit}')`; }
    else if (op === 'set') { currentDate.set(val, unit); label = `set(${val}, '${unit}')`; }
    else if (op === 'stripSecMillis') { currentDate.stripSecMillis(); label = `stripSecMillis()`; }
    else if (op === 'setTimezone') { currentDate.setTimezone(tzArg); label = `setTimezone('${tzArg}')`; }
    else if (op === 'cloneToTimezone') { currentDate = currentDate.cloneToTimezone(tzArg); label = `cloneToTimezone('${tzArg}')`; }
    history.push({ op: label, result: currentDate.toString() + ' (' + currentDate.timezone + ')' });
    renderManip();
  } catch (err) {
    history.push({ op: `${op} ${val} ${unit}`, result: 'error: ' + err.message });
    renderManip();
  }
});

manReset.addEventListener('click', rebuildFromSource);
[manSrc, manPattern, manTz].forEach(el => el.addEventListener('change', rebuildFromSource));
rebuildFromSource();

// ─────────────────────── global tick ───────────────────────

tickHero();
setInterval(() => { tickHero(); updateClockTiles(); }, 1000);
