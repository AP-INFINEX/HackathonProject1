// ---------- 1. Config ----------
const UNSPLASH_KEY = CONFIG.UNSPLASH_KEY;
const WEATHER_KEY = CONFIG.WEATHER_KEY;

// ---------- 2. Background ----------
const body = document.body;

// Fallback is already set in CSS
async function setBackground() {
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=dark-landscape&orientation=landscape&client_id=${UNSPLASH_KEY}`
    );
    const data = await res.json();
    const img = new Image();
    img.src = data.urls.full;
    img.onload = () => {
      body.style.backgroundImage = `url(${data.urls.full})`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
    };
  } catch (err) {
    console.error('Error loading background:', err);
  }
}
setBackground();

// ---------- 3. Time & Date ----------
const timeEl = document.getElementById('time');
const dateEl = document.getElementById('date');
const greetingEl = document.getElementById('greeting');

function updateTime() {
  const now = new Date();
  timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  const hour = now.getHours();
  let greeting = 'Hello';
  if (hour < 12) greeting = 'Good Morning';
  else if (hour < 18) greeting = 'Good Afternoon';
  else greeting = 'Good Evening';
  greetingEl.textContent = `${greeting}, Anubhav!`;
}

updateTime();
setInterval(updateTime, 1000);

// ---------- 4. Weather ----------
const weatherTemp = document.getElementById('weather-temp');
const weatherCondition = document.getElementById('weather-condition');

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`
    );
    const data = await res.json();
    weatherTemp.textContent = `${Math.round(data.main.temp)}°C`;
    weatherCondition.textContent = data.weather[0].main;
  } catch (err) {
    console.error('Weather fetch error:', err);
    weatherTemp.textContent = '--°C';
    weatherCondition.textContent = 'N/A';
  }
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
    (err) => fetchWeather(13.0827, 80.2707) // fallback coordinates (Chennai)
  );
} else {
  fetchWeather(13.0827, 80.2707);
}

// ---------- 5. Quotes ----------
const quoteEl = document.getElementById('quote');
async function fetchQuote() {
  try {
    const res = await fetch('https://type.fit/api/quotes');
    const data = await res.json();
    const random = Math.floor(Math.random() * data.length);
    quoteEl.textContent = `"${data[random].text}"`;
  } catch {
    quoteEl.textContent = "Push yourself, because no one else will!";
  }
}
fetchQuote();

// ---------- 6. Tasks ----------
const taskInput = document.getElementById('task-input');
const taskList = document.getElementById('task-list');
const TASKS_KEY = 'customDashboardTasks';

let tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
function renderTasks() {
  taskList.innerHTML = '';
  tasks.forEach((t, i) => {
    const li = document.createElement('li');
    li.textContent = t;
    li.onclick = () => {
      tasks.splice(i, 1);
      localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
      renderTasks();
    };
    taskList.appendChild(li);
  });
}
renderTasks();

taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && taskInput.value.trim() !== '') {
    tasks.push(taskInput.value.trim());
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    taskInput.value = '';
    renderTasks();
  }
});

// ---------- 7. Links ----------
const linksBtn = document.getElementById('links-btn');
const linksDropdown = document.getElementById('links-dropdown');
const addLinkBtn = document.getElementById('add-link-btn');
const LINKS_KEY = 'customDashboardLinks';
const linksListContainer = linksDropdown ? linksDropdown.querySelector('.links-list') : null;
let links = JSON.parse(localStorage.getItem(LINKS_KEY) || '[]');

function saveLinks() {
  localStorage.setItem(LINKS_KEY, JSON.stringify(links));
}

function renderLinks() {
  if (!linksListContainer) return;
  linksListContainer.innerHTML = '';
  if (links.length === 0) {
    linksListContainer.innerHTML = '<div class="no-links" style="color:#ccc">No links saved.</div>';
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

// initial render
renderLinks();

// toggle dropdown
if (linksBtn && linksDropdown) {
  linksBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    linksDropdown.classList.toggle('show');
  });
}

// add link
if (addLinkBtn) {
  addLinkBtn.addEventListener('click', () => {
    const input = prompt('Enter URL to add (include http:// or https:// or just domain):');
    if (!input) return;
    let url = input.trim();
    // basic normalization
    try {
      // if invalid, try to prepend https://
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
      linksDropdown.classList.add('show');
    } else {
      alert('Link already saved');
    }
  });
}

// close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!linksDropdown) return;
  if (!linksDropdown.contains(e.target) && e.target !== linksBtn && e.target !== addLinkBtn) {
    linksDropdown.classList.remove('show');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // --- Search bar ---
  const searchBar = document.getElementById('search-bar');
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
});

