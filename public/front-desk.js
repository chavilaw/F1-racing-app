let socket;
let latestSessions;

document.addEventListener('DOMContentLoaded', function() {
    const key = sessionStorage.getItem('racetrack_key');
    const role = localStorage.getItem('racetrack_role');

    if (!key || !role) {
        window.location.href = '/login.html';
        return;
    }
    console.log(key);

    socket = io(); // connect to server

    socket.on('sessions', (sessions) => {
        latestSessions = Array.isArray(sessions) ? sessions : [];
        renderSessions();
    });

    socket.on('connection-error', (err) => {
        console.error('Socket connect error', err);
        document.getElementById('error').innerText = 'Connection error';
    });

    socket.emit('auth', { role, key });

    socket.on('auth-result', (ok) => { // if OK, show race sessions
        if (ok) {
            document.getElementById('app').style.display = 'block';
            document.getElementById('error').innerText = '';
        } else {
            document.getElementById('error').innerText = "Wrong key!";
        }
    });
});

function addSession() {
    if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }
    const name = prompt("Enter session name:"); // popup asks input
    if (!name) return;

    const id = Date.now();
    const payload = { id, name };

    socket.emit('add-session', payload, (res) => {
        if (res && res.error) alert('Error creating session: ' + res.error);
    });
}

function addDriverToSession(sessionId) {
    if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }
    const name = prompt('Enter driver name:');
    if (!name) return;

    socket.emit('add-driver', { sessionId, name }, (res) => {
        if (res && res.error) {
            alert('Could not add driver: ' + res.error);
        } else {
            console.log('Driver added', res && res.driver);
        }
    });
}

function removeDriverFromSession(sessionId, driverName) {
    if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }
    if (!confirm(`Remove driver ${driverName}?`)) return;
    socket.emit('remove-driver', {sessionId, name: driverName }, (res) => {
        if (res && res.error) alert('Could not remove driver: ' + res.error);
    });
}

function renderSessions() {
    const ul = document.getElementById('sessions');
    ul.innerHTML = '';

    if (!latestSessions || latestSessions.length === 0) {
        ul.innerHTML = '<li><em>No sessions</em></li>';
        return;
    }

    latestSessions.forEach(s => {
        const li = document.createElement('li');

        const header = document.createElement('div');
        header.innerHTML = `<strong>ID: ${s.id}</strong> | Name: ${s.name} |&nbsp;<small>(${(s.drivers||[]).length}/8 drivers)</small>`;
        li.appendChild(header);

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add driver';
        addBtn.style.margin = '6px 6px 6px 0';
        if ((s.drivers || []).length >= 8) {
            addBtn.disabled = true;
            addBtn.title = 'Max 8 drivers';
        } else {
            addBtn.onclick = () => addDriverToSession(s.id);
        }
        li.appendChild(addBtn);

        const dl = document.createElement('ul');
        (s.drivers || []).forEach(d => {
            const dli = document.createElement('li');
            dli.textContent = `Car ${d.carNumber} - ${d.name}`;
            const rem = document.createElement('button');
            rem.textContent = 'Remove';
            rem.style.marginLeft = '8px';
            rem.onclick = () => removeDriverFromSession(s.id, d.name);
            dli.appendChild(rem);
            dl.appendChild(dli);
        });
        li.appendChild(dl);

        ul.appendChild(li);
    });
}