// Dashboard Script - Completely Rewritten for Smooth Performance

// Config keys
const UNSPLASH_KEY = (typeof CONFIG !== 'undefined' && CONFIG.UNSPLASH_KEY) ? CONFIG.UNSPLASH_KEY : null;
const UNSPLASH_QUERY = (typeof CONFIG !== 'undefined' && CONFIG.UNSPLASH_QUERY) ? CONFIG.UNSPLASH_QUERY : 'galaxy dark';
const WEATHER_KEY = (typeof CONFIG !== 'undefined' && CONFIG.WEATHER_KEY) ? CONFIG.WEATHER_KEY : null;

// ---------- Helpers ----------
const byId = id => document.getElementById(id);
// particles removed for now

// fetch with timeout helper (prevents very long waits)
async function fetchWithTimeout(url, timeout = 7000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    clearTimeout(id);
    console.warn('[fetchWithTimeout] failed', url, err && err.message ? err.message : err);
    return null;
  }
}

async function tryFetchJSON(url, timeout = 7000) {
  return await fetchWithTimeout(url, timeout);
}

// ---------- Background ----------
(async function setBackground() {
  try {
    if (!UNSPLASH_KEY) {
      console.info('[background] No UNSPLASH_KEY set — using CSS fallback.');
      return;
    }
    console.info('[background] Trying Unsplash with query:', UNSPLASH_QUERY);
    const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(UNSPLASH_QUERY)}&orientation=landscape&client_id=${UNSPLASH_KEY}`;
    const data = await tryFetchJSON(url, 8000);
    if (data && data.urls && data.urls.full) {
      document.body.style.backgroundImage = `url(${data.urls.full})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      console.info('[background] Unsplash background set.');
    } else {
      console.warn('[background] Unsplash returned no usable image, using CSS fallback.');
    }
  } catch (err) {
    console.warn('[background] load failed:', err);
  }
})();

// ---------- Time & Date ----------
const timeEl = byId('time');
const dateEl = byId('date');
const greetingEl = byId('greeting');

function updateTime() {
  if (timeEl) timeEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  if (greetingEl) {
    const hour = new Date().getHours();
    let greeting = 'Hello';
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 18) greeting = 'Good Afternoon';
    else greeting = 'Good Evening';
    const prefix = greetingEl.querySelector('.greeting-prefix');
    const typed = document.getElementById('typingText');
    if (prefix) prefix.textContent = `${greeting}, `;
    if (typed && !typed.textContent) typed.textContent = 'Anubhav!';
  }
}

function updateDate() {
  updateTime(); // This handles both time and date
}

// ---------- Weather ----------
const weatherTemp = byId('weather-temp');
const weatherCondition = byId('weather-condition');

