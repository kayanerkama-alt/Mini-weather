/**
 * privacy.js — Privacy & Data Management Module
 * Mini Weather · GDPR-aware, transparent data handling
 *
 * Responsibilities:
 *  - Privacy policy modal content
 *  - Local storage inventory & disclosure
 *  - Data export (JSON download)
 *  - Data deletion
 *  - Cookie / storage consent banner
 *  - Third-party API disclosures
 */

'use strict';

/* ============================================================
   STORAGE KEYS REGISTRY
   All keys the app writes to localStorage, with descriptions.
   ============================================================ */
const STORAGE_REGISTRY = [
    { key: 'mini-weather-theme',         label: 'Theme preference',          category: 'preferences', essential: true  },
    { key: 'mini-weather-unit',          label: 'Temperature unit (°C/°F)',   category: 'preferences', essential: true  },
    { key: 'mini-weather-location',      label: 'Last known coordinates',     category: 'location',    essential: false },
    { key: 'mini-weather-notifications', label: 'Notification permission',    category: 'preferences', essential: false },
    { key: 'mini-weather-api',           label: 'Preferred API source',       category: 'preferences', essential: false },
    { key: 'mini-weather-device',        label: 'Detected device type',       category: 'analytics',   essential: false },
    { key: 'mini-weather-garden-plant',  label: 'Virtual garden plant type',  category: 'garden',      essential: false },
    { key: 'mini-weather-garden-streak', label: 'Daily check-in streak',      category: 'garden',      essential: false },
    { key: 'mini-weather-garden-last',   label: 'Last garden check-in date',  category: 'garden',      essential: false },
    { key: 'mini-weather-garden-month',  label: 'Garden monthly reset key',   category: 'garden',      essential: false },
    { key: 'mini-weather-garden-born',   label: 'Garden plant birth date',    category: 'garden',      essential: false },
    { key: 'mini-weather-storage-ok',    label: 'Storage consent flag',       category: 'consent',     essential: true  },
    { key: 'mini-weather-privacy-seen',  label: 'Privacy notice acknowledged',category: 'consent',     essential: true  },
    { key: 'mini-weather-settings',      label: 'User settings object',       category: 'preferences', essential: false },
    { key: 'mini-weather-search-history',label: 'Location search history',    category: 'history',     essential: false },
];

/* ============================================================
   THIRD-PARTY API DISCLOSURES
   ============================================================ */
const THIRD_PARTY_APIS = [
    {
        name: 'WeatherAPI.com',
        url: 'https://www.weatherapi.com/privacy.aspx',
        purpose: 'Primary weather data — current conditions, 14-day forecast, hourly data',
        dataShared: 'GPS coordinates (latitude/longitude)',
        dataRetained: 'Per their privacy policy — not stored by Mini Weather',
        optional: false
    },
    {
        name: 'Open-Meteo',
        url: 'https://open-meteo.com/en/terms',
        purpose: 'Free, open-source weather data — fallback API',
        dataShared: 'GPS coordinates (latitude/longitude)',
        dataRetained: 'None — open API, no account required',
        optional: true
    },
    {
        name: 'National Weather Service (NWS)',
        url: 'https://www.weather.gov/privacy',
        purpose: 'US government weather data — US locations only',
        dataShared: 'GPS coordinates (latitude/longitude)',
        dataRetained: 'Per US government privacy policy',
        optional: true
    },
    {
        name: 'wttr.in',
        url: 'https://wttr.in/:help',
        purpose: 'Lightweight weather fallback',
        dataShared: 'GPS coordinates (latitude/longitude)',
        dataRetained: 'None disclosed',
        optional: true
    },
    {
        name: 'Nominatim (OpenStreetMap)',
        url: 'https://nominatim.org/release-docs/latest/api/Reverse/',
        purpose: 'Reverse geocoding — converts coordinates to city/country name',
        dataShared: 'GPS coordinates (latitude/longitude)',
        dataRetained: 'None — open API',
        optional: false
    }
];

/* ============================================================
   PRIVACY MANAGER CLASS
   ============================================================ */
class PrivacyManager {
    constructor() {
        this._consentKey  = 'mini-weather-storage-ok';
        this._seenKey     = 'mini-weather-privacy-seen';
        this._settingsKey = 'mini-weather-settings';
    }

    /* ----------------------------------------------------------
       CONSENT
       ---------------------------------------------------------- */

    /** Returns true if the user has acknowledged the privacy notice. */
    hasConsent() {
        return localStorage.getItem(this._consentKey) === 'true';
    }

    /** Mark consent as given. */
    grantConsent() {
        localStorage.setItem(this._consentKey, 'true');
        localStorage.setItem(this._seenKey, 'true');
        this._hideBanner();
    }

