const { resolveMx } = require('dns');
const express = require('express'); // tool to serve pages
const http = require('http'); // required by Socket.IO
const path = require('path');
const { Server } = require('socket.io'); // real-time connections

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
  console.log('http://localhost:3000/login.html'); // can add more direct links for testing purposes
});

let sessions = [];

function getSession(sessionId) {
  return sessions.find(s => String(s.id) === String(sessionId));
}

function broadcastSessions() {
  io.emit('sessions', sessions);
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

let StoredRaceData = null;

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
  if (!isAuthorized(socket, 'receptionist')) return cb && cb({ error: 'not authorized' });
  if (!payload || !payload.sessionId) return cb && cb({ error: 'invalid payload' });

  const idx = sessions.findIndex(s => String(s.id) === String(payload.sessionId));
  if (idx === -1) return cb && cb({ error: 'session not found' });

  // OPTIONAL SAFETY CHECK:
  // if (raceState && String(raceState.sessionId) === String(payload.sessionId)) {
  //   return cb && cb({ error: 'cannot delete session while race is active' });
  // }

  // Remove the session
  sessions.splice(idx, 1);
  broadcastSessions();
  cb && cb({ ok: true });
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
    }

    StoredRaceData = raceData;

    io.emit('timer-update', raceData);
  });

  socket.on('race-mode-change', (raceModeData) => { // re-broadcast race mode changes
    if (socket.role !== 'safety') { 
      console.warn('Unauthorized race mode change attempt');
      return;
    }

    io.emit('race-mode-change', raceModeData);
  });

  

});