async function fetchWeather(lat, lon) {
    try {
      if (!WEATHER_KEY) throw new Error('No WEATHER_KEY');
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`);
      if (!res.ok) throw new Error('Weather API error');
      const data = await res.json();
      if (weatherTemp) weatherTemp.textContent = `${Math.round(data.main.temp)}°C`;
      if (weatherCondition) weatherCondition.textContent = data.weather[0].main;
    } catch (err) {
      console.warn('Weather fetch error:', err);
      if (weatherTemp) weatherTemp.textContent = '--°C';
      if (weatherCondition) weatherCondition.textContent = 'N/A';
    }
  }
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => fetchWeather(13.0827, 80.2707) // fallback (Chennai)
    );
  } else {
    fetchWeather(13.0827, 80.2707);
  }

  // ---------- Quotes (API-first -> local json fallback -> cache) ----------
  const LOCAL_QUOTES_URL = 'quotes.json';
  const API_QUOTEGARDEN = 'https://quotegarden.herokuapp.com/api/v3/quotes/random';
  const API_ZENQUOTES = 'https://zenquotes.io/api/quotes';
  const QUOTES_KEY = 'customDashboardQuotes';
  const QUOTES_TTL = 1000 * 60 * 60 * 24; // 24h
  
  // Function to clear quote cache (for debugging)
  function clearQuoteCache() {
    localStorage.removeItem(QUOTES_KEY);
    console.info('[quotes] Cache cleared.');
  }
  // Expose globally for debugging
  window.clearQuoteCache = clearQuoteCache;

  function escapeHTML(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function isValidQuotesArray(arr) {
    return Array.isArray(arr) && arr.length && arr.every(it => it && (typeof it.q === 'string' || typeof it.text === 'string' || typeof it.content === 'string'));
  }

  function normalizeArray(raw) {
    if (!isValidQuotesArray(raw)) return null;
    return raw.map(item => {
      if (typeof item.q === 'string') return { q: item.q.trim(), a: (item.a || '').trim() };
      if (typeof item.text === 'string') return { q: item.text.trim(), a: (item.author || '').trim() };
      if (typeof item.content === 'string') return { q: item.content.trim(), a: (item.author || '').trim() };
      return null;
    }).filter(Boolean).filter(it => it.q && it.q.length > 3);
  }

  // Fetch fresh quotes from API only
  async function fetchAndCacheQuotes() {
    // Try a different approach - use JSONP or a proxy-friendly API
    const timestamp = Date.now(); // Add timestamp to prevent caching
    const quoteAPIs = [
      `https://api.quotable.io/random?_t=${timestamp}`,
      `https://zenquotes.io/api/random?_t=${timestamp}`,
      `https://api.quotable.io/random?minLength=30&_t=${timestamp}`,
      `https://api.quotable.io/random?tags=inspirational&_t=${timestamp}`
    ];
    
    // Try each API URL
    for (let i = 0; i < quoteAPIs.length; i++) {
      const url = quoteAPIs[i];
      console.info(`[quotes] Attempting API call ${i + 1}/${quoteAPIs.length}:`, url);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.info('[quotes] API SUCCESS - Raw data:', data);
          
          // Handle different API response formats
          let quote = null;
          if (data && data.content && data.author) {
            // Quotable format
            quote = { q: data.content.trim(), a: data.author.trim() };
          } else if (Array.isArray(data) && data[0] && data[0].q) {
            // ZenQuotes format
            quote = { q: data[0].q.trim(), a: data[0].a.trim() };
          }
          
          if (quote && quote.q.length > 10) {
            window.__lastQuotesSource = 'api';
            console.info('[quotes] SUCCESS: Fresh quote from API:', quote.q.substring(0, 50) + '...');
            return [quote];
          }
        } else {
          console.warn(`[quotes] API ${i + 1} failed with status:`, response.status);
        }
      } catch (error) {
        console.warn(`[quotes] API ${i + 1} error:`, error.message);
      }
    }

    // All APIs failed - use randomized backup quotes
    console.warn('[quotes] ALL APIs FAILED - Using randomized backup quotes');
    const allBackupQuotes = [
      { q: "The only way to do great work is to love what you do.", a: "Steve Jobs" },
      { q: "Innovation distinguishes between a leader and a follower.", a: "Steve Jobs" },
      { q: "Life is what happens to you while you're busy making other plans.", a: "John Lennon" },
      { q: "The future belongs to those who believe in the beauty of their dreams.", a: "Eleanor Roosevelt" },
      { q: "It is during our darkest moments that we must focus to see the light.", a: "Aristotle" },
      { q: "Success is not final, failure is not fatal: it is the courage to continue that counts.", a: "Winston Churchill" },
      { q: "Be yourself; everyone else is already taken.", a: "Oscar Wilde" },
      { q: "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.", a: "Albert Einstein" },
      { q: "You miss 100% of the shots you don't take.", a: "Wayne Gretzky" },
      { q: "The best time to plant a tree was 20 years ago. The second best time is now.", a: "Chinese Proverb" },
      { q: "Your time is limited, don't waste it living someone else's life.", a: "Steve Jobs" },
      { q: "If you want to live a happy life, tie it to a goal, not to people or things.", a: "Albert Einstein" }
    ];
    
    // Shuffle and return random quote
    const randomIndex = Math.floor(Math.random() * allBackupQuotes.length);
    window.__lastQuotesSource = 'backup';
    return [allBackupQuotes[randomIndex]];
  }

  function getCachedQuotes() {
    try {
      const raw = localStorage.getItem(QUOTES_KEY);
      if (!raw) {
        console.info('[quotes] No cached quotes found.');
        return null;
      }
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.quotes)) {
        console.info('[quotes] Invalid cached quotes format.');
        return null;
      }
      const age = Date.now() - (obj.ts || 0);
      const expired = age > QUOTES_TTL;
      console.info('[quotes] Cache age:', Math.round(age / 1000 / 60), 'minutes, expired:', expired);
      if (expired) {
        console.info('[quotes] Cache expired, will fetch fresh quotes.');
        return null;
      }
      // expose cached source as well
      window.__lastQuotesSource = obj.src || 'cache';
      console.info('[quotes] Using cached quotes from:', obj.src || 'cache');
      return obj.quotes;
    } catch (_) { 
      console.warn('[quotes] Error reading cache.');
      return null; 
    }
  }

  function pickRandom(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function renderQuote(obj) {
    const el = byId('quote');
    if (!el) return;
    if (!obj) {
      el.innerHTML = `<p class="quote-text">No quotes available (check internet or local file).</p>`;
      return;
    }
    const safeQ = escapeHTML(obj.q);
    const safeA = escapeHTML(obj.a || 'Unknown');
    el.innerHTML = `<p class="quote-text">"${safeQ}"</p><p class="quote-author">${safeA ? '— ' + safeA : ''}</p>`;
  }

  // Load quotes: always fetch fresh from API, no caching
  (async function loadQuotesRobust() {
    console.info('[quotes] Starting fresh quote fetch...');
    
    // Always fetch fresh - no cache, no local files
    const fresh = await fetchAndCacheQuotes();
    
    if (fresh && fresh.length > 0) {
      // Always pick the first (and only) quote from API
      const quote = fresh[0];
      renderQuote(quote);
      
      if (window.__lastQuotesSource === 'backup') {
        console.warn('[quotes] WARNING: Showing backup quote because APIs failed');
      } else {
        console.info('[quotes] Displaying fresh API quote');
      }
      return;
    }
    
    // No quotes available at all
    renderQuote(null);
    console.error('[quotes] CRITICAL: No quotes available from any source.');
  })();

// ---------- Tasks ----------
const taskInput = byId('task-input');
const taskList = byId('task-list');
const TASKS_KEY = 'customDashboardTasks';
let tasks = [];
try { tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]'); } catch (_) { tasks = []; }

function renderTasks() {
  if (!taskList) return;
  taskList.innerHTML = '';
  tasks.forEach((t, i) => {
    const li = document.createElement('li');
    li.textContent = t;
    li.addEventListener('click', () => {
      tasks.splice(i, 1);
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      renderTasks();
    });
    taskList.appendChild(li);
  });
}

function loadTasks() {
  renderTasks();
  
  if (taskInput) {
    taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && taskInput.value.trim() !== '') {
        tasks.push(taskInput.value.trim());
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
        taskInput.value = '';
        renderTasks();
      }
    });
  }
}