    /** Revoke consent — clears all non-essential storage. */
    revokeConsent() {
        this._clearNonEssential();
        localStorage.setItem(this._consentKey, 'false');
    }

    /** Show the consent banner if not yet acknowledged. */
    maybeShowBanner() {
        if (!localStorage.getItem(this._seenKey)) {
            this._showBanner();
        }
    }

    /* ----------------------------------------------------------
       DATA INVENTORY
       ---------------------------------------------------------- */

    /**
     * Returns an array of { key, label, category, essential, value, size } objects
     * for all registered keys that currently have a value in localStorage.
     */
    getStorageInventory() {
        return STORAGE_REGISTRY.map(entry => {
            const raw = localStorage.getItem(entry.key);
            return {
                ...entry,
                value: raw,
                present: raw !== null,
                size: raw ? new Blob([raw]).size : 0
            };
        }).filter(e => e.present);
    }

    /** Total bytes used by Mini Weather in localStorage. */
    getTotalStorageSize() {
        return STORAGE_REGISTRY.reduce((total, entry) => {
            const raw = localStorage.getItem(entry.key);
            return total + (raw ? new Blob([raw]).size : 0);
        }, 0);
    }

    /* ----------------------------------------------------------
       DATA EXPORT
       ---------------------------------------------------------- */

