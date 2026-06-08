// Mini Weather - Privacy-First, Multi-API Weather App with Virtual Garden
// Features: Location access, multiple weather APIs, virtual garden, cross-device support, notifications

class VirtualGarden {
    constructor() {
        this.plants = [];
        this.health = 100;
        this.level = 1;
        this.waterLevel = 100;
        this.sunlight = 50;
        this.loadGarden();
    }

    loadGarden() {
        const saved = localStorage.getItem('mini-garden-state');
        if (saved) {
            const state = JSON.parse(saved);
            this.plants = state.plants || [];
            this.health = state.health || 100;
            this.level = state.level || 1;
            this.waterLevel = state.waterLevel || 100;
        }
    }

    saveGarden() {
        localStorage.setItem('mini-garden-state', JSON.stringify({
            plants: this.plants,
            health: this.health,
            level: this.level,
            waterLevel: this.waterLevel
        }));
    }

    updateFromWeather(weather) {
        const temp = weather.current?.temp || 20;
        const humidity = weather.current?.humidity || 50;
        const windSpeed = weather.current?.windSpeed || 0;

        // Plant health based on conditions
        let healthDelta = 0;
        if (temp >= 15 && temp <= 25) healthDelta += 5;
        if (humidity >= 40 && humidity <= 80) healthDelta += 5;
        if (windSpeed < 20) healthDelta += 2;

        // Bad conditions reduce health
        if (temp > 35 || temp < 0) healthDelta -= 10;
        if (humidity > 90) healthDelta -= 5;
        if (windSpeed > 50) healthDelta -= 8;

        this.health = Math.max(0, Math.min(100, this.health + healthDelta));
        this.waterLevel = humidity;

        // Growth based on health
        if (this.health > 80) {
            this.level = Math.min(5, Math.floor(this.health / 20));
        }

        // Add plants when conditions improve
        if (this.health > 70 && this.plants.length < this.level * 3) {
            this.plants.push({
                x: Math.random() * 0.8 + 0.1,
                y: Math.random() * 0.6 + 0.3,
                size: Math.random() * 20 + 10,
                age: 0,
                health: 100
            });
        }

        // Age and update plants
        this.plants = this.plants.filter(p => {
            p.age += 1;
            p.health = Math.max(0, this.health);
            return p.health > 0;
        });

        this.saveGarden();
    }

    draw(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(100, 200, 150, 0.1)');
        gradient.addColorStop(1, 'rgba(50, 100, 80, 0.1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw soil
        ctx.fillStyle = '#654321';
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);

        // Draw water level indicator
        ctx.fillStyle = `rgba(100, 180, 255, ${this.waterLevel / 100 * 0.3})`;
        ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3 * (this.waterLevel / 100));

