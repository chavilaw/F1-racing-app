let socket;
let currentSession = null;

const state = {
  bestLapMs: new Map(),     
  currentLapNum: new Map(), 
  drivers: new Map(),       
  order: [],
  sessionEnded: false
};

// DOM
const elTbody       = document.getElementById('leaderboard-body');
const elTimerText   = document.getElementById('timer-text');
const elTimerStatus = document.getElementById('timer-status');
const elSessionName = document.getElementById('session-name');
const elPostNote    = document.getElementById('post-session-note');
const elFlag        = document.getElementById('flag');
const elFlagText    = document.getElementById('flag-text');

document.addEventListener('DOMContentLoaded', () => {
  initSocket();
});

function initSocket() {
  socket = io();

  // get initial timer/flag state immediately
  socket.on('connect', () => {
    socket.emit('request-race-data');
  });

  // Server always emits sessions on connect; also on receptionist edits
  socket.on('sessions', (sessions) => {
    if (!Array.isArray(sessions) || sessions.length === 0) return;

    // pick: keep current if present; else one with drivers; else first
    const picked =
      (currentSession && sessions.find(s => String(s.id) === String(currentSession.id))) ||
      sessions.find(s => (s.drivers || []).length > 0) ||
      sessions[0];

    if (!picked) return;

    if (!currentSession || String(picked.id) !== String(currentSession.id)) {
      initSession(picked);
    } else {
      // same session; refresh snapshot
      hydrateFromSnapshot(picked);
      renderTable();
    }
  });

  // lap updates
  socket.on('lap:recorded', onLapRecorded);

  // flags + timer from server
  socket.on('timer-update', (payload = {}) => {
    if (currentSession && payload.sessionId && String(payload.sessionId) !== String(currentSession.id)) return;

    if (payload.sessionName) elSessionName.textContent = payload.sessionName;

    applyRaceModeVisuals(payload.raceMode);
    setTimerFromPayload(payload);
  });
}

function initSession(session) {
  currentSession = session;
  state.sessionEnded = false;
  elPostNote.hidden = true;
  elSessionName.textContent = session.name || 'Current Session';

  // reset state
  state.bestLapMs.clear();
  state.currentLapNum.clear();
  state.drivers.clear();
  state.order = [];

  hydrateFromSnapshot(session);

  renderTable();
  elTimerStatus.textContent = '—'; // wait for server ticks
  if (session.flag) updateFlag(session.flag);
}

// apply driver snapshot into state
function hydrateFromSnapshot(session) {
  const drivers = session.drivers || [];
  for (const d of drivers) {
    const key = String(d.carNumber);
    if (!key) continue;

    state.drivers.set(key, {
      id: key,
      name: d.name || `Driver ${d.carNumber ?? ''}`,
      carNumber: d.carNumber ?? '?'
    });

    if (typeof d.currentLap === 'number') {
      state.currentLapNum.set(key, d.currentLap);
    } else if (!state.currentLapNum.has(key)) {
      state.currentLapNum.set(key, 0);
    }

    if (typeof d.fastestLapMs === 'number' && d.fastestLapMs > 0) {
      const prev = state.bestLapMs.get(key);
      if (prev == null || d.fastestLapMs < prev) {
        state.bestLapMs.set(key, d.fastestLapMs);
      }
    } else if (!state.bestLapMs.has(key)) {
      state.bestLapMs.set(key, undefined);
    }
  }
}

function onLapRecorded({ sessionId, driverId, lapNumber, lapTimeMs, carNumber }) {
  if (!currentSession) return;
  if (sessionId && String(sessionId) !== String(currentSession.id)) return;

  const key = String(carNumber ?? driverId);
  if (!state.drivers.has(key)) {
    state.drivers.set(key, { id: key, name: `Driver ${carNumber ?? driverId}`, carNumber: carNumber ?? '?' });
    state.bestLapMs.set(key, undefined);
    state.currentLapNum.set(key, 0);
  }

  const prevLap = state.currentLapNum.get(key) ?? 0;
  state.currentLapNum.set(key, Math.max(prevLap, typeof lapNumber === 'number' ? lapNumber : prevLap + 1));

  if (typeof lapTimeMs === 'number' && lapTimeMs > 0) {
    const prevBest = state.bestLapMs.get(key);
    if (prevBest == null || lapTimeMs < prevBest) {
      state.bestLapMs.set(key, lapTimeMs);
    }
  }

  renderTable();
}

function endSessionUI() {
  if (state.sessionEnded) return;
  state.sessionEnded = true;
  elTimerStatus.textContent = 'ENDED';
  elPostNote.hidden = false;
}

