// Mini Weather Backend - Node.js/Express
// Features: WeatherAPI integration, location caching, AI insights, optimized endpoints

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import compression from 'compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 min cache

// Environment variables
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'b3a0ebd7825d41bdad5151322260406';
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==================== WEATHER API INTEGRATIONS ====================

class WeatherService {
    constructor() {
        this.apis = {
            weatherapi: {
                name: 'WeatherAPI',
                desc: 'Fast, accurate, real-time data',
                fetch: (lat, lon) => this.fetchWeatherAPI(lat, lon)
            },
            'open-meteo': {
                name: 'Open-Meteo',
                desc: 'Free, no API key, global coverage',
                fetch: (lat, lon) => this.fetchOpenMeteo(lat, lon)
            },
            nws: {
                name: 'National Weather Service',
                desc: 'US only, government data',
                fetch: (lat, lon) => this.fetchNWS(lat, lon)
            }
        };
    }

    async fetchWeatherAPI(latitude, longitude) {
        const params = new URLSearchParams({
            key: WEATHER_API_KEY,
            q: `${latitude},${longitude}`,
            aqi: 'yes',
            alerts: 'yes',
            days: 14
        });

        const response = await fetch(
            `https://api.weatherapi.com/v1/forecast.json?${params}`,
            { timeout: 8000 }
        );

        if (!response.ok) throw new Error(`WeatherAPI: ${response.status}`);

        const data = await response.json();
        return this.normalizeWeatherAPI(data);
    }

    normalizeWeatherAPI(data) {
        const current = data.current;
        const forecast = data.forecast.forecastday;
        const location = data.location;

        return {
            source: 'WeatherAPI',
            location: {
                name: `${location.name}, ${location.region}`,
                latitude: location.lat,
                longitude: location.lon,
                timezone: location.tz_id,
                country: location.country
            },
            current: {
                temp: current.temp_c,
                tempF: current.temp_f,
                condition: current.condition.text,
                icon: current.condition.icon,
                code: current.condition.code,
                humidity: current.humidity,
                windSpeed: current.wind_kph,
                windMph: current.wind_mph,
                windDirection: current.wind_dir,
                windDegree: current.wind_degree,
                windGust: current.gust_kph,
                feelsLike: current.feelslike_c,
                feelsLikeF: current.feelslike_f,
                pressure: current.pressure_mb,
                pressureIn: current.pressure_in,
                precipitation: current.precip_mm,
                visibility: current.vis_km,
                uvIndex: current.uv,
                cloudCover: current.cloud,
                dewPoint: current.dewpoint_c,
                heatIndex: current.heatindex_c,
                windChill: current.windchill_c,
                isDay: current.is_day === 1,
                lastUpdated: current.last_updated
            },
            hourly: this.processHourlyWeatherAPI(forecast),
            daily: this.processDailyWeatherAPI(forecast),
            alerts: data.alerts?.alert || [],
            aqi: current.air_quality || null,
            timestamp: Date.now()
        };
    }

    processHourlyWeatherAPI(forecast) {
        const hourly = [];
        forecast.slice(0, 3).forEach(day => {
            day.hour.slice(0, 24).forEach(hour => {
                hourly.push({
                    time: hour.time,
                    temp: hour.temp_c,
                    condition: hour.condition.text,
                    icon: hour.condition.icon,
                    humidity: hour.humidity,
                    windSpeed: hour.wind_kph,
                    precipitation: hour.precip_mm,
                    precipChance: hour.chance_of_rain,
                    uvIndex: hour.uv,
                    feelsLike: hour.feelslike_c
                });
            });
        });
        return hourly.slice(0, 72); // 72 hours
    }

    processDailyWeatherAPI(forecast) {
        return forecast.map(day => ({
            date: day.date,
            condition: day.day.condition.text,
            icon: day.day.condition.icon,
            maxTemp: day.day.maxtemp_c,
            minTemp: day.day.mintemp_c,
            avgTemp: day.day.avgtemp_c,
            maxWind: day.day.maxwind_kph,
            totalPrecip: day.day.totalprecip_mm,
            precipChance: day.day.daily_chance_of_rain,
            avgHumidity: day.day.avghumidity,
            uvIndex: day.day.uv,
            sunrise: day.astro.sunrise,
            sunset: day.astro.sunset,
            moonrise: day.astro.moonrise,
            moonset: day.astro.moonset,
            moonPhase: day.astro.moon_phase,
            moonIllumination: day.astro.moon_illumination
        }));
    }

