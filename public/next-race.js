const socket = io();
let latestSessions = null;
let mode = null;
let active = false;

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
        if (payload !== null) {
            mode = payload.raceMode;
            active = payload.raceActive;
        }
        renderSession();
    });
});

function renderSession() {
    // Only remove li elements within the content area, not navigation
    document.querySelectorAll('#content li').forEach(li => li.remove());
    const content = document.getElementById('content');
    const out = document.getElementById('SessionName');
    if (latestSessions.length === 0) {
        out.textContent = 'No sessions';
        document.getElementById('info').textContent = '';
        return;
    }
    let second = latestSessions[0];
    console.log(mode);
    if (mode === "SAFE") {
        document.getElementById('info').textContent = '';
        second = latestSessions[1];
        if (latestSessions.length < 2) {
            document.getElementById('info').textContent = '';
            out.textContent = 'No second session';
            return;
        }
    }

    if (!active) {
        document.getElementById('info').textContent = 'Proceed to the paddock';
    } else {
        document.getElementById('info').textContent = '';
    }

    const name = (second && (second.name || second.id)) || String(second);
    out.textContent = name;

    (second.drivers || []).forEach(d => {
        const dli = document.createElement('li');
        dli.textContent = `Car ${d.carNumber} - ${d.name}`;
        content.appendChild(dli);
    });
}