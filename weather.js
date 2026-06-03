// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Notification Manager
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
            const permission = await Notification.requestPermission();
            this.enabled = permission === 'granted';
            localStorage.setItem('mini-weather-notifications', this.enabled ? 'true' : 'false');
            return this.enabled;
        }
        return false;
    }

    send(title, options = {}) {
        if (!this.enabled || !this.supported) return;
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                options
            });
        } else {
            new Notification(title, options);
        }
    }
}

const notificationManager = new NotificationManager();

// 50+ THEMES
const THEMES = {
    dark: 'Dark',
    light: 'Light',
    ocean: 'Ocean',
    sunset: 'Sunset',
    forest: 'Forest',
    lavender: 'Lavender',
    berry: 'Berry',
    mint: 'Mint',
    coffee: 'Coffee',
    nord: 'Nord',
    dracula: 'Dracula',
    gruvbox: 'Gruvbox',
    solarized: 'Solarized',
    cyberpunk: 'Cyberpunk',
    monochrome: 'Monochrome',
    warm: 'Warm',
    cool: 'Cool',
    neon: 'Neon',
    pastel: 'Pastel',
    retro: 'Retro',
    cherry: 'Cherry',
    aurora: 'Aurora',
    midnight: 'Midnight',
    slate: 'Slate',
    amber: 'Amber',
    rose: 'Rose',
    emerald: 'Emerald',
    sapphire: 'Sapphire',
    ruby: 'Ruby',
    topaz: 'Topaz',
    pearl: 'Pearl',
    shadow: 'Shadow',
    eclipse: 'Eclipse',
    nebula: 'Nebula',
    solstice: 'Solstice',
    glacier: 'Glacier',
    desert: 'Desert',
    jungle: 'Jungle',
    coral: 'Coral',
    storm: 'Storm',
    flame: 'Flame',
    ice: 'Ice',
    twilight: 'Twilight',
    mystic: 'Mystic',
    ethereal: 'Ethereal',
    radiant: 'Radiant',
    obsidian: 'Obsidian',
    amethyst: 'Amethyst',
    jade: 'Jade',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    copper: 'Copper',
    platinum: 'Platinum',
    'sapphire-dark': 'Sapphire Dark',
    'ruby-dark': 'Ruby Dark',
    'emerald-dark': 'Emerald Dark'
};

function initializeThemes() {
    const dropdown = document.getElementById('theme-dropdown');
    Object.entries(THEMES).forEach(([key, name]) => {
        const option = document.createElement('div');
        option.className = 'theme-option' + (key === currentTheme ? ' active' : '');
        option.title = name;
        option.onclick = (e) => {
            e.stopPropagation();
            setTheme(key);
        };
        dropdown.appendChild(option);
    });
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    currentTheme = theme;
    localStorage.setItem('mini-weather-theme', theme);
    
    document.querySelectorAll('.theme-option').forEach((opt, idx) => {
        opt.classList.toggle('active', Object.keys(THEMES)[idx] === theme);
    });
}

document.getElementById('theme-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('theme-dropdown').classList.toggle('active');
});

document.addEventListener('click', () => {
    document.getElementById('theme-dropdown').classList.remove('active');
});

// WEATHER UTILITIES
function getWeatherIcon(code, isDay = true) {
    // WMO codes
    if (code === 0) return '☀️';
    if (code === 1 || code === 2) return isDay ? '⛅' : '🌤️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code === 51 || code === 53 || code === 55) return '🌦️';
    if (code === 61 || code === 63 || code === 65) return '🌧️';
    if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return '❄️';
    if (code === 80 || code === 81 || code === 82) return '⛈️';
    if (code === 95 || code === 96 || code === 99) return '⚡';
    return '🌡️';
}

function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Depositing Rime Fog',
        51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
        61: 'Slight Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
        71: 'Slight Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
        77: 'Snow Grains',
        80: 'Slight Rain Showers', 81: 'Moderate Rain Showers', 82: 'Violent Rain Showers',
        85: 'Slight Snow Showers', 86: 'Heavy Snow Showers',
        95: 'Thunderstorm', 96: 'Thunderstorm with Slight Hail', 99: 'Thunderstorm with Heavy Hail'
    };
    return descriptions[code] || 'Unknown';
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getHourLabel(dateString) {
    const date = new Date(dateString);
    const hours = date.getHours();
    return hours.toString().padStart(2, '0') + ':00';
}