    async fetchOpenMeteo(latitude, longitude) {
        const params = new URLSearchParams({
            latitude: latitude.toFixed(3),
            longitude: longitude.toFixed(3),
            current: 'temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,apparent_temperature,pressure_msl,visibility,uv_index,precipitation,cloud_cover',
            hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,relative_humidity_2m',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
            timezone: 'auto',
            forecast_days: 14
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
            timeout: 8000
        });

        if (!response.ok) throw new Error(`Open-Meteo: ${response.status}`);

        const data = await response.json();
        return this.normalizeOpenMeteo(data);
    }

    normalizeOpenMeteo(data) {
        const current = data.current;
        return {
            source: 'Open-Meteo',
            location: {
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone
            },
            current: {
                temp: current.temperature_2m,
                condition: this.getDescription(current.weather_code),
                code: current.weather_code,
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
                windGust: current.wind_gusts_10m,
                feelsLike: current.apparent_temperature,
                pressure: current.pressure_msl,
                visibility: current.visibility / 1000,
                uvIndex: current.uv_index,
                cloudCover: current.cloud_cover,
                precipitation: current.precipitation || 0
            },
            hourly: data.hourly.time.slice(0, 72).map((time, i) => ({
                time,
                temp: data.hourly.temperature_2m[i],
                condition: this.getDescription(data.hourly.weather_code[i]),
                humidity: data.hourly.relative_humidity_2m[i],
                windSpeed: data.hourly.wind_speed_10m[i],
                precipitation: data.hourly.precipitation_probability[i] || 0
            })),
            daily: data.daily.time.map((date, i) => ({
                date,
                condition: this.getDescription(data.daily.weather_code[i]),
                maxTemp: data.daily.temperature_2m_max[i],
                minTemp: data.daily.temperature_2m_min[i],
                precipitation: data.daily.precipitation_sum[i] || 0,
                precipChance: data.daily.precipitation_probability_max[i] || 0,
                windSpeed: data.daily.wind_speed_10m_max[i],
                uvIndex: data.daily.uv_index_max[i],
                sunrise: data.daily.sunrise[i],
                sunset: data.daily.sunset[i]
            })),
            alerts: [],
            aqi: null,
            timestamp: Date.now()
        };
    }

    async fetchNWS(latitude, longitude) {
        const gridResponse = await fetch(
            `https://api.weather.gov/points/${latitude},${longitude}`,
            { timeout: 8000 }
        );

        if (!gridResponse.ok) throw new Error('NWS: Location not in US');

        const gridData = await gridResponse.json();
        const forecastUrl = gridData.properties.forecast;
        const forecastResponse = await fetch(forecastUrl, { timeout: 8000 });

        if (!forecastResponse.ok) throw new Error('NWS: Forecast unavailable');

        const forecastData = await forecastResponse.json();
        return this.normalizeNWS(forecastData);
    }

