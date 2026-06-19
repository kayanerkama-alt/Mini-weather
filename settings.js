/**
 * Mini Weather — Settings Page Logic
 * Handles all settings persistence, UI interactions, and garden management.
 */

'use strict';

/* ============================================================
   SETTINGS SCHEMA & DEFAULTS
   ============================================================ */
const SETTINGS_KEY = 'mini-weather-settings';

/** @type {Object} Default settings values */
const SETTINGS_DEFAULTS = {
    // General
    unit: 'C',
    timeFormat: '12h',
    windUnit: 'kmh',
    autoLocation: true,
    refreshInterval: '10',
    apiSource: 'weatherapi',

    // Privacy
    aiForecasts: true,
    analytics: false,
    errorReporting: false,
    notifications: false,
    uvAlerts: true,
    rainAlerts: true,
    windAlerts: true,

    // Appearance
    theme: 'dark',
    fontSize: 'normal',
    reduceMotion: false,
    compactMode: false,
    showDeviceBadge: true,
    showPrecipChart: true,

    // Garden
    gardenMonthlyReset: true,
    gardenAnimations: true,
};

/**
 * Load settings from localStorage, merging with defaults.
 * @returns {Object} Current settings
 */
function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...SETTINGS_DEFAULTS };
        const parsed = JSON.parse(raw);
        // Merge with defaults to handle new keys added in updates
        return { ...SETTINGS_DEFAULTS, ...parsed };
    } catch {
        return { ...SETTINGS_DEFAULTS };
    }
}

/**
 * Save settings to localStorage.
 * @param {Object} settings
 */
function saveSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        // Also sync individual legacy keys for backward compatibility with app.js
        if (settings.unit) localStorage.setItem('mini-weather-unit', settings.unit);
        if (settings.theme) localStorage.setItem('mini-weather-theme', settings.theme);
        if (settings.apiSource) localStorage.setItem('mini-weather-api', settings.apiSource);
        if (typeof settings.notifications === 'boolean') {
            localStorage.setItem('mini-weather-notifications', settings.notifications ? 'true' : 'false');
        }
    } catch (e) {
        console.warn('Settings save failed:', e);
    }
}

// Current settings state
let settings = loadSettings();

/* ============================================================
   THEME DEFINITIONS (subset for settings page)
   ============================================================ */
