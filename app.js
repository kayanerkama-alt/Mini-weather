/**
 * Mini Weather — Production-Ready Weather App
 * APIs: WeatherAPI.com (primary), Open-Meteo, NWS, wttr.in
 * Features: Virtual Garden, 80+ Themes, Device Detection, PWA, Notifications
 */

'use strict';

/* ============================================================
   SERVICE WORKER REGISTRATION
   ============================================================ */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ============================================================
   DEVICE DETECTION
   ============================================================ */
const Device = {
    type: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    hasTouch: false,
    isLandscape: false,

    detect() {
        const w = window.innerWidth;
        this.hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.isLandscape = window.innerWidth > window.innerHeight;

        if (w < 768 || (this.hasTouch && w < 1024)) {
            this.type = w < 481 ? 'mobile' : 'tablet';
            this.isMobile = w < 481;
            this.isTablet = w >= 481 && w < 1024;
            this.isDesktop = false;
        } else {
            this.type = 'desktop';
            this.isMobile = false;
            this.isTablet = false;
            this.isDesktop = true;
        }

        localStorage.setItem('mini-weather-device', this.type);
        document.body.setAttribute('data-device', this.type);

        const badge = document.getElementById('device-badge');
        if (badge) {
            const icons = { mobile: '📱', tablet: '📟', desktop: '🖥️' };
            badge.textContent = `${icons[this.type] || '💻'} ${this.type}`;
        }

        return this.type;
    }
};

Device.detect();
window.addEventListener('resize', () => Device.detect(), { passive: true });

/* ============================================================
   NOTIFICATION MANAGER
   ============================================================ */
class NotificationManager {
    constructor() {
        this.supported = 'Notification' in window;
        this.enabled = localStorage.getItem('mini-weather-notifications') === 'true';
    }

    async requestPermission() {
        if (!this.supported) return false;
        if (Notification.permission === 'granted') {
            this.enabled = true;
            localStorage.setItem('mini-weather-notifications', 'true');
            return true;
        }
        if (Notification.permission !== 'denied') {
            const perm = await Notification.requestPermission();
            this.enabled = perm === 'granted';
            localStorage.setItem('mini-weather-notifications', this.enabled ? 'true' : 'false');
            return this.enabled;
        }
        return false;
    }

    send(title, options = {}) {
        if (!this.enabled || !this.supported) return;
        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, options });
            } else {
                new Notification(title, options);
            }
        } catch (e) { /* silent */ }
    }
}

const notifications = new NotificationManager();

/* ============================================================
   TOAST
   ============================================================ */
function showToast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ============================================================
   THEME SYSTEM
   ============================================================ */
