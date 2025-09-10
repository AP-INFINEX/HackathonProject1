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

// Page loader with synced progress bar and rotating messages
function showLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    loader.classList.remove('hidden');
    try { window.__loaderShownAt = (window.performance && performance.now) ? performance.now() : Date.now(); } catch (_) { window.__loaderShownAt = Date.now(); }
    
    // Add progress bar and rotating messages
    const loaderContent = loader.querySelector('.loader-content');
    if (loaderContent) {
      // Create progress bar
      const progressContainer = document.createElement('div');
      progressContainer.style.cssText = `
        position: absolute;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: 200px;
        height: 4px;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
        overflow: hidden;
      `;
      
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #34e4c2, #20c997);
        border-radius: 2px;
        transition: width 0.3s ease;
      `;
      progressContainer.appendChild(progressBar);
      loaderContent.appendChild(progressContainer);
      
      // Create rotating messages
      const messageEl = document.createElement('div');
      messageEl.style.cssText = `
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255,255,255,0.8);
        font-size: 14px;
        text-align: center;
        min-height: 20px;
      `;
      loaderContent.appendChild(messageEl);
      
      // Rotating messages
      const messages = [
        'Initializing particles...',
        'Calibrating cursor...',
        'Loading dashboard...',
        'Preparing animations...',
        'Optimizing performance...',
        'Almost ready...'
      ];
      
      let messageIndex = 0;
      let progress = 0;
      const startTime = Date.now();
      const totalDuration = 8000; // 8 seconds total
      
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const realProgress = Math.min(100, (elapsed / totalDuration) * 100);
        
        // Smooth progress with some randomness for natural feel
        const randomFactor = 1 + (Math.random() - 0.5) * 0.1; // ±5% randomness
        progress = Math.min(realProgress * randomFactor, 100);
        
        progressBar.style.width = `${progress}%`;
        
        if (progress < 100) {
          requestAnimationFrame(updateProgress);
        }
      };
      
      const updateMessage = () => {
        messageEl.textContent = messages[messageIndex];
        messageEl.style.opacity = '0';
        setTimeout(() => {
          messageEl.style.opacity = '1';
          messageIndex = (messageIndex + 1) % messages.length;
        }, 200);
        
        if (progress < 100) {
          setTimeout(updateMessage, 1000 + Math.random() * 500);
        }
      };
      
      // Start progress and messages
      updateProgress();
      updateMessage();
    }

    // Initialize particles background once when loader is first shown
    const containerId = 'loaderParticles';
    const container = document.getElementById(containerId);
    if (container && !container.__particlesInit) {
      container.__particlesInit = true;
      const initParticles = () => {
        if (!window.particlesJS) return false;
        window.particlesJS(containerId, {
          particles: {
            number: { value: 70, density: { enable: true, value_area: 900 } },
            color: { value: '#ffffff' },
            shape: { type: 'circle' },
            opacity: { value: 0.55 },
            size: { value: 3.8, random: true },
            line_linked: { enable: true, distance: 160, color: '#ffffff', opacity: 0.75, width: 2.8 },
            move: { enable: true, speed: 0.8, direction: 'none', out_mode: 'out', straight: false }
          },
          interactivity: {
            detect_on: 'canvas',
            events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: false }, resize: true },
            modes: { grab: { distance: 200, line_linked: { opacity: 1 } } }
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
      // Local fallback: lightweight canvas particles with magnetic attraction
      if (!window.particlesJS) {
        const canvas = document.createElement('canvas');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        canvas.style.position = 'absolute';
        canvas.style.inset = '0';
        canvas.style.zIndex = '0';
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const nodes = [];
        const count = 70;
        
        function resize() { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
        window.addEventListener('resize', resize);
        
        for (let i = 0; i < count; i++) {
          nodes.push({ 
            x: Math.random() * canvas.width, 
            y: Math.random() * canvas.height, 
            vx: (Math.random()-0.5)*0.6, 
            vy: (Math.random()-0.5)*0.6,
            originalVx: (Math.random()-0.5)*0.6,
            originalVy: (Math.random()-0.5)*0.6
          });
        }
        
        let animId;
        let t0 = performance.now();
        
        function step(now) {
          ctx.fillStyle = '#000';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          const elapsed = (now - t0) / 1000;
          const zoom = 1 + Math.sin(elapsed * 0.2) * 0.02;
          
          ctx.save();
          ctx.translate(canvas.width/2, canvas.height/2);
          ctx.scale(zoom, zoom);
          ctx.translate(-canvas.width/2, -canvas.height/2);
          
          // Magnetic attraction to cursor
          const cursor = document.querySelector('.custom-cursor-main');
          let cursorX = canvas.width / 2;
          let cursorY = canvas.height / 2;
          
          if (cursor) {
            const rect = cursor.getBoundingClientRect();
            cursorX = rect.left + rect.width / 2;
            cursorY = rect.top + rect.height / 2;
          }
          
          // Update particles with magnetic attraction
          for (const p of nodes) {
            const depth = (p.x / canvas.width + p.y / canvas.height) * 0.5;
            
            // Magnetic attraction to cursor
            const dx = cursorX - p.x;
            const dy = cursorY - p.y;
            const distance = Math.hypot(dx, dy);
            const maxDistance = 150;
            
            if (distance < maxDistance && distance > 0) {
              const attraction = (1 - distance / maxDistance) * 0.02;
              p.vx += dx * attraction;
              p.vy += dy * attraction;
            } else {
              // Return to original velocity
              p.vx += (p.originalVx - p.vx) * 0.01;
              p.vy += (p.originalVy - p.vy) * 0.01;
            }
            
            // Apply velocity with depth-based speed
            p.x += p.vx * (0.7 + depth * 0.6);
            p.y += p.vy * (0.7 + depth * 0.6);
            
            // Bounce off edges
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
          }
          
          // Draw connections
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          for (let i=0;i<nodes.length;i++) {
            for (let j=i+1;j<nodes.length;j++) {
              const a = nodes[i], b = nodes[j];
              const dx = a.x-b.x, dy = a.y-b.y; const d2 = dx*dx+dy*dy;
              if (d2 < 220*220) {
                const op = 1 - Math.sqrt(d2)/220;
                ctx.globalAlpha = Math.min(1, 0.6*op);
                ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
              }
            }
          }
          
          ctx.globalAlpha = 1;
          
          // Draw particles
          ctx.fillStyle = '#ffffff';
          for (const p of nodes) { 
            ctx.beginPath(); 
            ctx.arc(p.x,p.y,3,0,Math.PI*2); 
            ctx.fill(); 
          }
          
          ctx.restore();
          animId = requestAnimationFrame(step);
        }
        
        step(performance.now());
        container.__particlesStop = () => { 
          cancelAnimationFrame(animId); 
          window.removeEventListener('resize', resize); 
          canvas.remove(); 
        };
      }
    }
  }
}

function hideLoader() {
  const loader = document.getElementById('pageLoader');
  if (loader) {
    // Enforce a minimum visible duration of 8 seconds
    try {
      const now = (window.performance && performance.now) ? performance.now() : Date.now();
      const shownAt = window.__loaderShownAt || now;
      const elapsed = now - shownAt;
      const minVisible = 8000; // 8 seconds
      if (elapsed < minVisible) {
        setTimeout(hideLoader, Math.max(0, minVisible - elapsed));
        return;
      }
    } catch (_) {}
    setTimeout(() => {
      loader.classList.add('hidden');
      setTimeout(() => {
        loader.style.display = 'none';
        const container = document.getElementById('loaderParticles');
        if (container && container.__particlesStop) { try { container.__particlesStop(); } catch(_) {} }
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

  // White glow for the greeting prefix, not the changing title
  try {
    const prefixEl = document.querySelector('#greeting .greeting-prefix');
    if (prefixEl) {
      prefixEl.style.transition = 'text-shadow 0.25s ease, color 0.25s ease';
      prefixEl.addEventListener('mouseenter', () => {
        prefixEl.style.textShadow = '0 0 20px rgba(255,255,255,0.9), 0 0 40px rgba(255,255,255,0.6)';
      });
      prefixEl.addEventListener('mouseleave', () => {
        prefixEl.style.textShadow = 'none';
      });
    }
  } catch (_) {}
  
  let currentIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  // Smoother pacing with consistent timing
  let typingSpeed = 95;
  let deleteSpeed = 55;
  let pauseTime = 2000;
  
  // Track timing to prevent shakiness
  let lastTypeTime = 0;
  let typeSequence = 0;
  
  function typeEffect() {
    const currentTitle = titles[currentIndex];
    const now = performance.now();
    
    if (!isDeleting) {
      // Typing
      typingText.textContent = currentTitle.substring(0, charIndex + 1);
      charIndex++;
      
      // If we've reached the end of the current title
      if (charIndex === currentTitle.length) {
        setTimeout(() => {
          isDeleting = true;
          typeSequence = 0;
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
        typeSequence = 0;
      }
    }
    
    // Consistent timing with minimal jitter
    typeSequence++;
    const baseSpeed = isDeleting ? deleteSpeed : typingSpeed;
    const jitter = Math.sin(typeSequence * 0.3) * 3; // smooth wave instead of random
    const speed = Math.max(20, baseSpeed + jitter);
    
    // Ensure minimum time between characters
    const timeSinceLast = now - lastTypeTime;
    const delay = Math.max(0, speed - timeSinceLast);
    
    lastTypeTime = now + delay;
    setTimeout(typeEffect, delay);
  }
  
  // Remove fixed width if previously set to recover older look
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
  let collapseCheckId = null;
  let isFadingOut = false;

  const enableGlobalCursorHide = () => {
    if (hideNativeCursorStyle) return;
    hideNativeCursorStyle = document.createElement('style');
    hideNativeCursorStyle.type = 'text/css';
    hideNativeCursorStyle.textContent = `
      *, *::before, *::after {
        cursor: none !important;
      }
      input, textarea, select, button, a {
        cursor: none !important;
      }
      .search-suggestions, .search-suggestions * {
        cursor: none !important;
      }
      .links-dropdown, .links-dropdown * {
        cursor: none !important;
      }
      .links-list, .links-list * {
        cursor: none !important;
      }
      li {
        cursor: none !important;
      }
      .task-list, .task-list * {
        cursor: none !important;
      }
      body {
        cursor: none !important;
      }
      html {
        cursor: none !important;
      }
      div[class*="suggestion"], div[class*="dropdown"], div[class*="menu"] {
        cursor: none !important;
      }
      div[class*="suggestion"] *, div[class*="dropdown"] *, div[class*="menu"] * {
        cursor: none !important;
      }
      [role="listbox"], [role="option"] {
        cursor: none !important;
      }
      [role="listbox"] *, [role="option"] * {
        cursor: none !important;
      }
      .autocomplete, .autocomplete * {
        cursor: none !important;
      }
    `;
    document.head.appendChild(hideNativeCursorStyle);
  };
  const disableGlobalCursorHide = () => {
    if (hideNativeCursorStyle && hideNativeCursorStyle.parentNode) {
      hideNativeCursorStyle.parentNode.removeChild(hideNativeCursorStyle);
    }
    hideNativeCursorStyle = null;
  };

  const createCursor = (startX, startY) => {
    // Force hide default cursor globally
    enableGlobalCursorHide();

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
      z-index: 10001;
    transform: translate(-50%, -50%);
      box-shadow: 0 0 28px rgba(32, 201, 151, 0.9);
      transition: opacity 120ms ease, transform 0.12s ease-out;
      opacity: 0;
      left: ${startX}px;
      top: ${startY}px;
  `;
  document.body.appendChild(cursor);

    // Trail (tapered, darker along tail) - ABSOLUTELY FIXED LENGTH
    const trailCount = 26; // Slightly longer trail
    trailElements = [];
  for (let i = 0; i < trailCount; i++) {
    const trail = document.createElement('div');
    trail.className = 'cursor-trail';

      // Size decreases and gets darker
      const size = Math.max(6, 32 - i * 1.1);
      const darkness = Math.min(1, 0.15 + i * 0.04);
      const opacity = Math.max(0.08, 0.95 - i * 0.04);

    trail.style.cssText = `
      position: fixed;
      width: ${size}px;
        height: ${size * 0.84}px;
      background: linear-gradient(135deg, 
          rgba(${Math.round(52 - 20 * darkness)}, ${Math.round(228 - 80 * darkness)}, ${Math.round(194 - 60 * darkness)}, ${opacity}) 0%,
          rgba(${Math.round(13 + 10 * darkness)}, ${Math.round(139 - 40 * darkness)}, ${Math.round(99 - 50 * darkness)}, ${opacity}) 100%);
        border-radius: 60% 70% 80% 70% / 70% 70% 55% 70%;
      pointer-events: none;
        z-index: 10000;
        transform: translate(-50%, -50%) rotate(0deg) scale(1);
        transition: opacity 260ms ease;
        opacity: 0;
        left: ${startX - i * 14}px;
        top: ${startY}px;
      `;
    document.body.appendChild(trail);
    trailElements.push({
      element: trail,
        x: startX - i * 14, 
        y: startY, 
        targetX: startX - i * 14, 
        targetY: startY,
        vx: 0,
        vy: 0
      });
    }

    // Initialize positions
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
    cursorX += (mouseX - cursorX) * 0.35; // slightly slower for longer visible tail
    cursorY += (mouseY - cursorY) * 0.35;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;

    // Trail follows with CONSTANT spacing and speed
    trailElements.forEach((trail, index) => {
      if (index === 0) {
        trail.targetX = cursorX;
        trail.targetY = cursorY;
      } else {
        const prev = trailElements[index - 1];
        trail.targetX = prev.x;
        trail.targetY = prev.y;
      }
      
      // CONSTANT follow speed - no variation based on movement speed
      const followEase = 0.25; // Fixed speed for all trail elements
      trail.x += (trail.targetX - trail.x) * followEase;
      trail.y += (trail.targetY - trail.y) * followEase;
      
      // CONSTANT scale - no variation
      const scale = Math.max(0.5, 1 - index * 0.03);
      trail.element.style.left = `${trail.x}px`;
      trail.element.style.top = `${trail.y}px`;
      trail.element.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scale}, ${scale * 0.9})`;
    });

    // CONSTANT cursor movement speed - no variation
    const moveSpeed = 0.35; // Fixed speed always
    cursorX += (mouseX - cursorX) * moveSpeed;
    cursorY += (mouseY - cursorY) * moveSpeed;
    
    // Immediate cursor personality using actual cursor position
    const interactiveElements = document.querySelectorAll('a, button, #search-bar, #task-input, #links-btn, #weather');
    let isNearInteractive = false;
    const cometRadius = 17;
    
    if (cursor) {
      const cursorRect = cursor.getBoundingClientRect();
      const cursorCenterX = cursorRect.left + cursorRect.width / 2;
      const cursorCenterY = cursorRect.top + cursorRect.height / 2;
      
      interactiveElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        
        // Check if ANY part of the comet circle overlaps with the element
        const cometLeft = cursorCenterX - cometRadius;
        const cometRight = cursorCenterX + cometRadius;
        const cometTop = cursorCenterY - cometRadius;
        const cometBottom = cursorCenterY + cometRadius;
        
        const elementLeft = rect.left;
        const elementRight = rect.right;
        const elementTop = rect.top;
        const elementBottom = rect.bottom;
        
        // Check for ANY overlap between the full circle and element
        const horizontalOverlap = cometRight > elementLeft && cometLeft < elementRight;
        const verticalOverlap = cometBottom > elementTop && cometTop < elementBottom;
        
        if (horizontalOverlap && verticalOverlap) {
          isNearInteractive = true;
        }
      });
    }
    
    // Apply immediate glow with faster transition
    if (isNearInteractive) {
      cursor.style.transition = 'box-shadow 0.1s ease, transform 0.1s ease';
      cursor.style.boxShadow = '0 0 40px rgba(32,201,151,1)';
      cursor.style.transform = `translate(-50%, -50%) scale(1.15)`; // Slightly bigger
    } else {
      cursor.style.transition = 'box-shadow 0.1s ease, transform 0.1s ease';
      cursor.style.boxShadow = '0 0 28px rgba(32, 201, 151, 0.9)';
      cursor.style.transform = `translate(-50%, -50%) scale(1)`;
    }

    rafId = requestAnimationFrame(animate);
  };

  const onEnter = (e) => {
    if (isActive) return;
    
    // Cancel any ongoing fade/destroy
    if (destroyTimeoutId) { clearTimeout(destroyTimeoutId); destroyTimeoutId = null; }
    if (collapseCheckId) { cancelAnimationFrame(collapseCheckId); collapseCheckId = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    
    isActive = true;
    isFadingOut = false;
    
    // Force hide native cursor globally IMMEDIATELY
    enableGlobalCursorHide();
    
    // Always recreate fresh comet with FULL trail
    if (cursor) { try { cursor.remove(); } catch(_) {} }
    trailElements.forEach(t => { try { t.element.remove(); } catch(_) {} });
    trailElements = [];
    
    createCursor(e.clientX, e.clientY);
    
    // CRITICAL: Pre-fill trail with FULL length immediately - CONSISTENT SPACING
    const spacing = 14; // Fixed spacing
    for (let i = 0; i < trailElements.length; i++) {
      const t = trailElements[i];
      t.x = e.clientX - i * spacing;
      t.y = e.clientY;
      t.targetX = t.x;
      t.targetY = t.y;
      t.element.style.left = `${t.x}px`;
      t.element.style.top = `${t.y}px`;
    }
    
    mouseX = e.clientX; 
    mouseY = e.clientY; 
    cursorX = e.clientX; 
    cursorY = e.clientY;
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);
  };

  // No click ripple effect

  // Sling-shot: brief speed-up on quick mouse flicks
  let lastMove = { t: performance.now(), x: 0, y: 0 };
  const baseHeadEase = 0.35;
  let speedBoostUntil = 0;
  document.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const dt = now - lastMove.t;
    const dx = e.clientX - lastMove.x;
    const dy = e.clientY - lastMove.y;
    const v = Math.hypot(dx, dy) / Math.max(1, dt);
    if (v > 1.5) {
      speedBoostUntil = now + 180; // 180ms boost
    }
    lastMove = { t: now, x: e.clientX, y: e.clientY };
  }, { passive: true });

  // patch animate to use boost
  const originalAnimate = animate;
  const boostedAnimate = () => {
    if (!cursor) return;
    const now = performance.now();
    const headEase = now < speedBoostUntil ? baseHeadEase + 0.15 : baseHeadEase;
    // reuse same logic but with local ease
    const vx = mouseX - cursorX;
    const vy = mouseY - cursorY;
    const angle = Math.atan2(vy, vx) * (180 / Math.PI);
    cursorX += (mouseX - cursorX) * headEase;
    cursorY += (mouseY - cursorY) * headEase;
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
    trailElements.forEach((trail, index) => {
      if (index === 0) { trail.targetX = cursorX; trail.targetY = cursorY; }
      else { const prev = trailElements[index - 1]; trail.targetX = prev.x; trail.targetY = prev.y; }
      const followEase = Math.min(0.45, 0.22 + index * 0.035);
      trail.x += (trail.targetX - trail.x) * followEase;
      trail.y += (trail.targetY - trail.y) * followEase;
      const scale = Math.max(0.5, 1 - index * 0.03);
      trail.element.style.left = `${trail.x}px`;
      trail.element.style.top = `${trail.y}px`;
      trail.element.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scale}, ${scale * 0.9})`;
    });
    const nearInteractive = document.querySelector('a:hover, button:hover, #search-bar:hover, #task-input:hover, #links-btn:hover, #weather:hover');
    if (nearInteractive) { cursor.style.boxShadow = '0 0 36px rgba(32,201,151,1)'; cursor.style.transform = `translate(-50%, -50%) scale(1.2)`; }
    else { cursor.style.boxShadow = '0 0 28px rgba(32, 201, 151, 0.9)'; cursor.style.transform = `translate(-50%, -50%) scale(1)`; }
    rafId = requestAnimationFrame(boostedAnimate);
  };
  // start boosted animate loop
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(boostedAnimate);

  const onLeave = () => {
    if (!isActive) return;
    isActive = false;
    document.removeEventListener('mousemove', handleMouseMove);
    
    // Stop animation immediately
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    
    // Immediate fade - no delay
    if (cursor) {
      cursor.style.transition = 'opacity 200ms ease';
      cursor.style.opacity = '0';
    }
    
    trailElements.forEach((t, i) => {
      t.element.style.transition = 'opacity 200ms ease';
      t.element.style.opacity = '0';
    });
    
    // Quick cleanup
    setTimeout(() => {
      if (!isActive) {
        destroyCursor();
      }
    }, 250);
  };

  // Safety: if user re-enters and mousemove fires before mouseenter, create cursor at first move
  const onFirstMoveCreate = (e) => {
    if (!isActive && !cursor) {
      onEnter(e);
    }
  };

  // Aggressive cursor visibility enforcement
  const enforceCursorVisibility = () => {
    if (isActive && cursor) {
      enableGlobalCursorHide();
      cursor.style.zIndex = '999999';
      cursor.style.pointerEvents = 'none';
      cursor.style.position = 'fixed';
      cursor.style.display = 'block';
      cursor.style.visibility = 'visible';
      cursor.style.opacity = '1';
    }
  };

  // Enhanced mouse event handling
  const handleMouseOver = (e) => {
    enforceCursorVisibility();
  };

  const handleMouseEnter = (e) => {
    enforceCursorVisibility();
  };

  // Monitor for search suggestions and ensure cursor visibility
  const monitorSearchSuggestions = () => {
    const searchSuggestions = document.querySelectorAll('[class*="suggestion"], [class*="dropdown"], [class*="menu"], [role="listbox"], [role="option"]');
    searchSuggestions.forEach(suggestion => {
      suggestion.addEventListener('mouseenter', enforceCursorVisibility);
      suggestion.addEventListener('mouseover', enforceCursorVisibility);
      suggestion.addEventListener('mouseleave', enforceCursorVisibility);
    });
  };

  // Monitor for dynamically created elements
  const observer = new MutationObserver(() => {
    monitorSearchSuggestions();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Continuous cursor visibility check
  setInterval(enforceCursorVisibility, 100);

  // Use pointer events for better device coverage
  document.addEventListener('mouseenter', onEnter);
  document.addEventListener('mouseleave', onLeave);
  document.addEventListener('mousemove', onFirstMoveCreate, { passive: true });
  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  document.addEventListener('mouseenter', handleMouseEnter, { passive: true });

  // Cleanup function
  return () => {
    document.removeEventListener('mouseenter', onEnter);
    document.removeEventListener('mouseleave', onLeave);
    document.removeEventListener('mousemove', onFirstMoveCreate);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mouseenter', handleMouseEnter);
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

  // Background micro-parallax (disabled per feedback)
  (function disableParallax() {
    document.body.style.backgroundPosition = 'center';
  })();

  // Enhanced weather glow when comet touches
  (function setupProximityGlow() {
    const targets = [document.getElementById('search-bar'), document.getElementById('links-btn'), document.getElementById('task-input'), document.getElementById('weather')].filter(Boolean);
    let glowTimer = null;
    
    console.log('Proximity glow targets:', targets.map(t => t.id)); // Debug log
    
    const applyGlow = (el, isTouching) => {
      if (!el) return;
      el.style.transition = 'box-shadow 0.1s ease, transform 0.1s ease, border 0.1s ease, background 0.1s ease'; // Added background transition
      if (isTouching) {
        // Enhanced glow for weather specifically
        if (el.id === 'weather') {
          el.style.boxShadow = '0 0 50px rgba(32,201,151,1), 0 0 100px rgba(32,201,151,0.8), inset 0 0 20px rgba(32,201,151,0.3)';
          el.style.border = '2px solid rgba(32,201,151,1)';
          el.style.background = 'rgba(32,201,151,0.1)'; // Add background glow
          el.style.transform = 'scale(1.05)';
          // Also glow the text inside
          const tempEl = el.querySelector('#weather-temp');
          const conditionEl = el.querySelector('#weather-condition');
          if (tempEl) tempEl.style.textShadow = '0 0 10px rgba(32,201,151,0.8)';
          if (conditionEl) conditionEl.style.textShadow = '0 0 10px rgba(32,201,151,0.8)';
        } else {
          el.style.boxShadow = '0 0 40px rgba(32,201,151,1), 0 0 80px rgba(32,201,151,0.7)';
          el.style.transform = 'scale(1.04)';
        }
        console.log('Box activated:', el.id);
      } else {
        el.style.boxShadow = '';
        el.style.transform = 'scale(1)';
        if (el.id === 'weather') {
          el.style.border = ''; // Reset weather border
          el.style.background = ''; // Reset weather background
          // Reset text glow
          const tempEl = el.querySelector('#weather-temp');
          const conditionEl = el.querySelector('#weather-condition');
          if (tempEl) tempEl.style.textShadow = '';
          if (conditionEl) conditionEl.style.textShadow = '';
        }
      }
    };
    
    const check = () => {
      if (!isActive || !cursor) { glowTimer = requestAnimationFrame(check); return; }
      
      const cometRadius = 17; // Full radius of the comet circle
      
      targets.forEach(t => {
        const r = t.getBoundingClientRect();
        
        // Use actual cursor position from the cursor element
        const cursorRect = cursor.getBoundingClientRect();
        const cursorCenterX = cursorRect.left + cursorRect.width / 2;
        const cursorCenterY = cursorRect.top + cursorRect.height / 2;
        
        // Check if ANY part of the comet circle overlaps with the element
        const cometLeft = cursorCenterX - cometRadius;
        const cometRight = cursorCenterX + cometRadius;
        const cometTop = cursorCenterY - cometRadius;
        const cometBottom = cursorCenterY + cometRadius;
        
        const elementLeft = r.left;
        const elementRight = r.right;
        const elementTop = r.top;
        const elementBottom = r.bottom;
        
        // Check for ANY overlap between the full circle and element
        const horizontalOverlap = cometRight > elementLeft && cometLeft < elementRight;
        const verticalOverlap = cometBottom > elementTop && cometTop < elementBottom;
        
        const isTouching = horizontalOverlap && verticalOverlap;
        
        // Debug weather specifically
        if (t.id === 'weather' && isTouching) {
          console.log('Weather touched! Comet:', cursorCenterX, cursorCenterY, 'Weather bounds:', elementLeft, elementTop, elementRight, elementBottom);
        }
        
        // Apply glow immediately when touching
        applyGlow(t, isTouching);
      });
      glowTimer = requestAnimationFrame(check);
    };
    glowTimer = requestAnimationFrame(check);
  })();
  
  // Idle attract: gentle comet orbit after 10s idle
  (function setupIdleAttract() {
    let lastMoveTime = performance.now();
    let orbitCenterX = window.innerWidth / 2;
    let orbitCenterY = window.innerHeight / 2;
    let orbitRadius = 100;
    let orbitAngle = 0;
    let orbitSpeed = 0.015;
    let isOrbiting = false;
    
    const updateIdleAttract = () => {
      const now = performance.now();
      const timeSinceMove = now - lastMoveTime;
      
      if (timeSinceMove > 10000 && !isOrbiting && isActive) { // 10 seconds idle
        isOrbiting = true;
        orbitAngle = Math.atan2(cursorY - orbitCenterY, cursorX - orbitCenterX);
        console.log('Starting idle orbit');
      } else if (timeSinceMove < 10000 && isOrbiting) {
        isOrbiting = false;
        console.log('Stopping idle orbit');
      }
      
      if (isOrbiting && isActive) {
        orbitAngle += orbitSpeed;
        const targetX = orbitCenterX + Math.cos(orbitAngle) * orbitRadius;
        const targetY = orbitCenterY + Math.sin(orbitAngle) * orbitRadius;
        
        // Smoothly move cursor towards orbit
        mouseX += (targetX - mouseX) * 0.03;
        mouseY += (targetY - mouseY) * 0.03;
      }
      
      requestAnimationFrame(updateIdleAttract);
    };
    
    document.addEventListener('mousemove', () => {
      lastMoveTime = performance.now();
    }, { passive: true });
    
    updateIdleAttract();
  })();
  
  // Cursor gravity wells: subtle magnetic pull near interactive elements
  (function setupGravityWells() {
    const gravityElements = document.querySelectorAll('a, button, #search-bar, #task-input, #links-btn, #weather');
    let gravityTimer = null;
    
    const applyGravity = () => {
      if (!isActive) { gravityTimer = requestAnimationFrame(applyGravity); return; }
      
      let totalPullX = 0;
      let totalPullY = 0;
      
      gravityElements.forEach(el => {
        const r = el.getBoundingClientRect();
        const centerX = r.left + r.width / 2;
        const centerY = r.top + r.height / 2;
        const distance = Math.hypot(cursorX - centerX, cursorY - centerY);
        const maxDistance = Math.max(r.width, r.height) / 2 + 80;
        
        if (distance < maxDistance && distance > 0) {
          const pullStrength = (1 - distance / maxDistance) * 0.4; // stronger pull
          const pullX = (centerX - cursorX) * pullStrength;
          const pullY = (centerY - cursorY) * pullStrength;
          totalPullX += pullX;
          totalPullY += pullY;
        }
      });
      
      // Apply gravity pull to mouse position
      if (Math.abs(totalPullX) > 0.1 || Math.abs(totalPullY) > 0.1) {
        mouseX += totalPullX * 0.15;
        mouseY += totalPullY * 0.15;
      }
      
      gravityTimer = requestAnimationFrame(applyGravity);
    };
    
    gravityTimer = requestAnimationFrame(applyGravity);
  })();
  
  // Task zoom effect to show clickability (no scrollbar, no cutoff)
  (function setupTaskZoom() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    
    // Hide scrollbar and allow overflow for zoom
    taskList.style.overflow = 'visible';
    taskList.style.zIndex = '1000';
    
    taskList.addEventListener('mouseenter', (e) => {
      if (e.target.tagName === 'LI') {
        e.target.style.transition = 'transform 0.2s ease';
        e.target.style.transform = 'scale(1.05)';
        e.target.style.cursor = 'none';
        e.target.style.zIndex = '1001';
        e.target.style.position = 'relative';
      }
    }, true);
    
    taskList.addEventListener('mouseleave', (e) => {
      if (e.target.tagName === 'LI') {
        e.target.style.transform = 'scale(1)';
        e.target.style.zIndex = 'auto';
      }
    }, true);
  })();
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