function getGardenState(temp, humidity, windSpeed, precipitation, uvIndex) {
    // Determine plant condition based on multiple weather factors
    // Ideal: 15-25°C, 40-70% humidity, <20 km/h wind, no rain, UV < 6
    
    let score = 0;
    let details = [];

    // Temperature scoring
    if (temp >= 15 && temp <= 25) {
        score += 25;
        details.push('✓ Perfect temperature');
    } else if (temp >= 10 && temp <= 30) {
        score += 15;
        details.push('✓ Acceptable temperature');
    } else {
        score += 5;
        details.push('✗ Extreme temperature');
    }

    // Humidity scoring
    if (humidity >= 40 && humidity <= 70) {
        score += 25;
        details.push('✓ Ideal humidity');
    } else if (humidity >= 30 && humidity <= 80) {
        score += 15;
        details.push('✓ Good humidity');
    } else {
        score += 5;
        details.push('✗ Poor humidity');
    }

    // Wind scoring
    if (windSpeed < 15) {
        score += 20;
        details.push('✓ Calm winds');
    } else if (windSpeed < 30) {
        score += 10;
        details.push('⚠ Breezy');
    } else {
        score += 2;
        details.push('✗ Strong winds');
    }

    // Precipitation scoring
    if (precipitation === 0) {
        score += 15;
        details.push('✓ No precipitation');
    } else if (precipitation < 5) {
        score += 10;
        details.push('✓ Light rain good');
    } else if (precipitation < 20) {
        score += 5;
        details.push('⚠ Heavy rain');
    } else {
        score += 1;
        details.push('✗ Very heavy rain');
    }

    // UV Index scoring
    if (uvIndex <= 3) {
        score += 15;
        details.push('✓ Safe UV');
    } else if (uvIndex <= 6) {
        score += 10;
        details.push('⚠ Moderate UV');
    } else {
        score += 5;
        details.push('✗ High UV');
    }

    // Determine state
    if (score >= 90) return { state: 'thriving', emoji: '🌻', text: 'THRIVING', details };
    if (score >= 70) return { state: 'healthy', emoji: '🌱', text: 'HEALTHY', details };
    if (score >= 50) return { state: 'stressed', emoji: '🌾', text: 'STRESSED', details };
    return { state: 'wilted', emoji: '🍂', text: 'WILTED', details };
}

async function getLocationName(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        const city = data.address?.city || data.address?.town || data.address?.county || 'Unknown';
        const country = data.address?.country || '';
        const state = data.address?.state || '';
        return `${city}${state ? ', ' + state : ''}, ${country}`;
    } catch (error) {
        return 'Your Location';
    }
}

// MULTI-API WEATHER FETCHING (Most accurate first)
async function fetchWeatherData(latitude, longitude) {
    let data = null;
    let source = '';

    try {
        // Primary: Open-Meteo (High accuracy, no config)
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${latitude}&longitude=${longitude}&` +
            `current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,apparent_temperature,pressure_msl,visibility,uv_index,precipitation,cloud_cover,dew_point_2m&` +
            `hourly=temperature_2m,weather_code,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,dew_point_2m,uv_index,cloud_cover,pressure_msl&` +
            `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,dew_point_2m_max,dew_point_2m_min,cloud_cover_max&` +
            `timezone=auto&forecast_days=14`
        );

        if (!response.ok) throw new Error('Open-Meteo failed');
        data = await response.json();
        source = 'Open-Meteo';
    } catch (e1) {
        try {
            // Fallback: National Weather Service (if in US)
            const gridResponse = await fetch(
                `https://api.weather.gov/points/${latitude},${longitude}`
            );
            if (gridResponse.ok) {
                const gridData = await gridResponse.json();
                const forecastUrl = gridData.properties.forecast;
                const forecastResponse = await fetch(forecastUrl);
                if (forecastResponse.ok) {
                    const forecastData = await forecastResponse.json();
                    source = 'National Weather Service';
                    // Convert NWS data format...
                }
            }
        } catch (e2) {
            // Keep Open-Meteo data if available
        }
    }

    if (!data) throw new Error('Unable to fetch weather data');
    return { data, source };
}