const THEMES = {
    // Core
    dark:              { label: 'Dark',            bg: '#0a0a0a', accent: '#1e88e5' },
    light:             { label: 'Light',           bg: '#f5f7fa', accent: '#1565c0' },
    // Nature
    ocean:             { label: 'Ocean',           bg: '#0d1b2a', accent: '#00b4d8' },
    forest:            { label: 'Forest',          bg: '#0a1a0a', accent: '#4caf50' },
    jungle:            { label: 'Jungle',          bg: '#081208', accent: '#388e3c' },
    desert:            { label: 'Desert',          bg: '#1a1208', accent: '#e65100' },
    glacier:           { label: 'Glacier',         bg: '#0a1520', accent: '#00b0ff' },
    aurora:            { label: 'Aurora',          bg: '#050f1a', accent: '#00e5ff' },
    // Warm
    sunset:            { label: 'Sunset',          bg: '#1a0a00', accent: '#ff6b35' },
    warm:              { label: 'Warm',            bg: '#1a1208', accent: '#ff8f00' },
    amber:             { label: 'Amber',           bg: '#1a1200', accent: '#ffc107' },
    retro:             { label: 'Retro',           bg: '#1a1000', accent: '#ff8800' },
    solstice:          { label: 'Solstice',        bg: '#1a0a00', accent: '#ff6f00' },
    flame:             { label: 'Flame',           bg: '#100500', accent: '#ff3d00' },
    coral:             { label: 'Coral',           bg: '#1a0a08', accent: '#ff5722' },
    // Cool
    cool:              { label: 'Cool',            bg: '#0a1020', accent: '#4488ff' },
    nord:              { label: 'Nord',            bg: '#2e3440', accent: '#88c0d0' },
    solarized:         { label: 'Solarized',       bg: '#002b36', accent: '#268bd2' },
    slate:             { label: 'Slate',           bg: '#1a1f2e', accent: '#7c9ef8' },
    midnight:          { label: 'Midnight',        bg: '#020408', accent: '#3a6fd8' },
    storm:             { label: 'Storm',           bg: '#0a0c10', accent: '#546e7a' },
    // Purple/Pink
    lavender:          { label: 'Lavender',        bg: '#1a1025', accent: '#9c27b0' },
    berry:             { label: 'Berry',           bg: '#1a0a15', accent: '#e91e63' },
    dracula:           { label: 'Dracula',         bg: '#282a36', accent: '#bd93f9' },
    eclipse:           { label: 'Eclipse',         bg: '#0a0510', accent: '#7c4dff' },
    nebula:            { label: 'Nebula',          bg: '#080510', accent: '#aa00ff' },
    twilight:          { label: 'Twilight',        bg: '#0f0a1a', accent: '#7e57c2' },
    mystic:            { label: 'Mystic',          bg: '#080510', accent: '#6a1b9a' },
    amethyst:          { label: 'Amethyst',        bg: '#0f0818', accent: '#9c27b0' },
    rose:              { label: 'Rose',            bg: '#1a0810', accent: '#f06292' },
    // Green
    mint:              { label: 'Mint',            bg: '#0a1a15', accent: '#00bfa5' },
    emerald:           { label: 'Emerald',         bg: '#051a10', accent: '#00c853' },
    jade:              { label: 'Jade',            bg: '#081510', accent: '#00897b' },
    topaz:             { label: 'Topaz',           bg: '#0a1510', accent: '#26a69a' },
    // Special
    cyberpunk:         { label: 'Cyberpunk',       bg: '#0a0015', accent: '#ff0080' },
    neon:              { label: 'Neon',            bg: '#050510', accent: '#00ff88' },
    gruvbox:           { label: 'Gruvbox',         bg: '#282828', accent: '#d79921' },
    monochrome:        { label: 'Mono',            bg: '#000000', accent: '#ffffff' },
    obsidian:          { label: 'Obsidian',        bg: '#050505', accent: '#424242' },
    shadow:            { label: 'Shadow',          bg: '#080808', accent: '#808080' },
    // Light themes
    pastel:            { label: 'Pastel',          bg: '#fef9ff', accent: '#c084fc' },
    ice:               { label: 'Ice',             bg: '#f0f8ff', accent: '#0288d1' },
    pearl:             { label: 'Pearl',           bg: '#f8f8ff', accent: '#7986cb' },
    ethereal:          { label: 'Ethereal',        bg: '#f8f0ff', accent: '#ab47bc' },
    radiant:           { label: 'Radiant',         bg: '#fff8e8', accent: '#f57f17' },
    // Gems
    ruby:              { label: 'Ruby',            bg: '#1a0505', accent: '#c62828' },
    sapphire:          { label: 'Sapphire',        bg: '#050a1a', accent: '#1565c0' },
    bronze:            { label: 'Bronze',          bg: '#150e05', accent: '#a0522d' },
    silver:            { label: 'Silver',          bg: '#1a1a1e', accent: '#9e9e9e' },
    gold:              { label: 'Gold',            bg: '#120e00', accent: '#ffd600' },
    copper:            { label: 'Copper',          bg: '#120a05', accent: '#bf6030' },
    platinum:          { label: 'Platinum',        bg: '#f0f2f5', accent: '#607d8b' },
    coffee:            { label: 'Coffee',          bg: '#1a1008', accent: '#8d6e63' },
    cherry:            { label: 'Cherry',          bg: '#1a0a15', accent: '#e91e63' },
    // New themes from requirements
    'ocean-deep':      { label: 'Ocean Deep',      bg: '#020d1a', accent: '#0066cc' },
    'sunset-warm':     { label: 'Sunset Warm',     bg: '#1a0800', accent: '#ff6600' },
    'forest-dark':     { label: 'Forest Dark',     bg: '#050f05', accent: '#2e7d32' },
    'aurora-borealis': { label: 'Aurora Borealis', bg: '#020810', accent: '#00e5cc' },
    'midnight-blue':   { label: 'Midnight Blue',   bg: '#010308', accent: '#1a3a8a' },
    'cherry-blossom':  { label: 'Cherry Blossom',  bg: '#fff0f5', accent: '#e91e8c' },
    'desert-sand':     { label: 'Desert Sand',     bg: '#1e1808', accent: '#d4a017' },
    'glacier-ice':     { label: 'Glacier Ice',     bg: '#e8f4ff', accent: '#0277bd' },
    'storm-dark':      { label: 'Storm Dark',      bg: '#050608', accent: '#37474f' },
    'flame-fire':      { label: 'Flame Fire',      bg: '#0f0300', accent: '#ff1a00' },
    'twilight-purple': { label: 'Twilight Purple', bg: '#0c0818', accent: '#673ab7' },
    'mystic-dark':     { label: 'Mystic Dark',     bg: '#060408', accent: '#4a148c' },
    'jade-green':      { label: 'Jade Green',      bg: '#041008', accent: '#00695c' },
    'bronze-gold':     { label: 'Bronze Gold',     bg: '#100a02', accent: '#b8860b' },
    'silver-white':    { label: 'Silver White',    bg: '#f8f8fa', accent: '#8888b0' },
    'platinum-light':  { label: 'Platinum Light',  bg: '#f4f6f8', accent: '#5c6bc0' },
    'ruby-red':        { label: 'Ruby Red',        bg: '#120303', accent: '#b71c1c' },
    'sapphire-blue':   { label: 'Sapphire Blue',   bg: '#020510', accent: '#1a237e' },
    'emerald-green':   { label: 'Emerald Green',   bg: '#021008', accent: '#1b5e20' },
    'amethyst-purple': { label: 'Amethyst Purple', bg: '#0a0515', accent: '#7b1fa2' },
    'coral-pink':      { label: 'Coral Pink',      bg: '#1a0808', accent: '#ff4081' },
    'teal-cyan':       { label: 'Teal Cyan',       bg: '#041418', accent: '#00838f' },
    'indigo-dark':     { label: 'Indigo Dark',     bg: '#060818', accent: '#283593' },
    'rose-pink':       { label: 'Rose Pink',       bg: '#180810', accent: '#e91e63' },
    'gold-warm':       { label: 'Gold Warm',       bg: '#100c00', accent: '#f9a825' },
    'copper-brown':    { label: 'Copper Brown',    bg: '#100805', accent: '#bf5a30' },
    'slate-gray':      { label: 'Slate Gray',      bg: '#141820', accent: '#607d8b' },
    'charcoal-dark':   { label: 'Charcoal Dark',   bg: '#0c0c0c', accent: '#616161' },
    'cream-light':     { label: 'Cream Light',     bg: '#fdf8f0', accent: '#8d6e63' },
    'mint-fresh':      { label: 'Mint Fresh',      bg: '#f0fff8', accent: '#00c853' },
};

let currentTheme = localStorage.getItem('mini-weather-theme') || 'dark';

function initThemes() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = '';

    Object.entries(THEMES).forEach(([key, theme]) => {
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch' + (key === currentTheme ? ' active' : '');
        swatch.title = theme.label;
        swatch.setAttribute('aria-label', theme.label);
        swatch.style.cssText = `background: linear-gradient(135deg, ${theme.bg} 50%, ${theme.accent} 100%);`;
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            applyTheme(key);
            document.getElementById('theme-dropdown').classList.remove('active');
        });
        grid.appendChild(swatch);
    });
}

function applyTheme(key) {
    if (!THEMES[key]) key = 'dark';
    document.body.setAttribute('data-theme', key);
    currentTheme = key;
    localStorage.setItem('mini-weather-theme', key);

    // Update active swatch
    document.querySelectorAll('.theme-swatch').forEach((s, i) => {
        s.classList.toggle('active', Object.keys(THEMES)[i] === key);
    });

    showToast(`Theme: ${THEMES[key]?.label || key}`);
}

// Theme toggle button
document.getElementById('theme-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('theme-dropdown').classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.theme-wrapper')) {
        document.getElementById('theme-dropdown').classList.remove('active');
    }
});

/* ============================================================
   WEATHER UTILITIES
   ============================================================ */
function getWeatherIcon(code, isDay = true) {
    if (code === 0) return isDay ? '☀️' : '🌙';
    if (code === 1) return isDay ? '🌤️' : '🌤️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code === 51 || code === 53 || code === 55) return '🌦️';
    if (code === 56 || code === 57) return '🌨️';
    if (code === 61 || code === 63 || code === 65) return '🌧️';
    if (code === 66 || code === 67) return '🌨️';
    if (code === 71 || code === 73 || code === 75 || code === 77) return '❄️';
    if (code === 80 || code === 81 || code === 82) return '⛈️';
    if (code === 85 || code === 86) return '🌨️';
    if (code === 95) return '⛈️';
    if (code === 96 || code === 99) return '⛈️';
    return '🌡️';
}

