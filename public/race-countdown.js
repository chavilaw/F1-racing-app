
// create, listen 'timer-update' (server already broadcasts), handle connect/disconnect

const socket = io();
socket.on('timer-update', (payload) => {
    // payload: { timeLeft, raceActive, raceMode, sessionId }
    //updateTimerUI(payload);
    let currentTime = payload.timeLeft;
    const min = Math.floor(currentTime / 60);
    const sec = currentTime % 60;
    const timer = document.getElementById('timer');
    timer.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

    const mode = document.getElementById('mode');
    mode.textContent = payload.raceMode;

    const sessionName = document.getElementById('session');
    sessionName.textContent = payload.sessionName;
});
// Setup fullscreen when DOM is ready


// toggleFullscreen(): enter/exit fullscreen on documentElement



