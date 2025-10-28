/*
1. CHECKBOX HACK: Uses hidden checkbox to control sidebar state
2. CSS TRANSITIONS: Smooth slide animation with transition property
3. PSEUDO-SELECTORS: :checked pseudo-class controls sidebar visibility
4. POSITION FIXED: Keeps sidebar and button in place
5. Z-INDEX: Controls layering of elements
6. LABEL TRICK: Labels act as clickable buttons for checkbox

- Hidden checkbox (#nav_check) controls sidebar state
- Label for checkbox acts as hamburger button
- CSS :checked pseudo-class slides sidebar in/out
- Font Awesome icons for visual appeal

CSS Animation Magic:
- #nav_check:checked ~ .nav_sidebar_menu { left: 0; }
- This moves sidebar from left: -280px to left: 0 when checked
- Transition property makes it smooth
*/

function loadNavigation() {
  // Prevent duplicates
  if (document.getElementById('nav_check')) return;

  // Load everything
  loadFontAwesome();
  loadNavCSS();
  loadNavHTML();
}

function loadNavCSS() {
  // Prevent duplicates
  if (document.querySelector('link[href*="nav.css"]')) return;
  
  // Create and inject CSS link
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'nav.css';
  document.head.appendChild(link);
}

function loadNavHTML() {
  // Fetch HTML content from nav.html file
  fetch('nav.html')
    .then(response => response.text())
    .then(html => {
      // Inject HTML into page
      document.body.insertAdjacentHTML('afterbegin', html);
    })
    .catch(error => {
      console.error('Failed to load navigation HTML:', error);
    });
}

function loadFontAwesome() {
  // Prevent duplicates
  if (document.querySelector('link[href*="fontawesome"]')) return;
  
  // Use Font Awesome CSS instead of JS kit (more reliable)
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
  document.head.appendChild(link);
}

// AUTO-LOAD - Run when page is ready
document.addEventListener('DOMContentLoaded', loadNavigation);