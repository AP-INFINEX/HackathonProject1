// ---------- 1. Unsplash Background ----------
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY; // your Unsplash API key
const body = document.body;

async function setBackground() {
  try {
    const res = await fetch(`https://api.unsplash.com/photos/random?query=nature&orientation=landscape&client_id=${UNSPLASH_KEY}`);
    const data = await res.json();
    body.style.backgroundImage = `url(${data.urls.full})`;
    body.style.backgroundSize = 'cover';
    body.style.backgroundPosition = 'center';
  } catch (err) {
    console.error('Error loading background:', err);
  }
}
setBackground();

// ---------- 2. Weather API ----------
const WEATHER_KEY = import.meta.env.VITE_WEATHER_KEY; // your OpenWeatherMap API key
const weatherLocation = document.getElementById('weather-location');
const weatherTemp = document.getElementById('weather-temp');
const weatherCondition = document.getElementById('weather-condition');

async function fetchWeather(city = "Hyderabad") {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_KEY}&units=metric`);
    const data = await res.json();
    weatherLocation.textContent = data.name;
    weatherTemp.textContent = `${Math.round(data.main.temp)}°C`;
    weatherCondition.textContent = data.weather[0].description;
  } catch (err) {
    console.error('Error fetching weather:', err);
    weatherLocation.textContent = "N/A";
    weatherTemp.textContent = "--°C";
    weatherCondition.textContent = "Unavailable";
  }
}
fetchWeather();

// ---------- 3. Motivational Quotes ----------
const quoteEl = document.getElementById('quote');

async function fetchQuote() {
  try {
    const res = await fetch('https://type.fit/api/quotes');
    const data = await res.json();
    const random = Math.floor(Math.random() * data.length);
    quoteEl.textContent = `"${data[random].text}"`;
  } catch (err) {
    console.error('Error fetching quote:', err);
    quoteEl.textContent = "Push yourself, because no one else will!";
  }
}
fetchQuote();

// ---------- 4. Greeting ----------
const greetingEl = document.getElementById('greeting');
const hour = new Date().getHours();
let greetText = "Hello";

if(hour < 12) greetText = "Good Morning";
else if(hour < 18) greetText = "Good Afternoon";
else greetText = "Good Evening";

greetingEl.textContent = `${greetText}, Prasant`;

// ---------- 5. Tasks Input & LocalStorage ----------
const taskInput = document.getElementById('task-input');
const TASKS_KEY = 'customDashboardTasks';

// Load tasks from localStorage
let tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];

taskInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && taskInput.value.trim() !== '') {
    tasks.push(taskInput.value.trim());
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    taskInput.value = '';
    console.log('Tasks:', tasks); // Later you can display them in a list
  }
});
