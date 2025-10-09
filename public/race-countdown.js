/* What the race-countdown page needs

Big, clear timer (mm:ss) — visible from far away.

Race/session name.

Race mode (Safe / Hazard / Danger / Finish).

A clear visual that the race is finished when it is.

Fullscreen button.

Client-side calculation fallback if server doesn't push every-second timer ticks (uses startTs + durationSec).

Listen for Socket.IO events: state, timer, race-started, race-finished, mode-changed. (If you use different event names on the server, adapt the JS.) */
const socket = io();
socket.on('timer-update', (payload) => {
    // payload: { timeLeft, raceActive, raceMode, sessionId }
    //updateTimerUI(payload);
    let currentTime = payload.timeLeft;
    const min = Math.floor(currentTime / 60);
    const sec = currentTime % 60;
    const timer = document.getElementById('timer');
    timer.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
});