// ---------- Links ----------
const linksBtn = byId('links-btn');
const linksDropdown = byId('links-dropdown');
const addLinkBtn = byId('add-link-btn');
const LINKS_KEY = 'customDashboardLinks';
const linksListContainer = linksDropdown ? linksDropdown.querySelector('.links-list') : null;
let links = [];
try { links = JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); } catch (_) { links = []; }

function saveLinks() {
try { localStorage.setItem(LINKS_KEY, JSON.stringify(links)); } catch (_) {}
}

function renderLinks() {
  if (!linksListContainer) return;
  linksListContainer.innerHTML = '';
  if (!links || links.length === 0) {
    const d = document.createElement('div');
    d.className = 'no-links';
    d.style.color = '#ccc';
    d.textContent = 'No links saved.';
    linksListContainer.appendChild(d);
    return;
  }
  links.forEach((url, idx) => {
    const item = document.createElement('div');
    item.className = 'link-item';

    const a = document.createElement('a');
    a.href = url;
    a.textContent = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const del = document.createElement('button');
    del.className = 'remove-link';
    del.type = 'button';
    del.title = 'Remove link';
    del.innerText = '×';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      links.splice(idx, 1);
      saveLinks();
      renderLinks();
    });

    item.appendChild(a);
    item.appendChild(del);
    linksListContainer.appendChild(item);
  });
}

function initLinks() {
  renderLinks();

  if (linksBtn) {
    linksBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (linksDropdown) linksDropdown.classList.toggle('show');
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const url = prompt('Enter URL:');
      if (url && url.trim()) {
        links.push(url.trim());
        saveLinks();
        renderLinks();
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (linksDropdown && !linksDropdown.contains(e.target) && e.target !== linksBtn) {
      linksDropdown.classList.remove('show');
    }
  });
}

// ---------- Search ----------
const searchBar = byId('search-bar');

function initSearch() {
  if (searchBar) {
    searchBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchBar.value.trim() !== '') {
        const query = encodeURIComponent(searchBar.value.trim());
        window.open(`https://www.google.com/search?q=${query}`, '_blank');
        searchBar.value = '';
      }
    });
  }
}

// ---------- Cursor System ----------
let cursorTrail = null;
let cursorFollowers = [];
let trailParticles = [];
const CURSOR_KEY = 'customDashboardCursor';

// Cursor selector elements
const cursorTrigger = document.querySelector('.cursor-trigger');
const cursorDropdown = document.querySelector('.cursor-dropdown');

