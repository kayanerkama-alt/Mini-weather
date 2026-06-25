/**
 * Mini Weather — Production-Ready Weather App v4.0
 * APIs: Open-Meteo (primary), NWS, wttr.in
 * Features: Virtual Garden, 80+ Themes, Device Detection, PWA, Notifications,
 *           AI Forecasting, Settings, Privacy Controls, Responsive UI,
 *           Location Search, AI Summaries, Comprehensive Alerts
 *
 * Architecture:
 *   Device        — viewport / touch detection
 *   NotificationManager — push notification wrapper
 *   Settings      — user preferences persistence
 *   WeatherApp    — main controller (fetch → render → interact)
 *   Garden        — virtual plant simulation
 *   AIForecastEngine (ai-forecast.js) — statistical ML analysis
 *   PrivacyManager (privacy.js)       — GDPR-aware data handling
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
    _resizeTimer: null,

    detect() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Robust touch detection (fixes iPad in desktop mode)
        this.hasTouch = (
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0)
        );
        this.isLandscape = w > h;

        // iPad detection: iPads in desktop mode report as desktop UA but have touch
        const isIPad = /iPad/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isIPad || (w >= 768 && w < 1200 && this.hasTouch)) {
            this.type = 'tablet';
            this.isMobile = false;
            this.isTablet = true;
            this.isDesktop = false;
        } else if (w < 768) {
            this.type = 'mobile';
            this.isMobile = true;
            this.isTablet = false;
            this.isDesktop = false;
        } else {
            this.type = 'desktop';
            this.isMobile = false;
            this.isTablet = false;
            this.isDesktop = true;
        }

        try { localStorage.setItem('mini-weather-device', this.type); } catch { /* ignore */ }
        document.body.setAttribute('data-device', this.type);
        document.body.setAttribute('data-landscape', this.isLandscape ? 'true' : 'false');

        const badge = document.getElementById('device-badge');
        if (badge) {
            const icons = { mobile: '📱', tablet: '📟', desktop: '🖥️' };
            badge.textContent = `${icons[this.type] || '💻'} ${this.type}`;
        }

        return this.type;
    }
};

Device.detect();

// Debounced resize handler to prevent excessive calls
window.addEventListener('resize', () => {
    clearTimeout(Device._resizeTimer);
    Device._resizeTimer = setTimeout(() => Device.detect(), 150);
}, { passive: true });

// Handle orientation change explicitly
window.addEventListener('orientationchange', () => {
    setTimeout(() => Device.detect(), 300);
}, { passive: true });

/* ============================================================
   NOTIFICATION MANAGER
   ============================================================ */
class NotificationManager {
    constructor() {
        this.supported = 'Notification' in window;
        this.enabled = localStorage.getItem('mini-weather-notifications') === 'true';
        this._notifications = this._loadNotifications();
        this._alertBadge = document.getElementById('nav-alert-badge');
    }

    _loadNotifications() {
        try {
            const raw = localStorage.getItem('mini-weather-notif-history');
            if (raw) return JSON.parse(raw);
        } catch { /* ignore */ }
        return [];
    }

    _saveNotifications() {
        try {
            // Keep only last 50 notifications
            const toSave = this._notifications.slice(-50);
            localStorage.setItem('mini-weather-notif-history', JSON.stringify(toSave));
        } catch { /* ignore */ }
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

    // Add notification to in-app history
    addToHistory(notif) {
        const item = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            read: false,
            ...notif
        };
        this._notifications.unshift(item);
        this._saveNotifications();
        this._updateBadge();
        this._renderNotificationPanel();
        return item;
    }

    _updateBadge() {
        const unread = this._notifications.filter(n => !n.read).length;
        if (this._alertBadge) {
            if (unread > 0) {
                this._alertBadge.textContent = unread > 9 ? '9+' : unread;
                this._alertBadge.style.display = 'block';
            } else {
                this._alertBadge.style.display = 'none';
            }
        }
    }

    markAsRead(id) {
        const notif = this._notifications.find(n => n.id === id);
        if (notif) {
            notif.read = true;
            this._saveNotifications();
            this._updateBadge();
        }
    }

    markAllRead() {
        this._notifications.forEach(n => n.read = true);
        this._saveNotifications();
        this._updateBadge();
        this._renderNotificationPanel();
    }

    clearAll() {
        this._notifications = [];
        this._saveNotifications();
        this._updateBadge();
        this._renderNotificationPanel();
    }

