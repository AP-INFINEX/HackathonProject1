// loader.js - MV3-safe bootstrapper
(function() {
  function loadScript(src, onload, onerror) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = onload;
    s.onerror = onerror || function(){ console.error('Failed to load', src); };
    document.body.appendChild(s);
  }

  // Start after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function start() {
    // Ensure loader visible early
    const loader = document.getElementById('pageLoader');
    if (loader) loader.style.display = 'flex';

    // Optionally load GSAP from local copy if available in future
    // Then load app.js
    loadScript('app.js', function() {
      // app.js handles init
    });
  }
})();


