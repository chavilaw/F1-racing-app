// Shared Fullscreen Functionality
// Include this file in any interface that needs fullscreen

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

function setupFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }
    
    document.addEventListener('fullscreenchange', () => { 
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) {
            // Update button text/icon based on fullscreen state
            if (fullscreenBtn.textContent !== undefined) {
                fullscreenBtn.textContent = document.fullscreenElement ? 'Exit' : 'Fullscreen';
            }
        }
    });
    
    // Escape key to leave fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.fullscreenElement) {
            document.exitFullscreen();
        }
    });
}

// Auto-setup when DOM is ready
document.addEventListener('DOMContentLoaded', setupFullscreen);