    _renderNotificationPanel() {
        const container = document.getElementById('notif-list');
        if (!container) return;

        if (this._notifications.length === 0) {
            container.innerHTML = `
                <div class="notif-empty" style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                    <span style="font-size:3rem;">🔔</span>
                    <p style="margin-top:12px;font-size:0.82rem;">No notifications yet</p>
                    <p style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Enable notifications to get weather alerts</p>
                </div>`;
            return;
        }

        container.innerHTML = this._notifications.map(n => {
            const time = this._formatNotifTime(n.timestamp);
            const typeClass = `notif-type-${n.type || 'info'}`;
            const unreadClass = n.read ? '' : 'unread';
            return `
                <div class="notif-item ${typeClass} ${unreadClass}" data-id="${n.id}" onclick="notifMgr.handleNotifClick(${n.id})">
                    <div style="display:flex;align-items:flex-start;gap:10px;">
                        <span class="notif-icon">${n.icon || '🔔'}</span>
                        <div class="notif-content">
                            <div class="notif-title">${this._escapeHtml(n.title)}</div>
                            <div class="notif-message">${this._escapeHtml(n.message)}</div>
                            <div class="notif-time">${time}</div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    _formatNotifTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    handleNotifClick(id) {
        this.markAsRead(id);
        const notif = this._notifications.find(n => n.id === id);
        if (notif && notif.action) {
            notif.action();
        }
    }

    showNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        const overlay = document.getElementById('notif-overlay');
        if (panel) {
            this._renderNotificationPanel();
            panel.classList.add('active');
        }
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    hideNotificationPanel() {
        const panel = document.getElementById('notification-panel');
        const overlay = document.getElementById('notif-overlay');
        if (panel) panel.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
}

const notifMgr = new NotificationManager();

// Extend notifications to use notifMgr
const notifications = {
    get enabled() { return notifMgr.enabled; },
    get supported() { return notifMgr.supported; },
    async requestPermission() { return notifMgr.requestPermission(); },
    send(title, options) { 
        notifMgr.send(title, options);
        // Also add to in-app history
        notifMgr.addToHistory({
            icon: options?.icon || '🔔',
            title,
            message: options?.body || '',
            type: options?.type || 'info'
        });
    }
};

/* ============================================================
   TOAST
   ============================================================ */
/**
 * Display a brief toast notification at the bottom of the screen.
 * @param {string} msg
 * @param {number} [duration=2800]
 */
function showToast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    // Sanitise — only set text, never innerHTML
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ============================================================
   SETTINGS MANAGER
   ============================================================ */
/**
 * Manages all user-configurable preferences with localStorage persistence.
 * Provides typed getters/setters and a reactive update mechanism.
 */
class Settings {
    static KEY = 'mini-weather-settings';

    static DEFAULTS = {
        // Display
        theme:          'dark',
        fontSize:       'medium',    // small | medium | large
        density:        'normal',    // compact | normal | comfortable
        // Units
        tempUnit:       'C',         // C | F
        windUnit:       'kmh',       // kmh | mph
        pressureUnit:   'hpa',       // hpa | inhg
        // Notifications
        notificationsEnabled: false,
        alertUV:        true,
        alertWind:      true,
        alertRain:      true,
        alertCold:      true,
        alertHeat:      true,
        // Data & Privacy
        storageEnabled: true,
        cacheMinutes:   10,
        searchHistory:  [],
        // Location
        savedLocations: [],
        defaultLocation: null,
        // Advanced
        apiSource:      'open-meteo',
        debugMode:      false,
        showAIForecast: true,
        showGarden:     true,
        showAlerts:     true,
    };

    constructor() {
        this._data = this._load();
        this._listeners = [];
    }

    /** Load settings from localStorage, merging with defaults. */
    _load() {
        try {
            const raw = localStorage.getItem(Settings.KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return { ...Settings.DEFAULTS, ...parsed };
            }
        } catch { /* corrupt data — use defaults */ }
        return { ...Settings.DEFAULTS };
    }

    /** Persist current settings to localStorage. */
    _save() {
        try {
            localStorage.setItem(Settings.KEY, JSON.stringify(this._data));
        } catch (e) {
            console.warn('[Settings] Could not save:', e.message);
        }
        this._listeners.forEach(fn => fn(this._data));
    }

    /** Get a setting value. */
    get(key) {
        return this._data[key] ?? Settings.DEFAULTS[key];
    }

    /** Set a setting value and persist. */
    set(key, value) {
        if (!(key in Settings.DEFAULTS)) {
            console.warn(`[Settings] Unknown key: ${key}`);
            return;
        }
        this._data[key] = value;
        this._save();
    }

    /** Batch-update multiple settings. */
    update(obj) {
        Object.entries(obj).forEach(([k, v]) => {
            if (k in Settings.DEFAULTS) this._data[k] = v;
        });
        this._save();
    }

    /** Subscribe to settings changes. Returns unsubscribe function. */
    onChange(fn) {
        this._listeners.push(fn);
        return () => { this._listeners = this._listeners.filter(l => l !== fn); };
    }

    /** Add a location to search history (max 10). */
    addSearchHistory(name, lat, lon) {
        const history = this.get('searchHistory') || [];
        const entry = { name, lat, lon, ts: Date.now() };
        const filtered = history.filter(h => h.name !== name);
        this.set('searchHistory', [entry, ...filtered].slice(0, 10));
    }

    /** Add a saved location (max 5). */
    addSavedLocation(name, lat, lon) {
        const locs = this.get('savedLocations') || [];
        if (locs.find(l => l.name === name)) return;
        this.set('savedLocations', [...locs, { name, lat, lon }].slice(0, 5));
    }

    /** Remove a saved location by name. */
    removeSavedLocation(name) {
        const locs = this.get('savedLocations') || [];
        this.set('savedLocations', locs.filter(l => l.name !== name));
    }

    /** Reset all settings to defaults. */
    reset() {
        this._data = { ...Settings.DEFAULTS };
        this._save();
    }

    /** Export settings as plain object. */
    export() {
        return { ...this._data };
    }
}

const settings = new Settings();

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

/**
 * Active temperature unit — kept in sync with settings.
 * Legacy `unit` variable retained for backward compatibility with render helpers.
 */
let unit = settings.get('tempUnit') || localStorage.getItem('mini-weather-unit') || 'C';

/**
 * Convert Celsius to the current display unit.
 * @param {number} tempC
 * @returns {number}
 */
function toDisplay(tempC) {
    if (typeof tempC !== 'number' || isNaN(tempC)) return 0;
    if (unit === 'F') return Math.round((tempC * 9 / 5) + 32);
    return Math.round(tempC);
}

/**
 * Convert km/h wind speed to the current display unit.
 * @param {number} kmh
 * @returns {number}
 */
function windDisplay(kmh) {
    if (typeof kmh !== 'number' || isNaN(kmh)) return 0;
    const wu = settings.get('windUnit') || 'kmh';
    if (wu === 'mph') return Math.round(kmh * 0.621371 * 10) / 10;
    return Math.round(kmh * 10) / 10;
}

/**
 * Returns the current wind speed unit label.
 * @returns {string}
 */
function windUnit() {
    const wu = settings.get('windUnit') || 'kmh';
    return wu === 'mph' ? 'mph' : 'km/h';
}

/**
 * Convert hPa pressure to the current display unit.
 * @param {number} hpa
 * @returns {string}
 */
function pressureDisplay(hpa) {
    if (typeof hpa !== 'number' || isNaN(hpa)) return '—';
    const pu = settings.get('pressureUnit') || 'hpa';
    if (pu === 'inhg') return (hpa * 0.02953).toFixed(2);
    return Math.round(hpa).toString();
}

/**
 * Returns the current pressure unit label.
 * @returns {string}
 */
function pressureUnit() {
    return settings.get('pressureUnit') === 'inhg' ? 'inHg' : 'hPa';
}

/* ============================================================
   LOCATION NAME (Nominatim)
   ============================================================ */

/** In-memory cache for reverse geocoding results. */
const _geocodeCache = new Map();

/**
 * Reverse-geocode coordinates to a human-readable location name.
 * Results are cached in memory for the session.
 * @param {number|string} lat
 * @param {number|string} lon
 * @returns {Promise<string>}
 */
async function getLocationName(lat, lon) {
    const cacheKey = `${parseFloat(lat).toFixed(3)},${parseFloat(lon).toFixed(3)}`;
    if (_geocodeCache.has(cacheKey)) return _geocodeCache.get(cacheKey);

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10`,
            { signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        const data = await res.json();
        const a = data.address || {};
        const parts = [];
        if (a.city)         parts.push(a.city);
        else if (a.town)    parts.push(a.town);
        else if (a.village) parts.push(a.village);
        else if (a.county)  parts.push(a.county);
        if (a.state && a.state !== parts[0]) parts.push(a.state);
        if (a.country) parts.push(a.country);
        const name = parts.join(', ') || 'Your Location';
        _geocodeCache.set(cacheKey, name);
        return name;
    } catch {
        const fallback = `${parseFloat(lat).toFixed(2)}°, ${parseFloat(lon).toFixed(2)}°`;
        _geocodeCache.set(cacheKey, fallback);
        return fallback;
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
/**
 * WeatherApp — central controller.
 * Handles location, API fetching, rendering, and all user interactions.
 */
class WeatherApp {
    constructor() {
        /** @type {{latitude: number, longitude: number}|null} */
        this.currentLocation = null;
        /** @type {object|null} Normalised weather data */
        this.currentWeather = null;
        /** @type {string|null} Human-readable location name */
        this.locationName = null;
        /** @type {Map<string, {data: object, time: number}>} */
        this.cache = new Map();
        /** Prevents concurrent fetches */
        this.isFetching = false;
        /** Debounce timer for resize events */
        this._resizeTimer = null;
        /** Cache TTL in ms — driven by settings */
        this._cacheTime = (settings.get('cacheMinutes') || 10) * 60 * 1000;

        this.apis = {
            'open-meteo': {
                name: 'Open-Meteo',
                desc: 'Free, no API key, global coverage — primary source',
                badge: 'PRIMARY',
                fetch: (lat, lon) => fetchOpenMeteo(lat, lon)
            },
            'weatherapi': {
                name: 'WeatherAPI.com',
                desc: '14-day forecast, hourly data (requires API key)',
                badge: 'PREMIUM',
                fetch: (lat, lon) => fetchWeatherAPI(lat, lon)
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

        // Sync apiSource from settings (with legacy localStorage fallback)
        // Default to open-meteo (free, no auth required)
        this.apiSource = settings.get('apiSource') || localStorage.getItem('mini-weather-api') || 'open-meteo';
        if (!this.apis[this.apiSource]) this.apiSource = 'open-meteo';

        this._bindEvents();
        this._restoreLocation();
        this._applyFontSize();
        this._applyDensity();
    }

    /* ----------------------------------------------------------
       EVENT BINDING
       ---------------------------------------------------------- */

    _bindEvents() {
        // Core controls — use event delegation where possible
        this._on('location-btn',  'click', () => this.requestLocation());
        this._on('refresh-btn',   'click', () => this.refresh());
        this._on('unit-btn',      'click', () => this.toggleUnit());
        this._on('notify-btn',    'click', () => this.toggleNotifications());
        this._on('api-btn',       'click', () => this.showAPIModal());
        this._on('settings-btn',  'click', () => this.showSettingsModal());
        this._on('search-btn',    'click', () => this.showSearchModal());
        this._on('privacy-btn',   'click', () => { if (typeof openPrivacyModal === 'function') openPrivacyModal(); });

        // Modal close buttons
        this._on('api-modal-close',      'click', () => this.closeAPIModal());
        this._on('settings-modal-close', 'click', () => this.closeSettingsModal());
        this._on('search-modal-close',   'click', () => this.closeSearchModal());
        this._on('privacy-modal-close',  'click', () => { if (typeof closePrivacyModal === 'function') closePrivacyModal(); });

        // Modal backdrop clicks
        this._onModal('api-modal',      () => this.closeAPIModal());
        this._onModal('settings-modal', () => this.closeSettingsModal());
        this._onModal('search-modal',   () => this.closeSearchModal());
        this._onModal('privacy-modal',  () => { if (typeof closePrivacyModal === 'function') closePrivacyModal(); });

        // Clock update — every minute
        setInterval(() => {
            const el = document.getElementById('loc-time');
            if (el && this.currentLocation) {
                el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }, 60000);

        // Debounced resize handler
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => Device.detect(), 200);
        }, { passive: true });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't fire when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.key) {
                case 'Escape':
                    this.closeAPIModal();
                    this.closeSettingsModal();
                    this.closeSearchModal();
                    if (typeof closePrivacyModal === 'function') closePrivacyModal();
                    const sm = document.getElementById('shortcuts-modal');
                    if (sm) sm.classList.remove('active');
                    break;
                case '?':
                    e.preventDefault();
                    const shortcutsModal = document.getElementById('shortcuts-modal');
                    if (shortcutsModal) shortcutsModal.classList.toggle('active');
                    break;
                case 'r': case 'R':
                    e.preventDefault();
                    this.refresh();
                    break;
                case 'u': case 'U':
                    e.preventDefault();
                    this.toggleUnit();
                    break;
                case 'l': case 'L':
                    e.preventDefault();
                    this.requestLocation();
                    break;
                case 's': case 'S':
                    e.preventDefault();
                    this.showSettingsModal();
                    break;
                case 't': case 'T':
                    e.preventDefault();
                    document.getElementById('theme-dropdown').classList.toggle('active');
                    break;
                case 'e': case 'E':
                    e.preventDefault();
                    this.exportWeatherData();
                    break;
                case 'f': case 'F':
                    e.preventDefault();
                    this.addToFavorites();
                    break;
                case 'ArrowRight':
                    if (document.getElementById('theme-dropdown').classList.contains('active')) {
                        e.preventDefault();
                        this._cycleTheme(1);
                    }
                    break;
                case 'ArrowLeft':
                    if (document.getElementById('theme-dropdown').classList.contains('active')) {
                        e.preventDefault();
                        this._cycleTheme(-1);
                    }
                    break;
            }
        });
    }

    /** Cycle through themes by offset (+1 or -1). */
    _cycleTheme(offset) {
        const keys = Object.keys(THEMES);
        const idx = keys.indexOf(currentTheme);
        const next = (idx + offset + keys.length) % keys.length;
        applyTheme(keys[next]);
    }

    /** Add current location to favorites (max 10). */
    addToFavorites() {
        if (!this.currentLocation) { showToast('📍 Get your location first'); return; }
        try {
            const favorites = JSON.parse(localStorage.getItem('mini-weather-favorites') || '[]');
            const exists = favorites.some(f =>
                Math.abs(f.latitude - this.currentLocation.latitude) < 0.01 &&
                Math.abs(f.longitude - this.currentLocation.longitude) < 0.01
            );
            if (exists) { showToast('⭐ Already in favorites'); return; }
            if (favorites.length >= 10) { showToast('⚠️ Maximum 10 favorites. Remove one in Settings.'); return; }
            favorites.push({
                latitude: this.currentLocation.latitude,
                longitude: this.currentLocation.longitude,
                name: this.locationName || 'My Location',
                addedAt: new Date().toISOString(),
            });
            localStorage.setItem('mini-weather-favorites', JSON.stringify(favorites));
            this._renderFavoritesBar();
            showToast(`⭐ Added ${this.locationName || 'location'} to favorites!`);
        } catch { showToast('❌ Could not save favorite'); }
    }

    /** Load a favorite location by index. */
    loadFavorite(index) {
        try {
            const favorites = JSON.parse(localStorage.getItem('mini-weather-favorites') || '[]');
            const fav = favorites[index];
            if (!fav) return;
            this.currentLocation = { latitude: fav.latitude, longitude: fav.longitude };
            this.locationName = fav.name || null;
            this.cache.clear();
            showToast(`📍 Loading ${fav.name || 'favorite'}…`);
            this.fetchWeather();
        } catch { showToast('❌ Could not load favorite'); }
    }

    /** Render the favorites quick-access bar. */
    _renderFavoritesBar() {
        const bar = document.getElementById('favorites-bar');
        if (!bar) return;
        let favorites = [];
        try { favorites = JSON.parse(localStorage.getItem('mini-weather-favorites') || '[]'); } catch { favorites = []; }
        if (!favorites.length) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        bar.innerHTML = favorites.map((fav, i) => {
            const isActive = this.currentLocation &&
                Math.abs(this.currentLocation.latitude - fav.latitude) < 0.01 &&
                Math.abs(this.currentLocation.longitude - fav.longitude) < 0.01;
            return `<button class="fav-chip${isActive ? ' active' : ''}" onclick="app.loadFavorite(${i})" aria-label="Load ${fav.name || 'favorite'}">📍 ${(fav.name || 'Location').substring(0, 20)}</button>`;
        }).join('');
    }

    /** Export current weather data as a JSON file. */
    exportWeatherData() {
        if (!this.currentWeather) { showToast('📍 No weather data to export'); return; }
        try {
            const data = {
                exportedAt: new Date().toISOString(),
                location: { name: this.locationName, coordinates: this.currentLocation },
                source: this.currentWeather.source,
                current: this.currentWeather.current,
                daily: this.currentWeather.daily,
                hourly: this.currentWeather.hourly ? this.currentWeather.hourly.slice(0, 24) : [],
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `weather-${(this.locationName || 'data').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('📤 Weather data exported!');
        } catch { showToast('❌ Export failed'); }
    }

    /** Safely attach an event listener to an element by ID. */
    _on(id, event, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, handler);
    }

    /** Close modal when clicking the backdrop. */
    _onModal(id, handler) {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => { if (e.target === el) handler(); });
    }

    /* ----------------------------------------------------------
       LOCATION
       ---------------------------------------------------------- */

    _restoreLocation() {
        try {
            const saved = localStorage.getItem('mini-weather-location');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
                    this.currentLocation = parsed;
                    this.fetchWeather();
                }
            }
        } catch { /* corrupt data — ignore */ }
    }

    async requestLocation() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by your browser.');
            return;
        }

        const btn = document.getElementById('location-btn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

        try {
            const pos = await new Promise((resolve, reject) => {
                // Manual timeout safety net in addition to the API timeout
                const timer = setTimeout(() => reject({ code: 3, message: 'Geolocation timed out' }), 15000);
                navigator.geolocation.getCurrentPosition(
                    (p) => { clearTimeout(timer); resolve(p); },
                    (e) => { clearTimeout(timer); reject(e); },
                    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 }
                );
            });

            const { latitude, longitude } = pos.coords;
            // Validate coordinates
            if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
                throw new Error('Invalid coordinates received from device.');
            }

            this.currentLocation = { latitude, longitude };
            localStorage.setItem('mini-weather-location', JSON.stringify(this.currentLocation));
            this.locationName = null; // Force re-geocode
            await this.fetchWeather();
        } catch (err) {
            const msg = err.code === 1
                ? 'Location access denied. Please enable location permissions in your browser.'
                : err.code === 2
                    ? 'Location unavailable. Check your device settings.'
                    : err.code === 3
                        ? 'Location request timed out. Please try again.'
                        : err.message || 'Could not get location.';
            this.showError(msg);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '📍'; }
        }
    }

    /* ----------------------------------------------------------
       LOCATION SEARCH (Nominatim geocoding)
       ---------------------------------------------------------- */

    showSearchModal() {
        const modal = document.getElementById('search-modal');
        if (!modal) return;
        modal.classList.add('active');
        const input = document.getElementById('search-input');
        if (input) { input.value = ''; input.focus(); }
        const results = document.getElementById('search-results');
        if (results) results.innerHTML = '';
    }

    closeSearchModal() {
        const modal = document.getElementById('search-modal');
        if (modal) modal.classList.remove('active');
    }

    async searchLocation(query) {
        if (!query || query.trim().length < 2) return;
        const results = document.getElementById('search-results');
        if (!results) return;

        results.innerHTML = '<div class="search-loading">🔍 Searching…</div>';

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=6&addressdetails=1`;
            const res = await fetch(url, {
                signal: AbortSignal.timeout(8000),
                headers: { 'Accept-Language': 'en' }
            });
            if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
            const data = await res.json();

            if (!data.length) {
                results.innerHTML = '<div class="search-empty">No results found. Try a different search.</div>';
                return;
            }

            results.innerHTML = data.map((place, i) => {
                const a = place.address || {};
                const city = a.city || a.town || a.village || a.county || place.display_name.split(',')[0];
                const region = a.state || a.region || '';
                const country = a.country || '';
                const label = [city, region, country].filter(Boolean).join(', ');
                return `<div class="search-result-item" role="button" tabindex="0"
                    data-lat="${place.lat}" data-lon="${place.lon}" data-name="${label.replace(/"/g, '&quot;')}"
                    onclick="app.selectSearchResult(${place.lat}, ${place.lon}, '${label.replace(/'/g, "\\'")}')">
                    <span class="search-result-icon">📍</span>
                    <div class="search-result-info">
                        <div class="search-result-name">${label}</div>
                        <div class="search-result-type">${place.type || place.class || 'location'}</div>
                    </div>
                </div>`;
            }).join('');

            // Keyboard navigation for results
            results.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        item.click();
                    }
                });
            });
        } catch (err) {
            results.innerHTML = `<div class="search-empty">Search failed: ${err.message}</div>`;
        }
    }

    selectSearchResult(lat, lon, name) {
        this.currentLocation = { latitude: parseFloat(lat), longitude: parseFloat(lon) };
        this.locationName = name;
        localStorage.setItem('mini-weather-location', JSON.stringify(this.currentLocation));
        settings.addSearchHistory(name, parseFloat(lat), parseFloat(lon));
        this.cache.clear();
        this.closeSearchModal();
        showToast(`📍 Loading ${name}…`);
        this.fetchWeather();
    }

    /* ----------------------------------------------------------
       WEATHER FETCHING
       ---------------------------------------------------------- */

    async fetchWeather(retryCount = 0) {
        if (!this.currentLocation || this.isFetching) return;

        const { latitude, longitude } = this.currentLocation;
        const cacheKey = `${parseFloat(latitude).toFixed(3)}-${parseFloat(longitude).toFixed(3)}-${this.apiSource}`;

        // Serve from cache if fresh
        const cacheTime = (settings.get('cacheMinutes') || 10) * 60 * 1000;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < cacheTime) {
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
                console.warn(`[WeatherApp] ${api.name} failed:`, primaryErr.message);

                // Auto-fallback chain — open-meteo first (free, no auth)
                const fallbacks = ['open-meteo', 'wttr', 'nws', 'weatherapi'].filter(k => k !== this.apiSource);
                for (const fallbackKey of fallbacks) {
                    try {
                        weather = await this.apis[fallbackKey].fetch(latitude, longitude);
                        weather.source += ' (fallback)';
                        showToast(`⚠️ Using ${this.apis[fallbackKey].name} as fallback`);
                        break;
                    } catch (fbErr) {
                        console.warn(`[WeatherApp] Fallback ${fallbackKey} failed:`, fbErr.message);
                    }
                }
            }

            // Retry logic: if all APIs failed and we haven't retried yet, wait and try again
            if (!weather && retryCount < 2) {
                console.warn(`[WeatherApp] All APIs failed, retrying in ${(retryCount + 1) * 3}s...`);
                this.isFetching = false;
                await new Promise(r => setTimeout(r, (retryCount + 1) * 3000));
                return this.fetchWeather(retryCount + 1);
            }

            if (!weather) throw new Error('All weather APIs failed. Check your connection.');

            this.currentWeather = weather;
            this.cache.set(cacheKey, { data: weather, time: Date.now() });

            // Save to search history
            if (this.locationName) {
                settings.addSearchHistory(this.locationName, latitude, longitude);
            }

            await this._render();
        } catch (err) {
            this.showError(err.message || 'Failed to fetch weather data.');
            console.error('[WeatherApp] Fetch error:', err);
        } finally {
            this.isFetching = false;
        }
    }

    /* ----------------------------------------------------------
       RENDERING
       ---------------------------------------------------------- */

    async _render() {
        if (!this.currentWeather) return;

        const { current, hourly, daily, source, location } = this.currentWeather;
        const { latitude, longitude } = this.currentLocation;

        // Resolve location name (cached)
        if (!this.locationName) {
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
        const locName    = document.getElementById('loc-name');
        const locCoords  = document.getElementById('loc-coords');
        const locTime    = document.getElementById('loc-time');
        const srcBadge   = document.getElementById('source-badge');
        const footerApi  = document.getElementById('footer-api');

        if (locName)   locName.textContent   = `📍 ${this.locationName}`;
        if (locCoords) locCoords.textContent = `${parseFloat(latitude).toFixed(3)}°, ${parseFloat(longitude).toFixed(3)}°`;
        if (locTime)   locTime.textContent   = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (srcBadge)  srcBadge.textContent  = `📡 ${source}`;
        if (footerApi) footerApi.textContent = source;
        if (locDisplay) locDisplay.style.display = 'flex';

        // Update AI badge
        const aiBadge = document.getElementById('ai-badge');
        if (aiBadge) {
            const aiEnabled = settings.get('showAIForecast') !== false;
            aiBadge.className = `ai-badge ${aiEnabled ? 'ai-active' : 'ai-disabled'}`;
            aiBadge.title = aiEnabled ? 'AI Forecast Enhancement: Active' : 'AI Forecast Enhancement: Disabled';
            aiBadge.textContent = aiEnabled ? '🤖 AI On' : '🤖 AI Off';
        }

        // Render favorites bar
        this._renderFavoritesBar();

        // Sync unit button
        const unitBtn = document.getElementById('unit-btn');
        if (unitBtn) unitBtn.textContent = `°${unit}`;

        // Build alerts HTML (respects settings.showAlerts)
        const alertsHTML = settings.get('showAlerts') ? this._buildAlerts(current, daily) : '';

        // Build AI summary (prominent, above the fold)
        let aiSummaryHTML = '';
        if (settings.get('showAIForecast') !== false) {
            aiSummaryHTML = this._buildAISummaryCard(current, hourly, daily);
        }

        // Build main weather card
        const weatherHTML = this._buildWeatherCard(current, hourly, daily, source, alertsHTML);

        // Build garden section (respects settings.showGarden)
        const gardenHTML = settings.get('showGarden')
            ? `<div class="garden-card" id="garden-card" role="region" aria-label="Virtual Garden"></div>`
            : '';

        // Build full AI forecast section (respects settings.showAIForecast)
        let aiHTML = '';
        if (settings.get('showAIForecast') && typeof AIForecastEngine !== 'undefined') {
            try {
                const engine = new AIForecastEngine(this.currentWeather);
                const result = engine.analyse();
                aiHTML = `<div class="weather-card ai-forecast-wrapper" role="region" aria-label="AI Forecast">
                    ${renderAIForecastCard(result, unit)}
                </div>`;
            } catch (aiErr) {
                console.warn('[WeatherApp] AI forecast error:', aiErr.message);
            }
        }

        // Inject into DOM
        const container = document.getElementById('weather-content');
        if (container) {
            container.innerHTML = aiSummaryHTML + weatherHTML + gardenHTML + aiHTML;
        }

        // Render garden after DOM update
        if (settings.get('showGarden')) {
            Garden.render({
                temp:          current.temp,
                humidity:      current.humidity,
                windSpeed:     current.windSpeed,
                precipitation: current.precipitation,
                uvIndex:       current.uvIndex
            });
        }

        // Send alert notifications
        this._sendAlertNotifications(current, daily);
    }

    /* ----------------------------------------------------------
       AI SUMMARY CARD (intelligent weather analysis)
       ---------------------------------------------------------- */

    _buildAISummaryCard(current, hourly, daily) {
        const wUnit = windUnit();
        const parts = [];

        // --- Temperature analysis (next 12 hours) ---
        const next12Temps = (hourly || []).slice(0, 12).map(h => h.temp).filter(t => t != null);
        if (next12Temps.length >= 3) {
            const minT = Math.min(...next12Temps);
            const maxT = Math.max(...next12Temps);
            const firstT = next12Temps[0];
            const lastT = next12Temps[next12Temps.length - 1];
            const delta = lastT - firstT;
            if (Math.abs(delta) >= 3) {
                parts.push(`🌡️ Temperatures will ${delta > 0 ? 'rise' : 'drop'} by ${Math.abs(Math.round(delta))}°${unit} over the next 12 hours (${toDisplay(minT)}–${toDisplay(maxT)}°${unit}).`);
            } else {
                parts.push(`🌡️ Temperatures stay steady around ${toDisplay(current.temp)}°${unit} for the next 12 hours.`);
            }
        }

        // --- Precipitation analysis ---
        const next12Precip = (hourly || []).slice(0, 12).map(h => h.precipitation || 0);
        if (next12Precip.length > 0) {
            const maxPrecip = Math.max(...next12Precip);
            const avgPrecip = next12Precip.reduce((a, b) => a + b, 0) / next12Precip.length;
            if (maxPrecip >= 70) {
                const peakHour = next12Precip.indexOf(maxPrecip);
                parts.push(`🌧️ High rain probability (${maxPrecip}%) expected around ${peakHour === 0 ? 'now' : `in ~${peakHour}h`}. Carry an umbrella.`);
            } else if (avgPrecip >= 40) {
                parts.push(`🌦️ Moderate rain chance throughout the day (avg ${Math.round(avgPrecip)}%). Showers possible.`);
            } else if (maxPrecip < 20) {
                parts.push(`☀️ Dry conditions expected — rain probability stays below 20% for the next 12 hours.`);
            }
        }

        // --- Wind analysis ---
        const next12Wind = (hourly || []).slice(0, 12).map(h => h.wind || 0);
        if (next12Wind.length > 0) {
            const maxWind = Math.max(...next12Wind);
            if (maxWind >= 50) {
                parts.push(`💨 Strong winds expected — gusts up to ${windDisplay(maxWind)} ${wUnit}. Secure loose objects outdoors.`);
            } else if (maxWind >= 30) {
                parts.push(`💨 Breezy conditions ahead — winds reaching ${windDisplay(maxWind)} ${wUnit}.`);
            }
        }

        // --- UV analysis ---
        if (current.uvIndex >= 8) {
            parts.push(`☀️ Very high UV index (${Math.round(current.uvIndex)}) — apply SPF 50+ and limit midday sun exposure.`);
        } else if (current.uvIndex >= 6) {
            parts.push(`🌤️ High UV index (${Math.round(current.uvIndex)}) — sunscreen recommended.`);
        }

        // --- Pressure / storm analysis ---
        if (current.pressure < 990) {
            parts.push(`⛈️ Very low atmospheric pressure (${Math.round(current.pressure)} hPa) — severe weather possible.`);
        } else if (current.pressure < 1000) {
            parts.push(`🌧️ Low pressure system (${Math.round(current.pressure)} hPa) — unsettled weather likely.`);
        } else if (current.pressure > 1025) {
            parts.push(`🌤️ High pressure (${Math.round(current.pressure)} hPa) — stable, clear conditions expected.`);
        }

        // --- Comfort summary ---
        const feelsLike = toDisplay(current.feelsLike);
        const actualTemp = toDisplay(current.temp);
        if (Math.abs(current.feelsLike - current.temp) >= 3) {
            parts.push(`🌡️ Feels like ${feelsLike}°${unit} (actual ${actualTemp}°${unit}) due to ${current.windSpeed > 20 ? 'wind chill' : 'humidity'}.`);
        }

        // --- Tomorrow outlook ---
        if (daily && daily[1]) {
            const tmr = daily[1];
            const tmrIcon = getWeatherIcon(tmr.code, true);
            parts.push(`📅 Tomorrow: ${tmrIcon} ${tmr.condition || getWeatherDescription(tmr.code)} — ${toDisplay(tmr.minTemp)}–${toDisplay(tmr.maxTemp)}°${unit}, ${tmr.precipChance}% rain.`);
        }

        if (!parts.length) {
            parts.push(`🌤️ Current conditions: ${current.description} at ${toDisplay(current.temp)}°${unit}. No significant weather events expected.`);
        }

        // Determine overall condition color
        const hasAlert = current.uvIndex >= 8 || current.windSpeed >= 40 || current.temp >= 35 || current.temp <= 0 || current.pressure < 1000;
        const borderColor = hasAlert ? 'var(--warning)' : 'var(--accent)';
        const bgGlow = hasAlert ? 'rgba(255,152,0,0.06)' : 'rgba(30,136,229,0.06)';

        return `<div class="weather-card ai-summary-card" role="region" aria-label="AI Weather Summary" style="border-left: 3px solid ${borderColor}; background: linear-gradient(135deg, var(--bg-card) 0%, ${bgGlow} 100%);">
            <div class="section-title" style="margin-top:0;">🤖 AI Weather Summary</div>
            <div class="ai-summary-content">
                ${parts.map(p => `<div class="ai-summary-line">${p}</div>`).join('')}
            </div>
            <div class="ai-summary-footer">
                <span>Powered by statistical analysis of Open-Meteo data</span>
                <span>Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>`;
    }

    /* ----------------------------------------------------------
       ALERTS
       ---------------------------------------------------------- */

    _buildAlerts(current, daily) {
        const alertItems = [];
        const s = settings;

        // UV alerts
        if (s.get('alertUV')) {
            if (current.uvIndex >= 11) {
                alertItems.push({ type: 'danger',  msg: `☀️ EXTREME UV Index ${Math.round(current.uvIndex)} — Avoid sun exposure` });
            } else if (current.uvIndex >= 8) {
                alertItems.push({ type: 'warning', msg: `☀️ Very High UV Index ${Math.round(current.uvIndex)} — Use SPF 50+` });
            } else if (current.uvIndex >= 6) {
                alertItems.push({ type: 'info',    msg: `☀️ High UV Index ${Math.round(current.uvIndex)} — Wear sunscreen` });
            }
        }

        // Wind alerts
        if (s.get('alertWind')) {
            if (current.windSpeed >= 60) {
                alertItems.push({ type: 'danger',  msg: `💨 SEVERE WINDS: ${windDisplay(current.windSpeed)} ${windUnit()} — Extreme caution` });
            } else if (current.windSpeed >= 40) {
                alertItems.push({ type: 'warning', msg: `💨 Strong winds: ${windDisplay(current.windSpeed)} ${windUnit()}` });
            }
        }

        // Rain alerts
        if (s.get('alertRain') && daily && daily[0]) {
            if (daily[0].precipChance >= 80) {
                alertItems.push({ type: 'warning', msg: `⛈️ Heavy rain expected — ${daily[0].precipChance}% chance` });
            } else if (daily[0].precipChance >= 60) {
                alertItems.push({ type: 'info',    msg: `🌧️ Rain likely today — ${daily[0].precipChance}% chance` });
            }
        }

        // Cold alerts
        if (s.get('alertCold')) {
            if (current.temp <= -10) {
                alertItems.push({ type: 'danger',  msg: `❄️ EXTREME COLD: ${toDisplay(current.temp)}°${unit} — Frostbite risk` });
            } else if (current.temp <= 0) {
                alertItems.push({ type: 'warning', msg: `❄️ Freezing conditions — Watch for ice` });
            }
        }

        // Heat alerts
        if (s.get('alertHeat')) {
            if (current.temp >= 40) {
                alertItems.push({ type: 'danger',  msg: `🔥 EXTREME HEAT: ${toDisplay(current.temp)}°${unit} — Heat stroke risk` });
            } else if (current.temp >= 35) {
                alertItems.push({ type: 'warning', msg: `🌡️ Very hot: ${toDisplay(current.temp)}°${unit} — Stay hydrated` });
            }
        }

        // Visibility
        if (typeof current.visibility === 'number' && current.visibility < 1) {
            alertItems.push({ type: 'warning', msg: `🌫️ Very low visibility: ${current.visibility.toFixed(1)} km` });
        }

        if (!alertItems.length) return '';

        return `<div class="alerts" role="alert" aria-live="polite">${alertItems.map(a =>
            `<div class="alert alert-${a.type}">${a.msg}</div>`
        ).join('')}</div>`;
    }

    /* ----------------------------------------------------------
       WEATHER CARD BUILDER
       ---------------------------------------------------------- */

    _buildWeatherCard(current, hourly, daily, source, alerts) {
        const displayTemp  = toDisplay(current.temp);
        const displayFeels = toDisplay(current.feelsLike);
        const displayWind  = windDisplay(current.windSpeed);
        const displayGusts = windDisplay(current.windGusts);
        const wUnit        = windUnit();
        const pUnit        = pressureUnit();
        const pVal         = pressureDisplay(current.pressure);
        const icon         = getWeatherIcon(current.code, current.isDay !== false);

        // Sunrise / sunset from today's daily data
        const today = daily && daily[0];
        const sunriseStr = today?.sunrise ? this._formatSunTime(today.sunrise) : null;
        const sunsetStr  = today?.sunset  ? this._formatSunTime(today.sunset)  : null;

        // Moon phase (simple calculation)
        const moonPhase = this._getMoonPhase();

        // Humidity comfort index
        const comfortIndex = this._humidityComfort(current.temp, current.humidity);

        let html = `<div class="weather-card" role="region" aria-label="Current Weather">
            <div class="temp-display">
                <span class="weather-icon-main" aria-hidden="true">${icon}</span>
                <div class="temp-value" aria-label="${displayTemp} degrees ${unit}">${displayTemp}°${unit}</div>
                <div class="condition">${current.description}</div>
                <div class="feels-like">Feels like ${displayFeels}°${unit}</div>
                ${sunriseStr ? `<div class="sun-times">🌅 ${sunriseStr} &nbsp;·&nbsp; 🌇 ${sunsetStr} &nbsp;·&nbsp; ${moonPhase}</div>` : ''}
            </div>

            <div class="stats" role="list">
                <div class="stat" role="listitem">
                    <div class="stat-label">💧 Humidity</div>
                    <div class="stat-value">${current.humidity}%</div>
                    <div class="stat-unit">${getHumidityLabel(current.humidity)}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">💨 Wind</div>
                    <div class="stat-value">${displayWind}</div>
                    <div class="stat-unit">${wUnit}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">💨 Gusts</div>
                    <div class="stat-value">${displayGusts}</div>
                    <div class="stat-unit">${wUnit}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">🔬 Pressure</div>
                    <div class="stat-value">${pVal}</div>
                    <div class="stat-unit">${pUnit}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">☀️ UV Index</div>
                    <div class="stat-value">${Math.round(current.uvIndex)}</div>
                    <div class="stat-unit">${getUVLabel(current.uvIndex)}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">👁️ Visibility</div>
                    <div class="stat-value">${parseFloat(current.visibility).toFixed(1)}</div>
                    <div class="stat-unit">km</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">☁️ Cloud Cover</div>
                    <div class="stat-value">${current.cloudCover}%</div>
                    <div class="stat-unit">${current.cloudCover < 25 ? 'Clear' : current.cloudCover < 75 ? 'Partly' : 'Overcast'}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">🌡️ Dew Point</div>
                    <div class="stat-value">${toDisplay(current.dewPoint || 0)}°</div>
                    <div class="stat-unit">${unit}</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">🌧️ Precip</div>
                    <div class="stat-value">${parseFloat(current.precipitation || 0).toFixed(1)}</div>
                    <div class="stat-unit">mm</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">🧭 Wind Dir</div>
                    <div class="stat-value">${getWindDirection(current.windDir || 0)}</div>
                    <div class="stat-unit">${current.windDir || 0}°</div>
                </div>
                <div class="stat" role="listitem">
                    <div class="stat-label">🌿 Comfort</div>
                    <div class="stat-value">${comfortIndex.score}</div>
                    <div class="stat-unit">${comfortIndex.label}</div>
                </div>
            </div>
        </div>`;

        // Alerts
        if (alerts) html += alerts;

        // Hourly forecast
        if (hourly && hourly.length > 0) {
            html += `<div class="weather-card" role="region" aria-label="Hourly Forecast">
                <div class="section-title">⏰ Hourly Forecast</div>
                <div class="hourly" role="list">`;

            hourly.slice(0, 24).forEach((h, idx) => {
                const hDate    = new Date(h.time);
                const hHour    = hDate.getHours();
                const isNow    = idx === 0;
                const timeLabel = isNow ? 'Now' : hDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const hIcon    = getWeatherIcon(h.code, hHour >= 6 && hHour < 20);
                const hTemp    = toDisplay(h.temp);
                const hWind    = windDisplay(h.wind || 0);
                const wUnit_   = windUnit();
                const precipPct = h.precipitation || 0;
                const precipBar = precipPct > 0
                    ? `<div class="hour-precip-bar" style="width:${precipPct}%;"></div>`
                    : '';

                html += `<div class="hour${isNow ? ' hour-now' : ''}" role="listitem" aria-label="${timeLabel}: ${hTemp}°, ${precipPct}% rain, ${hWind} ${wUnit_} wind">
                    <div class="hour-time">${timeLabel}</div>
                    <div class="hour-icon" aria-hidden="true">${hIcon}</div>
                    <div class="hour-temp">${hTemp}°</div>
                    <div class="hour-precip">💧${precipPct}%</div>
                    <div class="hour-wind">💨${hWind}</div>
                    <div class="hour-precip-track">${precipBar}</div>
                </div>`;
            });

            html += `</div></div>`;
        }

        // Daily forecast
        if (daily && daily.length > 0) {
            html += `<div class="weather-card" role="region" aria-label="14-Day Forecast">
                <div class="section-title">📅 14-Day Forecast</div>
                <div class="daily" role="list">`;

            daily.slice(0, 14).forEach((d, i) => {
                const dateObj   = new Date(d.date + 'T12:00:00');
                const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                const dIcon     = getWeatherIcon(d.code, true);

                html += `<div class="day" role="listitem" aria-label="${dateLabel}: ${toDisplay(d.maxTemp)}° high, ${toDisplay(d.minTemp)}° low">
                    <div class="day-date">${dateLabel}</div>
                    <div class="day-icon" aria-hidden="true">${dIcon}</div>
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
        html += `<div class="weather-card" role="region" aria-label="Detailed Analysis">
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
                    <div class="detail-value">${pVal} ${pUnit}</div>
                    <div class="detail-sub">${getPressureLabel(current.pressure)}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-title">Wind</div>
                    <div class="detail-value">${windDisplay(current.windSpeed)} ${wUnit}</div>
                    <div class="detail-sub">${getWindDirection(current.windDir || 0)} · Gusts ${windDisplay(current.windGusts)} ${wUnit}</div>
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
                    <div class="detail-title">Humidity Comfort</div>
                    <div class="detail-value">${comfortIndex.score}/100</div>
                    <div class="detail-sub">${comfortIndex.label} — ${comfortIndex.description}</div>
                </div>
            </div>
        </div>`;

        return html;
    }

    /* ----------------------------------------------------------
       NOTIFICATIONS
       ---------------------------------------------------------- */

    _sendAlertNotifications(current, daily) {
        if (!notifications.enabled) return;
        if (!settings.get('notificationsEnabled')) return;

        // Check for new severe weather conditions to notify
        const lastNotif = localStorage.getItem('mini-weather-last-notif') || '{}';
        const lastData = JSON.parse(lastNotif);
        const now = Date.now();

        // Rate limit notifications to every 30 minutes
        const NOTIF_COOLDOWN = 30 * 60 * 1000;

        if (settings.get('alertUV') && current.uvIndex >= 11 && (!lastData.uvTime || now - lastData.uvTime > NOTIF_COOLDOWN)) {
            notifications.send('⚠️ Extreme UV Alert', { 
                body: `UV Index: ${Math.round(current.uvIndex)} — Avoid sun exposure`,
                type: 'alert'
            });
            lastData.uvTime = now;
        }
        if (settings.get('alertWind') && current.windSpeed >= 60 && (!lastData.windTime || now - lastData.windTime > NOTIF_COOLDOWN)) {
            notifications.send('⚠️ Severe Wind Alert', { 
                body: `Winds: ${windDisplay(current.windSpeed)} ${windUnit()}`,
                type: 'alert'
            });
            lastData.windTime = now;
        }
        if (settings.get('alertRain') && daily && daily[0] && daily[0].precipChance >= 80 && (!lastData.rainTime || now - lastData.rainTime > NOTIF_COOLDOWN)) {
            notifications.send('🌧️ Heavy Rain Expected', { 
                body: `${daily[0].precipChance}% chance of rain today`,
                type: 'warning'
            });
            lastData.rainTime = now;
        }
        if (settings.get('alertCold') && current.temp <= 0 && (!lastData.coldTime || now - lastData.coldTime > NOTIF_COOLDOWN)) {
            notifications.send('❄️ Freezing Conditions', { 
                body: `Temperature: ${toDisplay(current.temp)}°${unit}`,
                type: 'warning'
            });
            lastData.coldTime = now;
        }
        if (settings.get('alertHeat') && current.temp >= 38 && (!lastData.heatTime || now - lastData.heatTime > NOTIF_COOLDOWN)) {
            notifications.send('🔥 Extreme Heat', { 
                body: `Temperature: ${toDisplay(current.temp)}°${unit}`,
                type: 'alert'
            });
            lastData.heatTime = now;
        }

        localStorage.setItem('mini-weather-last-notif', JSON.stringify(lastData));
    }

    /**
     * Generate a comprehensive weather report for the day
     */
    generateWeatherReport(current, hourly, daily) {
        const report = {
            date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
            location: this.locationName || 'Unknown Location',
            overview: '',
            highlights: [],
            details: {},
            recommendations: []
        };

        // Overview
        const temp = toDisplay(current.temp);
        const condition = current.description || 'Unknown';
        report.overview = `Today's weather in ${report.location}: ${condition} with temperatures around ${temp}°${unit}.`;

        // Highlights
        if (daily && daily[0]) {
            const today = daily[0];
            if (today.maxTemp && today.minTemp) {
                report.highlights.push({
                    icon: '🌡️',
                    label: 'Temperature Range',
                    value: `${toDisplay(today.minTemp)}° - ${toDisplay(today.maxTemp)}°${unit}`
                });
            }
            if (today.precipChance) {
                report.highlights.push({
                    icon: '💧',
                    label: 'Rain Chance',
                    value: `${today.precipChance}%`
                });
            }
            if (current.humidity) {
                report.highlights.push({
                    icon: '💦',
                    label: 'Humidity',
                    value: `${current.humidity}%`
                });
            }
            if (current.windSpeed) {
                report.highlights.push({
                    icon: '💨',
                    label: 'Wind Speed',
                    value: `${windDisplay(current.windSpeed)} ${windUnit()}`
                });
            }
            if (current.uvIndex) {
                report.highlights.push({
                    icon: '☀️',
                    label: 'UV Index',
                    value: `${Math.round(current.uvIndex)} (${getUVLabel(current.uvIndex)})`
                });
            }
            if (today.sunrise && today.sunset) {
                report.highlights.push({
                    icon: '🌅',
                    label: 'Sun',
                    value: `${this._formatSunTime(today.sunrise)} - ${this._formatSunTime(today.sunset)}`
                });
            }
        }

        // Hourly breakdown
        const nextHours = hourly ? hourly.slice(0, 12) : [];
        if (nextHours.length > 0) {
            const peakTemp = Math.max(...nextHours.map(h => h.temp).filter(t => t != null));
            const minTemp = Math.min(...nextHours.map(h => h.temp).filter(t => t != null));
            report.details.hourlyPeak = { temp: peakTemp, time: nextHours.find(h => h.temp === peakTemp)?.time };
            report.details.hourlyMin = { temp: minTemp, time: nextHours.find(h => h.temp === minTemp)?.time };
        }

        // Recommendations
        if (current.uvIndex >= 6) {
            report.recommendations.push({ icon: '🧴', text: 'Apply sunscreen before going outside' });
        }
        if (current.temp >= 30) {
            report.recommendations.push({ icon: '💧', text: 'Stay hydrated - drink plenty of water' });
        }
        if (current.temp <= 5) {
            report.recommendations.push({ icon: '🧥', text: 'Dress warmly with layered clothing' });
        }
        if (daily && daily[0] && daily[0].precipChance >= 50) {
            report.recommendations.push({ icon: '☂️', text: 'Carry an umbrella or rain jacket' });
        }
        if (current.windSpeed >= 30) {
            report.recommendations.push({ icon: '🏠', text: 'Secure loose outdoor items' });
        }
        if (current.humidity >= 80) {
            report.recommendations.push({ icon: '🌿', text: 'May feel muggy - AC or dehumidifier recommended' });
        }

        return report;
    }

    /**
     * Render weather report to HTML
     */
    renderWeatherReport(report) {
        const chips = report.highlights.map(h => `
            <div class="report-chip">
                <span>${h.icon}</span>
                <span>${h.value}</span>
            </div>
        `).join('');

        const recommendations = report.recommendations.map(r => `
            <div style="padding:6px 0;font-size:0.75rem;color:var(--text-dim);">
                <span style="margin-right:8px;">${r.icon}</span>${r.text}
            </div>
        `).join('');

        return `
            <div class="weather-report">
                <div class="report-header">
                    <div class="report-title">
                        📋 Daily Weather Report
                        <span class="report-badge">${report.date}</span>
                    </div>
                </div>
                <div class="report-content">
                    <p><strong>${report.overview}</strong></p>
                </div>
                <div class="report-highlights">
                    ${chips}
                </div>
                ${recommendations ? `
                    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">
                        <div style="font-size:0.75rem;font-weight:600;color:var(--accent-light);margin-bottom:8px;">💡 Recommendations</div>
                        ${recommendations}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get current weather report HTML
     */
    getReportHTML() {
        if (!this.currentWeather) {
            return '<div class="weather-report"><p style="color:var(--text-muted);text-align:center;">No weather data available. Fetch weather first.</p></div>';
        }
        const report = this.generateWeatherReport(
            this.currentWeather.current,
            this.currentWeather.hourly,
            this.currentWeather.daily
        );
        return this.renderWeatherReport(report);
    }

    /* ----------------------------------------------------------
       LOADING / ERROR STATES
       ---------------------------------------------------------- */

    showLoading() {
        const container = document.getElementById('weather-content');
        if (!container) return;
        container.innerHTML = `
            <div class="loading" role="status" aria-live="polite">
                <div class="loading-skeleton">
                    <div class="skeleton skeleton-temp"></div>
                    <div class="skeleton skeleton-row"></div>
                    <div class="skeleton skeleton-row short"></div>
                </div>
                <div class="spinner" aria-hidden="true"></div>
                <p class="loading-text">Fetching weather data from Open-Meteo…</p>
            </div>`;
    }

    showError(message) {
        const container = document.getElementById('weather-content');
        if (!container) return;
        // Use textContent for the message to prevent XSS
        const div = document.createElement('div');
        div.className = 'error';
        div.setAttribute('role', 'alert');
        div.innerHTML = `<div class="error-title">⚠️ Unable to load weather</div>`;
        const msg = document.createElement('div');
        msg.className = 'error-msg';
        msg.textContent = message;
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.textContent = '📍 Try GPS';
        btn.addEventListener('click', () => this.requestLocation());
        const searchBtn = document.createElement('button');
        searchBtn.textContent = '🔍 Search City';
        searchBtn.addEventListener('click', () => this.showSearchModal());
        btnRow.appendChild(btn);
        btnRow.appendChild(searchBtn);
        div.appendChild(msg);
        div.appendChild(btnRow);
        container.innerHTML = '';
        container.appendChild(div);
    }

    /* ----------------------------------------------------------
       UNIT TOGGLE
       ---------------------------------------------------------- */

    toggleUnit() {
        unit = unit === 'C' ? 'F' : 'C';
        settings.set('tempUnit', unit);
        localStorage.setItem('mini-weather-unit', unit);
        const btn = document.getElementById('unit-btn');
        if (btn) btn.textContent = `°${unit}`;
        showToast(`Switched to °${unit}`);
        if (this.currentWeather) this._render();
    }

    /* ----------------------------------------------------------
       NOTIFICATIONS TOGGLE
       ---------------------------------------------------------- */

    async toggleNotifications() {
        const granted = await notifications.requestPermission();
        if (granted) {
            settings.set('notificationsEnabled', true);
            showToast('🔔 Notifications enabled!');
            notifications.send('Mini Weather', { body: 'Weather alerts are now active.' });
        } else {
            settings.set('notificationsEnabled', false);
            showToast('🔕 Notifications blocked');
        }
    }

    /* ----------------------------------------------------------
       REFRESH
       ---------------------------------------------------------- */

    refresh() {
        if (!this.currentLocation) {
            showToast('📍 Please get your location first');
            return;
        }
        const { latitude, longitude } = this.currentLocation;
        const cacheKey = `${parseFloat(latitude).toFixed(3)}-${parseFloat(longitude).toFixed(3)}-${this.apiSource}`;
        this.cache.delete(cacheKey);
        this.locationName = null;
        showToast('🔄 Refreshing…');
        this.fetchWeather();
    }

    /* ----------------------------------------------------------
       API MODAL
       ---------------------------------------------------------- */

    showAPIModal() {
        const list = document.getElementById('api-list');
        if (!list) return;
        list.innerHTML = '';

        Object.entries(this.apis).forEach(([key, api]) => {
            const div = document.createElement('div');
            div.className = 'api-option' + (key === this.apiSource ? ' selected' : '');
            div.setAttribute('role', 'button');
            div.setAttribute('tabindex', '0');
            div.setAttribute('aria-pressed', key === this.apiSource ? 'true' : 'false');

            const nameEl = document.createElement('div');
            nameEl.className = 'api-name';
            nameEl.textContent = api.name;

            const badge = document.createElement('span');
            badge.className = 'api-badge';
            badge.textContent = api.badge;
            nameEl.appendChild(badge);

            if (key === this.apiSource) {
                const activeBadge = document.createElement('span');
                activeBadge.className = 'api-badge';
                activeBadge.style.background = 'var(--success)';
                activeBadge.textContent = 'ACTIVE';
                nameEl.appendChild(activeBadge);
            }

            const descEl = document.createElement('div');
            descEl.className = 'api-desc';
            descEl.textContent = api.desc;

            div.appendChild(nameEl);
            div.appendChild(descEl);

            const select = () => {
                this.apiSource = key;
                settings.set('apiSource', key);
                localStorage.setItem('mini-weather-api', key);
                this.closeAPIModal();
                this.cache.clear();
                showToast(`📡 Switched to ${api.name}`);
                if (this.currentLocation) this.fetchWeather();
            };

            div.addEventListener('click', select);
            div.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
            list.appendChild(div);
        });

        document.getElementById('api-modal').classList.add('active');
    }

    closeAPIModal() {
        const modal = document.getElementById('api-modal');
        if (modal) modal.classList.remove('active');
    }

    /* ----------------------------------------------------------
       SETTINGS MODAL
       ---------------------------------------------------------- */

    showSettingsModal() {
        const body = document.getElementById('settings-modal-body');
        if (!body) return;

        const s = settings;
        const savedLocs = s.get('savedLocations') || [];
        const searchHist = s.get('searchHistory') || [];

        body.innerHTML = `
            <div class="settings-section">
                <div class="settings-section-title">🎨 Display</div>
                <div class="settings-row">
                    <label class="settings-label" for="s-font-size">Font Size</label>
                    <select id="s-font-size" class="settings-select">
                        <option value="small"  ${s.get('fontSize') === 'small'  ? 'selected' : ''}>Small</option>
                        <option value="medium" ${s.get('fontSize') === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="large"  ${s.get('fontSize') === 'large'  ? 'selected' : ''}>Large</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label class="settings-label" for="s-density">Layout Density</label>
                    <select id="s-density" class="settings-select">
                        <option value="compact"     ${s.get('density') === 'compact'     ? 'selected' : ''}>Compact</option>
                        <option value="normal"      ${s.get('density') === 'normal'      ? 'selected' : ''}>Normal</option>
                        <option value="comfortable" ${s.get('density') === 'comfortable' ? 'selected' : ''}>Comfortable</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Show AI Forecast</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-show-ai" ${s.get('showAIForecast') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Show Virtual Garden</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-show-garden" ${s.get('showGarden') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Show Weather Alerts</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-show-alerts" ${s.get('showAlerts') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">📏 Units</div>
                <div class="settings-row">
                    <label class="settings-label" for="s-temp-unit">Temperature</label>
                    <select id="s-temp-unit" class="settings-select">
                        <option value="C" ${s.get('tempUnit') === 'C' ? 'selected' : ''}>Celsius (°C)</option>
                        <option value="F" ${s.get('tempUnit') === 'F' ? 'selected' : ''}>Fahrenheit (°F)</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label class="settings-label" for="s-wind-unit">Wind Speed</label>
                    <select id="s-wind-unit" class="settings-select">
                        <option value="kmh" ${s.get('windUnit') === 'kmh' ? 'selected' : ''}>km/h</option>
                        <option value="mph" ${s.get('windUnit') === 'mph' ? 'selected' : ''}>mph</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label class="settings-label" for="s-pressure-unit">Pressure</label>
                    <select id="s-pressure-unit" class="settings-select">
                        <option value="hpa"  ${s.get('pressureUnit') === 'hpa'  ? 'selected' : ''}>hPa</option>
                        <option value="inhg" ${s.get('pressureUnit') === 'inhg' ? 'selected' : ''}>inHg</option>
                    </select>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">🔔 Notifications & Alerts</div>
                <div class="settings-row">
                    <label class="settings-label">Enable Notifications</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-notif" ${s.get('notificationsEnabled') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">UV Alerts</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-alert-uv" ${s.get('alertUV') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Wind Alerts</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-alert-wind" ${s.get('alertWind') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Rain Alerts</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-alert-rain" ${s.get('alertRain') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Cold Alerts</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-alert-cold" ${s.get('alertCold') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Heat Alerts</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-alert-heat" ${s.get('alertHeat') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>

            <div class="settings-section">
                <div class="settings-section-title">📍 Location</div>
                ${savedLocs.length > 0 ? `
                <div class="settings-saved-locs">
                    ${savedLocs.map(loc => `
                        <div class="settings-loc-item">
                            <span>📍 ${loc.name}</span>
                            <button class="settings-loc-remove" data-name="${loc.name}" aria-label="Remove ${loc.name}">✕</button>
                        </div>`).join('')}
                </div>` : '<p class="settings-empty">No saved locations yet.</p>'}
                ${this.locationName ? `
                <button id="s-save-loc" class="settings-action-btn">💾 Save Current Location</button>` : ''}
                ${searchHist.length > 0 ? `
                <div class="settings-section-title" style="margin-top:12px;font-size:0.75rem;">Recent Searches</div>
                <div class="settings-search-hist">
                    ${searchHist.slice(0, 5).map(h => `
                        <div class="settings-hist-item" data-lat="${h.lat}" data-lon="${h.lon}" role="button" tabindex="0">
                            🕐 ${h.name}
                        </div>`).join('')}
                </div>` : ''}
            </div>

            <div class="settings-section">
                <div class="settings-section-title">⚙️ Advanced</div>
                <div class="settings-row">
                    <label class="settings-label" for="s-cache">Cache Duration</label>
                    <select id="s-cache" class="settings-select">
                        <option value="5"  ${s.get('cacheMinutes') === 5  ? 'selected' : ''}>5 minutes</option>
                        <option value="10" ${s.get('cacheMinutes') === 10 ? 'selected' : ''}>10 minutes</option>
                        <option value="30" ${s.get('cacheMinutes') === 30 ? 'selected' : ''}>30 minutes</option>
                        <option value="60" ${s.get('cacheMinutes') === 60 ? 'selected' : ''}>1 hour</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label class="settings-label">Debug Mode</label>
                    <label class="settings-toggle">
                        <input type="checkbox" id="s-debug" ${s.get('debugMode') ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                <div class="settings-row">
                    <button id="s-reset" class="settings-action-btn settings-danger-btn">🔄 Reset All Settings</button>
                </div>
            </div>`;

        // Wire up settings controls
        this._bindSettingsControls(body);

        document.getElementById('settings-modal').classList.add('active');
    }

    _bindSettingsControls(body) {
        const s = settings;

        const bind = (id, key, transform = v => v) => {
            const el = body.querySelector(`#${id}`);
            if (!el) return;
            const handler = () => {
                const val = el.type === 'checkbox' ? el.checked : transform(el.value);
                s.set(key, val);
                if (['tempUnit','windUnit','pressureUnit'].includes(key)) {
                    if (key === 'tempUnit') { unit = val; }
                    if (this.currentWeather) this._render();
                }
                if (key === 'fontSize') this._applyFontSize();
                if (key === 'density')  this._applyDensity();
            };
            el.addEventListener('change', handler);
        };

        bind('s-font-size',      'fontSize');
        bind('s-density',        'density');
        bind('s-show-ai',        'showAIForecast');
        bind('s-show-garden',    'showGarden');
        bind('s-show-alerts',    'showAlerts');
        bind('s-temp-unit',      'tempUnit');
        bind('s-wind-unit',      'windUnit');
        bind('s-pressure-unit',  'pressureUnit');
        bind('s-notif',          'notificationsEnabled');
        bind('s-alert-uv',       'alertUV');
        bind('s-alert-wind',     'alertWind');
        bind('s-alert-rain',     'alertRain');
        bind('s-alert-cold',     'alertCold');
        bind('s-alert-heat',     'alertHeat');
        bind('s-cache',          'cacheMinutes', v => parseInt(v, 10));
        bind('s-debug',          'debugMode');

        // Save current location
        const saveLocBtn = body.querySelector('#s-save-loc');
        if (saveLocBtn && this.locationName && this.currentLocation) {
            saveLocBtn.addEventListener('click', () => {
                s.addSavedLocation(this.locationName, this.currentLocation.latitude, this.currentLocation.longitude);
                showToast(`💾 Saved: ${this.locationName}`);
                this.showSettingsModal(); // Refresh
            });
        }

        // Remove saved location buttons
        body.querySelectorAll('.settings-loc-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                s.removeSavedLocation(name);
                showToast(`🗑️ Removed: ${name}`);
                this.showSettingsModal(); // Refresh
            });
        });

        // Search history items
        body.querySelectorAll('.settings-hist-item').forEach(item => {
            const go = () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                if (!isNaN(lat) && !isNaN(lon)) {
                    this.currentLocation = { latitude: lat, longitude: lon };
                    this.locationName = null;
                    this.closeSettingsModal();
                    this.fetchWeather();
                }
            };
            item.addEventListener('click', go);
            item.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
        });

        // Reset settings
        const resetBtn = body.querySelector('#s-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Reset all settings to defaults?')) {
                    s.reset();
                    unit = s.get('tempUnit');
                    showToast('🔄 Settings reset to defaults');
                    this.closeSettingsModal();
                    if (this.currentWeather) this._render();
                }
            });
        }
    }

    closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.remove('active');
    }

    /* ----------------------------------------------------------
       UTILITY METHODS
       ---------------------------------------------------------- */

    /** Apply font size setting to the root element. */
    _applyFontSize() {
        const size = settings.get('fontSize');
        const map = { small: '14px', medium: '16px', large: '18px' };
        document.documentElement.style.setProperty('--base-font-size', map[size] || '16px');
    }

    /** Apply layout density setting. */
    _applyDensity() {
        const density = settings.get('density');
        document.body.setAttribute('data-density', density || 'normal');
    }

    /**
     * Format a sunrise/sunset time string to HH:MM.
     * Handles both ISO strings and "06:30 AM" style strings.
     * @param {string} timeStr
     * @returns {string}
     */
    _formatSunTime(timeStr) {
        if (!timeStr) return '';
        try {
            // ISO datetime
            if (timeStr.includes('T')) {
                return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            // "06:30 AM" style
            if (timeStr.includes(':')) {
                const d = new Date(`2000-01-01 ${timeStr}`);
                if (!isNaN(d)) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return timeStr;
        } catch {
            return timeStr;
        }
    }

    /**
     * Calculate approximate moon phase for today.
     * @returns {string} emoji + label
     */
    _getMoonPhase() {
        const now = new Date();
        // Known new moon: Jan 6, 2000
        const knownNewMoon = new Date('2000-01-06T18:14:00Z');
        const lunarCycle = 29.53058867; // days
        const daysSince = (now - knownNewMoon) / (1000 * 60 * 60 * 24);
        const phase = ((daysSince % lunarCycle) + lunarCycle) % lunarCycle;

        if (phase < 1.85)  return '🌑 New Moon';
        if (phase < 7.38)  return '🌒 Waxing Crescent';
        if (phase < 9.22)  return '🌓 First Quarter';
        if (phase < 14.77) return '🌔 Waxing Gibbous';
        if (phase < 16.61) return '🌕 Full Moon';
        if (phase < 22.15) return '🌖 Waning Gibbous';
        if (phase < 23.99) return '🌗 Last Quarter';
        if (phase < 29.53) return '🌘 Waning Crescent';
        return '🌑 New Moon';
    }

    /**
     * Calculate a humidity comfort index (0–100) based on temp + humidity.
     * @param {number} tempC
     * @param {number} humidity
     * @returns {{score: number, label: string, description: string}}
     */
    _humidityComfort(tempC, humidity) {
        if (typeof tempC !== 'number' || typeof humidity !== 'number') {
            return { score: 50, label: 'Unknown', description: 'No data' };
        }

        // Heat index approximation
        let score = 100;

        // Temperature penalty
        if (tempC < 10 || tempC > 35) score -= 30;
        else if (tempC < 15 || tempC > 30) score -= 15;

        // Humidity penalty
        if (humidity < 20 || humidity > 80) score -= 30;
        else if (humidity < 30 || humidity > 70) score -= 15;

        // Combined heat + humidity (feels muggy)
        if (tempC > 25 && humidity > 70) score -= 20;

        score = Math.max(0, Math.min(100, score));

        const label = score >= 80 ? 'Ideal' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : score >= 20 ? 'Poor' : 'Uncomfortable';
        const description = score >= 80 ? 'Very comfortable conditions'
            : score >= 60 ? 'Comfortable for most activities'
            : score >= 40 ? 'Somewhat uncomfortable'
            : score >= 20 ? 'Uncomfortable — consider staying indoors'
            : 'Very uncomfortable conditions';

        return { score, label, description };
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

// Show privacy banner if not yet acknowledged
if (typeof privacyManager !== 'undefined') {
    privacyManager.maybeShowBanner();
}

/* ============================================================
   MOBILE BOTTOM NAVIGATION
   ============================================================ */
function initMobileNav() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            
            // Update active state
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            // Handle tab content
            switch (tab) {
                case 'home':
                    // Show main weather content
                    document.getElementById('weather-content').style.display = 'block';
                    closeAllMobilePanels();
                    break;
                case 'alerts':
                    // Show notification panel
                    notifMgr.showNotificationPanel();
                    break;
                case 'report':
                    // Show daily weather report
                    if (typeof app.getReportHTML === 'function') {
                        document.getElementById('weather-content').style.display = 'block';
                        closeAllMobilePanels();
                        // Insert report at top
                        const container = document.getElementById('weather-content');
                        if (container) {
                            const reportHTML = app.getReportHTML();
                            const currentContent = container.innerHTML;
                            // Only prepend if not already showing report
                            if (!currentContent.includes('Daily Weather Report')) {
                                container.innerHTML = reportHTML + currentContent;
                            }
                        }
                    }
                    break;
                case 'hourly':
                    // Scroll to hourly forecast
                    document.getElementById('weather-content').style.display = 'block';
                    closeAllMobilePanels();
                    const hourlySection = document.querySelector('.hourly');
                    if (hourlySection) {
                        hourlySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    break;
                case 'settings':
                    // Open settings modal
                    if (typeof app !== 'undefined') {
                        app.showSettingsModal();
                    }
                    break;
            }
        });
    });
    
    // Notification panel close button
    const clearAllBtn = document.getElementById('notif-clear-all');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Clear all notifications?')) {
                notifMgr.clearAll();
            }
        });
    }
    
    // Notification overlay click to close
    const notifOverlay = document.getElementById('notif-overlay');
    if (notifOverlay) {
        notifOverlay.addEventListener('click', () => {
            notifMgr.hideNotificationPanel();
        });
    }
    
    // Notification panel close on mobile swipe right
    let touchStartX = 0;
    const notifPanel = document.getElementById('notification-panel');
    if (notifPanel) {
        notifPanel.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        
        notifPanel.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const diff = touchEndX - touchStartX;
            if (diff > 80 && touchStartX < 50) {
                notifMgr.hideNotificationPanel();
            }
        }, { passive: true });
    }
}

function closeAllMobilePanels() {
    notifMgr.hideNotificationPanel();
}

// Initialize mobile nav when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    initMobileNav();
}

// Also expose app methods globally for the nav
window.app = app;
window.notifMgr = notifMgr;
