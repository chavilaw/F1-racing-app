let socket;
let latestSessions;
let mode;

document.addEventListener('DOMContentLoaded', function () {
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

    socket.on('connect', () => {
        socket.emit('request-race-data');
    });

    socket.on('timer-update', (payload) => {
        // payload: { timeLeft, raceActive, raceMode, sessionId }
        console.log('timer-update received', payload);
        mode = payload.raceMode;
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

function deleteSession(sessionId) {
  if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }
  if (!confirm('Delete session ' + sessionId + '? This cannot be undone.')) return;

  socket.emit('delete-session', { sessionId }, (res) => {
    if (res && res.error) {
      alert('Could not delete session: ' + res.error);
    } else {
      console.log('Deleted', sessionId);
    }
  });
}

function addDriverToSession(sessionId) {
    if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }
    const name = prompt('Enter driver name:');
    if (name == null) return;

    const carInput = prompt('Enter car number (1-8) - leave empty to automatically assign')
    const carNumber = (carInput === null || carInput.trim() === '') ? null : carInput.trim();

    socket.emit('add-driver', { sessionId, name, carNumber }, (res) => {
        if (res && res.error) {
            alert('Could not add driver: ' + res.error);
        } else {
            console.log('Driver added', res && res.driver);
        }
    });
}

function editDriver(sessionId, oldName, currentCar) {
    if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }

    const newName = prompt('Edit driver name', oldName);
    if (newName == null) return;

    const carInput = prompt('Edit car number (1-8) - leave empty to keep current', currentCar || '');
    const carNumber = (carInput === null || carInput.trim() === '') ? null : carInput.trim();

    const payload = { sessionId, oldName, newName };
    if (carNumber != null) payload.carNumber = carNumber;

    socket.emit('edit-driver', payload, (res) => {
        if (res && res.error) {
            alert('Could not edit driver: ' + res.error);
        } else {
            console.log('Driver edited', res && res.driver);
        }
    });
}

function removeDriverFromSession(sessionId, driverName) {
    if (!socket || socket.disconnected) { alert('Not connected. Log in first.'); return; }
    if (!confirm(`Remove driver ${driverName}?`)) return;
    socket.emit('remove-driver', { sessionId, name: driverName }, (res) => {
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

    latestSessions.forEach((s, index) => {
        if (mode === "SAFE" && index === 0) return;
        const li = document.createElement('li');

        const header = document.createElement('div');
        header.innerHTML = `<strong>ID: ${s.id}</strong> | Name: ${s.name} |&nbsp;<small>(${(s.drivers || []).length}/8 drivers)</small>`;
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

        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.style.margin = '6px';
        delBtn.onclick = () => deleteSession(s.id);
        li.appendChild(delBtn);

        const dl = document.createElement('ul');
        (s.drivers || []).forEach(d => {
            const dli = document.createElement('li');
            dli.textContent = `Car ${d.carNumber} - ${d.name}`;

            const edit = document.createElement('button');
            edit.textContent = 'Edit';
            edit.style.marginLeft = '8px';
            edit.onclick = () => editDriver(s.id, d.name, d.carNumber);
            dli.appendChild(edit);

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