const THEMES = {
    dark:              { label: 'Dark',            bg: '#0a0a0a', accent: '#1e88e5' },
    light:             { label: 'Light',           bg: '#f5f7fa', accent: '#1565c0' },
    ocean:             { label: 'Ocean',           bg: '#0d1b2a', accent: '#00b4d8' },
    forest:            { label: 'Forest',          bg: '#0a1a0a', accent: '#4caf50' },
    jungle:            { label: 'Jungle',          bg: '#081208', accent: '#388e3c' },
    desert:            { label: 'Desert',          bg: '#1a1208', accent: '#e65100' },
    glacier:           { label: 'Glacier',         bg: '#0a1520', accent: '#00b0ff' },
    aurora:            { label: 'Aurora',          bg: '#050f1a', accent: '#00e5ff' },
    sunset:            { label: 'Sunset',          bg: '#1a0a00', accent: '#ff6b35' },
    warm:              { label: 'Warm',            bg: '#1a1208', accent: '#ff8f00' },
    amber:             { label: 'Amber',           bg: '#1a1200', accent: '#ffc107' },
    retro:             { label: 'Retro',           bg: '#1a1000', accent: '#ff8800' },
    solstice:          { label: 'Solstice',        bg: '#1a0a00', accent: '#ff6f00' },
    flame:             { label: 'Flame',           bg: '#100500', accent: '#ff3d00' },
    coral:             { label: 'Coral',           bg: '#1a0a08', accent: '#ff5722' },
    cool:              { label: 'Cool',            bg: '#0a1020', accent: '#4488ff' },
    nord:              { label: 'Nord',            bg: '#2e3440', accent: '#88c0d0' },
    solarized:         { label: 'Solarized',       bg: '#002b36', accent: '#268bd2' },
    slate:             { label: 'Slate',           bg: '#1a1f2e', accent: '#7c9ef8' },
    midnight:          { label: 'Midnight',        bg: '#020408', accent: '#3a6fd8' },
    storm:             { label: 'Storm',           bg: '#0a0c10', accent: '#546e7a' },
    lavender:          { label: 'Lavender',        bg: '#1a1025', accent: '#9c27b0' },
    berry:             { label: 'Berry',           bg: '#1a0a15', accent: '#e91e63' },
    dracula:           { label: 'Dracula',         bg: '#282a36', accent: '#bd93f9' },
    eclipse:           { label: 'Eclipse',         bg: '#0a0510', accent: '#7c4dff' },
    nebula:            { label: 'Nebula',          bg: '#080510', accent: '#aa00ff' },
    twilight:          { label: 'Twilight',        bg: '#0f0a1a', accent: '#7e57c2' },
    mystic:            { label: 'Mystic',          bg: '#080510', accent: '#6a1b9a' },
    amethyst:          { label: 'Amethyst',        bg: '#0f0818', accent: '#9c27b0' },
    rose:              { label: 'Rose',            bg: '#1a0810', accent: '#f06292' },
    mint:              { label: 'Mint',            bg: '#0a1a15', accent: '#00bfa5' },
    emerald:           { label: 'Emerald',         bg: '#051a10', accent: '#00c853' },
    jade:              { label: 'Jade',            bg: '#081510', accent: '#00897b' },
    topaz:             { label: 'Topaz',           bg: '#0a1510', accent: '#26a69a' },
    cyberpunk:         { label: 'Cyberpunk',       bg: '#0a0015', accent: '#ff0080' },
    neon:              { label: 'Neon',            bg: '#050510', accent: '#00ff88' },
    gruvbox:           { label: 'Gruvbox',         bg: '#282828', accent: '#d79921' },
    monochrome:        { label: 'Mono',            bg: '#000000', accent: '#ffffff' },
    obsidian:          { label: 'Obsidian',        bg: '#050505', accent: '#424242' },
    shadow:            { label: 'Shadow',          bg: '#080808', accent: '#808080' },
    pastel:            { label: 'Pastel',          bg: '#fef9ff', accent: '#c084fc' },
    ice:               { label: 'Ice',             bg: '#f0f8ff', accent: '#0288d1' },
    pearl:             { label: 'Pearl',           bg: '#f8f8ff', accent: '#7986cb' },
    ethereal:          { label: 'Ethereal',        bg: '#f8f0ff', accent: '#ab47bc' },
    radiant:           { label: 'Radiant',         bg: '#fff8e8', accent: '#f57f17' },
    ruby:              { label: 'Ruby',            bg: '#1a0505', accent: '#c62828' },
    sapphire:          { label: 'Sapphire',        bg: '#050a1a', accent: '#1565c0' },
    bronze:            { label: 'Bronze',          bg: '#150e05', accent: '#a0522d' },
    silver:            { label: 'Silver',          bg: '#1a1a1e', accent: '#9e9e9e' },
    gold:              { label: 'Gold',            bg: '#120e00', accent: '#ffd600' },
    copper:            { label: 'Copper',          bg: '#120a05', accent: '#bf6030' },
    platinum:          { label: 'Platinum',        bg: '#f0f2f5', accent: '#607d8b' },
    coffee:            { label: 'Coffee',          bg: '#1a1008', accent: '#8d6e63' },
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

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */
/**
 * Show a brief toast notification.
 * @param {string} msg - Message to display
 * @param {number} [duration=2800] - Duration in ms
 */
function showToast(msg, duration = 2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ============================================================
   SETTING MUTATION
   ============================================================ */
/**
 * Update a single setting value and persist.
 * @param {string} key - Setting key
 * @param {*} value - New value
 */
function setSetting(key, value) {
    settings[key] = value;
    saveSettings(settings);

    // Apply immediate side effects
    if (key === 'theme') applyTheme(value);
    if (key === 'fontSize') applyFontSize(value);
    if (key === 'reduceMotion') applyReduceMotion(value);
    if (key === 'compactMode') applyCompactMode(value);

    showToast('✅ Setting saved');
}

/* ============================================================
   THEME APPLICATION
   ============================================================ */
/**
 * Apply a theme to the document.
 * @param {string} key - Theme key
 */
function applyTheme(key) {
    if (!THEMES[key]) key = 'dark';
    document.body.setAttribute('data-theme', key);
    settings.theme = key;
    saveSettings(settings);

    // Update active swatch
    document.querySelectorAll('.theme-swatch-settings').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === key);
    });
}

/* ============================================================
   FONT SIZE
   ============================================================ */