function getWeatherDescription(code) {
    const map = {
        0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Rime Fog',
        51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
        56: 'Freezing Drizzle', 57: 'Heavy Freezing Drizzle',
        61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
        66: 'Freezing Rain', 67: 'Heavy Freezing Rain',
        71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow', 77: 'Snow Grains',
        80: 'Rain Showers', 81: 'Heavy Showers', 82: 'Violent Showers',
        85: 'Snow Showers', 86: 'Heavy Snow Showers',
        95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Severe Thunderstorm'
    };
    return map[code] || 'Unknown';
}

function getWindDirection(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16] || '—';
}

function getUVLabel(uv) {
    if (uv < 3) return 'Low';
    if (uv < 6) return 'Moderate';
    if (uv < 8) return 'High';
    if (uv < 11) return 'Very High';
    return 'Extreme';
}

function getPressureLabel(hpa) {
    if (hpa > 1022) return 'High (Clear)';
    if (hpa < 1000) return 'Low (Stormy)';
    return 'Normal';
}

function getHumidityLabel(h) {
    if (h < 30) return 'Dry';
    if (h < 60) return 'Comfortable';
    if (h < 80) return 'Humid';
    return 'Very Humid';
}

/* ============================================================
   VIRTUAL GARDEN
   ============================================================ */
const Garden = {
    KEY_PLANT: 'mini-weather-garden-plant',
    KEY_STREAK: 'mini-weather-garden-streak',
    KEY_LAST: 'mini-weather-garden-last',
    KEY_MONTH: 'mini-weather-garden-month',
    KEY_BORN: 'mini-weather-garden-born',

    init() {
        // Monthly reset on 1st of month
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
        const savedMonth = localStorage.getItem(this.KEY_MONTH);

        if (savedMonth !== monthKey) {
            // New month — reset garden
            localStorage.setItem(this.KEY_MONTH, monthKey);
            localStorage.setItem(this.KEY_STREAK, '0');
            localStorage.setItem(this.KEY_BORN, now.toISOString());
            localStorage.removeItem(this.KEY_LAST);
        }

        // Ensure born date exists
        if (!localStorage.getItem(this.KEY_BORN)) {
            localStorage.setItem(this.KEY_BORN, now.toISOString());
        }
    },

    getStreak() {
        return parseInt(localStorage.getItem(this.KEY_STREAK) || '0', 10);
    },

    getDaysAlive() {
        const born = localStorage.getItem(this.KEY_BORN);
        if (!born) return 0;
        const diff = Date.now() - new Date(born).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    },

    updateStreak() {
        const today = new Date().toDateString();
        const last = localStorage.getItem(this.KEY_LAST);
        if (last !== today) {
            const streak = this.getStreak() + 1;
            localStorage.setItem(this.KEY_STREAK, String(streak));
            localStorage.setItem(this.KEY_LAST, today);
        }
    },

    getGrowthStage(daysAlive) {
        if (daysAlive < 3) return { size: 'small', label: 'Seedling' };
        if (daysAlive < 7) return { size: 'medium', label: 'Sprout' };
        if (daysAlive < 14) return { size: 'large', label: 'Growing' };
        if (daysAlive < 21) return { size: 'xlarge', label: 'Mature' };
        return { size: 'xlarge', label: 'Ancient' };
    },

    getPlantEmoji(temp, state) {
        // Temperature-based emoji
        if (temp <= 0) return '❄️';
        if (temp <= 8) return '🌿';
        if (temp <= 15) return '🌱';
        if (temp <= 25) {
            if (state === 'thriving') return '🌻';
            if (state === 'healthy') return '🌿';
            if (state === 'stressed') return '🌾';
            return '🍂';
        }
        if (temp <= 32) return '🌻';
        return '🔥';
    },

    getState(temp, humidity, windSpeed, precipitation, uvIndex) {
        let score = 0;
        const details = [];

        // Temperature (25 pts)
        if (temp >= 15 && temp <= 25) { score += 25; details.push('✅ Perfect temperature'); }
        else if (temp >= 8 && temp <= 32) { score += 15; details.push('⚠️ Acceptable temperature'); }
        else { score += 3; details.push('❌ Extreme temperature'); }

        // Humidity (25 pts)
        if (humidity >= 40 && humidity <= 70) { score += 25; details.push('✅ Ideal humidity'); }
        else if (humidity >= 25 && humidity <= 85) { score += 14; details.push('⚠️ Acceptable humidity'); }
        else { score += 3; details.push('❌ Poor humidity'); }

        // Wind (20 pts)
        if (windSpeed < 15) { score += 20; details.push('✅ Calm winds'); }
        else if (windSpeed < 35) { score += 10; details.push('⚠️ Breezy'); }
        else { score += 2; details.push('❌ Strong winds'); }

        // Precipitation (15 pts)
        if (precipitation === 0) { score += 15; details.push('✅ No precipitation'); }
        else if (precipitation < 5) { score += 12; details.push('✅ Light rain'); }
        else if (precipitation < 20) { score += 6; details.push('⚠️ Heavy rain'); }
        else { score += 1; details.push('❌ Extreme rain'); }

        // UV (15 pts)
        if (uvIndex <= 3) { score += 15; details.push('✅ Safe UV'); }
        else if (uvIndex <= 6) { score += 10; details.push('⚠️ Moderate UV'); }
        else if (uvIndex <= 9) { score += 5; details.push('⚠️ High UV'); }
        else { score += 2; details.push('❌ Extreme UV'); }

        if (score >= 88) return { state: 'thriving', text: 'THRIVING', score, details };
        if (score >= 68) return { state: 'healthy',  text: 'HEALTHY',  score, details };
        if (score >= 45) return { state: 'stressed', text: 'STRESSED', score, details };
        return { state: 'wilted', text: 'WILTED', score, details };
    },

    render(weatherData) {
        if (!weatherData) return;

        this.init();
        this.updateStreak();

        const { temp, humidity, windSpeed, precipitation, uvIndex } = weatherData;
        const gardenState = this.getState(temp, humidity, windSpeed, precipitation, uvIndex);
        const daysAlive = this.getDaysAlive();
        const streak = this.getStreak();
        const growth = this.getGrowthStage(daysAlive);
        const emoji = this.getPlantEmoji(temp, gardenState.state);

        // Decorative plants
        const decos = ['🌿', '🍀', '🌸', '🌺', '🌼'];
        const deco1 = decos[daysAlive % decos.length];
        const deco2 = decos[(daysAlive + 2) % decos.length];

        const statusClass = `status-${gardenState.state}`;

        const html = `
            <div class="garden-header">
                <div class="garden-title">🌱 Virtual Garden</div>
                <div class="garden-streak">🔥 ${streak} day streak</div>
            </div>

            <div class="garden-scene">
                <div class="garden-deco">${deco1}</div>
                <div class="garden-plant ${gardenState.state} ${growth.size}" id="garden-plant">${emoji}</div>
                <div class="garden-deco">${deco2}</div>
                <div class="garden-ground"></div>
            </div>

            <div style="text-align:center; margin-top: 10px;">
                <span class="garden-status-badge ${statusClass}">
                    ${emoji} ${gardenState.text} — ${growth.label}
                </span>
            </div>

            <div class="garden-info">
                <div class="garden-stat">
                    <div class="garden-stat-label">🌱 Days Alive</div>
                    <div class="garden-stat-value">${daysAlive}</div>
                </div>
                <div class="garden-stat">
                    <div class="garden-stat-label">💚 Health Score</div>
                    <div class="garden-stat-value">${gardenState.score}/100</div>
                </div>
                <div class="garden-stat">
                    <div class="garden-stat-label">📈 Growth Stage</div>
                    <div class="garden-stat-value">${growth.label}</div>
                </div>
                <div class="garden-stat">
                    <div class="garden-stat-label">🌡️ Temp Effect</div>
                    <div class="garden-stat-value">${temp <= 0 ? '❄️ Frozen' : temp <= 15 ? '🌿 Cool' : temp <= 28 ? '🌻 Ideal' : '🔥 Hot'}</div>
                </div>
            </div>

            <div class="garden-conditions">
                ${gardenState.details.map(d => `<div class="garden-condition-item">${d}</div>`).join('')}
            </div>
        `;

        const card = document.getElementById('garden-card');
        if (card) card.innerHTML = html;
    }
};

