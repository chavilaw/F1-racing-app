let socket;
let latestSessions;

// TODO: Add authentication check on page load
// TODO: Connect to socket.io server
// TODO: Listen for session data updates
// TODO: Handle connection errors
document.addEventListener('DOMContentLoaded', function() {
    // Initialize timer immediately when page loads
    initializeTimer();
    
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
        
        // For testing: if no sessions exist, create a test session
        if (latestSessions.length === 0) {
            console.log('No sessions found, creating test session for demo...');
            const testSession = {
                id: 'test-session-' + Date.now(),
                name: 'Test Race Session',
                drivers: [
                    { name: 'Test Driver 1', carNumber: 1, currentPosition: 1, status: 'Ready' },
                    { name: 'Test Driver 2', carNumber: 2, currentPosition: 2, status: 'Ready' }
                ]
            };
            latestSessions = [testSession];
        }
        
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
            const errorElement = document.getElementById('error');
            if (errorElement) {
                errorElement.innerText = '';
            }

            initializeRaceModeButtons();
            initializeRaceControlButtons();
            initializeRaceInfoPanel();
            initializeDriverBriefing();
            initializeLogout();

        } else {
            const errorElement = document.getElementById('error');
            if (errorElement) {
                errorElement.innerText = "Wrong key!";
            }
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
    console.log('Initializing timer...');
    
    const timerElement = document.getElementById('timer');
    const timerText = document.getElementById('timer-text');
    const timerStatus = document.getElementById('timer-status');
    
    console.log('Timer elements found:', timerElement, timerText, timerStatus);
    
    if (timerElement) {
        timerElement.style.display = 'block';
        console.log('Timer display set to block');
    } else {
        console.error('Timer element not found!');
    }
    
    if (timerText) {
        timerText.textContent = '00:00';
        console.log('Timer text set to 00:00');
    } else {
        console.error('Timer text element not found!');
    }
    
    if (timerStatus) {
        timerStatus.textContent = raceActive ? 'Time Remaining' : 'Race Timer';
        console.log('Timer status set to:', timerStatus.textContent);
    } else {
        console.error('Timer status element not found!');
    }
    
    console.log('Timer initialization complete');
}


function startTimer(duration) {
    console.log('Starting timer with duration:', duration);
    
    // Check if there's a current session
    if (!currentSession) {
        alert('No race session selected. Please create a session first using the Front Desk interface.');
        return;
    }
    
    timeLeft = duration;

    raceActive = true;

    raceStartTime = Date.now();

    socket.emit('race-started', {sessionId: currentSession?.id});

    timerInterval = setInterval(() => {
        timeLeft--;
        console.log('Timer tick - timeLeft:', timeLeft);
        updateDisplay();

        if (timeLeft <= 0) {
            timeExpired();
        }
    }, 1000); //every second

    updateButtonStates();
    console.log('Timer started, raceActive:', raceActive, 'timeLeft:', timeLeft);
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
    console.log('updateDisplay called - timeLeft:', timeLeft);
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    
    const timerText = document.getElementById('timer-text');
    const timerStatus = document.getElementById('timer-status');
    
    console.log('Timer elements found:', timerText, timerStatus);
    
    if (timerText) {
        timerText.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        console.log('Timer text updated to:', timerText.textContent);
    } else {
        console.error('timer-text element not found!');
    }
    
    if (timerStatus) {
        timerStatus.textContent = raceActive ? 'Time Remaining' : 'Race Timer';
    } else {
        console.error('timer-status element not found!');
    }
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
    console.log('Race mode changed to:', mode);
    currentRaceMode = mode.toUpperCase();
    
    // btn visual update
    document.getElementById('safe-mode-btn').classList.remove('active');
    document.getElementById('hazard-mode-btn').classList.remove('active');
    document.getElementById('danger-mode-btn').classList.remove('active');
    document.getElementById('finish-mode-btn').classList.remove('active');

    document.getElementById(`${mode}-mode-btn`).classList.add('active');

    // socket communication - broadcast to all other interfaces
    socket.emit('race-mode-change', { mode, sessionId: currentSession?.id });

    // Update race mode in the info panel
    document.getElementById('current-race-mode').textContent = mode.toUpperCase();
    
    console.log('Race mode updated to:', currentRaceMode);
}

function initializeRaceControlButtons() {
    console.log('Initializing race control buttons...');

    // Add a small delay to ensure DOM is fully loaded
    setTimeout(() => {
        startBtn = document.getElementById('start-race-btn');
        stopBtn = document.getElementById('stop-race-btn');
        emergencyBtn = document.getElementById('emergency-stop-btn');

        console.log('Start button found:', startBtn);
        console.log('Stop button found:', stopBtn);
        console.log('Emergency button found:', emergencyBtn);

    if (startBtn) {
        console.log('Start button found, adding click listener...');
        startBtn.addEventListener('click', () => {
            console.log('Start button clicked!');
            startTimer(300);
        });
        console.log('Click listener added successfully');
    } else {
        console.error('Start button not found!');
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => stopTimer());
    }

    if (emergencyBtn) {
        emergencyBtn.addEventListener('click', () => stopTimer());
    }

    updateButtonStates();
    }, 100); // 100ms delay
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