const FONT_SIZES = { small: '13px', normal: '15px', large: '17px', xlarge: '19px' };

/**
 * Apply font size to the document root.
 * @param {string} size - 'small' | 'normal' | 'large' | 'xlarge'
 */
function applyFontSize(size) {
    document.documentElement.style.fontSize = FONT_SIZES[size] || FONT_SIZES.normal;
    localStorage.setItem('mini-weather-fontsize', size);

    // Update button states
    ['small', 'normal', 'large', 'xlarge'].forEach(s => {
        const btn = document.getElementById(`font-${s}`);
        if (btn) btn.classList.toggle('active', s === size);
    });

    // Update preview
    const preview = document.getElementById('font-preview');
    if (preview) {
        const labels = { small: 'Small (13px)', normal: 'Normal (15px)', large: 'Large (17px)', xlarge: 'Extra Large (19px)' };
        preview.style.fontSize = FONT_SIZES[size];
        preview.textContent = `Preview [${labels[size]}]: The quick brown fox jumps over the lazy dog. 🌤️ 22°C`;
    }
}

/**
 * Set font size from UI.
 * @param {string} size
 */
function setFontSize(size) {
    setSetting('fontSize', size);
    applyFontSize(size);
}

/* ============================================================
   REDUCE MOTION
   ============================================================ */
/**
 * Apply reduce-motion preference.
 * @param {boolean} enabled
 */
function applyReduceMotion(enabled) {
    document.documentElement.style.setProperty(
        '--transition',
        enabled ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    );
    if (enabled) {
        document.documentElement.classList.add('reduce-motion');
    } else {
        document.documentElement.classList.remove('reduce-motion');
    }
}

/* ============================================================
   COMPACT MODE
   ============================================================ */
/**
 * Apply compact mode preference.
 * @param {boolean} enabled
 */
function applyCompactMode(enabled) {
    document.body.classList.toggle('compact-mode', enabled);
    localStorage.setItem('mini-weather-compact', enabled ? 'true' : 'false');
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
/**
 * Toggle notification permission.
 * @param {boolean} enabled
 */
async function toggleNotifications(enabled) {
    if (!enabled) {
        setSetting('notifications', false);
        showToast('🔕 Notifications disabled');
        return;
    }

    if (!('Notification' in window)) {
        showToast('❌ Notifications not supported');
        const toggle = document.getElementById('toggle-notifications');
        if (toggle) toggle.checked = false;
        return;
    }

    if (Notification.permission === 'denied') {
        showToast('❌ Notifications blocked — enable in browser settings');
        const toggle = document.getElementById('toggle-notifications');
        if (toggle) toggle.checked = false;
        setSetting('notifications', false);
        return;
    }

    try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
            setSetting('notifications', true);
            showToast('🔔 Notifications enabled!');
        } else {
            setSetting('notifications', false);
            const toggle = document.getElementById('toggle-notifications');
            if (toggle) toggle.checked = false;
            showToast('🔕 Notification permission denied');
        }
    } catch (e) {
        showToast('❌ Could not request notification permission');
    }
}

/* ============================================================
   LOCATION MANAGEMENT
   ============================================================ */
/**
 * Search for a manually entered location using Nominatim.
 */
async function searchManualLocation() {
    const input = document.getElementById('manual-location');
    if (!input) return;
    const query = input.value.trim();
    if (!query) {
        showToast('⚠️ Please enter a location');
        return;
    }

    // Check if it's coordinates (lat,lon)
    const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
        const lat = parseFloat(coordMatch[1]);
        const lon = parseFloat(coordMatch[2]);
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            saveLocation(lat, lon, query);
            return;
        }
    }

    // Geocode via Nominatim
    showToast('🔍 Searching…');
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
            { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) throw new Error('Geocoding failed');
        const data = await res.json();
        if (!data.length) {
            showToast('❌ Location not found');
            return;
        }
        const { lat, lon, display_name } = data[0];
        saveLocation(parseFloat(lat), parseFloat(lon), display_name);
    } catch (e) {
        showToast('❌ Could not find location');
    }
}

/**
 * Save a location to localStorage.
 * @param {number} lat
 * @param {number} lon
 * @param {string} name
 */
function saveLocation(lat, lon, name) {
    const loc = { latitude: lat, longitude: lon, name };
    localStorage.setItem('mini-weather-location', JSON.stringify({ latitude: lat, longitude: lon }));
    localStorage.setItem('mini-weather-location-name', name);
    updateSavedLocationDisplay();
    showToast(`📍 Location set: ${name.substring(0, 40)}`);
}

