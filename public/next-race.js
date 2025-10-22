const socket = io();
let latestSessions = null;
let mode = null;

document.addEventListener('DOMContentLoaded', function () {
    socket.on('sessions', (sessions) => {
        console.log('sessions received', sessions);
        latestSessions = Array.isArray(sessions) ? sessions : [];

    });

    socket.on('connect', () => {
        socket.emit('request-race-data');
    });

    socket.on('timer-update', (payload) => {
        // payload: { timeLeft, raceActive, raceMode, sessionId }
        console.log('timer-update received', payload);
        if (payload !== null) mode = payload.raceMode;
        renderSession();
    });
});

function renderSession() {
    document.querySelectorAll('li').forEach(li => li.remove());
    const out = document.getElementById('SessionName');
    if (latestSessions.length === 0) {
        out.textContent = 'No sessions';
        return;
    }
    let second = latestSessions[0];
    console.log(mode);
    if (mode === "SAFE") {
        second = latestSessions[1];
        if (latestSessions.length < 2) {
            out.textContent = 'No second session';
            return;
        }
    }

    const name = (second && (second.name || second.id)) || String(second);
    out.textContent = name;

    (second.drivers || []).forEach(d => {
        const dli = document.createElement('li');
        dli.textContent = `Car ${d.carNumber} - ${d.name}`;
        document.body.appendChild(dli);
    });
}