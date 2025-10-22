// RACE COUNTDOWN (MINIMAL PLAN)
// =============================
// Server already broadcasts 'timer-update' and 'race-mode-change' to all clients
// Just receive updates and display them
//
// initializePage(): cache DOM (#timer, #statusBanner, #fullscreenBtn, #closeFullscreenBtn), connect socket, bind clicks
// connectSocket(): io() create, listen 'timer-update' (server already broadcasts), handle connect/disconnect
// handleTimerUpdate(payload): updateTimerText(payload.timeLeft), setStatusBanner(...)
// updateTimerText(timeLeftSec): render "MM:SS" or "--:--" when null/not running
// setStatusBanner(state): "waiting" | "running" | "finished"
// formatTime(totalSeconds): return "MM:SS" string
//
// toggleFullscreen(): enter/exit fullscreen on documentElement
// onKeydownEsc(): exit fullscreen on Escape key
// onFullscreenChange(): show/hide #closeFullscreenBtn when in fullscreen
// setupFullscreen(): wire #fullscreenBtn click, #closeFullscreenBtn click, keydown listener, fullscreenchange listener



