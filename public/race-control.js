let socket;
let latestSessions;

// TODO: Add authentication check on page load
// TODO: Connect to socket.io server
// TODO: Listen for session data updates
// TODO: Handle connection errors
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

            initializeTimer();
            initializeRaceModeButtons();
            initializeRaceControlButtons();
            initializeRaceInfoPanel();
            initializeDriverBriefing();
            initializeLogout();

        } else {
            document.getElementById('error').innerText = "Wrong key!";
        }
    });
});

// TODO: Timer functionality
// - Start countdown timer
// - Display time remaining
// - Handle timer expiration
// - Update timer display

let raceActive = false;
let timeLeft = 0;
let raceStartTime = null;
let timerInterval = null;
let currentSession = null;
let startBtn, stopBtn, emergencyBtn;
let currentRaceMode = 'SAFE'; // Default race mode


function initializeTimer() {
    document.getElementById('timer').style.display = 'block';
    document.getElementById('timer-text').textContent = '00:00';
    document.getElementById('timer-status').textContent = raceActive ? 'Time Remaining' : 'Race Timer'; //or Race Timer

}


function startTimer(duration) {
    timeLeft = duration;

    raceActive = true;

    raceStartTime = Date.now();

    socket.emit('race-started', {sessionId: currentSession?.id});

    timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            timeExpired();
        }
    }, 1000); //every second

    updateButtonStates();
}

function stopTimer() {
    raceActive = false;

    socket.emit('race-stopped', {sessionId: currentSession?.id});

    clearInterval(timerInterval); //stop it

    updateButtonStates();
}

function timeExpired() {
    // Stop timer
    clearInterval(timerInterval);

    document.getElementById('timer-text').textContent = '00:00';
    document.getElementById('timer-status').textContent = 'Time Remaining';

    raceActive = false;
    updateButtonStates();

    alert('Race completed');

    socket.emit('race-completed', { sessionId: currentSession?.id});
}

function updateDisplay() { //refresh screen
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    
    document.getElementById('timer-text').textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    document.getElementById('timer-status').textContent = raceActive ? 'Time Remaining' : 'Race Timer';
}




// TODO: Race mode buttons (SAFE, HAZARD, DANGER, FINISH)
// - Handle mode switching
// - Update visual indicators
// - Send mode changes to server

function initializeRaceModeButtons() {
    

    document.getElementById('safe-mode-btn').addEventListener('click', () => setRaceMode('safe'));
    document.getElementById('hazard-mode-btn').addEventListener('click', () => setRaceMode('hazard'));
    document.getElementById('danger-mode-btn').addEventListener('click', () => setRaceMode('danger'));
    document.getElementById('finish-mode-btn').addEventListener('click', () => setRaceMode('finish'));
}

function setRaceMode(mode) { //handle mode clicks

    currentRaceMode = mode.toUpperCase();
    // btn visual update
    document.getElementById('safe-mode-btn').classList.remove('active');
    document.getElementById('hazard-mode-btn').classList.remove('active');
    document.getElementById('danger-mode-btn').classList.remove('active');
    document.getElementById('finish-mode-btn').classList.remove('active');

    document.getElementById(`${mode}-mode-btn`).classList.add('active'); // replace if statement in golang

    // socket communication
    socket.emit('race-mode-change', { mode, sessionId: currentSession?.id });

    // Update race mode
    document.getElementById('current-race-mode').textContent = mode.toUpperCase();
}

// TODO: Race control buttons
// - Start race functionality
// - Stop race functionality  
// - Emergency stop functionality
// - Update button states

function initializeRaceControlButtons() {

    startBtn = document.getElementById('start-race-btn');
    stopBtn = document.getElementById('stop-race-btn');
    emergencyBtn = document.getElementById('emergency-stop-btn');

    startBtn.addEventListener('click', () => startTimer(300));
    stopBtn.addEventListener('click', () => stopTimer());
    emergencyBtn.addEventListener('click', () => stopTimer());

    updateButtonStates();
}

function updateButtonStates() {
    startBtn.disabled = raceActive;
    stopBtn.disabled = !raceActive;
    emergencyBtn.disabled = !raceActive;
}



// TODO: Race info panel
// - Display current session name
// - Show driver count
// - Show current race mode
// - Show race duration

function initializeRaceInfoPanel() {
    
    // Display session name
    document.getElementById('sessions').textContent = currentSession?.name || 'No session selected';
    // Driver count
    document.getElementById('driver-count').textContent = `${(currentSession?.drivers || []).length}/8 drivers`;
    // Show current race mode
    document.getElementById('current-race-mode').textContent = currentRaceMode;
    // Show race duration
    if (raceActive && raceStartTime) {
        const elapsedTime = Math.floor((Date.now() - raceStartTime) / 1000);
        document.getElementById('race-duration').textContent = `${elapsedTime} seconds elapsed`;
    } else {
        document.getElementById('race-duration').textContent = 'Race not started';
    }
}

// TODO: Driver briefing section
// - Display current drivers list
// - Show car numbers and names
// - Update driver positions
// - Handle driver status changes

function initializeDriverBriefing() {

    // Clear the list
    document.getElementById('driver-list').innerHTML = ''; 

    // Get drivers from current session
    const drivers = currentSession?.drivers || [];

    drivers.forEach(driver => {
        
        const li = document.createElement('li');
        li.textContent = `Car ${driver.carNumber} - ${driver.name} - ${driver.currentPosition} - ${driver.status}`;
        document.getElementById('driver-list').appendChild(li);
    });

}

// TODO: Logout functionality
// - Clear session data
// - Redirect to login page

function initializeLogout() {
    document.getElementById('logout').addEventListener('click', () => { 
        sessionStorage.removeItem('racetrack_key');
        localStorage.removeItem('racetrack_role');
        socket.disconnect();
        window.location.href = '/login.html';
    });
}

function renderSessions() {
    const sessionsList = document.getElementById('sessions-list');
    sessionsList.innerHTML = '';

    if (!latestSessions || latestSessions.length === 0) {
        sessionsList.innerHTML = '<li>No sessions available</li>';
        return;
    }

    latestSessions.forEach(session => {
        const li = document.createElement('li');
        li.textContent = session.name;
        sessionsList.appendChild(li);
    });

    if (latestSessions.length > 0) {
        currentSession = latestSessions[0];
    }

    updateRaceInfoPanel();
    updateDriverBriefing();
}

function updateRaceInfoPanel() {
    // Display session name
    document.getElementById('sessions').textContent = currentSession?.name || 'No session selected';
    // Driver count
    document.getElementById('driver-count').textContent = `${(currentSession?.drivers || []).length}/8 drivers`;
    // Show current race mode
    document.getElementById('current-race-mode').textContent = currentRaceMode;
    // Show race duration
    if (raceActive && raceStartTime) {
        const elapsedTime = Math.floor((Date.now() - raceStartTime) / 1000);
        document.getElementById('race-duration').textContent = `${elapsedTime} seconds elapsed`;
    } else {
        document.getElementById('race-duration').textContent = 'Race not started';
    }
}

function updateDriverBriefing() {
    // Clear the list
    document.getElementById('driver-list').innerHTML = '';
    
    // Get drivers from current session
    const drivers = currentSession?.drivers || [];
    
    if (drivers.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No drivers assigned';
        document.getElementById('driver-list').appendChild(li);
        return;
    }

    drivers.forEach(driver => {
        const li = document.createElement('li');
        li.textContent = `Car ${driver.carNumber} - ${driver.name}`;
        document.getElementById('driver-list').appendChild(li);
    });
}