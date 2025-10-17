let socket;
let currentSession = null;
let sessionEndAtMs = null;
let timerInterval = null;
let serverTimerActive = false; // becomes true once we receive timer-update for the current session

const state = {
  bestLapMs: new Map(),     // driverId -> best lap (ms)
  currentLapNum: new Map(), // driverId -> current lap
  drivers: new Map(),       // driverId -> { id, name, carNumber }
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

  socket.on('connect', () => {
    // Ask server to send the current session snapshot
    socket.emit('leaderboard:get-current-session');
  });

  // Required events only:
  socket.on('session:current', initSession);
  socket.on('session:start',  initSession);
  socket.on('session:end',    endSessionUI);
  socket.on('lap:recorded',   onLapRecorded);
  socket.on('session:flag',   ({ flag }) => updateFlag(flag));

  
  socket.on('timer-update', (payload) => {
    
    if (currentSession && payload.sessionId && payload.sessionId !== currentSession.id) return;


    if (payload.sessionName) elSessionName.textContent = payload.sessionName;

    // apply visuals + timer
    applyRaceModeVisuals(payload.raceMode);
    setTimerFromPayload(payload);

    // once we start receiving server ticks for this session, stop local timer
    serverTimerActive = true;
    clearInterval(timerInterval);
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

  // drivers
  const drivers = session.drivers || [];
  for (const d of drivers) {
    const driverId = d.id ?? d.driverId ?? `${d.carNumber}`;
    state.drivers.set(driverId, {
      id: driverId,
      name: d.name || d.driverName || `Driver ${d.carNumber ?? ''}`,
      carNumber: d.carNumber ?? d.number ?? '?'
    });
    state.bestLapMs.set(driverId, undefined);
    state.currentLapNum.set(driverId, 0);
  }

  // reset server timer flag for a fresh session
  serverTimerActive = false;

  // timer target (fallback if we don't get timer-update)
  sessionEndAtMs = null;
  if (session.endsAt) {
    sessionEndAtMs = new Date(session.endsAt).getTime();
  } else if (session.remainingMs) {
    sessionEndAtMs = Date.now() + session.remainingMs;
  } else if (session.durationMs && session.startedAt) {
    sessionEndAtMs = new Date(session.startedAt).getTime() + session.durationMs;
  }
  startTimerLoop(); // will be cancelled automatically when timer-update arrives

  // initial render
  renderTable();
  elTimerStatus.textContent = 'LIVE';

  // initial flag if provided
  if (session.flag) updateFlag(session.flag);
}

function onLapRecorded({ sessionId, driverId, lapNumber, lapTimeMs }) {
  if (!currentSession) return;
  if (sessionId && currentSession.id && sessionId !== currentSession.id) return;

  if (!state.drivers.has(driverId)) {
    // late-added driver fallback (minimal)
    state.drivers.set(driverId, { id: driverId, name: `Driver ${driverId}`, carNumber: '?' });
    state.bestLapMs.set(driverId, undefined);
    state.currentLapNum.set(driverId, 0);
  }

  const prevLap = state.currentLapNum.get(driverId) ?? 0;
  state.currentLapNum.set(
    driverId,
    Math.max(prevLap, typeof lapNumber === 'number' ? lapNumber : prevLap + 1)
  );

  if (typeof lapTimeMs === 'number' && lapTimeMs > 0) {
    const prevBest = state.bestLapMs.get(driverId);
    if (prevBest === undefined || lapTimeMs < prevBest) {
      state.bestLapMs.set(driverId, lapTimeMs);
    }
  }

  renderTable();
}

function startTimerLoop() {
  clearInterval(timerInterval);

  // If the server is driving via timer-update, don't run the local loop
  if (serverTimerActive) return;

  if (!sessionEndAtMs) {
    elTimerText.textContent = '--:--';
    elTimerStatus.textContent = 'LIVE';
    return;
  }

  const tick = () => {
    if (serverTimerActive) { // stop if server takes over mid-session
      clearInterval(timerInterval);
      return;
    }
    let remaining = sessionEndAtMs - Date.now();
    if (remaining <= 0) {
      remaining = 0;
      clearInterval(timerInterval);
      endSessionUI();
    }
    elTimerText.textContent = fmtClock(remaining);
    if (!state.sessionEnded) elTimerStatus.textContent = 'LIVE';
  };

  tick();
  timerInterval = setInterval(tick, 200);
}

function endSessionUI() {
  state.sessionEnded = true;
  elTimerStatus.textContent = 'ENDED';
  elPostNote.hidden = false;
  // Keep table as-is until next session
}

function renderTable() {
  const rows = [];

  for (const [driverId, meta] of state.drivers.entries()) {
    rows.push({
      driverId,
      carNumber: meta.carNumber,
      name: meta.name,
      bestLapMs: state.bestLapMs.get(driverId),
      currentLap: state.currentLapNum.get(driverId) ?? 0
    });
  }

  // sort fastest first; no time => bottom
  rows.sort((a, b) => {
    const aa = a.bestLapMs, bb = b.bestLapMs;
    if (aa == null && bb == null) return 0;
    if (aa == null) return 1;
    if (bb == null) return -1;
    return aa - bb;
  });

  state.order = rows.map(r => r.driverId);

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

// === racemode visuals=====
function applyRaceModeVisuals(raceMode) {
  // Normalize to UPPER
  const m = String(raceMode || '').toUpperCase();

  // Map race mode -> your flag system
  const modeToFlag = {
    SAFE:    'GREEN',
    HAZARD:  'YELLOW',
    DANGER:  'RED',
    FINISH:  'CHECKERED',
  };
  const flag = modeToFlag[m] || '';

  // Update your flag badge/text
  if (flag) updateFlag(flag);

  // Set page background similar to teammate's implementation
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
  // Safety emits timeLeft in seconds; fmtClock expects ms
  if (typeof payload.timeLeft === 'number') {
    elTimerText.textContent = fmtClock(Math.max(0, payload.timeLeft) * 1000);
  }
  // status label
  if (String(payload.raceMode || '').toUpperCase() === 'FINISH') {
    elTimerStatus.textContent = 'FINISH';
  } else if (payload.raceActive) {
    elTimerStatus.textContent = 'LIVE';
  } else {
    elTimerStatus.textContent = 'ENDED';
  }
}

// ===== Flags =====
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

// ===== the clock  =====
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