// Clean, robust dashboard script

// Config keys (from config.js)
// You can also set CONFIG.UNSPLASH_QUERY in config.js to change the background description.
const UNSPLASH_KEY = (typeof CONFIG !== 'undefined' && CONFIG.UNSPLASH_KEY) ? CONFIG.UNSPLASH_KEY : null;
const UNSPLASH_QUERY = (typeof CONFIG !== 'undefined' && CONFIG.UNSPLASH_QUERY) ? CONFIG.UNSPLASH_QUERY : 'dark blurry galaxy raindrops';
const WEATHER_KEY = (typeof CONFIG !== 'undefined' && CONFIG.WEATHER_KEY) ? CONFIG.WEATHER_KEY : null;

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Helpers ----------
  const byId = id => document.getElementById(id);

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
      greetingEl.textContent = `${greeting}, Anubhav!`;
    }
  }
  updateTime();
  setInterval(updateTime, 1000);

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
  const API_TYPEFIT = 'https://type.fit/api/quotes';
  const API_QUOTABLE = 'https://api.quotable.io/quotes?limit=150';
  const QUOTES_KEY = 'customDashboardQuotes';
  const QUOTES_TTL = 1000 * 60 * 60 * 24; // 24h

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

  // Try API sources (with timeout). If both API sources fail, use local quotes.json.
  async function fetchAndCacheQuotes() {
    // Attempt type.fit first
    console.info('[quotes] trying type.fit API...');
    let data = await tryFetchJSON(API_TYPEFIT, 7000);
    let normalized = normalizeArray(data);
    if (normalized && normalized.length) {
      try { localStorage.setItem(QUOTES_KEY, JSON.stringify({ ts: Date.now(), quotes: normalized, src: 'type.fit' })); } catch(_) {}
      window.__lastQuotesSource = 'type.fit';
      console.info('[quotes] loaded from type.fit (API).');
      return normalized;
    }
    console.warn('[quotes] type.fit failed or returned invalid data.');

    // Attempt quotable
    console.info('[quotes] trying Quotable API...');
    data = await tryFetchJSON(API_QUOTABLE, 7000);
    if (data && Array.isArray(data.results)) {
      normalized = normalizeArray(data.results.map(r => ({ text: r.content, author: r.author })));
      if (normalized && normalized.length) {
        try { localStorage.setItem(QUOTES_KEY, JSON.stringify({ ts: Date.now(), quotes: normalized, src: 'quotable' })); } catch(_) {}
        window.__lastQuotesSource = 'quotable';
        console.info('[quotes] loaded from Quotable (API).');
        return normalized;
      }
    }
    console.warn('[quotes] Quotable failed or returned invalid data.');

    // API attempts failed — try local JSON fallback
    console.info('[quotes] trying local quotes.json fallback...');
    const local = await tryFetchJSON(LOCAL_QUOTES_URL, 4000);
    const normLocal = normalizeArray(local);
    if (normLocal && normLocal.length) {
      window.__lastQuotesSource = 'local';
      console.info('[quotes] loaded from local quotes.json.');
      // Do not overwrite cache timestamp — treat local as last-resort source but still return it
      return normLocal;
    }

    console.warn('[quotes] no quotes available from APIs or local file.');
    return null;
  }

  function getCachedQuotes() {
    try {
      const raw = localStorage.getItem(QUOTES_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.quotes)) return null;
      if (Date.now() - (obj.ts || 0) > QUOTES_TTL) return null;
      // expose cached source as well
      window.__lastQuotesSource = obj.src || 'cache';
      return obj.quotes;
    } catch (_) { return null; }
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
    // show source if available
    const src = window.__lastQuotesSource || '';
    el.innerHTML = `<p class="quote-text">"${safeQ}"</p><p class="quote-author">${safeA ? '— ' + safeA : ''}</p>` +
                   (src ? `<div class="quote-source" style="font-size:12px;opacity:0.8;margin-top:6px;">(source: ${escapeHTML(src)})</div>` : '');
  }

  // Load quotes: prefer fresh API results; if APIs fail, use cache; if no cache, use local JSON; if all fails, show message.
  (async function loadQuotesRobust() {
    // Try APIs first
    const fresh = await fetchAndCacheQuotes();
    const cached = getCachedQuotes();
    const quotes = fresh || cached;
    if (!quotes || quotes.length === 0) {
      // nothing available
      renderQuote(null);
      console.warn('[quotes] No quotes to render.');
      return;
    }
    window.__dashboardQuotes = quotes;
    const chosen = pickRandom(quotes);
    renderQuote(chosen);
    console.info('[quotes] displayed one quote. Source:', window.__lastQuotesSource || 'unknown');
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
  renderLinks();

  if (linksBtn && linksDropdown) {
    linksBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      linksDropdown.classList.toggle('show');
    });
  }

  if (addLinkBtn) {
    addLinkBtn.addEventListener('click', () => {
      const input = prompt('Enter URL to add (you may omit https://)');
      if (!input) return;
      let url = input.trim();
      try {
        new URL(url);
      } catch (_) {
        try {
          url = 'https://' + url;
          new URL(url);
        } catch (err) {
          alert('Invalid URL');
          return;
        }
      }
      if (!links.includes(url)) {
        links.push(url);
        saveLinks();
        renderLinks();
        if (linksDropdown) linksDropdown.classList.add('show');
      } else {
        alert('Link already saved');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!linksDropdown) return;
    if (!linksDropdown.contains(e.target) && e.target !== linksBtn && e.target !== addLinkBtn) {
      linksDropdown.classList.remove('show');
    }
  });

  // ---------- Search ----------
  const searchBar = byId('search-bar');
  if (searchBar) {
    searchBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = searchBar.value.trim();
        if (!q) return;
        const query = encodeURIComponent(q);
        window.open(`https://www.google.com/search?q=${query}`, '_blank');
        searchBar.value = '';
      }
    });
  }

}); // DOMContentLoaded end
