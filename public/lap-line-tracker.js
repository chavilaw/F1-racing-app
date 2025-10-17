let socket; 
let latestSessions = []; 
let currentSessionId = sessionStorage.getItem('lapline_session_id') || null; 

let raceActive = false;
let currentRaceMode = 'SAFE';
let raceStartTime = null;
let currentSession = null;

document.addEventListener('DOMContentLoaded', () => {
  // auth from login.html
  const key  = sessionStorage.getItem('racetrack_key');
  let role   = localStorage.getItem('racetrack_role');

  if (!key) { window.location.href = '/login.html'; return; }
  if (role !== 'observer') { role = 'observer'; localStorage.setItem('racetrack_role', 'observer'); }

  // single socket
  socket = io();
  socket.emit('auth', { role, key });

  socket.on('auth-result', (ok) => {
    if (!ok) { showError('Wrong key!'); return; }
    clearError();
    document.getElementById('app').style.display = 'block';
    // server will emit 'sessions' on auth ok (per your server code)
  });

  socket.on('connect_error', () => showError('Connection error'));

  // sessions list (comes from server on auth and after receptionist changes)
  socket.on('sessions', (sessions) => {
    latestSessions = Array.isArray(sessions) ? sessions : [];

    // pick current session (keep existing if present; else prefer one with drivers; else first)
    if (!currentSessionId || !latestSessions.some(s => String(s.id) === String(currentSessionId))) {
      const withDrivers = latestSessions.find(s => (s.drivers || []).length > 0);
      currentSessionId = (withDrivers || latestSessions[0] || {})?.id || null;
      if (currentSessionId) sessionStorage.setItem('lapline_session_id', String(currentSessionId));
    }

    currentSession = latestSessions.find(s => String(s.id) === String(currentSessionId)) || null;

    updateRaceInfoPanel();
    renderSessionsDropdown();
    renderCarButtons();
    initializeLogout();
  });

  // SAFETY TIMER BROADCAST — this is the only race-state feed your server relays
  socket.on('timer-update', (payload) => {
    // payload: { timeLeft, raceActive, raceMode, sessionId }
    if (!matchesSession(payload.sessionId)) return;

    raceActive = !!payload.raceActive;
    currentRaceMode = String(payload.raceMode || 'SAFE').toUpperCase();

    // optional: synthesize a startTime so your elapsed display moves
    if (raceActive && payload.timeLeft != null) {
      // treat start as "now - remaining to end of session" only to tick UI
      // if you don’t want this, remove lines below and just show LIVE/--:--
      raceStartTime = raceStartTime || Date.now();
    } else if (!raceActive) {
      raceStartTime = null;
    }

    updateRaceInfoPanel();
    updateGridEnabled();
  });

  // click to emit lap
  document.getElementById('grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-car]');
    if (!btn) return;
    const carNumber = Number(btn.dataset.car);
    if (!carNumber) return;

    if (!isLapAllowed()) return;
    socket.emit('lap:crossed', { carNumber, sessionId: currentSessionId });
  });

  // ---- helpers ----
  function updateRaceInfoPanel() {
    document.getElementById('sessions').textContent =
      currentSession ? (currentSession.name || '—') : 'No session selected';
    document.getElementById('driver-count').textContent =
      `${(currentSession?.drivers || []).length}/8 drivers`;
    document.getElementById('current-race-mode').textContent = currentRaceMode;

    // simple status text; you can replace with a countdown if server sends one to this page
    if (raceActive) {
      document.getElementById('race-duration').textContent = 'Race in progress';
    } else if (currentRaceMode === 'FINISH') {
      document.getElementById('race-duration').textContent = 'Finish flag — laps may still count';
    } else {
      document.getElementById('race-duration').textContent = 'Race not started';
    }
  }

  function renderSessionsDropdown() {
    const sessionsSelect = document.getElementById('sessionSelect');
    sessionsSelect.innerHTML = '';

    if (!latestSessions.length) {
      sessionsSelect.innerHTML = '<option value="">No sessions</option>';
      return;
    }

    latestSessions.forEach((s) => {
      const opt = document.createElement('option');
      opt.value = String(s.id);
      opt.textContent = `#${s.id} — ${s.name} (${(s.drivers||[]).length}/8)`;
      if (String(s.id) === String(currentSessionId)) opt.selected = true;
      sessionsSelect.appendChild(opt);
    });

    sessionsSelect.onchange = () => {
      currentSessionId = sessionsSelect.value;
      sessionStorage.setItem('lapline_session_id', String(currentSessionId));
      currentSession = latestSessions.find(s => String(s.id) === String(currentSessionId)) || null;

      // reset local race flags until next timer-update arrives
      raceActive = false;
      currentRaceMode = 'SAFE';
      raceStartTime = null;

      updateRaceInfoPanel();
      renderCarButtons();
      updateGridEnabled();
    };
  }

  function renderCarButtons() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';

    const session = latestSessions.find(s => String(s.id) === String(currentSessionId));
    if (!session) { grid.textContent = 'Select a session.'; return; }

    const drivers = Array.isArray(session.drivers) ? session.drivers : [];
    if (!drivers.length) { grid.textContent = 'No drivers yet.'; return; }

    drivers
      .map(d => Number(d.carNumber))
      .filter(n => Number.isFinite(n))
      .sort((a,b) => a - b)
      .forEach((n) => {
        const btn = document.createElement('button');
        btn.dataset.car = String(n);
        btn.textContent = String(n);
        grid.appendChild(btn);
      });

    updateGridEnabled();
  }

  function updateGridEnabled() {
    const disabled = !isLapAllowed();
    document.querySelectorAll('#grid button[data-car]').forEach(b => b.disabled = disabled);
  }

  function isLapAllowed() {
    // Allow during RUNNING and FINISH (spec: laps can still cross in finish)
    return (raceActive || currentRaceMode === 'FINISH');
  }

  function matchesSession(sessionId) {
    return !sessionId || String(sessionId) === String(currentSessionId);
  }

  function showError(msg){ document.getElementById('error').textContent = msg; }
  function clearError(){ document.getElementById('error').textContent = ''; }
});

function initializeLogout() {
  const btn = document.getElementById('logout');
  if (!btn) return;
  btn.addEventListener('click', () => { 
    sessionStorage.removeItem('racetrack_key');
    localStorage.removeItem('racetrack_role');
    if (socket) socket.disconnect();
    window.location.href = '/login.html';
  });
}