function initCursorSelector() {
  try {
    const cursorSelector = document.getElementById('cursor-selector');
    const cursorOptions = document.querySelectorAll('.cursor-option');
    
    if (!cursorSelector) {
      console.warn('[cursor] Cursor selector not found in the DOM');
      return false;
    }
    
    if (cursorOptions.length === 0) {
      console.warn('[cursor] No cursor options found in the DOM');
      return false;
    }
    
    // Toggle dropdown with animation (dropup)
    const toggleDropdown = (e) => {
      if (e) e.stopPropagation();
      cursorSelector.classList.toggle('active');
      
      // Animate dropdown
      const dropdown = cursorSelector.querySelector('.cursor-dropdown');
      if (dropdown) {
        if (cursorSelector.classList.contains('active')) {
          dropdown.style.opacity = '1';
          dropdown.style.visibility = 'visible';
          dropdown.style.transform = 'translateY(0)';
          // Clamp within viewport
          requestAnimationFrame(() => {
            const rect = dropdown.getBoundingClientRect();
            const overflowRight = rect.right - window.innerWidth;
            const overflowBottom = rect.bottom - window.innerHeight;
            if (overflowRight > 0) {
              dropdown.style.right = `${(parseFloat(getComputedStyle(dropdown).right) || 0) + overflowRight + 16}px`;
            }
            if (overflowBottom > 0) {
              dropdown.style.bottom = `calc(100% + ${12 + overflowBottom + 16}px)`;
            }
          });
        }
      }
    };
    
    // Close dropdown when clicking outside
    const closeDropdown = () => {
      if (cursorSelector.classList.contains('active')) {
        const dropdown = cursorSelector.querySelector('.cursor-dropdown');
        if (dropdown) {
          dropdown.style.opacity = '0';
          dropdown.style.transform = 'translateY(-10px)';
          cursorSelector.classList.remove('active');
        } else {
          cursorSelector.classList.remove('active');
        }
      }
    };
    
    // Toggle dropdown on clicking the trigger button only
    const triggerBtn = cursorSelector.querySelector('.cursor-trigger');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(e);
      });
    }
    
    // Close when clicking outside and on Escape
    document.addEventListener('click', (e) => {
      if (!cursorSelector.contains(e.target)) closeDropdown();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown();
    });
    
    // Handle cursor selection - only 2 styles: default and blue-blob
    cursorOptions.forEach(option => {
      if (!option.dataset || !option.dataset.cursor) {
        console.warn('[cursor] Cursor option is missing data-cursor attribute');
        return;
      }
      
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const cursorType = option.dataset.cursor;
        
        // Visual feedback
        option.classList.add('selecting');
        
        // Apply cursor with a small delay for better UX
        setTimeout(() => {
          try {
            applyCursor(cursorType);
            
            // Update active state
            cursorOptions.forEach(opt => {
              opt.classList.toggle('active', opt === option);
              opt.classList.remove('selecting');
            });
            
            // Close dropdown with animation
            closeDropdown();
            
          } catch (error) {
            console.error('[cursor] Error applying cursor:', error);
            option.classList.remove('selecting');
          }
        }, 150);
      });
    });
    
    return true;
    
  } catch (error) {
    console.error('[cursor] Error initializing cursor selector:', error);
    return false;
  }
}

function applyCursor(cursorType) {
  console.log('[cursor] Applying cursor:', cursorType);
  
  // Remove all cursor classes first
  document.body.classList.remove('cursor-default', 'cursor-blue-blob');
  
  // Clean up existing cursor elements
  const existingCursor = document.querySelector('.cursor-follower');
  if (existingCursor && existingCursor.cleanup) {
    existingCursor.cleanup();
  } else if (existingCursor) {
    existingCursor.remove();
  }
  
  // Clean up existing particles
  document.querySelectorAll('.cursor-particle').forEach(p => p.remove());
  
  // Clear any existing timeouts
  if (window.cursorTimeout) {
    clearTimeout(window.cursorTimeout);
  }
  
  // Apply the selected cursor
  document.body.classList.add(`cursor-${cursorType}`);
  // Force repaint to ensure CSS cursor change applies immediately
  void document.body.offsetHeight;
  
  if (cursorType === 'blue-blob') {
    createBlueBlobCursor();
  } else {
    // ensure any custom follower and trail are removed for default
    const existingCursor = document.querySelector('.cursor-follower');
    if (existingCursor && existingCursor.cleanup) existingCursor.cleanup();
    document.querySelectorAll('.cursor-trail-dot, .cursor-particle').forEach(n => n.remove());
  }
  
  // Save preference
  localStorage.setItem(CURSOR_KEY, cursorType);
  
  // Update active state in UI
  document.querySelectorAll('.cursor-option').forEach(option => {
    option.classList.toggle('active', option.dataset.cursor === cursorType);
  });
  
  // Log the change
  console.log(`[cursor] Cursor changed to: ${cursorType}`);
}