/* ============================================================
   TEMPERATURE / UNIT CONVERSION
   ============================================================ */
let unit = localStorage.getItem('mini-weather-unit') || 'C';

function toDisplay(tempC) {
    if (unit === 'F') return Math.round((tempC * 9 / 5) + 32);
    return Math.round(tempC);
}

function windDisplay(kmh) {
    if (unit === 'F') return (Math.round(kmh * 0.621371 * 10) / 10);
    return Math.round(kmh * 10) / 10;
}

function windUnit() { return unit === 'F' ? 'mph' : 'km/h'; }

/* ============================================================
   LOCATION NAME (Nominatim)
   ============================================================ */
async function getLocationName(lat, lon) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
            { signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) throw new Error('Nominatim error');
        const data = await res.json();
        const a = data.address || {};
        const parts = [];
        if (a.city) parts.push(a.city);
        else if (a.town) parts.push(a.town);
        else if (a.village) parts.push(a.village);
        else if (a.county) parts.push(a.county);
        if (a.state && a.state !== parts[0]) parts.push(a.state);
        if (a.country) parts.push(a.country);
        return parts.join(', ') || 'Your Location';
    } catch {
        return `${parseFloat(lat).toFixed(2)}°, ${parseFloat(lon).toFixed(2)}°`;
    }
}

/* ============================================================
   API: WeatherAPI.com (PRIMARY)
   ============================================================ */
const WEATHERAPI_KEY = 'd2cbbf50a55542749d8151557260406';

async function fetchWeatherAPI(lat, lon) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=14&aqi=no&alerts=yes`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`WeatherAPI HTTP ${res.status}`);
    const d = await res.json();
    return normalizeWeatherAPI(d);
}

function normalizeWeatherAPI(d) {
    const c = d.current;
    const loc = d.location;

    // Build hourly from all forecast days
    const hourly = [];
    d.forecast.forecastday.forEach(day => {
        day.hour.forEach(h => {
            hourly.push({
                time: h.time,
                temp: h.temp_c,
                code: mapWeatherAPICode(h.condition.code, h.is_day),
                precipitation: h.chance_of_rain || 0,
                wind: h.wind_kph,
                humidity: h.humidity,
                feelsLike: h.feelslike_c,
                dewPoint: h.dewpoint_c,
                uvIndex: h.uv,
                cloudCover: h.cloud,
                pressure: h.pressure_mb,
                visibility: h.vis_km
            });
        });
    });

    // Daily
    const daily = d.forecast.forecastday.map(day => ({
        date: day.date,
        code: mapWeatherAPICode(day.day.condition.code, 1),
        maxTemp: day.day.maxtemp_c,
        minTemp: day.day.mintemp_c,
        precipitation: day.day.totalprecip_mm || 0,
        precipChance: day.day.daily_chance_of_rain || 0,
        wind: day.day.maxwind_kph,
        uvIndex: day.day.uv,
        sunrise: day.astro.sunrise,
        sunset: day.astro.sunset,
        cloudCover: day.day.avghumidity,
        condition: day.day.condition.text
    }));

    return {
        source: 'WeatherAPI',
        location: { latitude: loc.lat, longitude: loc.lon, timezone: loc.tz_id, name: loc.name, region: loc.region, country: loc.country },
        current: {
            temp: c.temp_c,
            code: mapWeatherAPICode(c.condition.code, c.is_day),
            description: c.condition.text,
            icon: c.is_day ? getWeatherIcon(mapWeatherAPICode(c.condition.code, 1), true) : getWeatherIcon(mapWeatherAPICode(c.condition.code, 0), false),
            humidity: c.humidity,
            windSpeed: c.wind_kph,
            windGusts: c.gust_kph,
            windDir: c.wind_degree,
            feelsLike: c.feelslike_c,
            pressure: c.pressure_mb,
            visibility: c.vis_km,
            uvIndex: c.uv,
            cloudCover: c.cloud,
            precipitation: c.precip_mm || 0,
            dewPoint: c.dewpoint_c || (c.temp_c - ((100 - c.humidity) / 5)),
            isDay: c.is_day === 1
        },
        hourly: hourly.slice(0, 48),
        daily
    };
}

// Map WeatherAPI condition codes to WMO-like codes for icon lookup
function mapWeatherAPICode(code, isDay) {
    if (code === 1000) return isDay ? 0 : 0;
    if ([1003].includes(code)) return 1;
    if ([1006].includes(code)) return 2;
    if ([1009].includes(code)) return 3;
    if ([1030, 1135, 1147].includes(code)) return 45;
    if ([1063, 1180, 1183].includes(code)) return 61;
    if ([1186, 1189].includes(code)) return 63;
    if ([1192, 1195].includes(code)) return 65;
    if ([1066, 1210, 1213].includes(code)) return 71;
    if ([1216, 1219].includes(code)) return 73;
    if ([1222, 1225].includes(code)) return 75;
    if ([1069, 1204, 1207].includes(code)) return 77;
    if ([1072, 1150, 1153].includes(code)) return 51;
    if ([1168, 1171].includes(code)) return 56;
    if ([1198, 1201].includes(code)) return 66;
    if ([1240, 1243].includes(code)) return 80;
    if ([1246].includes(code)) return 82;
    if ([1255, 1258].includes(code)) return 85;
    if ([1273, 1276].includes(code)) return 95;
    if ([1279, 1282].includes(code)) return 99;
    return 0;
}

/* ============================================================
   API: Open-Meteo (FALLBACK 1)
   ============================================================ */
async function fetchOpenMeteo(lat, lon) {
    const params = new URLSearchParams({
        latitude: parseFloat(lat).toFixed(4),
        longitude: parseFloat(lon).toFixed(4),
        current: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature,pressure_msl,visibility,uv_index,precipitation,cloud_cover,dew_point_2m',
        hourly: 'temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,dew_point_2m,uv_index,cloud_cover,pressure_msl',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,cloud_cover_max',
        timezone: 'auto',
        forecast_days: '14'
    });

    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const d = await res.json();
    return normalizeOpenMeteo(d);
}

function normalizeOpenMeteo(d) {
    const c = d.current;
    const h = d.hourly;
    const day = d.daily;

    return {
        source: 'Open-Meteo',
        location: { latitude: d.latitude, longitude: d.longitude, timezone: d.timezone },
        current: {
            temp: c.temperature_2m,
            code: c.weather_code,
            description: getWeatherDescription(c.weather_code),
            icon: getWeatherIcon(c.weather_code, true),
            humidity: c.relative_humidity_2m,
            windSpeed: c.wind_speed_10m,
            windGusts: c.wind_gusts_10m || 0,
            windDir: c.wind_direction_10m || 0,
            feelsLike: c.apparent_temperature,
            pressure: c.pressure_msl,
            visibility: (c.visibility || 0) / 1000,
            uvIndex: c.uv_index || 0,
            cloudCover: c.cloud_cover || 0,
            precipitation: c.precipitation || 0,
            dewPoint: c.dew_point_2m || 0,
            isDay: true
        },
        hourly: h.time.slice(0, 48).map((time, i) => ({
            time,
            temp: h.temperature_2m[i],
            code: h.weather_code[i],
            precipitation: h.precipitation_probability[i] || 0,
            wind: h.wind_speed_10m[i],
            humidity: h.relative_humidity_2m[i],
            dewPoint: h.dew_point_2m ? h.dew_point_2m[i] : 0,
            uvIndex: h.uv_index ? h.uv_index[i] : 0,
            cloudCover: h.cloud_cover ? h.cloud_cover[i] : 0,
            pressure: h.pressure_msl ? h.pressure_msl[i] : 1013
        })),
        daily: day.time.map((date, i) => ({
            date,
            code: day.weather_code[i],
            maxTemp: day.temperature_2m_max[i],
            minTemp: day.temperature_2m_min[i],
            precipitation: day.precipitation_sum[i] || 0,
            precipChance: day.precipitation_probability_max[i] || 0,
            wind: day.wind_speed_10m_max[i],
            uvIndex: day.uv_index_max[i] || 0,
            sunrise: day.sunrise[i],
            sunset: day.sunset[i],
            cloudCover: day.cloud_cover_max ? day.cloud_cover_max[i] : 0,
            condition: getWeatherDescription(day.weather_code[i])
        }))
    };
}

/* ============================================================
   API: NWS (FALLBACK 2 — US only)
   ============================================================ */
async function fetchNWS(lat, lon) {
    const gridRes = await fetch(`https://api.weather.gov/points/${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`, {
        signal: AbortSignal.timeout(8000)
    });
    if (!gridRes.ok) throw new Error('NWS: Not in US coverage area');
    const gridData = await gridRes.json();

    const forecastRes = await fetch(gridData.properties.forecast, { signal: AbortSignal.timeout(8000) });
    if (!forecastRes.ok) throw new Error('NWS: Forecast unavailable');
    const forecastData = await forecastRes.json();

    return normalizeNWS(forecastData, lat, lon);
}