        // Draw plants
        this.plants.forEach(plant => {
            const x = canvas.width * plant.x;
            const y = canvas.height * plant.y;
            const size = plant.size * (plant.health / 100);

            ctx.save();
            ctx.translate(x, y);

            // Draw leaves
            ctx.fillStyle = `rgba(50, 200, 100, ${plant.health / 100})`;
            ctx.beginPath();
            ctx.ellipse(0, -size * 0.3, size * 0.3, size * 0.5, -0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.ellipse(0, -size * 0.3, size * 0.3, size * 0.5, 0.3, 0, Math.PI * 2);
            ctx.fill();

            // Draw stem
            ctx.strokeStyle = `rgba(34, 139, 34, ${plant.health / 100})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -size);
            ctx.stroke();

            // Draw flower if healthy
            if (plant.health > 70) {
                ctx.fillStyle = `rgba(255, 200, 100, ${plant.health / 100})`;
                ctx.beginPath();
                ctx.arc(0, -size, size * 0.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        });

        // Draw sun indicator
        const sunSize = 30;
        ctx.fillStyle = `rgba(255, 200, 0, 0.5)`;
        ctx.beginPath();
        ctx.arc(canvas.width - 40, 30, sunSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw health bar
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.fillRect(10, 10, 100, 8);
        const healthColor = this.health > 60 ? '#4CAF50' : this.health > 30 ? '#FFC107' : '#F44336';
        ctx.fillStyle = healthColor;
        ctx.fillRect(10, 10, this.health, 8);
    }
}

class WeatherApp {
    constructor() {
        this.currentLocation = null;
        this.currentWeather = null;
        this.unit = localStorage.getItem('mini-weather-unit') || 'C';
        this.apiSource = localStorage.getItem('mini-weather-api') || 'open-meteo';
        this.cache = new Map();
        this.cacheTime = 10 * 60 * 1000;
        this.garden = new VirtualGarden();
        this.notificationsEnabled = localStorage.getItem('mini-weather-notifications') === 'true';
        this.refreshInterval = null;

        this.apis = {
            'open-meteo': {
                name: 'Open-Meteo',
                desc: 'Free, accurate, no API key needed',
                fetch: (lat, lon) => this.fetchOpenMeteo(lat, lon)
            },
            'nws': {
                name: 'National Weather Service',
                desc: 'US only, highly accurate',
                fetch: (lat, lon) => this.fetchNWS(lat, lon)
            },
            'wttr': {
                name: 'wttr.in',
                desc: 'Fast, simple, global coverage',
                fetch: (lat, lon) => this.fetchWttr(lat, lon)
            }
        };

        this.initEventListeners();
        this.registerServiceWorker();
        this.setupNotifications();
    }

    initEventListeners() {
        const locationBtn = document.getElementById('location-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        const unitBtn = document.getElementById('unit-btn');
        const apiBtn = document.getElementById('api-btn');
        const notifyBtn = document.getElementById('notify-btn');

        if (locationBtn) locationBtn.addEventListener('click', () => this.requestLocation());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refresh());
        if (unitBtn) unitBtn.addEventListener('click', () => this.toggleUnit());
        if (apiBtn) apiBtn.addEventListener('click', () => this.showAPIModal());
        if (notifyBtn) {
            notifyBtn.style.display = 'inline-flex';
            notifyBtn.addEventListener('click', () => this.toggleNotifications());
            this.updateNotifyButton();
        }

        const apiModal = document.getElementById('api-modal');
        if (apiModal) {
            apiModal.addEventListener('click', (e) => {
                if (e.target.id === 'api-modal') this.closeAPIModal();
            });
        }
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    setupNotifications() {
        if ('Notification' in window && Notification.permission === 'granted') {
            this.notificationsEnabled = true;
            localStorage.setItem('mini-weather-notifications', 'true');
        }
    }

    async toggleNotifications() {
        if (!('Notification' in window)) {
            this.showError('Notifications not supported on this device');
            return;
        }

        if (Notification.permission === 'denied') {
            this.showError('Notification permission was denied. Enable in settings.');
            return;
        }

        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    this.notificationsEnabled = true;
                    localStorage.setItem('mini-weather-notifications', 'true');
                }
            } catch (error) {
                console.warn('Notification request failed:', error);
            }
        } else {
            this.notificationsEnabled = !this.notificationsEnabled;
            localStorage.setItem('mini-weather-notifications', this.notificationsEnabled);
        }
        this.updateNotifyButton();
    }

    updateNotifyButton() {
        const btn = document.getElementById('notify-btn');
        if (btn) {
            btn.textContent = this.notificationsEnabled ? '🔔' : '🔕';
            btn.style.opacity = this.notificationsEnabled ? '1' : '0.5';
        }
    }

    sendNotification(title, options = {}) {
        if (!this.notificationsEnabled || !('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    icon: '☀️',
                    badge: '☀️',
                    ...options
                });
            } catch (error) {
                console.warn('Notification failed:', error);
            }
        }
    }

    async requestLocation() {
        const btn = document.getElementById('location-btn');
        if (!btn) return;

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
            this.sendNotification('Location obtained', {
                body: `Fetching weather for ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
            });
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
            const api = this.apis[this.apiSource];
            const weather = await api.fetch(latitude, longitude);
            this.currentWeather = weather;
            this.cache.set(cacheKey, { data: weather, time: Date.now() });

            // Update garden
            this.garden.updateFromWeather(weather);
            this.render();
            this.drawGarden();
        } catch (error) {
            this.showError(`Failed to fetch weather: ${error.message}`);
            console.error('Weather fetch error:', error);
        }
    }

    async fetchOpenMeteo(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat.toFixed(3),
            longitude: lon.toFixed(3),
            current: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,apparent_temperature,pressure_msl,visibility,uv_index,precipitation,cloud_cover',
            hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
            timezone: 'auto',
            forecast_days: 14
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return this.normalizeOpenMeteo(data);
    }

    normalizeOpenMeteo(data) {
        const current = data.current;
        const hourly = data.hourly;
        const daily = data.daily;

        return {
            source: 'Open-Meteo',
            location: {
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone
            },
            current: {
                temp: current.temperature_2m,
                code: current.weather_code,
                description: this.getDescription(current.weather_code),
                icon: this.getIcon(current.weather_code),
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
                windGusts: current.wind_gusts_10m,
                feelsLike: current.apparent_temperature,
                pressure: current.pressure_msl,
                visibility: current.visibility / 1000,
                uvIndex: current.uv_index,
                cloudCover: current.cloud_cover,
                precipitation: current.precipitation || 0
            },
            hourly: hourly.time.slice(0, 48).map((time, i) => ({
                time,
                temp: hourly.temperature_2m[i],
                code: hourly.weather_code[i],
                icon: this.getIcon(hourly.weather_code[i]),
                precipitation: hourly.precipitation_probability[i] || 0,
                wind: hourly.wind_speed_10m[i],
                humidity: hourly.relative_humidity_2m[i]
            })),
            daily: daily.time.map((date, i) => ({
                date,
                code: daily.weather_code[i],
                icon: this.getIcon(daily.weather_code[i]),
                maxTemp: daily.temperature_2m_max[i],
                minTemp: daily.temperature_2m_min[i],
                precipitation: daily.precipitation_sum[i] || 0,
                precipChance: daily.precipitation_probability_max[i] || 0,
                wind: daily.wind_speed_10m_max[i],
                uvIndex: daily.uv_index_max[i],
                sunrise: daily.sunrise[i],
                sunset: daily.sunset[i]
            }))
        };
    }

    async fetchNWS(lat, lon) {
        const gridResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!gridResponse.ok) throw new Error('NWS: Location not in US');

        const gridData = await gridResponse.json();
        const forecastUrl = gridData.properties.forecast;
        const forecastResponse = await fetch(forecastUrl, {
            signal: AbortSignal.timeout(8000)
        });

        if (!forecastResponse.ok) throw new Error('NWS: Forecast unavailable');

        const forecastData = await forecastResponse.json();
        return this.normalizeNWS(forecastData);
    }

    normalizeNWS(data) {
        const periods = data.properties.periods;
        const current = periods[0];

        return {
            source: 'National Weather Service',
            location: {
                latitude: data.geometry.coordinates[1],
                longitude: data.geometry.coordinates[0],
                timezone: 'US'
            },
            current: {
                temp: current.temperature,
                code: 0,
                description: current.shortForecast,
                icon: this.getIcon(0),
                humidity: 50,
                windSpeed: parseInt(current.windSpeed) || 0,
                windGusts: 0,
                feelsLike: current.temperature,
                pressure: 1013,
                visibility: 10,
                uvIndex: 5,
                cloudCover: 50,
                precipitation: 0
            },
            hourly: [],
            daily: periods.filter((_, i) => i % 2 === 0).slice(0, 7).map(p => ({
                date: p.startTime.split('T')[0],
                code: 0,
                icon: this.getIcon(0),
                maxTemp: p.temperature,
                minTemp: p.temperature - 5,
                precipitation: 0,
                precipChance: 0,
                wind: parseInt(p.windSpeed) || 0,
                uvIndex: 5,
                sunrise: '06:00',
                sunset: '18:00'
            }))
        };
    }

    async fetchWttr(lat, lon) {
        const response = await fetch(`https://wttr.in/${lat},${lon}?format=j1`, {
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) throw new Error('wttr.in unavailable');

        const data = await response.json();
        return this.normalizeWttr(data);
    }

    normalizeWttr(data) {
        const current = data.current_condition[0];
        const forecast = data.weather[0];

        return {
            source: 'wttr.in',
            location: {
                latitude: data.nearest_area[0].latitude,
                longitude: data.nearest_area[0].longitude,
                timezone: 'UTC'
            },
            current: {
                temp: current.temp_C,
                code: 0,
                description: current.weatherDesc[0].value,
                icon: this.getIcon(0),
                humidity: current.humidity,
                windSpeed: current.windspeedKmph,
                windGusts: current.WindGustKmph,
                feelsLike: current.FeelsLikeC,
                pressure: current.pressure,
                visibility: current.visibility,
                uvIndex: current.uvIndex,
                cloudCover: current.cloudcover,
                precipitation: current.precipMM || 0
            },
            hourly: [],
            daily: forecast.hourly.slice(0, 7).map((h, i) => ({
                date: forecast.date,
                code: 0,
                icon: this.getIcon(0),
                maxTemp: h.tempC,
                minTemp: h.tempC - 3,
                precipitation: h.precipMM || 0,
                precipChance: h.chanceofrain || 0,
                wind: h.windspeedKmph,
                uvIndex: h.uvIndex,
                sunrise: '06:00',
                sunset: '18:00'
            }))
        };
    }

    getDescription(code) {
        const map = {
            0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
            45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
            55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
            71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow', 77: 'Snow grains',
            80: 'Rain showers', 81: 'Heavy showers', 82: 'Violent showers',
            85: 'Snow showers', 86: 'Heavy snow showers',
            95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm'
        };
        return map[code] || 'Unknown';
    }

    getIcon(code) {
        if (code === 0 || code === null) return '☀️';
        if (code === 1 || code === 2) return '⛅';
        if (code === 3) return '☁️';
        if (code === 45 || code === 48) return '🌫️';
        if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
        if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️';
        if ([95, 96, 99].includes(code)) return '⛈️';
        return '🌡️';
    }

    async getLocationName(lat, lon) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
                { signal: AbortSignal.timeout(5000) }
            );
            const data = await response.json();
            const address = data.address || {};
            const parts = [];
            if (address.city) parts.push(address.city);
            else if (address.town) parts.push(address.town);
            if (address.state && address.state !== address.city) parts.push(address.state);
            if (address.country) parts.push(address.country);
            return parts.join(', ') || 'Unknown Location';
        } catch {
            return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
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

        const { current, hourly, daily, source } = this.currentWeather;
        const { latitude, longitude } = this.currentLocation;
        const locationName = await this.getLocationName(latitude, longitude);

        const locDisplay = document.getElementById('location-display');
        if (locDisplay) {
            document.getElementById('loc-name').textContent = `📍 ${locationName}`;
            document.getElementById('loc-coords').textContent = `${latitude.toFixed(3), longitude.toFixed(3)}`;
            document.getElementById('loc-time').textContent = new Date().toLocaleTimeString();
            locDisplay.style.display = 'flex';
        }

        let html = `
            <div class="weather-card">
                <div class="temp-display">
                    <div class="temp-value">${this.formatTemp(current.temp)}°${this.unit}</div>
                    <div class="condition">${current.description}</div>
                    <div class="feels-like">Feels like ${this.formatTemp(current.feelsLike)}°</div>
                </div>

                <div class="stats">
                    <div class="stat">
                        <div class="stat-label">Humidity</div>
                        <div class="stat-value">${current.humidity}%</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Wind</div>
                        <div class="stat-value">${this.formatWind(current.windSpeed)} ${this.getWindUnit()}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Pressure</div>
                        <div class="stat-value">${Math.round(current.pressure)} hPa</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">UV</div>
                        <div class="stat-value">${Math.round(current.uvIndex)}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Visibility</div>
                        <div class="stat-value">${current.visibility.toFixed(1)} km</div>
                    </div>
                </div>

                <div class="source-badge">Data from ${source}</div>
        `;

        if (hourly.length > 0) {
            html += '<div class="section-title">Hourly</div><div class="hourly">';
            hourly.slice(0, 24).forEach(h => {
                const time = new Date(h.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                html += `
                    <div class="hour">
                        <div class="hour-time">${time}</div>
                        <div class="hour-icon">${h.icon}</div>
                        <div class="hour-temp">${this.formatTemp(h.temp)}°</div>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (daily.length > 0) {
            html += '<div class="section-title">Forecast</div><div class="daily">';
            daily.slice(0, 7).forEach(d => {
                const date = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                html += `
                    <div class="day">
                        <div class="day-date">${date}</div>
                        <div class="day-icon">${d.icon}</div>
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

    drawGarden() {
        const canvas = document.getElementById('garden-canvas');
        if (canvas) {
            this.garden.draw(canvas);
            document.getElementById('garden-health').textContent = `${Math.round(this.garden.health)}%`;
            document.getElementById('garden-growth').textContent = `Level ${this.garden.level}`;
            document.getElementById('garden-plants').textContent = this.garden.plants.length;
            document.getElementById('garden-container').style.display = 'block';
        }
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
        if (!modal || !list) return;

        list.innerHTML = '';

        Object.entries(this.apis).forEach(([key, api]) => {
            const div = document.createElement('div');
            div.className = 'api-option' + (key === this.apiSource ? ' selected' : '');
            div.innerHTML = `
                <div class="api-name">${api.name}</div>
                <div class="api-desc">${api.desc}</div>
            `;
            div.addEventListener('click', () => {
                this.apiSource = key;
                localStorage.setItem('mini-weather-api', key);
                this.closeAPIModal();
                if (this.currentLocation) this.fetchWeather();
            });
            list.appendChild(div);
        });

        modal.classList.add('active');
    }

    closeAPIModal() {
        const modal = document.getElementById('api-modal');
        if (modal) modal.classList.remove('active');
    }
}

// Initialize app
const app = new WeatherApp();

// Restore location from storage
const savedLocation = localStorage.getItem('mini-weather-location');
if (savedLocation) {
    try {
        app.currentLocation = JSON.parse(savedLocation);
        app.fetchWeather();
    } catch (error) {
        console.error('Failed to restore location:', error);
    }
}