function createBlueBlobCursor() {
  // Remove any existing cursor
  const existingCursor = document.querySelector('.cursor-follower');
  if (existingCursor) {
    existingCursor.remove();
  }
  
  // Create main cursor element
  const cursor = document.createElement('div');
  cursor.className = 'cursor-follower';
  document.body.appendChild(cursor);
  // Force visible
  cursor.style.opacity = '1';
  
  // Cursor size and style
  const CURSOR_SIZE = 22;
  cursor.style.width = `${CURSOR_SIZE}px`;
  cursor.style.height = `${CURSOR_SIZE}px`;
  cursor.style.background = 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)';
  cursor.style.borderRadius = '50%';
  cursor.style.position = 'fixed';
  cursor.style.pointerEvents = 'none';
  cursor.style.zIndex = '10000';
  cursor.style.transform = 'translate(-50%, -50%)';
  cursor.style.transition = 'transform 0.1s ease-out';
  cursor.style.boxShadow = '0 0 20px rgba(0, 242, 254, 0.8)';
  cursor.style.willChange = 'transform';
  
  // Position variables
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let posX = mouseX;
  let posY = mouseY;
  
  // Smoothing factor (lower = smoother but slower)
  const ease = 0.22;
  
  // Handle mouse movement
  const onMouseMove = (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };
  
  // Handle mouse over clickable elements
  const onMouseOver = (e) => {
    if (e.target.closest('a, button, [role="button"], [data-cursor="pointer"]')) {
      cursor.classList.add('pointer');
    } else {
      cursor.classList.remove('pointer');
    }
  };
  
  const onMouseLeave = () => {
    cursor.classList.remove('pointer');
  };
  
  // Add event listeners
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mouseover', onMouseOver, { passive: true });
  document.addEventListener('mouseleave', onMouseLeave, { passive: true });
  
  // Build a deterministic trail of dots following the cursor
  const TRAIL_COUNT = 14;
  const positions = [];
  const trailDots = [];

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const dot = document.createElement('div');
    dot.className = 'cursor-trail-dot';
    // Size decreases along the trail
    const size = Math.max(3, CURSOR_SIZE - 1 - i);
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    // Color: cyan with increasing darkness (via lower opacity)
    const opacity = Math.max(0.06, 0.85 - i * 0.045);
    dot.style.background = 'linear-gradient(135deg, #00eaff 0%, #00c8ff 100%)';
    dot.style.opacity = `${opacity}`;
    document.body.appendChild(dot);
    trailDots.push(dot);
  }

  // Animation loop using requestAnimationFrame for better performance
  let animationFrameId;
  let lastTimestamp = 0;
  const frameRate = 1000 / 60; // 60fps

  const animate = (timestamp) => {
    if (!lastTimestamp || timestamp - lastTimestamp >= frameRate) {
      lastTimestamp = timestamp;

      // Ease main cursor toward mouse
      const dx = mouseX - posX;
      const dy = mouseY - posY;
      posX += dx * ease;
      posY += dy * ease;
      cursor.style.transform = `translate3d(${Math.round(posX)}px, ${Math.round(posY)}px, 0) scale(${cursor.classList.contains('pointer') ? 0.4 : 1})`;

      // Record current position at head of queue
      positions.unshift({ x: posX, y: posY });
      if (positions.length > TRAIL_COUNT) positions.length = TRAIL_COUNT;

      // Position trail dots along the recorded positions
      for (let i = 0; i < trailDots.length; i++) {
        const p = positions[i] || positions[positions.length - 1] || { x: posX, y: posY };
        const dot = trailDots[i];
        dot.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`;
      }
    }
    animationFrameId = requestAnimationFrame(animate);
  };

  // Start animation
  animationFrameId = requestAnimationFrame(animate);
  
  // Store cleanup function on cursor element
  cursor.cleanup = () => {
    cancelAnimationFrame(animationFrameId);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('mouseleave', onMouseLeave);
    if (cursor.parentNode) {
      cursor.remove();
    }
    trailDots.forEach(d => d.parentNode && d.parentNode.removeChild(d));
  };
  
  return cursor;
}

// Page loader
function showLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.remove('hidden');
    try { window.__loaderShownAt = (window.performance && performance.now) ? performance.now() : Date.now(); } catch (_) { window.__loaderShownAt = Date.now(); }

    // Initialize particles background once when loader is first shown
    const containerId = 'loaderParticles';
    const container = document.getElementById(containerId);
    if (container && !container.__particlesInit) {
      container.__particlesInit = true;
      const initParticles = () => {
        if (!window.particlesJS) return false;
        window.particlesJS(containerId, {
          particles: {
            number: { value: 80, density: { enable: true, value_area: 900 } },
            color: { value: '#ffffff' },
            shape: { type: 'circle' },
            opacity: { value: 0.5 },
            size: { value: 3, random: true },
            line_linked: { enable: true, distance: 130, color: '#ffffff', opacity: 0.35, width: 1 },
            move: { enable: true, speed: 1, direction: 'none', out_mode: 'out', straight: false }
          },
          interactivity: {
            detect_on: 'canvas',
            events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: false }, resize: true },
            modes: { grab: { distance: 140, line_linked: { opacity: 0.6 } } }
          },
          retina_detect: true
        });
        // Layering
        setTimeout(() => {
          const canvas = container.querySelector('canvas');
          if (canvas) {
            canvas.style.position = 'absolute';
            canvas.style.inset = '0';
            canvas.style.zIndex = '0';
            canvas.style.background = '#000';
          }
          const content = loader.querySelector('.loader-content');
          if (content) content.style.position = 'relative';
        }, 0);
        return true;
      };
      // Try immediately and then retry a few times if the library hasn't loaded yet
      if (!initParticles()) {
        let tries = 0;
        const t = setInterval(() => {
          tries += 1;
          if (initParticles() || tries > 20) clearInterval(t);
        }, 100);
      }
    }
  }
}

function hideLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    // Enforce a minimum visible duration of 5 seconds
    try {
      const now = (window.performance && performance.now) ? performance.now() : Date.now();
      const shownAt = window.__loaderShownAt || now;
      const elapsed = now - shownAt;
      const minVisible = 5000; // 5 seconds
      if (elapsed < minVisible) {
        setTimeout(hideLoader, Math.max(0, minVisible - elapsed));
        return;
      }
    } catch (_) {}
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => {
        loader.style.display = 'none';
      }, 300);
    }, 300);
  }
}

// Enhanced typewriter animation with better cursor handling
function initTypingAnimation() {
  const typingContainer = document.querySelector('.typing-container');
  const typingText = document.getElementById('typingText');
  const cursorBlink = document.getElementById('cursorBlink');
  
  if (!typingText || !cursorBlink) return;
  
  // Make sure cursor blink is visible and blinking
  cursorBlink.style.opacity = '1';
  cursorBlink.style.animation = 'blink 1s infinite';
  // Match caret color to the dynamic title color
  try {
    const computed = getComputedStyle(typingText).color || '#20c997';
    cursorBlink.style.backgroundColor = computed;
    cursorBlink.style.color = computed;
    cursorBlink.style.borderColor = computed;
  } catch (_) {}
  // Smoother appearance
  typingText.style.transition = 'opacity 0.2s ease';
  typingText.style.willChange = 'contents, opacity';
  
  const titles = [
    'Anubhav!',
    'Programmer!',
    'Procrastinator!',
    'Developer!',
    'Creator!',
    'Innovator!',
    'Dreamer!'
  ];
  
  let currentIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  // Restore previous pacing
  let typingSpeed = 100;
  let deleteSpeed = 50;
  let pauseTime = 2000;
  
  function typeEffect() {
    const currentTitle = titles[currentIndex];
    
    if (!isDeleting) {
      // Typing
      typingText.textContent = currentTitle.substring(0, charIndex + 1);
      charIndex++;
      
      // If we've reached the end of the current title
      if (charIndex === currentTitle.length) {
        setTimeout(() => {
          isDeleting = true;
          typeEffect();
        }, pauseTime);
        return;
      }
    } else {
      // Deleting
      typingText.textContent = currentTitle.substring(0, charIndex - 1);
      charIndex--;
      
      // If we've deleted the entire title
      if (charIndex === 0) {
        isDeleting = false;
        currentIndex = (currentIndex + 1) % titles.length;
      }
    }
    
    // Slight randomization for human-like rhythm
    const jitter = isDeleting ? 10 : 30;
    const speed = (isDeleting ? deleteSpeed : typingSpeed) + Math.round((Math.random() - 0.5) * jitter);
    setTimeout(typeEffect, Math.max(20, speed));
  }
  
  // Ensure no forced min-width remains (revert to original tighter layout)
  typingText.style.minWidth = '';
  typingText.style.display = '';

  // Start the animation
  setTimeout(typeEffect, 1000);
}

// Custom cursor with smooth trail effect
function initCustomCursor() {
  // Don't initialize on touch devices
  if ('ontouchstart' in window || navigator.maxTouchPoints) {
    return;
  }

  let rafId = null;
  let cursor = null;
  let trailElements = [];
  let mouseX = 0;
  let mouseY = 0;
  let cursorX = 0;
  let cursorY = 0;
  let isActive = false;
  let destroyTimeoutId = null;
  let hideNativeCursorStyle = null;

  const enableGlobalCursorHide = () => {
    if (hideNativeCursorStyle) return;
    hideNativeCursorStyle = document.createElement('style');
    hideNativeCursorStyle.type = 'text/css';
    hideNativeCursorStyle.textContent = '*{cursor:none !important}';
    document.head.appendChild(hideNativeCursorStyle);
  };
  const disableGlobalCursorHide = () => {
    if (hideNativeCursorStyle && hideNativeCursorStyle.parentNode) {
      hideNativeCursorStyle.parentNode.removeChild(hideNativeCursorStyle);
    }
    hideNativeCursorStyle = null;
  };

  const createCursor = (startX, startY) => {
    // Hide default cursor only while active
    document.body.style.cursor = 'none';

    // Main cursor (bigger, teal)
    cursor = document.createElement('div');
    cursor.className = 'custom-cursor-main';
    cursor.style.cssText = `
      position: fixed;
      width: 34px;
      height: 34px;
      background: radial-gradient(circle at 35% 35%, #34e4c2 0%, #20c997 45%, #0d8b63 100%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 10001; /* above particles canvas */
      transform: translate(-50%, -50%);
      box-shadow: 0 0 28px rgba(32, 201, 151, 0.9);
      transition: opacity 120ms ease, transform 0.12s ease-out;
      opacity: 0;
    `;
    document.body.appendChild(cursor);

    // Trail (tapered, darker along tail)
    const trailCount = 18; // denser for more connected look
    trailElements = [];
    for (let i = 0; i < trailCount; i++) {
      const trail = document.createElement('div');
      trail.className = 'cursor-trail';

      // Size decreases and gets darker
      const size = Math.max(5, 30 - i * 1.4);
      const darkness = Math.min(1, 0.12 + i * 0.05); // more dark further back
      const opacity = Math.max(0.06, 0.92 - i * 0.05);

      trail.style.cssText = `
        position: fixed;
        width: ${size}px;
        height: ${size * 0.84}px;
        background: linear-gradient(135deg,
          rgba(${Math.round(52 - 20 * darkness)}, ${Math.round(228 - 80 * darkness)}, ${Math.round(194 - 60 * darkness)}, ${opacity}) 0%,
          rgba(${Math.round(13 + 10 * darkness)}, ${Math.round(139 - 40 * darkness)}, ${Math.round(99 - 50 * darkness)}, ${opacity}) 100%);
        border-radius: 60% 70% 80% 70% / 70% 70% 55% 70%;
        pointer-events: none;
        z-index: 10000; /* above particles canvas */
        transform: translate(-50%, -50%) rotate(0deg) scale(1);
        transition: opacity 260ms ease;
        opacity: 0;
      `;
      document.body.appendChild(trail);
      trailElements.push({ element: trail, x: startX, y: startY, targetX: startX, targetY: startY });
    }

    // Seed positions at pointer
    mouseX = cursorX = startX;
    mouseY = cursorY = startY;

    // Fade in
    requestAnimationFrame(() => {
      cursor.style.opacity = '1';
      trailElements.forEach(t => (t.element.style.opacity = '1'));
    });
  };

  const destroyCursor = () => {
    if (!cursor) return;
    // Fade out, then remove
    cursor.style.opacity = '0';
    trailElements.forEach((t, i) => {
      // staggered gentle fade for smoother exit
      setTimeout(() => { t.element.style.opacity = '0'; }, i * 14);
    });
    destroyTimeoutId = setTimeout(() => {
      cursor && cursor.remove();
      trailElements.forEach(t => t.element.remove());
      cursor = null;
      trailElements = [];
      document.body.style.cursor = '';
      disableGlobalCursorHide();
      destroyTimeoutId = null;
    }, 420);
  };

  const handleMouseMove = (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };

  const animate = () => {
    if (!cursor) return;

    // velocity for orientation
    const vx = mouseX - cursorX;
    const vy = mouseY - cursorY;
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);

    // Smooth main cursor movement
    cursorX += (mouseX - cursorX) * 0.38; // faster head
    cursorY += (mouseY - cursorY) * 0.38;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;

    // Trail follows
    trailElements.forEach((trail, index) => {
      if (index === 0) {
        trail.targetX = cursorX;
        trail.targetY = cursorY;
      } else {
        const prev = trailElements[index - 1];
        trail.targetX = prev.x;
        trail.targetY = prev.y;
      }
      // quicker catch-up, tighter connection
      const followEase = Math.min(0.5, 0.28 + index * 0.045);
      trail.x += (trail.targetX - trail.x) * followEase;
      trail.y += (trail.targetY - trail.y) * followEase;
      const scale = Math.max(0.44, 1 - index * 0.028);
      trail.element.style.left = `${trail.x}px`;
      trail.element.style.top = `${trail.y}px`;
      trail.element.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scale}, ${scale * 0.9})`;
    });

    rafId = requestAnimationFrame(animate);
  };

  const onEnter = (e) => {
    if (isActive) return;
    isActive = true;
    if (destroyTimeoutId) { clearTimeout(destroyTimeoutId); destroyTimeoutId = null; }
    // Hide native cursor globally while active (covers inputs/links)
    enableGlobalCursorHide();
    createCursor(e.clientX, e.clientY);
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);
  };

  const onLeave = () => {
    if (!isActive) return;
    isActive = false;
    document.removeEventListener('mousemove', handleMouseMove);
    if (rafId) cancelAnimationFrame(rafId);
    destroyCursor();
  };

  // Safety: if user re-enters and mousemove fires before mouseenter, create cursor at first move
  const onFirstMoveCreate = (e) => {
    if (!isActive && !cursor) {
      onEnter(e);
    }
  };

  // Use pointer events for better device coverage
  document.addEventListener('mouseenter', onEnter);
  document.addEventListener('mouseleave', onLeave);
  document.addEventListener('mousemove', onFirstMoveCreate, { passive: true });

  // Cleanup function
  return () => {
    document.removeEventListener('mouseenter', onEnter);
    document.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mousemove', onFirstMoveCreate);
    document.removeEventListener('mousemove', handleMouseMove);
    if (rafId) cancelAnimationFrame(rafId);
    destroyCursor();
  };
}

