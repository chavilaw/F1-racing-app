const { resolveMx } = require('dns');
const express = require('express'); // tool to serve pages
const http = require('http'); // required by Socket.IO
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io'); // real-time connections

const PERSIST = process.argv.includes('--persist');
const PERSIST_FILE = path.join(__dirname, 'data.json');

if (!process.env.RECEPTIONIST_KEY || !process.env.OBSERVER_KEY || !process.env.SAFETY_KEY) { // IF KEYS NOT SET, SERVER WILL NOT START
  console.error('Error: Missing access keys. Set RECEPTIONIST_KEY, OBSERVER_KEY, SAFETY_KEY.');
  process.exit(1);
}

const app = express(); // "app" is the Express web app
const server = http.createServer(app); // "server" is the HTTP server that Express runs on
const io = new Server(server); // "io" is the Socket.IO server attached to the HTTP server

app.use(express.static(path.join(__dirname, 'public'))); // anything in public/ can be viewed in the browser

app.get('/', (req, res) => {
  res.sendFile('index.html');
});

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
  console.log(`Persistence: ${PERSIST ? 'ENABLED' : 'DISABLED'} (start with --persist to enable)`);
});

let sessions = [];
let StoredRaceData = null;
let resumeTimerInterval = null;

function getSession(sessionId) {
  return sessions.find(s => String(s.id) === String(sessionId));
}

function broadcastSessions() {
  io.emit('sessions', sessions);
  debSaveState();
}

function isAuthorized(socket, role) {
  return socket.role === role;
}

function getAvailableCarNumber(session) {
  const used = new Set((session.drivers || []).map(d => Number(d.carNumber)).filter(n => !isNaN(n)));
  for (let n = 1; n <= 8; n++) {
    if (!used.has(n)) return n;
  }
  return null;
}

function loadState() {
  if (!PERSIST) return;
  try {
    if (!fs.existsSync(PERSIST_FILE)) return;
    const raw = fs.readFileSync(PERSIST_FILE, 'utf8');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.sessions && Array.isArray(parsed.sessions)) sessions = parsed.sessions;
    if (parsed.StoredRaceData) StoredRaceData = parsed.StoredRaceData;
    console.log('Loaded state from', PERSIST_FILE);
  } catch (err) {
    console.error('Failed to load persisted state', err);
  }
}

function saveState() {
  if (!PERSIST) return;
  try {
    const tmp = PERSIST_FILE + '.tmp';
    const data = { sessions, StoredRaceData: StoredRaceData };
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, PERSIST_FILE);
    //console.log('Saved state to', PERSIST_FILE); // testing logging
  } catch (err) {
    console.error('Failed to save state', err);
  }
}

let saveScheduled = false;
function debSaveState() {
  if (!PERSIST) return;
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    saveState();
  }, 200);
}

function restoreServerTimer() {
  if (resumeTimerInterval) {
    clearInterval(resumeTimerInterval);
    resumeTimerInterval = null;
  }

  if (!StoredRaceData || !StoredRaceData.raceActive) return;

  let endTs = null;
  if (StoredRaceData.endTs && Number.isFinite(Number(StoredRaceData.endTs))) {
    endTs = Number(StoredRaceData.endTs);
  } else if (StoredRaceData.timeLeft != null) {
    endTs = Date.now() + Number(StoredRaceData.timeLeft) * 1000;
    StoredRaceData.endTs = endTs;
    debSaveState();
  } else {
    // nothing we can resume
    return;
  }

  StoredRaceData.raceActive = true;

  // Tick function: emit remaining seconds each second
  function tick() {
    const remainingMs = Math.max(0, endTs - Date.now());
    const remainingSec = Math.ceil(remainingMs / 1000);
    // Compose payload similar to what race-control used
    const payload = {
      timeLeft: remainingSec,
      raceActive: remainingSec > 0,
      raceMode: StoredRaceData.raceMode,
      sessionId: StoredRaceData.sessionId,
      // keep endTs so future restarts can resume
      endTs: endTs
    };
    // update stored snapshot
    StoredRaceData.timeLeft = remainingSec;
    StoredRaceData.endTs = endTs;
    StoredRaceData.raceActive = payload.raceActive;

    io.emit('timer-update', payload);
    debSaveState();

    if (!payload.raceActive) {
      // race finished — clear interval and set final mode
      clearInterval(resumeTimerInterval);
      resumeTimerInterval = null;
      StoredRaceData.raceActive = false;
      StoredRaceData.raceMode = 'finish';
      // final broadcast
      io.emit('timer-update', {
        timeLeft: 0,
        raceActive: false,
        raceMode: 'finish',
        sessionId: StoredRaceData.sessionId,
        endTs: endTs
      });
      debSaveState();
    }
  }

  // Immediately send one tick then set interval
  tick();
  resumeTimerInterval = setInterval(tick, 1000);
}