function normalizeNWS(d, lat, lon) {
    const periods = d.properties.periods;
    const current = periods[0];
    const tempC = current.temperatureUnit === 'F'
        ? (current.temperature - 32) * 5 / 9
        : current.temperature;

    return {
        source: 'NWS',
        location: { latitude: lat, longitude: lon, timezone: 'US' },
        current: {
            temp: tempC,
            code: 0,
            description: current.shortForecast,
            icon: getWeatherIcon(0, current.isDaytime),
            humidity: 55,
            windSpeed: parseInt(current.windSpeed) || 0,
            windGusts: 0,
            windDir: 0,
            feelsLike: tempC,
            pressure: 1013,
            visibility: 10,
            uvIndex: 4,
            cloudCover: 50,
            precipitation: 0,
            dewPoint: tempC - 5,
            isDay: current.isDaytime
        },
        hourly: [],
        daily: periods.filter((_, i) => i % 2 === 0).slice(0, 7).map(p => {
            const tC = p.temperatureUnit === 'F' ? (p.temperature - 32) * 5 / 9 : p.temperature;
            return {
                date: p.startTime.split('T')[0],
                code: 0,
                maxTemp: tC,
                minTemp: tC - 5,
                precipitation: 0,
                precipChance: parseInt(p.probabilityOfPrecipitation?.value) || 0,
                wind: parseInt(p.windSpeed) || 0,
                uvIndex: 4,
                sunrise: '06:00',
                sunset: '18:30',
                cloudCover: 50,
                condition: p.shortForecast
            };
        })
    };
}

/* ============================================================
   API: wttr.in (FALLBACK 3)
   ============================================================ */