// Enhanced page animations
function initPageAnimations() {
  // Hide loader and start animations
  hideLoader();
  
  // Initialize typing animation
  initTypingAnimation();
  
  // Animate time and date - faster
  setTimeout(() => {
    if (window.gsap) {
      gsap.fromTo(['#time', '#date'], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", stagger: 0.05 });
    } else {
      document.querySelectorAll('#time, #date').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    }
  }, 2000);
  
  // Animate quote - faster
  setTimeout(() => {
    if (window.gsap) {
      gsap.fromTo('#quote', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" });
    } else {
      const el = document.getElementById('quote');
      if (el) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }
    }
  }, 2300);
  
  // Enhanced hover animations
  document.querySelectorAll('.links-btn, #weather, .cursor-trigger').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      if (window.gsap) {
        gsap.to(btn, { scale: 1.05, duration: 0.3, ease: "back.out(1.7)", boxShadow: "0 8px 25px rgba(0, 255, 255, 0.3)" });
      } else {
        btn.style.transform = 'scale(1.05)';
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (window.gsap) {
        gsap.to(btn, { scale: 1, duration: 0.3, ease: "power2.out", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)" });
      } else {
        btn.style.transform = 'scale(1)';
      }
    });
  });
  
  // Task animations - faster and smoother
  const taskList = document.getElementById('task-list');
  if (taskList) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.tagName === 'LI') {
            if (window.gsap) {
              gsap.fromTo(node, { opacity: 0, x: 20, scale: 0.9 }, { opacity: 1, x: 0, scale: 1, duration: 0.3, ease: "back.out(1.2)" });
            } else {
              node.style.opacity = '1';
              node.style.transform = 'translateX(0) scale(1)';
            }
          }
        });
      });
    });
    observer.observe(taskList, { childList: true });
  }
  
  // Search bar focus animation
  const searchBar = document.getElementById('search-bar');
  if (searchBar) {
    searchBar.addEventListener('focus', () => {
      if (window.gsap) {
        gsap.to(searchBar, { scale: 1.02, duration: 0.3, ease: "power2.out" });
      } else {
        searchBar.style.transform = 'scale(1.02)';
      }
    });
    searchBar.addEventListener('blur', () => {
      if (window.gsap) {
        gsap.to(searchBar, { scale: 1, duration: 0.3, ease: "power2.out" });
      } else {
        searchBar.style.transform = 'scale(1)';
      }
    });
  }
}