if (PERSIST) {
  loadState();
  if (StoredRaceData && StoredRaceData.raceActive) {
    console.log('Resuming race timer from persisted state...');
    restoreServerTimer();
  }
}

io.on('connection', (socket) => { // socket object for every unique user
  console.log('Client connected');
  socket.emit('sessions', sessions);

  socket.on('request-race-data', () => {
    socket.emit('timer-update', StoredRaceData);
  });
  // socket.on === listen // socket.emit === send

  socket.on('auth', ({ role, key }) => { // check keys and role
    let correct = false;
    if (role === 'receptionist' && key === process.env.RECEPTIONIST_KEY) correct = true;
    if (role === 'observer' && key === process.env.OBSERVER_KEY) correct = true;
    if (role === 'safety' && key === process.env.SAFETY_KEY) correct = true;

    setTimeout(() => {
      socket.emit('auth-result', correct);
      if (correct) {
        socket.role = role;
        socket.emit('sessions', sessions);
      }
    }, 500); // 500ms delay
  });

  socket.on('add-session', (data, cb) => { // creating sessions
    if (!isAuthorized(socket, 'receptionist')) return cb && cb({ error: 'not authorized' });
    if (!data || !data.name) return cb && cb({ error: 'invalid session data' });

    const id = data.id || (Date.now());
    if (getSession(id)) return cb && cb({ error: 'session id already exists' });

    if (sessions.find(s => String(s.name) === String(data.name))) return cb && cb({ error: 'session name already exists' });

    const newSession = { id, name: data.name, drivers: [] };
    sessions.push(newSession);
    broadcastSessions(); // broadcast to everyone
    cb && cb({ ok: true, session: newSession });
  });

  socket.on('delete-session', (payload, cb) => {
    // Allow both receptionist and safety officer to delete sessions
    if (!isAuthorized(socket, 'receptionist') && !isAuthorized(socket, 'safety')) {
      return cb && cb({ error: 'not authorized' });
    }

    if (!payload || !payload.sessionId) return cb && cb({ error: 'invalid payload' });

    const idx = sessions.findIndex(s => String(s.id) === String(payload.sessionId));
    if (idx === -1) return cb && cb({ error: 'session not found' });

    // OPTIONAL SAFETY CHECK:
    // if (raceState && String(raceState.sessionId) === String(payload.sessionId)) {
    //   return cb && cb({ error: 'cannot delete session while race is active' });
    // }

    // Remove the session
    const deleted = sessions.splice(idx, 1)[0];
    console.log(`Session deleted by ${socket.role}: ${deleted.name} (ID: ${deleted.id})`);
    broadcastSessions();
    cb && cb({ ok: true, deleted });
  });

  socket.on('add-driver', (payload, cb) => {
    if (!isAuthorized(socket, 'receptionist')) return cb && cb({ error: 'not authorized' });
    if (!payload || !payload.sessionId || !payload.name) return cb && cb({ error: 'invalid payload' });

    carNum = payload.carNumber;

    const s = getSession(payload.sessionId);
    if (!s) return cb && cb({ error: 'session not found' });

    if ((s.drivers || []).length >= 8) {
      return cb && cb({ error: 'session already has maximum 8 drivers' });
    }

    if ((s.drivers || []).some(d => d.name === payload.name)) {
      return cb && cb({ error: 'driver name already exists in this session' });
    }

    if (carNum != null) {
      const desired = Number(carNum);
      if (isNaN(desired) || desired < 1 || desired > 8) return cb && cb({ error: 'car number must be from 1 to 8' });
      const conflict = (s.drivers || []).some(x => x.name !== payload.oldName && Number(x.carNumber) === desired);
      if (conflict) return cb && cb({ error: 'car number already assigned in this session' });
      carNum = desired;
    } else {
      carNum = getAvailableCarNumber(s);
      if (carNum == null) {
        return cb && cb({ error: 'no car numbers available' });
      }
    }

    const driver = {
      name: payload.name,
      carNumber: carNum,
      fastestLapMs: null,
      currentLap: 0,
      lastLapStamp: null
    };
    s.drivers = s.drivers || [];
    s.drivers.push(driver);

    broadcastSessions();
    cb && cb({ ok: true, driver });
  });

  socket.on('edit-driver', (payload, cb) => {
    if (!isAuthorized(socket, 'receptionist')) return cb && cb({ error: 'not authorized' });
    if (!payload || !payload.sessionId || !payload.oldName || !payload.newName) return cb && cb({ error: 'invalid payload' });

    const s = getSession(payload.sessionId);
    if (!s) return cb && cb({ error: 'session not found' });

    const d = (s.drivers || []).find(x => x.name === payload.oldName);
    if (!d) return cb && cb({ error: 'driver not found' });

    if (payload.newName !== payload.oldName && (s.drivers || []).some(x => x.name === payload.newName)) {
      return cb && cb({ error: 'new driver name already used in this session' });
    }

    if (payload.carNumber != null) {
      const desired = Number(payload.carNumber);
      if (isNaN(desired) || desired < 1 || desired > 8) return cb && cb({ error: 'car number must be from 1 to 8' });
      const conflict = (s.drivers || []).some(x => x.name !== payload.oldName && Number(x.carNumber) === desired);
      if (conflict) return cb && cb({ error: 'car number already assigned in this session' });
      d.carNumber = desired;
    }

    d.name = payload.newName;
    broadcastSessions();
    cb && cb({ ok: true, driver: d });
  });

  socket.on('remove-driver', (payload, cb) => {
    if (!isAuthorized(socket, 'receptionist')) return cb && cb({ error: 'not authorized' });
    if (!payload || !payload.sessionId || !payload.name) return cb && cb({ error: 'invalid payload' });

    const s = getSession(payload.sessionId);
    if (!s) return cb && cb({ error: 'session not found' });

    const before = s.drivers ? s.drivers.length : 0;
    s.drivers = (s.drivers || []).filter(d => d.name !== payload.name);
    const after = s.drivers.length;
    if (before === after) return cb && cb({ error: 'driver not found' });

    broadcastSessions();
    cb && cb({ ok: true });
  });

  socket.on('timer-update', (raceData) => { // re-broadcast race data
    if (socket.role !== 'safety') {
      console.warn('Unauthorized timer update attempt');
      return;
    }

    const now = Date.now();
    if (raceData && raceData.raceActive && Number.isFinite(Number(raceData.timeLeft))) {
      const endTs = now + Number(raceData.timeLeft) * 1000;
      StoredRaceData = Object.assign({}, raceData, { endTs: endTs, lastUpdated: now });
    } else {
      StoredRaceData = Object.assign({}, raceData, { lastUpdated: now });
    }

    // persist and forward
    debSaveState();
    io.emit('timer-update', StoredRaceData);

    // If persisted and raceActive, ensure server also keeps a resume timer (so it can continue itself later)
    if (PERSIST && StoredRaceData && StoredRaceData.raceActive) {
      // cancel any existing resume interval
      if (resumeTimerInterval) clearInterval(resumeTimerInterval);
      restoreServerTimer();
    }
  });

  socket.on('race-mode-change', (raceModeData) => { // re-broadcast race mode changes
    if (socket.role !== 'safety') {
      console.warn('Unauthorized race mode change attempt');
      return;
    }

    if (PERSIST) {
      StoredRaceData = Object.assign({}, StoredRaceData || {}, { raceMode: raceModeData.raceMode, lastUpdated: Date.now() });
      debSaveState();
    }

    io.emit('race-mode-change', raceModeData);
  });

  socket.on('lap:crossed', (payload) => {
    // allow from observer (and optionally safety)
    if (socket.role !== 'observer' && socket.role !== 'safety') {
      console.warn('Unauthorized lap crossed attempt');
      return;
    }
    if (!payload || payload.sessionId == null || payload.carNumber == null) return;

    const s = getSession(payload.sessionId);
    if (!s) return;

    const carNum = Number(payload.carNumber);
    if (!Number.isFinite(carNum)) return;

    const d = (s.drivers || []).find(x => Number(x.carNumber) === carNum);
    if (!d) return;

    // --- timing (server is source of truth) ---
    const serverNow = Date.now();
    const clientNow = Number(payload.crossedAt);
    if (Number.isFinite(clientNow) && Math.abs(clientNow - serverNow) > 1500) {
      console.warn(`Lap timestamp drift for car ${carNum}: client ${clientNow - serverNow}ms`);
    }

    const prevStamp = d.lastLapStamp;   // may be null on first lap
    d.lastLapStamp = serverNow;

    const prevLap = Number(d.currentLap) || 0;
    const nextLap = prevLap + 1;
    d.currentLap = nextLap;

    let lapTimeMs = null;
    if (Number.isFinite(prevStamp)) {
      lapTimeMs = serverNow - prevStamp;
      if (lapTimeMs <= 0 || !Number.isFinite(lapTimeMs)) lapTimeMs = null;
    }

    // update fastest
    if (lapTimeMs != null) {
      if (d.fastestLapMs == null || lapTimeMs < d.fastestLapMs) {
        d.fastestLapMs = lapTimeMs;
      }
    }

    // refresh snapshot for everyone (Reception, Lapline, Leaderboard, etc.)
    broadcastSessions();

    // targeted event leaderboards listen to
    io.emit('lap:recorded', {
      sessionId: s.id,
      driverId: String(d.carNumber),   // canonical client key = String(carNumber)
      carNumber: d.carNumber,
      lapNumber: nextLap,
      lapTimeMs: lapTimeMs ?? undefined,
      crossedAt: serverNow
    });

  });

});

process.on('SIGINT', () => {
  if (PERSIST) {
    console.log('SIGINT received - saving state and exiting...');
    saveState();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (PERSIST) {
    console.log('SIGTERM received - saving state and exiting...');
    saveState();
  }
  process.exit(0);
});