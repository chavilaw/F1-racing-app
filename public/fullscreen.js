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
        
        // Set initial icon
        updateFullscreenIcon();
    }
    
    document.addEventListener('fullscreenchange', () => { 
        updateFullscreenIcon();
    });
    
    // Escape key to leave fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.fullscreenElement) {
            document.exitFullscreen();
        }
    });
}

function updateFullscreenIcon() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    if (fullscreenBtn) {
        const icon = fullscreenBtn.querySelector('i');
        if (icon) {
            // Toggle between fullscreen and exit icons
            if (document.fullscreenElement) {
                icon.className = 'fas fa-compress'; // Exit fullscreen icon
            } else {
                icon.className = 'fas fa-expand'; // Enter fullscreen icon
            }
        }
    }
}

// Auto-setup when DOM is ready
document.addEventListener('DOMContentLoaded', setupFullscreen);