// Initialize cursor on page load with proper persistence
function initCursor() {
  try {
    // Always-on custom cursor (cyan-teal comet)
    document.body.classList.add('cursor-blue-blob');
    createBlueBlobCursor();
  } catch (error) {
    console.error('[cursor] Error initializing custom cursor:', error);
  }
}

// Initialize everything on page load
function initializeApp() {
  // Show loader first
  showLoader();
  
  // Set a timeout to ensure the loader is always hidden, even if there are errors
  const loaderTimeout = setTimeout(() => {
    hideLoader();
  }, 10000); // 10 second timeout
  
  // Override the hideLoader to clear the timeout
  const originalHideLoader = hideLoader;
  
  try {
    updateTime();
    setInterval(updateTime, 1000);
    updateDate();
    initLinks();
    initSearch();
    loadTasks();
    initTypingAnimation(); // Use the fixed version
    initCustomCursor();    // Use the new custom cursor
    
    // Initialize animations after a short delay to allow for initial render
    setTimeout(() => {
      try {
        initPageAnimations();
        initTypingAnimation();
      } catch (e) {
        console.error('Error initializing animations:', e);
      }
    }, 100);
    
    // Set background
    setBackground().catch(e => console.error('Error setting background:', e));
    
    // Load quotes
    loadQuotesRobust().catch(e => console.error('Error loading quotes:', e));
    
  } catch (error) {
    console.error('Error during initialization:', error);
  }
}

// Start the app when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOMContentLoaded has already fired
  setTimeout(initializeApp, 0);
}