    normalizeNWS(data) {
        const periods = data.properties.periods;
        return {
            source: 'National Weather Service',
            location: {
                latitude: data.geometry.coordinates[1],
                longitude: data.geometry.coordinates[0],
                timezone: 'US'
            },
            current: {
                temp: (periods[0].temperature - 32) * 5/9,
                condition: periods[0].shortForecast,
                code: 0,
                humidity: 50,
                windSpeed: parseInt(periods[0].windSpeed) || 0,
                windGust: 0,
                feelsLike: periods[0].temperature,
                pressure: 1013,
                visibility: 10,
                uvIndex: 5,
                cloudCover: 50,
                precipitation: 0
            },
            hourly: [],
            daily: periods.filter((_, i) => i % 2 === 0).slice(0, 7).map(p => ({
                date: p.startTime.split('T')[0],
                condition: p.shortForecast,
                code: 0,
                maxTemp: p.temperature,
                minTemp: p.temperature - 5,
                precipitation: 0,
                precipChance: 0,
                windSpeed: parseInt(p.windSpeed) || 0,
                uvIndex: 5,
                sunrise: '06:00',
                sunset: '18:00'
            })),
            alerts: [],
            aqi: null,
            timestamp: Date.now()
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
}

// ==================== AI INSIGHTS ====================

class AIInsights {
    static generateInsights(weather, location) {
        const insights = [];
        const { current, daily } = weather;

        // Temperature insights
        if (current.temp > 35) {
            insights.push({
                type: 'heat',
                severity: 'high',
                title: '🔥 Extreme Heat',
                message: `${Math.round(current.temp)}°C is dangerously hot. Stay hydrated and avoid prolonged sun exposure.`,
                action: 'Stay indoors during peak hours (11am-4pm)'
            });
        } else if (current.temp < 0) {
            insights.push({
                type: 'cold',
                severity: 'high',
                title: '❄️ Freezing Temperature',
                message: `${Math.round(current.temp)}°C is freezing. Dress warmly and watch for ice.`,
                action: 'Wear insulated clothing and check road conditions'
            });
        }

        // UV insights
        if (current.uvIndex > 8) {
            insights.push({
                type: 'uv',
                severity: 'high',
                title: '☀️ Extreme UV',
                message: `UV Index ${Math.round(current.uvIndex)} is extreme. Apply SPF 50+ sunscreen.`,
                action: 'Reapply sunscreen every 2 hours'
            });
        } else if (current.uvIndex > 6) {
            insights.push({
                type: 'uv',
                severity: 'medium',
                title: '☀️ High UV',
                message: `UV Index ${Math.round(current.uvIndex)} is high. Use SPF 30+ sunscreen.`,
                action: 'Wear sunscreen and sunglasses'
            });
        }

        // Wind insights
        if (current.windSpeed > 40) {
            insights.push({
                type: 'wind',
                severity: 'high',
                title: '💨 Strong Winds',
                message: `Wind speed ${Math.round(current.windSpeed)} km/h. Secure loose objects.`,
                action: 'Avoid outdoor activities, secure outdoor items'
            });
        }

        // Precipitation insights
        if (daily[0]?.precipChance > 80) {
            insights.push({
                type: 'rain',
                severity: 'medium',
                title: '🌧️ Heavy Rain Expected',
                message: `${daily[0].precipChance}% chance of rain. Bring an umbrella.`,
                action: 'Carry umbrella and wear waterproof clothing'
            });
        }

        // Activity recommendations
        if (current.temp >= 15 && current.temp <= 25 && current.windSpeed < 20 && current.uvIndex < 6) {
            insights.push({
                type: 'activity',
                severity: 'low',
                title: '🏃 Perfect Weather',
                message: 'Ideal conditions for outdoor activities!',
                action: 'Great time for hiking, running, or outdoor sports'
            });
        }

        // Air quality insights
        if (weather.aqi) {
            const aqi = weather.aqi.us_epa_index;
            if (aqi >= 4) {
                insights.push({
                    type: 'aqi',
                    severity: 'high',
                    title: '💨 Poor Air Quality',
                    message: `Air quality is unhealthy. Limit outdoor activities.`,
                    action: 'Wear N95 mask if going outside'
                });
            }
        }

        return insights;
    }
}

// ==================== LOCATION CACHE ====================

class LocationCache {
    static getKey(lat, lon) {
        return `loc_${lat.toFixed(3)}_${lon.toFixed(3)}`;
    }

    static async getLocationName(latitude, longitude) {
        const key = this.getKey(latitude, longitude);
        const cached = cache.get(key);
        if (cached) return cached;

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
                { timeout: 5000 }
            );
            const data = await response.json();
            const address = data.address || {};
            const parts = [];
            if (address.city) parts.push(address.city);
            else if (address.town) parts.push(address.town);
            if (address.state && address.state !== address.city) parts.push(address.state);
            if (address.country) parts.push(address.country);
            const name = parts.join(', ') || 'Unknown Location';
            cache.set(key, name);
            return name;
        } catch {
            return `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
        }
    }
}

// ==================== API ROUTES ====================

const weatherService = new WeatherService();

// Get weather for location
app.get('/api/weather', async (req, res) => {
    try {
        const { lat, lon, source = 'weatherapi' } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({ error: 'Missing latitude or longitude' });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        // Check cache
        const cacheKey = `weather_${latitude.toFixed(3)}_${longitude.toFixed(3)}_${source}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        // Fetch weather
        const api = weatherService.apis[source];
        if (!api) {
            return res.status(400).json({ error: 'Invalid weather source' });
        }

        const weather = await api.fetch(latitude, longitude);
        const locationName = await LocationCache.getLocationName(latitude, longitude);

        // Generate AI insights
        const insights = AIInsights.generateInsights(weather, locationName);

        const result = {
            ...weather,
            locationName,
            insights,
            fromCache: false
        };

        cache.set(cacheKey, result);
        res.json(result);
    } catch (error) {
        console.error('Weather API error:', error);
        res.status(500).json({
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Get available weather sources
app.get('/api/sources', (req, res) => {
    const sources = Object.entries(weatherService.apis).map(([key, api]) => ({
        id: key,
        name: api.name,
        description: api.desc
    }));
    res.json(sources);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV
    });
});

// Cache stats
app.get('/api/cache-stats', (req, res) => {
    const keys = cache.keys();
    res.json({
        cacheSize: keys.length,
        keys: keys.slice(0, 10),
        stats: cache.getStats()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🌤️  Mini Weather Backend running on port ${PORT}`);
    console.log(`📡 WeatherAPI Key: ${WEATHER_API_KEY.substring(0, 8)}...`);
    console.log(`🔗 API: http://localhost:${PORT}/api/weather?lat=40.7128&lon=-74.0060`);
    console.log(`📊 Cache: http://localhost:${PORT}/api/cache-stats`);
});

export default app;

