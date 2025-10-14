const socket = io();

socket.on('connect', () => {
    socket.emit('request-race-data');
});

socket.on('timer-update', (payload) => {
    // payload: { timeLeft, raceActive, raceMode, sessionId }

    const mode = document.getElementById('mode');
    mode.textContent = payload.raceMode;
    switch (payload.raceMode) {
        case "SAFE":
            document.documentElement.style.backgroundImage = "";
            document.documentElement.style.backgroundColor = "green";
            break;
        case "HAZARD":
            document.documentElement.style.backgroundImage = "";
            document.documentElement.style.backgroundColor = "yellow";
            break;
        case "DANGER":
            document.documentElement.style.backgroundImage = "";
            document.documentElement.style.backgroundColor = "red";
            break;
        case "FINISH":
            document.documentElement.style.backgroundImage = "url('https://img.freepik.com/premium-vector/checkered-flag-vectorbanner-seamless-chessboardracing-flagblack-white-checkered-seamless-patt_888418-28661.jpg')";
            document.documentElement.style.backgroundSize = "20%";
            document.documentElement.style.backgroundPosition = "center";
            break;
    }

    const sessionName = document.getElementById('session');
    sessionName.textContent = payload.sessionName;
});
