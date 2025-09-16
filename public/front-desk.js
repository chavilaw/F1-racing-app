let socket;

function login() {
    const key = document.getElementById('key').value; // user given key
    socket = io(); // connect to server

    socket.emit('auth', { role: 'receptionist', key }); // send

    socket.on('auth-result', (ok) => { // if OK, show race sessions and hide login
        if (ok) {
            document.getElementById('login').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            
            if (socket) { // get session updates
                socket.on('sessions', (sessions) => {
                    const ul = document.getElementById('sessions');
                    ul.innerHTML = "";
                    sessions.forEach(s => {
                        const li = document.createElement('li');
                        li.innerText = s.name;
                        ul.appendChild(li);
                    });
                });
            }
        } else {
            document.getElementById('error').innerText = "Wrong key!";
        }
    });
}

function addSession() {
    const name = prompt("Enter session name:"); // popup asks input
    if (name) socket.emit('add-session', { name }); // server updates sessions
}

