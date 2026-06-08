// api.js - API abstraction layer for multiple weather sources
const http = require('http');
const https = require('https');

class WeatherAPI {
    static async fetch(url, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;
            const req = protocol.get(url, { timeout }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.on('error', reject);
        });
    }

    static async getOpenMeteo(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m',
            daily: 'temperature_2m_max,temperature_2m_min,weather_code',
            timezone: 'auto'
        });
        return this.fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    }

    static async getNomimatin(lat, lon) {
        return this.fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
        );
    }
}

module.exports = WeatherAPI;
