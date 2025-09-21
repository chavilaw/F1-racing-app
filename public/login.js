let socket;

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    login();
});

// Handle Bootstrap dropdown selection
document.addEventListener('DOMContentLoaded', function() {
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const dropdownButton = document.getElementById('roleDropdown');
    const hiddenRoleInput = document.getElementById('role');
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const value = this.getAttribute('data-value');
            const text = this.textContent;
            
            // Update button text
            dropdownButton.textContent = text;
            
            // Update hidden input
            hiddenRoleInput.value = value;
            
            // Close dropdown
            const dropdown = bootstrap.Dropdown.getInstance(dropdownButton);
            if (dropdown) {
                dropdown.hide();
            }
        });
    });
});

function login() {
    const role = document.getElementById('role').value;
    const key = document.getElementById('key').value;
    const errorDiv = document.getElementById('error');
    
    // Clear previous errors
    errorDiv.classList.add('d-none');
    errorDiv.textContent = '';
    
    // Validate inputs
    if (!role) {
        showError('Please select a role');
        return;
    }
    
    if (!key.trim()) {
        showError('Please enter access key');
        return;
    }
    
    // Connect to server
    socket = io();
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection failed:', error);
        showError('Connection failed. Please try again.');
    });
    
    // Handle authentication result
    socket.on('auth-result', (success) => {
        if (success) {
            // Save authentication data
            localStorage.setItem('racetrack_authenticated', 'true');
            localStorage.setItem('racetrack_role', role);
            
            // Redirect based on role
            redirectToInterface(role);
        } else {
            showError('Invalid access key for this role');
        }
    });
    
    // Send authentication request
    socket.emit('auth', { role, key });
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
}

function redirectToInterface(role) {
    switch(role) {
        case 'receptionist':
            window.location.href = '/front-desk.html';
            break;
        case 'safety':
            window.location.href = '/race-control.html';
            break;
        case 'observer':
            window.location.href = '/lap-line-tracker.html';
            break;
        default:
            showError('Invalid role selected');
    }
}

// Handle page load - check authentication
window.addEventListener('load', function() {
    const currentPage = window.location.pathname;
    const protectedPages = ['/front-desk.html', '/race-control.html', '/lap-line-tracker.html'];
    
    // If user is on a protected page, check if they're authenticated
    if (protectedPages.includes(currentPage)) {
        const isAuthenticated = localStorage.getItem('racetrack_authenticated');
        const userRole = localStorage.getItem('racetrack_role');
        
        if (!isAuthenticated || !userRole) {
            // Not authenticated, redirect to login
            window.location.href = '/login.html';
            return;
        }
        
        // Check if user has permission for this page
        const requiredRole = getRequiredRole(currentPage);
        if (userRole !== requiredRole) {
            alert('You do not have permission to access this page.');
            window.location.href = '/login.html';
            return;
        }
    }
});

// Security checkin for accesses to certain pages
function getRequiredRole(page) {
    switch(page) {
        case '/front-desk.html': return 'receptionist';
        case '/race-control.html': return 'safety';
        case '/lap-line-tracker.html': return 'observer';
        default: return null;
    }
}