    /**
     * Export all stored data as a JSON file download.
     */
    exportData() {
        const inventory = this.getStorageInventory();
        const exportObj = {
            exportedAt: new Date().toISOString(),
            app: 'Mini Weather',
            version: '3.0',
            data: {}
        };

        inventory.forEach(entry => {
            try {
                exportObj.data[entry.key] = {
                    label: entry.label,
                    category: entry.category,
                    value: JSON.parse(entry.value)
                };
            } catch {
                exportObj.data[entry.key] = {
                    label: entry.label,
                    category: entry.category,
                    value: entry.value
                };
            }
        });

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `mini-weather-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ----------------------------------------------------------
       DATA DELETION
       ---------------------------------------------------------- */

    /** Delete all Mini Weather data from localStorage. */
    deleteAllData() {
        STORAGE_REGISTRY.forEach(entry => localStorage.removeItem(entry.key));
        // Also clear any cache keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('mini-weather-')) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    /** Delete only non-essential data (location, history, analytics). */
    _clearNonEssential() {
        STORAGE_REGISTRY
            .filter(e => !e.essential)
            .forEach(e => localStorage.removeItem(e.key));
    }

    /* ----------------------------------------------------------
       BANNER
       ---------------------------------------------------------- */

    _showBanner() {
        const existing = document.getElementById('privacy-banner');
        if (existing) return;

        const banner = document.createElement('div');
        banner.id = 'privacy-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Privacy notice');
        banner.innerHTML = `
            <div class="privacy-banner-content">
                <span class="privacy-banner-icon">🔒</span>
                <div class="privacy-banner-text">
                    <strong>Privacy Notice</strong>
                    Mini Weather stores preferences locally on your device. No personal data is sent to our servers.
                    Weather data is fetched from third-party APIs using your GPS coordinates.
                    <a href="#" id="privacy-banner-learn" class="privacy-link">Learn more</a>
                </div>
                <div class="privacy-banner-actions">
                    <button id="privacy-banner-accept" class="btn-primary privacy-btn">Accept</button>
                    <button id="privacy-banner-decline" class="privacy-btn-ghost">Decline</button>
                </div>
            </div>`;

        document.body.appendChild(banner);

        document.getElementById('privacy-banner-accept').addEventListener('click', () => {
            this.grantConsent();
            if (typeof showToast === 'function') showToast('✅ Privacy preferences saved');
        });

        document.getElementById('privacy-banner-decline').addEventListener('click', () => {
            this.revokeConsent();
            this._hideBanner();
            if (typeof showToast === 'function') showToast('🔕 Non-essential storage disabled');
        });

        document.getElementById('privacy-banner-learn').addEventListener('click', (e) => {
            e.preventDefault();
            if (typeof openPrivacyModal === 'function') openPrivacyModal();
        });
    }

    _hideBanner() {
        const banner = document.getElementById('privacy-banner');
        if (banner) {
            banner.classList.add('privacy-banner-hide');
            setTimeout(() => banner.remove(), 400);
        }
    }

    /* ----------------------------------------------------------
       PRIVACY POLICY CONTENT
       ---------------------------------------------------------- */

    /**
     * Returns the full privacy policy HTML string.
     */
    getPolicyHTML() {
        const inventory = this.getStorageInventory();
        const totalKB   = (this.getTotalStorageSize() / 1024).toFixed(2);

        const apiRows = THIRD_PARTY_APIS.map(api => `
            <div class="privacy-api-card">
                <div class="privacy-api-name">
                    <strong>${api.name}</strong>
                    ${api.optional ? '<span class="privacy-badge-optional">Optional</span>' : '<span class="privacy-badge-required">Required</span>'}
                </div>
                <div class="privacy-api-detail"><span>Purpose:</span> ${api.purpose}</div>
                <div class="privacy-api-detail"><span>Data shared:</span> ${api.dataShared}</div>
                <div class="privacy-api-detail"><span>Retention:</span> ${api.dataRetained}</div>
                <a href="${api.url}" target="_blank" rel="noopener noreferrer" class="privacy-link">Privacy Policy ↗</a>
            </div>`).join('');

        const storageRows = inventory.length > 0
            ? inventory.map(e => `
                <div class="privacy-storage-row">
                    <span class="privacy-storage-key">${e.label}</span>
                    <span class="privacy-storage-cat privacy-cat-${e.category}">${e.category}</span>
                    <span class="privacy-storage-size">${e.size} B</span>
                    ${e.essential ? '<span class="privacy-badge-essential">Essential</span>' : ''}
                </div>`).join('')
            : '<p class="privacy-empty">No data currently stored.</p>';

        return `
            <div class="privacy-policy">
                <div class="privacy-section">
                    <h3>🔒 Our Privacy Commitment</h3>
                    <p>Mini Weather is designed with privacy as a core principle. We do <strong>not</strong> operate any servers, collect analytics, or track users. All data stays on your device.</p>
                </div>

                <div class="privacy-section">
                    <h3>📦 What We Store Locally</h3>
                    <p>The following data is stored in your browser's <code>localStorage</code> (total: ~${totalKB} KB):</p>
                    <div class="privacy-storage-list">${storageRows}</div>
                    <p class="privacy-note">You can export or delete this data at any time using the buttons below.</p>
                </div>

                <div class="privacy-section">
                    <h3>🌐 Third-Party APIs</h3>
                    <p>To display weather data, your GPS coordinates are sent to one or more of these services. Mini Weather does not control their data practices.</p>
                    <div class="privacy-apis">${apiRows}</div>
                </div>

                <div class="privacy-section">
                    <h3>📍 Location Data</h3>
                    <p>Your coordinates are only used to fetch weather data. They are stored locally so the app can reload without asking again. You can clear them at any time.</p>
                </div>

                <div class="privacy-section">
                    <h3>🍪 Cookies</h3>
                    <p>Mini Weather does <strong>not</strong> use cookies. All persistence is via <code>localStorage</code> only.</p>
                </div>

                <div class="privacy-section">
                    <h3>🇪🇺 GDPR / CCPA</h3>
                    <p>Because we do not collect or process personal data on any server, formal GDPR/CCPA obligations do not apply to Mini Weather itself. However, the third-party APIs listed above may have their own obligations — please review their policies.</p>
                </div>

                <div class="privacy-section">
                    <h3>🗑️ Your Rights</h3>
                    <p>You have full control over your data:</p>
                    <ul>
                        <li><strong>Access:</strong> Use "Export Data" to download everything stored.</li>
                        <li><strong>Deletion:</strong> Use "Delete All Data" to wipe all local storage.</li>
                        <li><strong>Portability:</strong> Exported data is in standard JSON format.</li>
                    </ul>
                </div>

                <div class="privacy-section">
                    <h3>📬 Contact</h3>
                    <p>Mini Weather is an open-source project. For privacy concerns, please open an issue on the project repository.</p>
                </div>

                <div class="privacy-actions">
                    <button id="privacy-export-btn" class="btn-primary">⬇️ Export My Data</button>
                    <button id="privacy-delete-btn" class="btn-danger">🗑️ Delete All Data</button>
                </div>
            </div>`;
    }
}

/* ============================================================
   SINGLETON EXPORT
   ============================================================ */
const privacyManager = new PrivacyManager();

/**
 * Open the privacy modal (called from app.js / index.html).
 */
function openPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (!modal) return;

    const body = document.getElementById('privacy-modal-body');
    if (body) {
        body.innerHTML = privacyManager.getPolicyHTML();

        // Wire up action buttons
        const exportBtn = document.getElementById('privacy-export-btn');
        const deleteBtn = document.getElementById('privacy-delete-btn');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                privacyManager.exportData();
                if (typeof showToast === 'function') showToast('📦 Data exported!');
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Delete ALL Mini Weather data from this device? This cannot be undone.')) {
                    privacyManager.deleteAllData();
                    if (typeof showToast === 'function') showToast('🗑️ All data deleted');
                    modal.classList.remove('active');
                    setTimeout(() => location.reload(), 1200);
                }
            });
        }
    }

    modal.classList.add('active');
}

/**
 * Close the privacy modal.
 */
function closePrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    if (modal) modal.classList.remove('active');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PrivacyManager, privacyManager, openPrivacyModal, closePrivacyModal, STORAGE_REGISTRY, THIRD_PARTY_APIS };
}
