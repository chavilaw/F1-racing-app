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
  console.log('http://localhost:3000/front-desk.html');
});

let sessions = [];

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

  socket.on('add-session', (data) => { // creating sessions
    if (socket.role !== 'receptionist') return;
    const newSession = { id: Date.now(), name: data.name };
    sessions.push(newSession);
    io.emit('sessions', sessions); // broadcast to everyone
  });
});