function renderTable() {
  const rows = [];

  for (const [key, meta] of state.drivers.entries()) {
    rows.push({
      key,
      carNumber: meta.carNumber,
      name: meta.name,
      bestLapMs: state.bestLapMs.get(key),
      currentLap: state.currentLapNum.get(key) ?? 0
    });
  }

  rows.sort((a, b) => {
    const aa = a.bestLapMs, bb = b.bestLapMs;
    if (aa == null && bb == null) return 0;
    if (aa == null) return 1;
    if (bb == null) return -1;
    return aa - bb;
  });

  state.order = rows.map(r => r.key);

  elTbody.innerHTML = '';
  let pos = 1;
  for (const r of rows) {
    const tr = document.createElement('tr');

    const tdPos = document.createElement('td');
    tdPos.textContent = r.bestLapMs == null ? '—' : String(pos++);
    tr.appendChild(tdPos);

    const tdCar = document.createElement('td');
    tdCar.textContent = r.carNumber;
    tr.appendChild(tdCar);

    const tdDriver = document.createElement('td');
    tdDriver.textContent = r.name;
    tr.appendChild(tdDriver);

    const tdBest = document.createElement('td');
    if (r.bestLapMs == null) {
      tdBest.textContent = '—';
      tdBest.className = 'time-na';
    } else {
      tdBest.textContent = fmtLap(r.bestLapMs);
      tdBest.className = 'time-good';
    }
    tr.appendChild(tdBest);

    const tdCur = document.createElement('td');
    tdCur.textContent = r.currentLap > 0 ? r.currentLap : '—';
    tr.appendChild(tdCur);

    elTbody.appendChild(tr);
  }
}

// visuals for the mode
function applyRaceModeVisuals(raceMode) {
  const m = String(raceMode || '').toUpperCase();

  //small display
  const modeEl = document.getElementById('mode');
  if (modeEl) modeEl.textContent = m;

  const modeToFlag = {
    SAFE:    'GREEN',
    HAZARD:  'YELLOW',
    DANGER:  'RED',
    FINISH:  'CHECKERED',
  };
  const flag = modeToFlag[m] || '';

  if (flag) updateFlag(flag);

  const root = document.documentElement;
  root.style.backgroundImage = '';
  root.style.backgroundColor = '';

  if (m === 'SAFE')   root.style.backgroundColor = 'green';
  if (m === 'HAZARD') root.style.backgroundColor = 'yellow';
  if (m === 'DANGER') root.style.backgroundColor = 'red';
  if (m === 'FINISH') {
    root.style.backgroundImage =
      "url('https://img.freepik.com/premium-vector/checkered-flag-vectorbanner-seamless-chessboardracing-flagblack-white-checkered-seamless-patt_888418-28661.jpg')";
    root.style.backgroundSize = '20%';
    root.style.backgroundPosition = 'center';
  }
}

function setTimerFromPayload(payload) {
  if (typeof payload.timeLeft === 'number') {
    elTimerText.textContent = fmtClock(Math.max(0, payload.timeLeft) * 1000);
  } else {
    elTimerText.textContent = '--:--';
  }

  const mode = String(payload.raceMode || '').toUpperCase();
  if (mode === 'FINISH') {
    elTimerStatus.textContent = 'FINISH';
    endSessionUI();
  } else if (payload.raceActive) {
    elTimerStatus.textContent = 'LIVE';
  } else if (payload.timeLeft === 0) {
    elTimerStatus.textContent = 'ENDED';
    endSessionUI();
  } else {
    elTimerStatus.textContent = '—';
  }
}

// flag display
function updateFlag(flagRaw) {
  const flag = String(flagRaw || '').toUpperCase();
  elFlag.classList.remove('flag-green','flag-yellow','flag-red','flag-checker','flag-sc');
  let label = flag;

  switch (flag) {
    case 'GREEN':
      elFlag.classList.add('flag-green'); label = 'Green – Track Clear'; break;
    case 'YELLOW':
    case 'FULL COURSE YELLOW':
      elFlag.classList.add('flag-yellow'); label = 'Yellow – Caution'; break;
    case 'RED':
      elFlag.classList.add('flag-red'); label = 'Red – Session Stopped'; break;
    case 'CHECKERED':
    case 'CHECKER':
    case 'CHEQUERED':
      elFlag.classList.add('flag-checker'); label = 'Checkered – Finish'; break;
    case 'SC':
    case 'SAFETY_CAR':
      elFlag.classList.add('flag-yellow','flag-sc'); label = 'Safety Car'; break;
    default:
      label = flag || '—';
  }
  elFlagText.textContent = label;
}

// time formatters 
function fmtClock(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function fmtLap(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mm = m.toString();
  const ss = s.toString().padStart(2,'0');
  const millis = (ms % 1000).toString().padStart(3,'0');
  return `${mm}:${ss}.${millis}`;
}
