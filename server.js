const { resolveMx } = require('dns');
const express = require('express'); // tool to serve pages
const http = require('http'); // required by Socket.IO
const { Server } = require('socket.io'); // real-time connections

if (!process.env.RECEPTIONIST_KEY || !process.env.OBSERVER_KEY || !process.env.SAFETY_KEY) { // IF KEYS NOT SET, SERVER WILL NOT START
  console.error('Error: Missing access keys. Set RECEPTIONIST_KEY, OBSERVER_KEY, SAFETY_KEY.');
  process.exit(1);
}

const app = express(); // "app" is the Express web app
const server = http.createServer(app); // "server" is the HTTP server that Express runs on
const io = new Server(server); // "io" is the Socket.IO server attached to the HTTP server

app.use(express.static('public')); // anything in public/ can be viewed in the browser

server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
  console.log('http://localhost:3000/login.html');
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

io.on('connection', (socket) => { // socket object for every unique user
  console.log('Client connected');
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

    const newSession = { id, name: data.name, drivers: [] };
    sessions.push(newSession);
    broadcastSessions(); // broadcast to everyone
    cb && cb({ ok: true, session: newSession });
  });


  socket.on('add-driver', (payload, cb) => {
    if (!isAuthorized(socket, 'receptionist')) return cb && cb({ error: 'not authorized' });
    if (!payload || !payload.sessionId || !payload.name) return cb && cb({ error: 'invalid payload' });

    const s = getSession(payload.sessionId);
    if (!s) return cb && cb({ error: 'session not found' });

    if ((s.drivers || []).length >= 8) {
      return cb && cb({ error: 'session already has maximum 8 drivers' });
    }

    if ((s.drivers || []).some(d => d.name === payload.name)) {
      return cb && cb({ error: 'driver name already exists in this session' });
    }

    const carNumber = getAvailableCarNumber(s);
    if (carNumber == null) {
      return cb && cb({ error: 'no car numbers available' });
    }

    const driver = {
      name: payload.name,
      carNumber: carNumber,
      fastestLapMs: null,
      currentLap: 0,
      lastLapStamp: null
    };
    s.drivers = s.drivers || [];
    s.drivers.push(driver);

    broadcastSessions();
    cb && cb({ ok: true, driver });
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
  })


});
