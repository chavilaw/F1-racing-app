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
  // Prevent duplicate navigation if already loaded
  if (document.getElementById('nav_check')) return;

  // Load CSS and HTML from separate files
  loadNavCSS();
  loadNavHTML();
  loadFontAwesome();
}

function loadNavCSS() {
  // Check if CSS already loaded (prevent duplicates)
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
  // Check if Font Awesome already loaded (prevent duplicates)
  if (document.querySelector('script[src*="fontawesome"]')) return;
  
  // Create and inject Font Awesome JavaScript
  const script = document.createElement('script');
  script.src = 'https://kit.fontawesome.com/a076d05399.js';
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}

// AUTO-LOAD - Run when page is ready
document.addEventListener('DOMContentLoaded', loadNavigation);