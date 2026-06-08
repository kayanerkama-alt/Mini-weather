# Mini Weather 🌤️

**Fast, Accurate, AI-Powered Weather App**

A modern weather application with real-time data, AI insights, and multiple weather API sources.

## ✨ Features

### 🌍 Multi-API Support
- **WeatherAPI** (Primary): Fast, accurate, real-time data with alerts
- **Open-Meteo**: Free, no API key, global coverage
- **National Weather Service**: US-only, government data

### 🤖 AI-Powered Insights
- Smart weather alerts (heat, cold, UV, wind)
- Activity recommendations
- Air quality warnings
- Personalized safety tips

### 📊 Comprehensive Weather Data
- **Current**: Temperature, humidity, wind, pressure, UV index, visibility
- **Hourly**: 72-hour forecast with precipitation probability
- **Daily**: 14-day forecast with sunrise/sunset times
- **Alerts**: Weather warnings and severe weather alerts

### ⚡ Performance
- 10-minute intelligent caching
- Optimized API responses
- Fast location lookup
- Offline support via service worker

### 🔒 Privacy First
- No tracking or analytics
- Location data anonymized
- Whitelisted API domains only
- All data stays local

### 📱 Responsive Design
- Mobile-first approach
- Works on all devices
- Touch-optimized controls
- Dark theme by default

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3000
```

### Environment Variables

```bash
WEATHER_API_KEY=b3a0ebd7825d41bdad5151322260406  # WeatherAPI key
PORT=3000                                         # Server port
NODE_ENV=development                              # Environment
```

### Deploy to Railway

```bash
# Push to GitHub
git push origin main

# Railway auto-deploys on push
# Set WEATHER_API_KEY in Railway dashboard
```

## 📡 API Endpoints

### Get Weather
```bash
GET /api/weather?lat=40.7128&lon=-74.0060&source=weatherapi
```

Response:
```json
{
  "source": "WeatherAPI",
  "location": {
    "name": "New York, NY",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "timezone": "America/New_York",
    "country": "United States"
  },
  "current": {
    "temp": 22.5,
    "condition": "Partly cloudy",
    "humidity": 65,
    "windSpeed": 12.5,
    "uvIndex": 5,
    "visibility": 10,
    "pressure": 1013
  },
  "hourly": [...],
  "daily": [...],
  "insights": [
    {
      "type": "activity",
      "severity": "low",
      "title": "🏃 Perfect Weather",
      "message": "Ideal conditions for outdoor activities!",
      "action": "Great time for hiking, running, or outdoor sports"
    }
  ],
  "alerts": [],
  "aqi": null,
  "fromCache": false
}
```

### Get Available Sources
```bash
GET /api/sources
```

### Health Check
```bash
GET /api/health
```

### Cache Statistics
```bash
GET /api/cache-stats
```

## 🏗️ Architecture

### Frontend
- **app.js**: Main application logic
- **index.html**: UI markup
- **sw.js**: Service worker for offline support
- **manifest.json**: PWA configuration

### Backend
- **server.js**: Express.js API server
- **WeatherService**: Multi-API weather fetching
- **AIInsights**: AI-powered weather analysis
- **LocationCache**: Location name caching

## 📦 Dependencies

### Frontend
- No external dependencies (vanilla JavaScript)

### Backend
- `express`: Web framework
- `cors`: Cross-origin support
- `compression`: Response compression
- `node-cache`: In-memory caching
- `node-fetch`: HTTP requests

## 🔧 Configuration

### Cache Settings
```javascript
// 10-minute TTL, check every 2 minutes
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
```

### API Timeout
```javascript
// 8-second timeout for API requests
{ timeout: 8000 }
```

### Temperature Units
- Default: Celsius (°C)
- Toggle to Fahrenheit (°F)
- Wind speed converts automatically

## 🎯 Usage

1. **Click 📍** to request location
2. **View current weather** with detailed stats
3. **Read AI insights** for personalized recommendations
4. **Check hourly/daily forecast** for planning
5. **Switch API source** with 🔌 button
6. **Toggle units** with °C/°F button
7. **Refresh** with 🔄 button

## 🐛 Troubleshooting

### Location not working
- Check browser permissions
- Ensure HTTPS (or localhost)
- Try refreshing the page

### API errors
- Verify WEATHER_API_KEY is set
- Check internet connection
- Try different API source

### Slow performance
- Clear browser cache
- Check network tab in DevTools
- Verify server is running

## 📊 Performance Metrics

- **Bundle Size**: ~12KB (gzipped)
- **Initial Load**: ~1-2 seconds
- **API Response**: 2-5 seconds
- **Cache Hit**: <100ms

## 🔐 Security

- No sensitive data stored locally
- API keys only on backend
- CORS enabled for frontend
- Input validation on all endpoints
- Rate limiting via caching

## 📝 License

MIT License - Feel free to use and modify

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- GitHub Issues: Report bugs
- Discussions: Ask questions
- Email: support@miniweather.app

## 🗺️ Roadmap

- [ ] Geolocation search (city name input)
- [ ] Multiple location bookmarks
- [ ] Weather alerts/notifications
- [ ] Air quality detailed data
- [ ] Pollen forecast
- [ ] Historical weather data
- [ ] Weather maps
- [ ] Mobile app (React Native)

---

**Made with ❤️ for weather enthusiasts**