async function renderWeather(weatherData, locationName) {
    const { data, source } = weatherData;
    const current = data.current;
    const hourly = data.hourly;
    const daily = data.daily;

    let tempC = current.temperature_2m;
    let tempF = (tempC * 9/5) + 32;
    let displayTemp = temperatureUnit === 'C' ? Math.round(tempC) : Math.round(tempF);
    let tempUnit = temperatureUnit;

    let windKmh = current.wind_speed_10m;
    let windMph = windKmh * 0.621371;
    let displayWind = temperatureUnit === 'C' ? Math.round(windKmh * 10) / 10 : Math.round(windMph * 10) / 10;
    let windUnit = temperatureUnit === 'C' ? 'km/h' : 'mph';

    const description = getWeatherDescription(current.weather_code);
    const feelsLike = temperatureUnit === 'C' ? Math.round(current.apparent_temperature) : Math.round((current.apparent_temperature * 9/5) + 32);

    // Hourly forecast
    const hourlyForecast = hourly.time.slice(0, 48).map((time, idx) => ({
        time: getHourLabel(time),
        temp: Math.round(hourly.temperature_2m[idx]),
        code: hourly.weather_code[idx],
        precipitation: hourly.precipitation_probability[idx] || 0,
        wind: Math.round(hourly.wind_speed_10m[idx] * 10) / 10,
        humidity: hourly.relative_humidity_2m[idx]
    }));

    // Daily forecast
    const dailyForecast = daily.time.map((date, idx) => ({
        date: formatDate(date),
        maxTemp: Math.round(daily.temperature_2m_max[idx]),
        minTemp: Math.round(daily.temperature_2m_min[idx]),
        code: daily.weather_code[idx],
        condition: getWeatherDescription(daily.weather_code[idx]),
        precipitation: daily.precipitation_sum[idx] || 0,
        precipChance: daily.precipitation_probability_max[idx] || 0,
        wind: Math.round(daily.wind_speed_10m_max[idx] * 10) / 10,
        sunrise: daily.sunrise[idx],
        sunset: daily.sunset[idx],
        uvMax: Math.round(daily.uv_index_max[idx]),
        cloudCover: daily.cloud_cover_max[idx]
    }));

    if (temperatureUnit === 'F') {
        dailyForecast.forEach(day => {
            day.maxTemp = Math.round((day.maxTemp * 9/5) + 32);
            day.minTemp = Math.round((day.minTemp * 9/5) + 32);
        });
    }

    // Update garden
    const gardenState = getGardenState(
        tempC,
        current.relative_humidity_2m,
        current.wind_speed_10m,
        current.precipitation || 0,
        current.uv_index
    );

    document.getElementById('garden-plant').className = `plant ${gardenState.state}`;
    document.getElementById('garden-plant').textContent = gardenState.emoji;
    document.getElementById('garden-status').innerHTML = `
        <strong>${gardenState.text}</strong><br>
        ${gardenState.details.map(d => `<div style="font-size: 0.8rem; margin: 4px 0;">${d}</div>`).join('')}
    `;

    // Alerts
    let alertsHtml = '<div class="alerts">';
    
    if (current.uv_index > 8) {
        alertsHtml += '<div class="alert alert-danger">☀️ EXTREME UV: UV Index ' + Math.round(current.uv_index) + ' - Avoid sun exposure</div>';
        notificationManager.send('UV Alert', { body: `UV Index: ${Math.round(current.uv_index)} - EXTREME` });
    } else if (current.uv_index > 6) {
        alertsHtml += '<div class="alert alert-warning">☀️ High UV: Index ' + Math.round(current.uv_index) + ' - Use protection</div>';
    }

    if (current.wind_speed_10m > 50) {
        alertsHtml += '<div class="alert alert-danger">💨 SEVERE WINDS: ' + displayWind + ' ' + windUnit + ' - Extreme caution</div>';
        notificationManager.send('Wind Alert', { body: `Severe winds: ${displayWind} ${windUnit}` });
    } else if (current.wind_speed_10m > 40) {
        alertsHtml += '<div class="alert alert-warning">💨 STRONG WINDS: ' + displayWind + ' ' + windUnit + '</div>';
    }

    if (dailyForecast[0].precipChance > 80) {
        alertsHtml += '<div class="alert alert-warning">⛈️ HEAVY RAIN EXPECTED: ' + dailyForecast[0].precipChance + '% chance</div>';
        notificationManager.send('Rain Alert', { body: `Heavy rain expected: ${dailyForecast[0].precipChance}% chance` });
    } else if (dailyForecast[0].precipChance > 60) {
        alertsHtml += '<div class="alert alert-info">🌧️ Rain likely today</div>';
    }

    if (tempC < 0) {
        alertsHtml += '<div class="alert alert-warning">❄️ FREEZING CONDITIONS: Watch for ice</div>';
        notificationManager.send('Cold Alert', { body: 'Freezing conditions detected' });
    }

    alertsHtml += '</div>';

    // Build HTML
    let html = `
        <div class="weather-card">
            <div class="location-info">
                📍 <span>${locationName}</span>
                <button onclick="updateLocation()">Change</button>
                <span class="api-source">Via ${source}</span>
            </div>

            <div class="temperature-section">
                <p class="temperature">${displayTemp}°${tempUnit}</p>
                <p class="condition">${description}</p>
                <p class="feels-like">Feels like ${feelsLike}°${tempUnit}</p>
            </div>

            <div class="quick-stats">
                <div class="stat-item">
                    <div class="stat-label">Humidity</div>
                    <div class="stat-value">${current.relative_humidity_2m}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Wind Speed</div>
                    <div class="stat-value">${displayWind} ${windUnit}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Wind Gust</div>
                    <div class="stat-value">${Math.round(current.wind_gusts_10m * 10) / 10} ${windUnit}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Wind Dir</div>
                    <div class="stat-value">${current.wind_direction_10m}°</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">UV Index</div>
                    <div class="stat-value">${Math.round(current.uv_index)}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Pressure</div>
                    <div class="stat-value">${Math.round(current.pressure_msl)} hPa</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Visibility</div>
                    <div class="stat-value">${(current.visibility / 1000).toFixed(1)} km</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Dew Point</div>
                    <div class="stat-value">${Math.round(current.dew_point_2m)}°</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Cloud Cover</div>
                    <div class="stat-value">${current.cloud_cover}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Precipitation</div>
                    <div class="stat-value">${current.precipitation || 0} mm</div>
                </div>
            </div>
        </div>

        ${alertsHtml}

        <div class="forecast-section">
            <h3 class="section-title">⏰ 48-Hour Forecast</h3>
            <div class="hourly-forecast">
    `;

    hourlyForecast.forEach((hour, idx) => {
        if (idx % 2 === 0) { // Show every 2 hours
            html += `
                <div class="hourly-item">
                    <div class="hourly-time">${hour.time}</div>
                    <div class="hourly-icon">${getWeatherIcon(hour.code)}</div>
                    <div class="hourly-temp">${hour.temp}°</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">
                        💧 ${hour.precipitation}% | 💨 ${hour.wind}
                    </div>
                </div>
            `;
        }
    });

    html += `
            </div>
        </div>

        <div class="forecast-section">
            <h3 class="section-title">📅 14-Day Forecast</h3>
            <div class="daily-forecast">
    `;

    dailyForecast.forEach(day => {
        const sunrise = new Date(day.sunrise).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const sunset = new Date(day.sunset).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        html += `
            <div class="daily-item">
                <div class="daily-date">${day.date}</div>
                <div class="daily-icon">${getWeatherIcon(day.code)}</div>
                <div class="daily-condition">${day.condition}</div>
                <div class="daily-temps">
                    <span class="temp-max">${day.maxTemp}°</span>
                    <span class="temp-min">${day.minTemp}°</span>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px;">
                    🌅 ${sunrise} 🌇 ${sunset}<br>
                    💧 ${day.precipChance}% | 💨 ${day.wind}<br>
                    ☀️ UV${day.uvMax} | ☁️ ${day.cloudCover}%
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>

        <div class="forecast-section">
            <h3 class="section-title">📊 Detailed Analysis</h3>
            <div class="detailed-info">
                <div class="info-card">
                    <div class="info-title">Apparent Temperature</div>
                    <div class="info-value">${feelsLike}°${tempUnit}</div>
                    <div class="info-detail">How it actually feels with wind chill and humidity</div>
                </div>
                <div class="info-card">
                    <div class="info-title">Dew Point</div>
                    <div class="info-value">${Math.round(current.dew_point_2m)}°</div>
                    <div class="info-detail">Temperature when moisture condenses</div>
                </div>
                <div class="info-card">
                    <div class="info-title">UV Index Level</div>
                    <div class="info-value">${Math.round(current.uv_index)}</div>
                    <div class="info-detail">${current.uv_index < 3 ? 'Low' : current.uv_index < 6 ? 'Moderate' : current.uv_index < 8 ? 'High' : current.uv_index < 11 ? 'Very High' : 'Extreme'}</div>
                </div>
                <div class="info-card">
                    <div class="info-title">Atmospheric Pressure</div>
                    <div class="info-value">${Math.round(current.pressure_msl)} hPa</div>
                    <div class="info-detail">${current.pressure_msl > 1013 ? 'High (Clear)' : 'Low (Cloudy)'}</div>
                </div>
                <div class="info-card">
                    <div class="info-title">Wind Information</div>
                    <div class="info-value">${displayWind} ${windUnit}</div>
                    <div class="info-detail">Direction ${current.wind_direction_10m}° | Gust ${Math.round(current.wind_gusts_10m * 10) / 10} ${windUnit}</div>
                </div>
                <div class="info-card">
                    <div class="info-title">Visibility</div>
                    <div class="info-value">${(current.visibility / 1000).toFixed(1)} km</div>
                    <div class="info-detail">Horizontal visibility range</div>
                </div>
                <div class="info-card">
                    <div class="info-title">Cloud Coverage</div>
                    <div class="info-value">${current.cloud_cover}%</div>
                    <div class="info-detail">${current.cloud_cover < 25 ? 'Clear' : current.cloud_cover < 75 ? 'Partly Cloudy' : 'Overcast'}</div>
                </div>
                <div class="info-card">
                    <div class="info-title">Humidity Level</div>
                    <div class="info-value">${current.relative_humidity_2m}%</div>
                    <div class="info-detail">${current.relative_humidity_2m < 30 ? 'Dry' : current.relative_humidity_2m < 70 ? 'Comfortable' : 'Humid'}</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('weather-content').innerHTML = html;
}

async function getWeather() {
    const content = document.getElementById('weather-content');
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            userLocation = { latitude, longitude };

            try {
                const weatherData = await fetchWeatherData(latitude, longitude);
                const locationName = await getLocationName(latitude, longitude);
                await renderWeather(weatherData, locationName);
            } catch (error) {
                content.innerHTML = `
                    <div class="error">
                        <p>❌ Error fetching weather data</p>
                        <p style="font-size: 0.85rem; margin-top: 10px;">${error.message}</p>
                        <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px;">Retry</button>
                    </div>
                `;
            }
        },
        () => {
            content.innerHTML = `
                <div class="error">
                    <p>📍 Location Access Denied</p>
                    <p style="font-size: 0.85rem; margin-top: 10px;">Please enable location services</p>
                    <button onclick="location.reload()" style="margin-top: 15px; padding: 10px 20px;">Retry</button>
                </div>
            `;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function updateLocation() {
    document.getElementById('weather-content').innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Updating location...</p>
        </div>
    `;
    getWeather();
}

document.getElementById('refresh-btn').addEventListener('click', () => {
    document.getElementById('weather-content').innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p class="loading-text">Refreshing weather data...</p>
        </div>
    `;
    getWeather();
});

document.getElementById('settings-btn').addEventListener('click', () => {
    temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('mini-weather-unit', temperatureUnit);
    document.getElementById('settings-btn').textContent = `⚙️ Units (°${temperatureUnit})`;
    
    if (userLocation) {
        document.getElementById('weather-content').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p class="loading-text">Converting temperatures...</p>
            </div>
        `;
        getWeather();
    }
});

document.getElementById('notification-btn').addEventListener('click', async () => {
    const granted = await notificationManager.requestPermission();
    if (granted) {
        notificationManager.send('Mini Weather', {
            body: 'Push notifications enabled! You\'ll get weather alerts.'
        });
    }
});

let currentTheme = localStorage.getItem('mini-weather-theme') || 'dark';
let userLocation = null;
let temperatureUnit = localStorage.getItem('mini-weather-unit') || 'C';

document.addEventListener('DOMContentLoaded', () => {
    setTheme(currentTheme);
    initializeThemes();
    document.getElementById('settings-btn').textContent = `⚙️ Units (°${temperatureUnit})`;
    getWeather();
});
