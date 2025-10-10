let socket; 
let latestSessions = []; 
let currentSessionId = sessionStorage.getItem('lapline_session_id') || null; 

// functionality from the safety officer
let raceActive = false;
let currentRaceMode = 'SAFE';
let raceStartTime = null;
let currentSession = null;

document.addEventListener('DOMContentLoaded', () => {
  // 1) auth info from login.html
  const key  = sessionStorage.getItem('racetrack_key');
  let role   = localStorage.getItem('racetrack_role');

  if (!key) { window.location.href = '/login.html'; return; }
  if (role !== 'observer') { role = 'observer'; localStorage.setItem('racetrack_role', 'observer'); }

  // 2) connect + auth
  socket = io();
  socket.emit('auth', { role, key });

  socket.on('auth-result', (ok) => {
    if (!ok) { showError('Wrong key!'); return; }
    clearError();

    document.getElementById('app').style.display = 'block';

    // Ask for initial sessions snapshot 
    socket.emit('get-sessions');
  });

  socket.on('connect_error', () => showError('Connection error'));

  // 3) sessions broadcast
  socket.on('sessions', (sessions) => {
    latestSessions = Array.isArray(sessions) ? sessions : [];

    // choose session (prefer one with drivers)
    if (!currentSessionId || !latestSessions.some(s => String(s.id) === String(currentSessionId))) {
      const withDrivers = latestSessions.find(s => (s.drivers || []).length > 0);
      currentSessionId = (withDrivers || latestSessions[0] || {}).id || null;
      if (currentSessionId) sessionStorage.setItem('lapline_session_id', String(currentSessionId));
    }

    // keep a handy pointer to current session for the info panel
    currentSession = latestSessions.find(s => String(s.id) === String(currentSessionId)) || null;

    // join the session room and get current race state snapshot
    if (currentSessionId) {
      socket.emit('join-session', { sessionId: currentSessionId });     // server optional, but recommended
      socket.emit('get-race-state', { sessionId: currentSessionId });   // server should reply with 'race-state'
    }

    updateRaceInfoPanel();
    renderSessionsDropdown();
    renderCarButtons();
    initializeLogout();
  });

  // 4) click to emit lap (gated by race state)
  document.getElementById('grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-car]');
    if (!btn) return;
    const carNumber = Number(btn.dataset.car);
    if (!carNumber) return;

    // Only allow laps if the race is running and mode is allowed
    if (!isLapAllowed()) {
      return;
    }

    socket.emit('lap:crossed', { carNumber, sessionId: currentSessionId });
  });

  // subscribe to safety officer for race state updates
  socket.on('race-state', ({ sessionId, active, mode, startTime }) => {
    if (!matchesSession(sessionId)) return;
    raceActive = !!active;
    currentRaceMode = String(mode || 'SAFE').toUpperCase();
    raceStartTime = startTime || null;
    updateRaceInfoPanel();
    updateGridEnabled();
  });

  socket.on('race-mode-change', ({ mode, sessionId }) => {
    if (!matchesSession(sessionId)) return;
    currentRaceMode = String(mode || 'SAFE').toUpperCase();
    updateRaceInfoPanel();
    updateGridEnabled();
  });

  socket.on('race-started', ({ sessionId, startTime }) => {
    if (!matchesSession(sessionId)) return;
    raceActive = true;
    raceStartTime = startTime || Date.now();
    updateRaceInfoPanel();
    updateGridEnabled();
  });

  socket.on('race-stopped', ({ sessionId }) => {
    if (!matchesSession(sessionId)) return;
    raceActive = false;
    updateRaceInfoPanel();
    updateGridEnabled();
  });

  socket.on('race-completed', ({ sessionId }) => {
    if (!matchesSession(sessionId)) return;
    raceActive = false;
    updateRaceInfoPanel();
    updateGridEnabled();
  });

  // ----- helpers -----

  // basically just the info panel same as safety officer but read only
  function updateRaceInfoPanel() {
    document.getElementById('sessions').textContent =
      currentSession?.name || 'No session selected';
    document.getElementById('driver-count').textContent =
      `${(currentSession?.drivers || []).length}/8 drivers`;
    document.getElementById('current-race-mode').textContent = currentRaceMode;

    if (raceActive && raceStartTime) {
      const elapsed = Math.floor((Date.now() - raceStartTime) / 1000);
      document.getElementById('race-duration').textContent = `${elapsed} seconds elapsed`;
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

      // rejoin room + refresh state for the new session
      if (currentSessionId) {
        socket.emit('join-session', { sessionId: currentSessionId });
        socket.emit('get-race-state', { sessionId: currentSessionId });
      }

      // pessimistically disable until state arrives
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

    // Reflect current safety gating
    updateGridEnabled();
  }

  function updateGridEnabled() {
    const disabled = !isLapAllowed();
    document.querySelectorAll('#grid button[data-car]').forEach(b => b.disabled = disabled);
  }

  function isLapAllowed() {
    // Policy: allow laps only while race is active AND mode is SAFE or HAZARD
    return raceActive && (currentRaceMode === 'SAFE' || currentRaceMode === 'HAZARD');
  }

  function matchesSession(sessionId) {
    return !sessionId || String(sessionId) === String(currentSessionId);
  }

  function showError(msg){
    document.getElementById('error').textContent = msg;
  }
  function clearError(){
    document.getElementById('error').textContent = '';
  }
});

function initializeLogout() {
  document.getElementById('logout').addEventListener('click', () => { 
    sessionStorage.removeItem('racetrack_key');
    localStorage.removeItem('racetrack_role');
    socket.disconnect();
    window.location.href = '/login.html';
  });
}