/**
 * Clear the saved location.
 */
function clearLocation() {
    localStorage.removeItem('mini-weather-location');
    localStorage.removeItem('mini-weather-location-name');
    updateSavedLocationDisplay();
    showToast('🗑️ Location cleared');
}

/**
 * Update the saved location display text.
 */
function updateSavedLocationDisplay() {
    const el = document.getElementById('saved-location-display');
    if (!el) return;
    const saved = localStorage.getItem('mini-weather-location');
    const name = localStorage.getItem('mini-weather-location-name');
    if (saved) {
        try {
            const loc = JSON.parse(saved);
            el.textContent = name || `${parseFloat(loc.latitude).toFixed(3)}°, ${parseFloat(loc.longitude).toFixed(3)}°`;
        } catch {
            el.textContent = 'Saved location';
        }
    } else {
        el.textContent = 'No location saved';
    }
}

/* ============================================================
   FAVORITES MANAGEMENT
   ============================================================ */
/**
 * Load and render favorite locations.
 */
function renderFavorites() {
    const container = document.getElementById('favorites-list');
    if (!container) return;

    let favorites = [];
    try {
        favorites = JSON.parse(localStorage.getItem('mini-weather-favorites') || '[]');
    } catch { favorites = []; }

    if (!favorites.length) {
        container.innerHTML = '<div style="color: var(--text-dim); font-size: 0.82rem; padding: 8px 0;">No favorites saved yet. Add locations from the main app.</div>';
        return;
    }

    container.innerHTML = favorites.map((fav, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding: 10px 0; border-bottom: 1px solid var(--border); gap: 10px;">
            <div>
                <div style="font-size: 0.85rem; font-weight: 500;">📍 ${fav.name || 'Unknown'}</div>
                <div style="font-size: 0.7rem; color: var(--text-dim);">${parseFloat(fav.latitude).toFixed(3)}°, ${parseFloat(fav.longitude).toFixed(3)}°</div>
            </div>
            <button class="action-btn danger" onclick="removeFavorite(${i})" style="padding: 6px 10px; min-height: 36px; font-size: 0.75rem;">Remove</button>
        </div>
    `).join('');
}

/**
 * Remove a favorite by index.
 * @param {number} index
 */
function removeFavorite(index) {
    try {
        const favorites = JSON.parse(localStorage.getItem('mini-weather-favorites') || '[]');
        favorites.splice(index, 1);
        localStorage.setItem('mini-weather-favorites', JSON.stringify(favorites));
        renderFavorites();
        showToast('🗑️ Favorite removed');
    } catch { /* ignore */ }
}

/* ============================================================
   GARDEN MANAGEMENT
   ============================================================ */
/**
 * Load and display garden statistics.
 */
function loadGardenStats() {
    const streak = parseInt(localStorage.getItem('mini-weather-garden-streak') || '0', 10);
    const born = localStorage.getItem('mini-weather-garden-born');
    let daysAlive = 0;
    if (born) {
        daysAlive = Math.floor((Date.now() - new Date(born).getTime()) / (1000 * 60 * 60 * 24));
    }

    const stages = [
        { days: 0, label: 'Seedling' },
        { days: 3, label: 'Sprout' },
        { days: 7, label: 'Growing' },
        { days: 14, label: 'Mature' },
        { days: 21, label: 'Ancient' },
    ];
    const stage = stages.reduce((acc, s) => daysAlive >= s.days ? s : acc, stages[0]);

    const streakEl = document.getElementById('gs-streak');
    const daysEl = document.getElementById('gs-days');
    const stageEl = document.getElementById('gs-stage');

    if (streakEl) streakEl.textContent = streak;
    if (daysEl) daysEl.textContent = daysAlive;
    if (stageEl) stageEl.textContent = stage.label;
}

/**
 * Export garden stats as a JSON file download.
 */
function exportGardenStats() {
    const data = {
        exportedAt: new Date().toISOString(),
        streak: parseInt(localStorage.getItem('mini-weather-garden-streak') || '0', 10),
        born: localStorage.getItem('mini-weather-garden-born'),
        lastCheckin: localStorage.getItem('mini-weather-garden-last'),
        month: localStorage.getItem('mini-weather-garden-month'),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mini-weather-garden-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Garden stats exported!');
}

/**
 * Show confirmation dialog before resetting garden.
 */
function confirmResetGarden() {
    showConfirm(
        '🔄 Reset Garden?',
        'This will clear your streak, days alive, and growth stage. Your garden will start fresh. This cannot be undone.',
        resetGarden
    );
}

/**
 * Reset all garden data.
 */
function resetGarden() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    localStorage.setItem('mini-weather-garden-streak', '0');
    localStorage.setItem('mini-weather-garden-born', now.toISOString());
    localStorage.setItem('mini-weather-garden-month', monthKey);
    localStorage.removeItem('mini-weather-garden-last');
    loadGardenStats();
    showToast('🌱 Garden reset! Starting fresh.');
}

/* ============================================================
   DATA MANAGEMENT
   ============================================================ */
/**
 * Export all user data as a JSON file.
 */
function exportData() {
    const data = {
        exportedAt: new Date().toISOString(),
        appVersion: '3.0',
        settings: settings,
        location: (() => {
            try { return JSON.parse(localStorage.getItem('mini-weather-location') || 'null'); } catch { return null; }
        })(),
        locationName: localStorage.getItem('mini-weather-location-name'),
        garden: {
            streak: localStorage.getItem('mini-weather-garden-streak'),
            born: localStorage.getItem('mini-weather-garden-born'),
            lastCheckin: localStorage.getItem('mini-weather-garden-last'),
            month: localStorage.getItem('mini-weather-garden-month'),
        },
        favorites: (() => {
            try { return JSON.parse(localStorage.getItem('mini-weather-favorites') || '[]'); } catch { return []; }
        })(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mini-weather-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Data exported successfully!');
}

/**
 * Clear all app data from localStorage.
 */
function clearAllData() {
    showConfirm(
        '🗑️ Clear All Data?',
        'This will remove your location, theme, garden progress, favorites, and all settings. The app will reset to defaults. This cannot be undone.',
        () => {
            const keysToRemove = [
                'mini-weather-settings',
                'mini-weather-location',
                'mini-weather-location-name',
                'mini-weather-theme',
                'mini-weather-unit',
                'mini-weather-api',
                'mini-weather-notifications',
                'mini-weather-device',
                'mini-weather-fontsize',
                'mini-weather-compact',
                'mini-weather-favorites',
                'mini-weather-garden-streak',
                'mini-weather-garden-born',
                'mini-weather-garden-last',
                'mini-weather-garden-month',
                'mini-weather-garden-plant',
            ];
            keysToRemove.forEach(k => localStorage.removeItem(k));
            settings = { ...SETTINGS_DEFAULTS };
            initUI();
            showToast('🗑️ All data cleared. Settings reset to defaults.');
        }
    );
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
let _confirmCallback = null;

/**
 * Show a confirmation dialog.
 * @param {string} title
 * @param {string} msg
 * @param {Function} onConfirm
 */
function showConfirm(title, msg, onConfirm) {
    const overlay = document.getElementById('confirm-overlay');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-msg');
    if (!overlay) return;

    titleEl.textContent = title;
    msgEl.textContent = msg;
    _confirmCallback = onConfirm;
    overlay.classList.add('active');

    // Focus the cancel button for accessibility
    setTimeout(() => {
        const cancelBtn = document.getElementById('confirm-cancel');
        if (cancelBtn) cancelBtn.focus();
    }, 50);
}

/** Close the confirmation dialog without action. */
function closeConfirm() {
    const overlay = document.getElementById('confirm-overlay');
    if (overlay) overlay.classList.remove('active');
    _confirmCallback = null;
}

/** Execute the confirmed action. */
function executeConfirm() {
    closeConfirm();
    if (typeof _confirmCallback === 'function') {
        _confirmCallback();
        _confirmCallback = null;
    }
}

/* ============================================================
   THEME GRID INITIALIZATION
   ============================================================ */
/**
 * Build the theme selection grid.
 */
function initThemeGrid() {
    const grid = document.getElementById('theme-grid-settings');
    if (!grid) return;
    grid.innerHTML = '';

    Object.entries(THEMES).forEach(([key, theme]) => {
        const swatch = document.createElement('div');
        swatch.className = 'theme-swatch-settings' + (key === settings.theme ? ' active' : '');
        swatch.dataset.theme = key;
        swatch.setAttribute('role', 'option');
        swatch.setAttribute('aria-selected', key === settings.theme ? 'true' : 'false');
        swatch.setAttribute('aria-label', theme.label);
        swatch.title = theme.label;
        swatch.style.cssText = `background: linear-gradient(135deg, ${theme.bg} 50%, ${theme.accent} 100%);`;

        const label = document.createElement('span');
        label.className = 'swatch-label';
        label.textContent = theme.label;
        swatch.appendChild(label);

        swatch.addEventListener('click', () => {
            setSetting('theme', key);
            // Update aria states
            grid.querySelectorAll('.theme-swatch-settings').forEach(s => {
                s.classList.toggle('active', s.dataset.theme === key);
                s.setAttribute('aria-selected', s.dataset.theme === key ? 'true' : 'false');
            });
        });

        grid.appendChild(swatch);
    });
}

/* ============================================================
   UI INITIALIZATION
   ============================================================ */
/**
 * Initialize all UI controls from current settings.
 */
function initUI() {
    // Apply theme
    applyTheme(settings.theme);

    // Apply font size
    applyFontSize(settings.fontSize || 'normal');

    // Apply reduce motion
    applyReduceMotion(settings.reduceMotion || false);

    // Apply compact mode
    applyCompactMode(settings.compactMode || false);

    // Temperature unit buttons
    const unitC = document.getElementById('unit-c');
    const unitF = document.getElementById('unit-f');
    if (unitC) unitC.classList.toggle('active', settings.unit === 'C');
    if (unitF) unitF.classList.toggle('active', settings.unit === 'F');

    // Time format buttons
    const time12 = document.getElementById('time-12');
    const time24 = document.getElementById('time-24');
    if (time12) time12.classList.toggle('active', settings.timeFormat === '12h');
    if (time24) time24.classList.toggle('active', settings.timeFormat === '24h');

    // Wind unit buttons
    const windKmh = document.getElementById('wind-kmh');
    const windMph = document.getElementById('wind-mph');
    if (windKmh) windKmh.classList.toggle('active', settings.windUnit === 'kmh');
    if (windMph) windMph.classList.toggle('active', settings.windUnit === 'mph');

    // Toggles
    const toggleMap = {
        'toggle-auto-location': 'autoLocation',
        'toggle-ai-forecasts': 'aiForecasts',
        'toggle-analytics': 'analytics',
        'toggle-error-reporting': 'errorReporting',
        'toggle-notifications': 'notifications',
        'toggle-uv-alerts': 'uvAlerts',
        'toggle-rain-alerts': 'rainAlerts',
        'toggle-wind-alerts': 'windAlerts',
        'toggle-reduce-motion': 'reduceMotion',
        'toggle-compact': 'compactMode',
        'toggle-device-badge': 'showDeviceBadge',
        'toggle-precip-chart': 'showPrecipChart',
        'toggle-garden-reset': 'gardenMonthlyReset',
        'toggle-garden-anim': 'gardenAnimations',
    };

    Object.entries(toggleMap).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!settings[key];
    });

    // Selects
    const refreshEl = document.getElementById('refresh-interval');
    if (refreshEl) refreshEl.value = settings.refreshInterval || '10';

    const apiEl = document.getElementById('api-source');
    if (apiEl) apiEl.value = settings.apiSource || 'weatherapi';

    // Location display
    updateSavedLocationDisplay();

    // Garden stats
    loadGardenStats();

    // Favorites
    renderFavorites();

    // Theme grid
    initThemeGrid();
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
/**
 * Initialize tab switching behavior.
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;

            tabBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.tab === target);
                b.setAttribute('aria-selected', b.dataset.tab === target ? 'true' : 'false');
            });

            tabPanels.forEach(panel => {
                panel.classList.toggle('active', panel.id === `tab-${target}`);
            });

            // Save last active tab
            sessionStorage.setItem('settings-tab', target);
        });
    });

    // Restore last active tab
    const lastTab = sessionStorage.getItem('settings-tab');
    if (lastTab) {
        const btn = document.querySelector(`[data-tab="${lastTab}"]`);
        if (btn) btn.click();
    }
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', (e) => {
    // Close confirm dialog on Escape
    if (e.key === 'Escape') {
        const overlay = document.getElementById('confirm-overlay');
        if (overlay && overlay.classList.contains('active')) {
            closeConfirm();
            return;
        }
        // Go back to main app
        window.location.href = 'index.html';
    }
});

/* ============================================================
   INITIALIZE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initUI();
});