async function fetchWttr(lat, lon) {
    const res = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, {
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error('wttr.in unavailable');
    const d = await res.json();
    return normalizeWttr(d);
}

function normalizeWttr(d) {
    const c = d.current_condition[0];
    const forecast = d.weather[0];
    const tempC = parseFloat(c.temp_C);

    return {
        source: 'wttr.in',
        location: {
            latitude: parseFloat(d.nearest_area[0].latitude),
            longitude: parseFloat(d.nearest_area[0].longitude),
            timezone: 'UTC'
        },
        current: {
            temp: tempC,
            code: 0,
            description: c.weatherDesc[0].value,
            icon: getWeatherIcon(0, true),
            humidity: parseInt(c.humidity),
            windSpeed: parseFloat(c.windspeedKmph),
            windGusts: parseFloat(c.WindGustKmph) || 0,
            windDir: parseInt(c.winddirDegree) || 0,
            feelsLike: parseFloat(c.FeelsLikeC),
            pressure: parseFloat(c.pressure),
            visibility: parseFloat(c.visibility),
            uvIndex: parseFloat(c.uvIndex) || 0,
            cloudCover: parseInt(c.cloudcover) || 0,
            precipitation: parseFloat(c.precipMM) || 0,
            dewPoint: parseFloat(c.DewPointC) || (tempC - 5),
            isDay: true
        },
        hourly: [],
        daily: d.weather.slice(0, 7).map(w => ({
            date: w.date,
            code: 0,
            maxTemp: parseFloat(w.maxtempC),
            minTemp: parseFloat(w.mintempC),
            precipitation: parseFloat(w.hourly[0]?.precipMM) || 0,
            precipChance: parseInt(w.hourly[0]?.chanceofrain) || 0,
            wind: parseFloat(w.hourly[0]?.windspeedKmph) || 0,
            uvIndex: parseFloat(w.uvIndex) || 0,
            sunrise: w.astronomy[0]?.sunrise || '06:00 AM',
            sunset: w.astronomy[0]?.sunset || '06:00 PM',
            cloudCover: parseInt(w.hourly[0]?.cloudcover) || 0,
            condition: w.hourly[0]?.weatherDesc[0]?.value || 'Unknown'
        }))
    };
}

/* ============================================================
   MAIN APP CLASS
   ============================================================ */
class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.currentWeather = null;
        this.locationName = null;
        this.cache = new Map();
        this.cacheTime = 10 * 60 * 1000; // 10 min
        this.isFetching = false;

        this.apis = {
            'weatherapi': {
                name: 'WeatherAPI.com',
                desc: 'Most accurate — 14-day forecast, hourly data',
                badge: 'PRIMARY',
                fetch: (lat, lon) => fetchWeatherAPI(lat, lon)
            },
            'open-meteo': {
                name: 'Open-Meteo',
                desc: 'Free, no API key, global coverage',
                badge: 'FREE',
                fetch: (lat, lon) => fetchOpenMeteo(lat, lon)
            },
            'nws': {
                name: 'National Weather Service',
                desc: 'US only — official government data',
                badge: 'US ONLY',
                fetch: (lat, lon) => fetchNWS(lat, lon)
            },
            'wttr': {
                name: 'wttr.in',
                desc: 'Fast, simple, global fallback',
                badge: 'FALLBACK',
                fetch: (lat, lon) => fetchWttr(lat, lon)
            }
        };

        this.apiSource = localStorage.getItem('mini-weather-api') || 'weatherapi';
        if (!this.apis[this.apiSource]) this.apiSource = 'weatherapi';

        this._bindEvents();
        this._restoreLocation();
    }

    _bindEvents() {
        document.getElementById('location-btn').addEventListener('click', () => this.requestLocation());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('unit-btn').addEventListener('click', () => this.toggleUnit());
        document.getElementById('notify-btn').addEventListener('click', () => this.toggleNotifications());
        document.getElementById('api-btn').addEventListener('click', () => this.showAPIModal());
        document.getElementById('api-modal-close').addEventListener('click', () => this.closeAPIModal());
        document.getElementById('api-modal').addEventListener('click', (e) => {
            if (e.target.id === 'api-modal') this.closeAPIModal();
        });

        // Update clock every minute
        setInterval(() => {
            const el = document.getElementById('loc-time');
            if (el && this.currentLocation) {
                el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }, 60000);
    }

    _restoreLocation() {
        const saved = localStorage.getItem('mini-weather-location');
        if (saved) {
            try {
                this.currentLocation = JSON.parse(saved);
                this.fetchWeather();
            } catch { /* ignore */ }
        }
    }

    async requestLocation() {
        const btn = document.getElementById('location-btn');
        btn.disabled = true;
        btn.textContent = '⏳';

        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 300000
                });
            });

            const { latitude, longitude } = pos.coords;
            this.currentLocation = { latitude, longitude };
            localStorage.setItem('mini-weather-location', JSON.stringify(this.currentLocation));
            this.locationName = null; // Force re-fetch
            await this.fetchWeather();
        } catch (err) {
            const msg = err.code === 1
                ? 'Location access denied. Please enable location permissions in your browser.'
                : err.code === 2
                    ? 'Location unavailable. Check your device settings.'
                    : 'Location request timed out. Please try again.';
            this.showError(msg);
        } finally {
            btn.disabled = false;
            btn.textContent = '📍';
        }
    }

    async fetchWeather() {
        if (!this.currentLocation || this.isFetching) return;

        const { latitude, longitude } = this.currentLocation;
        const cacheKey = `${parseFloat(latitude).toFixed(3)}-${parseFloat(longitude).toFixed(3)}-${this.apiSource}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.cacheTime) {
                this.currentWeather = cached.data;
                await this._render();
                return;
            }
        }

        this.isFetching = true;
        this.showLoading();

        try {
            const api = this.apis[this.apiSource];
            let weather = null;

            try {
                weather = await api.fetch(latitude, longitude);
            } catch (primaryErr) {
                console.warn(`${api.name} failed:`, primaryErr.message);

                // Auto-fallback chain
                const fallbacks = ['weatherapi', 'open-meteo', 'nws', 'wttr'].filter(k => k !== this.apiSource);
                for (const fallbackKey of fallbacks) {
                    try {
                        weather = await this.apis[fallbackKey].fetch(latitude, longitude);
                        weather.source += ' (fallback)';
                        showToast(`⚠️ Using ${this.apis[fallbackKey].name} as fallback`);
                        break;
                    } catch (fbErr) {
                        console.warn(`Fallback ${fallbackKey} failed:`, fbErr.message);
                    }
                }
            }

            if (!weather) throw new Error('All weather APIs failed. Check your connection.');

            this.currentWeather = weather;
            this.cache.set(cacheKey, { data: weather, time: Date.now() });
            await this._render();
        } catch (err) {
            this.showError(err.message || 'Failed to fetch weather data.');
            console.error('Weather fetch error:', err);
        } finally {
            this.isFetching = false;
        }
    }

    async _render() {
        if (!this.currentWeather) return;

        const { current, hourly, daily, source, location } = this.currentWeather;
        const { latitude, longitude } = this.currentLocation;

        // Get location name (cached)
        if (!this.locationName) {
            // Use WeatherAPI location name if available
            if (location && location.name) {
                const parts = [location.name];
                if (location.region && location.region !== location.name) parts.push(location.region);
                if (location.country) parts.push(location.country);
                this.locationName = parts.join(', ');
            } else {
                this.locationName = await getLocationName(latitude, longitude);
            }
        }

        // Update location bar
        const locDisplay = document.getElementById('location-display');
        document.getElementById('loc-name').textContent = `📍 ${this.locationName}`;
        document.getElementById('loc-coords').textContent = `${parseFloat(latitude).toFixed(3)}°, ${parseFloat(longitude).toFixed(3)}°`;
        document.getElementById('loc-time').textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        document.getElementById('source-badge').textContent = `📡 ${source}`;
        document.getElementById('footer-api').textContent = source;
        locDisplay.style.display = 'flex';

        // Update unit button
        document.getElementById('unit-btn').textContent = `°${unit}`;

        // Build alerts
        const alerts = this._buildAlerts(current, daily);

        // Build weather HTML
        const weatherHTML = this._buildWeatherCard(current, hourly, daily, source, alerts);

        // Build garden HTML
        const gardenHTML = `<div class="garden-card" id="garden-card"></div>`;

        // Render
        const container = document.getElementById('weather-content');
        container.innerHTML = weatherHTML + gardenHTML;

        // Render garden (after DOM update)
        Garden.render({
            temp: current.temp,
            humidity: current.humidity,
            windSpeed: current.windSpeed,
            precipitation: current.precipitation,
            uvIndex: current.uvIndex
        });

        // Send notifications for severe conditions
        this._sendAlertNotifications(current, daily);
    }

    _buildAlerts(current, daily) {
        const alertItems = [];

        if (current.uvIndex >= 11) {
            alertItems.push({ type: 'danger', msg: `☀️ EXTREME UV Index ${Math.round(current.uvIndex)} — Avoid sun exposure` });
        } else if (current.uvIndex >= 8) {
            alertItems.push({ type: 'warning', msg: `☀️ Very High UV Index ${Math.round(current.uvIndex)} — Use SPF 50+` });
        } else if (current.uvIndex >= 6) {
            alertItems.push({ type: 'info', msg: `☀️ High UV Index ${Math.round(current.uvIndex)} — Wear sunscreen` });
        }

        if (current.windSpeed >= 60) {
            alertItems.push({ type: 'danger', msg: `💨 SEVERE WINDS: ${windDisplay(current.windSpeed)} ${windUnit()} — Extreme caution` });
        } else if (current.windSpeed >= 40) {
            alertItems.push({ type: 'warning', msg: `💨 Strong winds: ${windDisplay(current.windSpeed)} ${windUnit()}` });
        }

        if (daily && daily[0]) {
            if (daily[0].precipChance >= 80) {
                alertItems.push({ type: 'warning', msg: `⛈️ Heavy rain expected — ${daily[0].precipChance}% chance` });
            } else if (daily[0].precipChance >= 60) {
                alertItems.push({ type: 'info', msg: `🌧️ Rain likely today — ${daily[0].precipChance}% chance` });
            }
        }

        if (current.temp <= -10) {
            alertItems.push({ type: 'danger', msg: `❄️ EXTREME COLD: ${toDisplay(current.temp)}°${unit} — Frostbite risk` });
        } else if (current.temp <= 0) {
            alertItems.push({ type: 'warning', msg: `❄️ Freezing conditions — Watch for ice` });
        }

        if (current.temp >= 40) {
            alertItems.push({ type: 'danger', msg: `🔥 EXTREME HEAT: ${toDisplay(current.temp)}°${unit} — Heat stroke risk` });
        } else if (current.temp >= 35) {
            alertItems.push({ type: 'warning', msg: `🌡️ Very hot: ${toDisplay(current.temp)}°${unit} — Stay hydrated` });
        }

        if (current.visibility < 1) {
            alertItems.push({ type: 'warning', msg: `🌫️ Very low visibility: ${current.visibility.toFixed(1)} km` });
        }

        if (!alertItems.length) return '';

        return `<div class="alerts">${alertItems.map(a =>
            `<div class="alert alert-${a.type}">${a.msg}</div>`
        ).join('')}</div>`;
    }

    _buildWeatherCard(current, hourly, daily, source, alerts) {
        const displayTemp = toDisplay(current.temp);
        const displayFeels = toDisplay(current.feelsLike);
        const displayWind = windDisplay(current.windSpeed);
        const displayGusts = windDisplay(current.windGusts);
        const wUnit = windUnit();
        const icon = getWeatherIcon(current.code, current.isDay !== false);

        let html = `<div class="weather-card">
            <div class="temp-display">
                <span class="weather-icon-main">${icon}</span>
                <div class="temp-value">${displayTemp}°${unit}</div>
                <div class="condition">${current.description}</div>
                <div class="feels-like">Feels like ${displayFeels}°${unit}</div>
            </div>

            <div class="stats">
                <div class="stat">
                    <div class="stat-label">💧 Humidity</div>
                    <div class="stat-value">${current.humidity}%</div>
                    <div class="stat-unit">${getHumidityLabel(current.humidity)}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">💨 Wind</div>
                    <div class="stat-value">${displayWind}</div>
                    <div class="stat-unit">${wUnit}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">💨 Gusts</div>
                    <div class="stat-value">${displayGusts}</div>
                    <div class="stat-unit">${wUnit}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">🔬 Pressure</div>
                    <div class="stat-value">${Math.round(current.pressure)}</div>
                    <div class="stat-unit">hPa</div>
                </div>
                <div class="stat">
                    <div class="stat-label">☀️ UV Index</div>
                    <div class="stat-value">${Math.round(current.uvIndex)}</div>
                    <div class="stat-unit">${getUVLabel(current.uvIndex)}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">👁️ Visibility</div>
                    <div class="stat-value">${parseFloat(current.visibility).toFixed(1)}</div>
                    <div class="stat-unit">km</div>
                </div>
                <div class="stat">
                    <div class="stat-label">☁️ Cloud Cover</div>
                    <div class="stat-value">${current.cloudCover}%</div>
                    <div class="stat-unit">${current.cloudCover < 25 ? 'Clear' : current.cloudCover < 75 ? 'Partly' : 'Overcast'}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">🌡️ Dew Point</div>
                    <div class="stat-value">${toDisplay(current.dewPoint || 0)}°</div>
                    <div class="stat-unit">${unit}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">🌧️ Precip</div>
                    <div class="stat-value">${parseFloat(current.precipitation || 0).toFixed(1)}</div>
                    <div class="stat-unit">mm</div>
                </div>
                <div class="stat">
                    <div class="stat-label">🧭 Wind Dir</div>
                    <div class="stat-value">${getWindDirection(current.windDir || 0)}</div>
                    <div class="stat-unit">${current.windDir || 0}°</div>
                </div>
            </div>
        </div>`;

        // Alerts
        if (alerts) html += alerts;

        // Hourly forecast
        if (hourly && hourly.length > 0) {
            html += `<div class="weather-card">
                <div class="section-title">⏰ Hourly Forecast</div>
                <div class="hourly">`;

            const now = new Date();
            const currentHour = now.getHours();

            hourly.slice(0, 24).forEach((h, idx) => {
                const hDate = new Date(h.time);
                const hHour = hDate.getHours();
                const isNow = idx === 0;
                const timeLabel = isNow ? 'Now' : hDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const hIcon = getWeatherIcon(h.code, hHour >= 6 && hHour < 20);
                const hTemp = toDisplay(h.temp);

                html += `<div class="hour${isNow ? '" style="border-color:var(--accent);background:var(--accent-glow)' : ''}">
                    <div class="hour-time">${timeLabel}</div>
                    <div class="hour-icon">${hIcon}</div>
                    <div class="hour-temp">${hTemp}°</div>
                    <div class="hour-precip">💧${h.precipitation}%</div>
                </div>`;
            });

            html += `</div></div>`;
        }

        // Daily forecast
        if (daily && daily.length > 0) {
            html += `<div class="weather-card">
                <div class="section-title">📅 14-Day Forecast</div>
                <div class="daily">`;

            daily.slice(0, 14).forEach((d, i) => {
                const dateObj = new Date(d.date + 'T12:00:00');
                const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                const dIcon = getWeatherIcon(d.code, true);

                html += `<div class="day">
                    <div class="day-date">${dateLabel}</div>
                    <div class="day-icon">${dIcon}</div>
                    <div class="day-condition">${(d.condition || '').substring(0, 14)}</div>
                    <div class="day-temps">
                        <span class="day-max">${toDisplay(d.maxTemp)}°</span>
                        <span class="day-min">${toDisplay(d.minTemp)}°</span>
                    </div>
                    <div class="day-precip">💧${d.precipChance}%</div>
                </div>`;
            });

            html += `</div></div>`;
        }

        // Detailed analysis
        html += `<div class="weather-card">
            <div class="section-title">📊 Detailed Analysis</div>
            <div class="detailed-grid">
                <div class="detail-card">
                    <div class="detail-title">Apparent Temperature</div>
                    <div class="detail-value">${toDisplay(current.feelsLike)}°${unit}</div>
                    <div class="detail-sub">Wind chill + humidity effect</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Dew Point</div>
                    <div class="detail-value">${toDisplay(current.dewPoint || 0)}°${unit}</div>
                    <div class="detail-sub">Moisture condensation point</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">UV Index</div>
                    <div class="detail-value">${Math.round(current.uvIndex)}</div>
                    <div class="detail-sub">${getUVLabel(current.uvIndex)} — ${current.uvIndex < 3 ? 'No protection needed' : current.uvIndex < 6 ? 'Wear sunscreen' : 'Limit sun exposure'}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Atmospheric Pressure</div>
                    <div class="detail-value">${Math.round(current.pressure)} hPa</div>
                    <div class="detail-sub">${getPressureLabel(current.pressure)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Wind</div>
                    <div class="detail-value">${windDisplay(current.windSpeed)} ${windUnit()}</div>
                    <div class="detail-sub">${getWindDirection(current.windDir || 0)} · Gusts ${windDisplay(current.windGusts)} ${windUnit()}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Visibility</div>
                    <div class="detail-value">${parseFloat(current.visibility).toFixed(1)} km</div>
                    <div class="detail-sub">${current.visibility >= 10 ? 'Excellent' : current.visibility >= 5 ? 'Good' : current.visibility >= 2 ? 'Moderate' : 'Poor'}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Cloud Cover</div>
                    <div class="detail-value">${current.cloudCover}%</div>
                    <div class="detail-sub">${current.cloudCover < 25 ? 'Clear sky' : current.cloudCover < 75 ? 'Partly cloudy' : 'Overcast'}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Humidity</div>
                    <div class="detail-value">${current.humidity}%</div>
                    <div class="detail-sub">${getHumidityLabel(current.humidity)}</div>
                </div>
            </div>
        </div>`;

        return html;
    }

    _sendAlertNotifications(current, daily) {
        if (!notifications.enabled) return;
        if (current.uvIndex >= 11) {
            notifications.send('⚠️ Extreme UV Alert', { body: `UV Index: ${Math.round(current.uvIndex)} — Avoid sun exposure` });
        }
        if (current.windSpeed >= 60) {
            notifications.send('⚠️ Severe Wind Alert', { body: `Winds: ${windDisplay(current.windSpeed)} ${windUnit()}` });
        }
        if (daily && daily[0] && daily[0].precipChance >= 80) {
            notifications.send('🌧️ Heavy Rain Expected', { body: `${daily[0].precipChance}% chance of rain today` });
        }
    }

    showLoading() {
        document.getElementById('weather-content').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p class="loading-text">Fetching weather data…</p>
            </div>`;
    }

    showError(message) {
        document.getElementById('weather-content').innerHTML = `
            <div class="error">
                <div class="error-title">⚠️ Unable to load weather</div>
                <div class="error-msg">${message}</div>
                <button class="btn-primary" onclick="app.requestLocation()">📍 Try Again</button>
            </div>`;
    }

    toggleUnit() {
        unit = unit === 'C' ? 'F' : 'C';
        localStorage.setItem('mini-weather-unit', unit);
        document.getElementById('unit-btn').textContent = `°${unit}`;
        showToast(`Switched to °${unit}`);
        if (this.currentWeather) this._render();
    }

    async toggleNotifications() {
        const granted = await notifications.requestPermission();
        if (granted) {
            showToast('🔔 Notifications enabled!');
            notifications.send('Mini Weather', { body: 'Weather alerts are now active.' });
        } else {
            showToast('🔕 Notifications blocked');
        }
    }

    refresh() {
        if (!this.currentLocation) {
            showToast('📍 Please get your location first');
            return;
        }
        // Clear cache for current location
        const { latitude, longitude } = this.currentLocation;
        const cacheKey = `${parseFloat(latitude).toFixed(3)}-${parseFloat(longitude).toFixed(3)}-${this.apiSource}`;
        this.cache.delete(cacheKey);
        this.locationName = null;
        showToast('🔄 Refreshing…');
        this.fetchWeather();
    }

    showAPIModal() {
        const list = document.getElementById('api-list');
        list.innerHTML = '';

        Object.entries(this.apis).forEach(([key, api]) => {
            const div = document.createElement('div');
            div.className = 'api-option' + (key === this.apiSource ? ' selected' : '');
            div.innerHTML = `
                <div class="api-name">
                    ${api.name}
                    <span class="api-badge">${api.badge}</span>
                    ${key === this.apiSource ? '<span class="api-badge" style="background:var(--success)">ACTIVE</span>' : ''}
                </div>
                <div class="api-desc">${api.desc}</div>`;
            div.addEventListener('click', () => {
                this.apiSource = key;
                localStorage.setItem('mini-weather-api', key);
                this.closeAPIModal();
                // Clear cache and re-fetch
                this.cache.clear();
                showToast(`📡 Switched to ${api.name}`);
                if (this.currentLocation) this.fetchWeather();
            });
            list.appendChild(div);
        });

        document.getElementById('api-modal').classList.add('active');
    }

    closeAPIModal() {
        document.getElementById('api-modal').classList.remove('active');
    }
}

/* ============================================================
   INITIALIZE
   ============================================================ */
// Apply saved theme
applyTheme(currentTheme);
initThemes();

// Create app instance
const app = new WeatherApp();
