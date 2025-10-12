/* 
A clear visual that the race is finished when it is.

Fullscreen button.

Client-side calculation fallback if server doesn't push every-second timer ticks (uses startTs + durationSec).
*/
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



