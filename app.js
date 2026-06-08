// Mini Weather Frontend - Uses Backend API
// Features: WeatherAPI integration, AI insights, optimized caching

class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.currentWeather = null;
        this.unit = localStorage.getItem('mini-weather-unit') || 'C';
        this.apiSource = localStorage.getItem('mini-weather-api') || 'weatherapi';
        this.apiUrl = this.getApiUrl();
        this.cache = new Map();
        this.cacheTime = 10 * 60 * 1000; // 10 minutes

        this.initEventListeners();
        this.registerServiceWorker();
        this.loadAvailableAPIs();
    }

    getApiUrl() {
        // Use backend API if available, otherwise fallback to direct APIs
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            return 'http://localhost:3000/api';
        }
        // In production, use relative path
        return '/api';
    }

    async loadAvailableAPIs() {
        try {
            const response = await fetch(`${this.apiUrl}/sources`);
            if (response.ok) {
                const sources = await response.json();
                this.availableAPIs = sources;
            }
        } catch (error) {
            console.warn('Could not load API sources:', error);
        }
    }

    initEventListeners() {
        document.getElementById('location-btn').addEventListener('click', () => this.requestLocation());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('unit-btn').addEventListener('click', () => this.toggleUnit());
        document.getElementById('api-btn').addEventListener('click', () => this.showAPIModal());

        document.getElementById('api-modal').addEventListener('click', (e) => {
            if (e.target.id === 'api-modal') this.closeAPIModal();
        });
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    async requestLocation() {
        const btn = document.getElementById('location-btn');
        btn.disabled = true;
        btn.textContent = '⏳';

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 300000
                });
            });

            const { latitude, longitude } = position.coords;
            this.currentLocation = { latitude, longitude };
            localStorage.setItem('mini-weather-location', JSON.stringify(this.currentLocation));

            await this.fetchWeather();
        } catch (error) {
            this.showError('Location access denied. Please enable location permissions.');
            console.error('Location error:', error);
        } finally {
            btn.disabled = false;
            btn.textContent = '📍';
        }
    }

    async fetchWeather() {
        if (!this.currentLocation) {
            this.showError('No location selected');
            return;
        }

        const { latitude, longitude } = this.currentLocation;
        const cacheKey = `${latitude.toFixed(3)}-${longitude.toFixed(3)}-${this.apiSource}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.time < this.cacheTime) {
                this.currentWeather = cached.data;
                this.render();
                return;
            }
        }

        this.showLoading();

        try {
            const response = await fetch(
                `${this.apiUrl}/weather?lat=${latitude}&lon=${longitude}&source=${this.apiSource}`,
                { signal: AbortSignal.timeout(10000) }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const weather = await response.json();
            this.currentWeather = weather;
            this.cache.set(cacheKey, { data: weather, time: Date.now() });
            this.render();
        } catch (error) {
            this.showError(`Failed to fetch weather: ${error.message}`);
            console.error('Weather fetch error:', error);
        }
    }

    formatTemp(temp) {
        if (this.unit === 'F') {
            return Math.round((temp * 9/5) + 32);
        }
        return Math.round(temp);
    }

    formatWind(speed) {
        if (this.unit === 'F') {
            return Math.round(speed * 0.621371 * 10) / 10;
        }
        return Math.round(speed * 10) / 10;
    }

    getWindUnit() {
        return this.unit === 'F' ? 'mph' : 'km/h';
    }

    async render() {
        if (!this.currentWeather) return;

        const { current, hourly, daily, insights, locationName, source } = this.currentWeather;

        // Update location display
        const locDisplay = document.getElementById('location-display');
        document.getElementById('loc-name').textContent = `📍 ${locationName}`;
        document.getElementById('loc-coords').textContent = `${this.currentLocation.latitude.toFixed(3)}°, ${this.currentLocation.longitude.toFixed(3)}°`;
        document.getElementById('loc-time').textContent = new Date().toLocaleTimeString();
        locDisplay.style.display = 'flex';

        // Build weather HTML
        let html = `
            <div class="weather-card">
                <div class="temp-display">
                    <div class="temp-value">${this.formatTemp(current.temp)}°${this.unit}</div>
                    <div class="condition">${current.condition}</div>
                    <div class="feels-like">Feels like ${this.formatTemp(current.feelsLike)}°</div>
                </div>

                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">💧 Humidity</div>
                        <div class="stat-value">${current.humidity}%</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">💨 Wind</div>
                        <div class="stat-value">${this.formatWind(current.windSpeed)} ${this.getWindUnit()}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">🔬 Pressure</div>
                        <div class="stat-value">${Math.round(current.pressure)} hPa</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">☀️ UV</div>
                        <div class="stat-value">${Math.round(current.uvIndex)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">👁️ Visibility</div>
                        <div class="stat-value">${current.visibility.toFixed(1)} km</div>
                    </div>
                </div>

                <div class="source-badge">📡 ${source}</div>
        `;

        // AI Insights
        if (insights && insights.length > 0) {
            html += '<div class="insights-section"><div class="section-title">🤖 AI Insights</div>';
            insights.forEach(insight => {
                const severityClass = `alert-${insight.severity}`;
                html += `
                    <div class="alert ${severityClass}">
                        <div style="font-weight: 600; margin-bottom: 4px;">${insight.title}</div>
                        <div style="font-size: 0.8rem; margin-bottom: 6px;">${insight.message}</div>
                        <div style="font-size: 0.75rem; opacity: 0.8;">💡 ${insight.action}</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Hourly forecast
        if (hourly && hourly.length > 0) {
            html += '<div class="section-title">Hourly</div><div class="hourly">';
            hourly.slice(0, 24).forEach(h => {
                const time = new Date(h.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                html += `
                    <div class="hour">
                        <div class="hour-time">${time}</div>
                        <div class="hour-icon">${h.icon || '🌡️'}</div>
                        <div class="hour-temp">${this.formatTemp(h.temp)}°</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Daily forecast
        if (daily && daily.length > 0) {
            html += '<div class="section-title">Forecast</div><div class="daily">';
            daily.slice(0, 7).forEach(d => {
                const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                html += `
                    <div class="day">
                        <div class="day-date">${date}</div>
                        <div class="day-icon">${d.icon || '🌡️'}</div>
                        <div class="day-temps">
                            <span class="day-max">${this.formatTemp(d.maxTemp)}°</span>
                            <span class="day-min">${this.formatTemp(d.minTemp)}°</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
        document.getElementById('weather-content').innerHTML = html;
    }

    showLoading() {
        document.getElementById('weather-content').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p style="color: var(--text-dim);">Fetching weather...</p>
            </div>
        `;
    }

    showError(message) {
        document.getElementById('weather-content').innerHTML = `<div class="error">${message}</div>`;
    }

    toggleUnit() {
        this.unit = this.unit === 'C' ? 'F' : 'C';
        localStorage.setItem('mini-weather-unit', this.unit);
        document.getElementById('unit-btn').textContent = `°${this.unit}`;
        if (this.currentWeather) this.render();
    }

    refresh() {
        if (this.currentLocation) this.fetchWeather();
    }

    showAPIModal() {
        const modal = document.getElementById('api-modal');
        const list = document.getElementById('api-list');
        list.innerHTML = '';

        const apis = [
            { id: 'weatherapi', name: 'WeatherAPI', desc: 'Fast, accurate, real-time data' },
            { id: 'open-meteo', name: 'Open-Meteo', desc: 'Free, no API key, global coverage' },
            { id: 'nws', name: 'National Weather Service', desc: 'US only, government data' }
        ];

        apis.forEach(api => {
            const div = document.createElement('div');
            div.className = 'api-option' + (api.id === this.apiSource ? ' selected' : '');
            div.innerHTML = `
                <div class="api-name">${api.name}</div>
                <div class="api-desc">${api.desc}</div>
            `;
            div.addEventListener('click', () => {
                this.apiSource = api.id;
                localStorage.setItem('mini-weather-api', api.id);
                this.closeAPIModal();
                if (this.currentLocation) this.fetchWeather();
            });
            list.appendChild(div);
        });

        modal.classList.add('active');
    }

    closeAPIModal() {
        document.getElementById('api-modal').classList.remove('active');
    }
}

// Initialize app
const app = new WeatherApp();

// Try to restore location from storage
const savedLocation = localStorage.getItem('mini-weather-location');
if (savedLocation) {
    app.currentLocation = JSON.parse(savedLocation);
    app.fetchWeather();
}

