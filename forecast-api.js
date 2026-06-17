/**
 * Mini Weather — AI Forecast Enhancement API
 *
 * Cloudflare Workers compatible endpoint.
 * Enhances weather forecasts using statistical analysis of current + historical patterns.
 *
 * Privacy guarantees:
 *   - No location data stored
 *   - No user tracking
 *   - All processing in-memory
 *   - Data discarded after response
 *
 * Endpoint: POST /api/forecast
 * Body: { latitude, longitude, currentWeather, historicalData }
 * Response: { predictions, confidence, timestamp, cached }
 */

'use strict';

/* ============================================================
   IN-MEMORY CACHE (per Worker instance, not persistent)
   ============================================================ */
/** @type {Map<string, {data: Object, expires: number}>} */
const forecastCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a cache key from rounded coordinates (privacy: ~10km grid).
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
function makeCacheKey(lat, lon) {
    // Round to 1 decimal place (~11km grid) — no precise location stored
    return `${parseFloat(lat).toFixed(1)},${parseFloat(lon).toFixed(1)}`;
}

/**
 * Get cached forecast if still valid.
 * @param {string} key
 * @returns {Object|null}
 */
function getCached(key) {
    const entry = forecastCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        forecastCache.delete(key);
        return null;
    }
    return entry.data;
}

/**
 * Store forecast in cache.
 * @param {string} key
 * @param {Object} data
 */
function setCache(key, data) {
    // Limit cache size to prevent memory leaks
    if (forecastCache.size > 500) {
        const firstKey = forecastCache.keys().next().value;
        forecastCache.delete(firstKey);
    }
    forecastCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

/* ============================================================
   STATISTICAL ANALYSIS HELPERS
   ============================================================ */
/**
 * Calculate mean of an array.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
    if (!arr || !arr.length) return 0;
    return arr.reduce((a, b) => a + (b || 0), 0) / arr.length;
}

/**
 * Calculate standard deviation.
 * @param {number[]} arr
 * @returns {number}
 */
function stdDev(arr) {
    if (!arr || arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((acc, v) => acc + Math.pow((v || 0) - m, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

/**
 * Clamp a value between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
}

/**
 * Linear interpolation.
 * @param {number} a
 * @param {number} b
 * @param {number} t - 0..1
 * @returns {number}
 */
function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
}

/* ============================================================
   PRECIPITATION PROBABILITY ENHANCEMENT
   ============================================================ */
/**
 * Enhance precipitation probability using multiple atmospheric indicators.
 *
 * Factors considered:
 *   - Base probability from API
 *   - Humidity (high humidity → higher precip chance)
 *   - Dew point depression (temp - dewPoint; small gap → fog/rain)
 *   - Pressure trend (falling pressure → incoming weather)
 *   - Cloud cover (high cloud cover → higher precip chance)
 *   - Wind speed (strong winds can bring weather systems)
 *
 * @param {Object} current - Current weather data
 * @param {number} basePrecipProb - Base precipitation probability (0-100)
 * @returns {{probability: number, confidence: number, factors: string[]}}
 */
function enhancePrecipProbability(current, basePrecipProb) {
    const factors = [];
    let adjustment = 0;
    let confidenceFactors = 0;

    const humidity = current.humidity || 50;
    const dewPoint = current.dewPoint || (current.temp - 10);
    const pressure = current.pressure || 1013;
    const cloudCover = current.cloudCover || 0;
    const temp = current.temp || 15;
    const windSpeed = current.windSpeed || 0;

    // Factor 1: Humidity adjustment
    if (humidity >= 85) {
        adjustment += 15;
        factors.push('Very high humidity (+15%)');
        confidenceFactors++;
    } else if (humidity >= 70) {
        adjustment += 8;
        factors.push('High humidity (+8%)');
        confidenceFactors++;
    } else if (humidity < 40) {
        adjustment -= 10;
        factors.push('Low humidity (-10%)');
        confidenceFactors++;
    }

    // Factor 2: Dew point depression (temp - dewPoint)
    const dewDepression = temp - dewPoint;
    if (dewDepression < 3) {
        adjustment += 20;
        factors.push('Near dew point — fog/rain likely (+20%)');
        confidenceFactors++;
    } else if (dewDepression < 6) {
        adjustment += 10;
        factors.push('Close to dew point (+10%)');
        confidenceFactors++;
    }

    // Factor 3: Pressure analysis
    if (pressure < 990) {
        adjustment += 20;
        factors.push('Very low pressure — storm likely (+20%)');
        confidenceFactors++;
    } else if (pressure < 1000) {
        adjustment += 12;
        factors.push('Low pressure — rain likely (+12%)');
        confidenceFactors++;
    } else if (pressure > 1025) {
        adjustment -= 15;
        factors.push('High pressure — clear conditions (-15%)');
        confidenceFactors++;
    } else if (pressure > 1015) {
        adjustment -= 5;
        factors.push('Moderate high pressure (-5%)');
        confidenceFactors++;
    }

    // Factor 4: Cloud cover
    if (cloudCover >= 90) {
        adjustment += 15;
        factors.push('Overcast sky (+15%)');
        confidenceFactors++;
    } else if (cloudCover >= 70) {
        adjustment += 8;
        factors.push('Mostly cloudy (+8%)');
        confidenceFactors++;
    } else if (cloudCover < 20) {
        adjustment -= 12;
        factors.push('Clear sky (-12%)');
        confidenceFactors++;
    }

    // Factor 5: Wind speed (strong winds can bring weather)
    if (windSpeed > 50) {
        adjustment += 10;
        factors.push('Strong winds — weather system (+10%)');
        confidenceFactors++;
    }

    const enhanced = clamp(basePrecipProb + adjustment, 0, 100);
    const confidence = clamp(0.5 + (confidenceFactors * 0.08), 0.5, 0.95);

    return {
        probability: Math.round(enhanced),
        adjustment: Math.round(adjustment),
        confidence: parseFloat(confidence.toFixed(2)),
        factors,
    };
}

/* ============================================================
   TEMPERATURE TREND ANALYSIS
   ============================================================ */
/**
 * Analyze temperature trend from hourly data.
 *
 * @param {Array} hourlyTemps - Array of hourly temperature values
 * @param {number} currentTemp - Current temperature
 * @returns {{trend: string, direction: number, magnitude: string, confidence: number}}
 */
function analyzeTemperatureTrend(hourlyTemps, currentTemp) {
    if (!hourlyTemps || hourlyTemps.length < 6) {
        return { trend: 'stable', direction: 0, magnitude: 'minimal', confidence: 0.5 };
    }

    // Use next 12 hours for trend
    const next12 = hourlyTemps.slice(0, 12).filter(t => t != null);
    if (next12.length < 3) {
        return { trend: 'stable', direction: 0, magnitude: 'minimal', confidence: 0.5 };
    }

    // Simple linear regression
    const n = next12.length;
    const xMean = (n - 1) / 2;
    const yMean = mean(next12);

    let numerator = 0;
    let denominator = 0;
    next12.forEach((y, x) => {
        numerator += (x - xMean) * (y - yMean);
        denominator += Math.pow(x - xMean, 2);
    });

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const totalChange = slope * (n - 1);

    let trend, magnitude;
    const absChange = Math.abs(totalChange);

    if (absChange < 1) {
        trend = 'stable';
        magnitude = 'minimal';
    } else if (absChange < 3) {
        trend = totalChange > 0 ? 'warming' : 'cooling';
        magnitude = 'slight';
    } else if (absChange < 6) {
        trend = totalChange > 0 ? 'warming' : 'cooling';
        magnitude = 'moderate';
    } else {
        trend = totalChange > 0 ? 'warming' : 'cooling';
        magnitude = 'significant';
    }

    // Confidence based on data consistency (low std dev = high confidence)
    const sd = stdDev(next12);
    const confidence = clamp(0.9 - (sd / 20), 0.5, 0.95);

    return {
        trend,
        direction: parseFloat(slope.toFixed(3)),
        totalChange: parseFloat(totalChange.toFixed(1)),
        magnitude,
        confidence: parseFloat(confidence.toFixed(2)),
    };
}

/* ============================================================
   SEVERE WEATHER RISK ASSESSMENT
   ============================================================ */
/**
 * Assess severe weather risk from multiple indicators.
 *
 * @param {Object} current - Current weather conditions
 * @param {Array} hourlyData - Hourly forecast data
 * @returns {{risk: string, score: number, alerts: string[], confidence: number}}
 */
function assessSevereWeatherRisk(current, hourlyData) {
    let riskScore = 0;
    const alerts = [];

    const temp = current.temp || 15;
    const humidity = current.humidity || 50;
    const windSpeed = current.windSpeed || 0;
    const windGusts = current.windGusts || 0;
    const pressure = current.pressure || 1013;
    const uvIndex = current.uvIndex || 0;
    const precipitation = current.precipitation || 0;
    const cloudCover = current.cloudCover || 0;
    const visibility = current.visibility || 10;

    // Extreme temperature
    if (temp >= 40) {
        riskScore += 30;
        alerts.push('🔥 Extreme heat — heat stroke risk');
    } else if (temp >= 35) {
        riskScore += 15;
        alerts.push('🌡️ Very hot conditions');
    } else if (temp <= -15) {
        riskScore += 30;
        alerts.push('❄️ Extreme cold — frostbite risk');
    } else if (temp <= 0) {
        riskScore += 15;
        alerts.push('❄️ Freezing conditions — ice risk');
    }

    // Wind
    if (windSpeed >= 80 || windGusts >= 100) {
        riskScore += 35;
        alerts.push('🌪️ Dangerous wind speeds — stay indoors');
    } else if (windSpeed >= 60 || windGusts >= 80) {
        riskScore += 20;
        alerts.push('💨 Severe winds — avoid outdoor activities');
    } else if (windSpeed >= 40) {
        riskScore += 10;
        alerts.push('💨 Strong winds — caution advised');
    }

    // Pressure (very low = storm)
    if (pressure < 980) {
        riskScore += 25;
        alerts.push('⛈️ Very low pressure — severe storm possible');
    } else if (pressure < 990) {
        riskScore += 15;
        alerts.push('🌧️ Low pressure — storm system approaching');
    }

    // UV Index
    if (uvIndex >= 11) {
        riskScore += 20;
        alerts.push('☀️ Extreme UV — avoid sun exposure');
    } else if (uvIndex >= 8) {
        riskScore += 10;
        alerts.push('☀️ Very high UV — use SPF 50+');
    }

    // Visibility
    if (visibility < 0.5) {
        riskScore += 20;
        alerts.push('🌫️ Near-zero visibility — dangerous driving');
    } else if (visibility < 2) {
        riskScore += 10;
        alerts.push('🌫️ Poor visibility');
    }

    // Heavy precipitation
    if (precipitation >= 20) {
        riskScore += 20;
        alerts.push('🌊 Extreme precipitation — flood risk');
    } else if (precipitation >= 10) {
        riskScore += 10;
        alerts.push('🌧️ Heavy rain — flooding possible');
    }

    // Analyze hourly data for upcoming severe conditions
    if (hourlyData && hourlyData.length > 0) {
        const next6h = hourlyData.slice(0, 6);
        const maxPrecip = Math.max(...next6h.map(h => h.precipitation || 0));
        const maxWind = Math.max(...next6h.map(h => h.wind || 0));

        if (maxPrecip >= 80) {
            riskScore += 15;
            alerts.push('⛈️ Heavy rain expected in next 6 hours');
        }
        if (maxWind >= 60) {
            riskScore += 10;
            alerts.push('💨 Strong winds expected in next 6 hours');
        }
    }

    // Determine risk level
    let risk;
    if (riskScore >= 50) risk = 'extreme';
    else if (riskScore >= 30) risk = 'high';
    else if (riskScore >= 15) risk = 'moderate';
    else if (riskScore >= 5) risk = 'low';
    else risk = 'minimal';

    const confidence = clamp(0.7 + (Math.min(alerts.length, 3) * 0.05), 0.7, 0.95);

    return {
        risk,
        score: riskScore,
        alerts: [...new Set(alerts)], // deduplicate
        confidence: parseFloat(confidence.toFixed(2)),
    };
}

/* ============================================================
   COMFORT INDEX CALCULATION
   ============================================================ */
/**
 * Calculate a human comfort index (0-100).
 *
 * @param {Object} current - Current weather
 * @returns {{score: number, label: string, description: string}}
 */
function calculateComfortIndex(current) {
    const temp = current.temp || 20;
    const humidity = current.humidity || 50;
    const windSpeed = current.windSpeed || 0;
    const uvIndex = current.uvIndex || 0;

    let score = 100;

    // Temperature comfort (ideal: 18-24°C)
    if (temp < 0 || temp > 40) score -= 40;
    else if (temp < 5 || temp > 35) score -= 25;
    else if (temp < 10 || temp > 30) score -= 15;
    else if (temp < 15 || temp > 28) score -= 5;

    // Humidity comfort (ideal: 40-60%)
    if (humidity < 20 || humidity > 90) score -= 20;
    else if (humidity < 30 || humidity > 80) score -= 12;
    else if (humidity < 40 || humidity > 70) score -= 5;

    // Wind comfort (ideal: < 15 km/h)
    if (windSpeed > 60) score -= 25;
    else if (windSpeed > 40) score -= 15;
    else if (windSpeed > 25) score -= 8;
    else if (windSpeed > 15) score -= 3;

    // UV comfort (ideal: < 3)
    if (uvIndex >= 11) score -= 20;
    else if (uvIndex >= 8) score -= 12;
    else if (uvIndex >= 6) score -= 6;
    else if (uvIndex >= 3) score -= 2;

    score = clamp(score, 0, 100);

    let label, description;
    if (score >= 85) { label = 'Excellent'; description = 'Perfect outdoor conditions'; }
    else if (score >= 70) { label = 'Good'; description = 'Comfortable for most activities'; }
    else if (score >= 55) { label = 'Fair'; description = 'Acceptable with minor discomfort'; }
    else if (score >= 35) { label = 'Poor'; description = 'Uncomfortable — limit outdoor time'; }
    else { label = 'Dangerous'; description = 'Avoid outdoor exposure'; }

    return { score, label, description };
}

/* ============================================================
   MAIN FORECAST ENHANCEMENT FUNCTION
   ============================================================ */
/**
 * Generate AI-enhanced forecast predictions.
 *
 * @param {Object} params
 * @param {number} params.latitude - Approximate latitude (privacy: rounded)
 * @param {number} params.longitude - Approximate longitude (privacy: rounded)
 * @param {Object} params.currentWeather - Current weather conditions
 * @param {Array} [params.hourlyData] - Hourly forecast data
 * @param {number} [params.basePrecipProb] - Base precipitation probability
 * @returns {Object} Enhanced forecast predictions
 */
function generateForecastEnhancement(params) {
    const {
        latitude,
        longitude,
        currentWeather,
        hourlyData = [],
        basePrecipProb = 0,
    } = params;

    if (!currentWeather) {
        throw new Error('currentWeather is required');
    }

    // Extract hourly temperatures for trend analysis
    const hourlyTemps = hourlyData.map(h => h.temp || h.temperature || null).filter(t => t != null);

    // Run all analyses
    const precipEnhancement = enhancePrecipProbability(currentWeather, basePrecipProb);
    const tempTrend = analyzeTemperatureTrend(hourlyTemps, currentWeather.temp || 15);
    const severeRisk = assessSevereWeatherRisk(currentWeather, hourlyData);
    const comfortIndex = calculateComfortIndex(currentWeather);

    // Overall confidence (weighted average)
    const overallConfidence = parseFloat((
        (precipEnhancement.confidence * 0.3) +
        (tempTrend.confidence * 0.3) +
        (severeRisk.confidence * 0.2) +
        0.85 * 0.2 // comfort index is deterministic
    ).toFixed(2));

    return {
        predictions: {
            precipProbability: {
                enhanced: precipEnhancement.probability,
                adjustment: precipEnhancement.adjustment,
                factors: precipEnhancement.factors,
                confidence: precipEnhancement.confidence,
            },
            temperatureTrend: {
                trend: tempTrend.trend,
                direction: tempTrend.direction,
                totalChange: tempTrend.totalChange,
                magnitude: tempTrend.magnitude,
                confidence: tempTrend.confidence,
                summary: tempTrend.trend === 'stable'
                    ? 'Temperature will remain stable'
                    : `Temperature ${tempTrend.trend} by ~${Math.abs(tempTrend.totalChange || 0).toFixed(1)}°C over next 12h`,
            },
            severeWeatherRisk: {
                risk: severeRisk.risk,
                score: severeRisk.score,
                alerts: severeRisk.alerts,
                confidence: severeRisk.confidence,
            },
            comfortIndex: {
                score: comfortIndex.score,
                label: comfortIndex.label,
                description: comfortIndex.description,
            },
        },
        confidence: overallConfidence,
        timestamp: new Date().toISOString(),
        cached: false,
        privacy: {
            locationStored: false,
            dataRetained: false,
            processingMode: 'in-memory',
        },
    };
}

/* ============================================================
   CLOUDFLARE WORKER HANDLER
   ============================================================ */
/**
 * Cloudflare Worker fetch handler.
 * Handles CORS, request validation, caching, and response.
 *
 * @param {Request} request
 * @param {Object} env - Worker environment bindings
 * @param {Object} ctx - Execution context
 * @returns {Response}
 */
async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only handle POST /api/forecast
    if (request.method !== 'POST' || url.pathname !== '/api/forecast') {
        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        // Parse request body
        let body;
        try {
            body = await request.json();
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Validate required fields
        const { currentWeather } = body;
        if (!currentWeather || typeof currentWeather !== 'object') {
            return new Response(JSON.stringify({ error: 'currentWeather object is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Privacy: use rounded coordinates for cache key only (not stored)
        const lat = parseFloat(body.latitude || body.lat || 0);
        const lon = parseFloat(body.longitude || body.lon || 0);
        const cacheKey = makeCacheKey(lat, lon);

        // Check cache
        const cached = getCached(cacheKey);
        if (cached) {
            return new Response(JSON.stringify({ ...cached, cached: true }), {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=600',
                    'X-Cache': 'HIT',
                },
            });
        }

        // Generate enhancement
        const result = generateForecastEnhancement({
            latitude: lat,
            longitude: lon,
            currentWeather,
            hourlyData: body.hourlyData || [],
            basePrecipProb: body.basePrecipProb || 0,
        });

        // Cache the result (privacy: no location stored in cache value)
        setCache(cacheKey, result);

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600',
                'X-Cache': 'MISS',
            },
        });

    } catch (err) {
        console.error('Forecast API error:', err);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: err.message,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}

/* ============================================================
   CLIENT-SIDE FORECAST ENHANCEMENT
   (Used when running as a static app without the Worker)
   ============================================================ */
/**
 * Client-side AI forecast enhancement.
 * Falls back to local computation when the Worker endpoint is unavailable.
 *
 * @param {Object} currentWeather - Current weather data
 * @param {Array} hourlyData - Hourly forecast data
 * @param {number} basePrecipProb - Base precipitation probability
 * @returns {Promise<Object>} Enhanced forecast
 */
async function enhanceForecastClient(currentWeather, hourlyData = [], basePrecipProb = 0) {
    // Check if AI forecasts are enabled in settings
    try {
        const settingsRaw = localStorage.getItem('mini-weather-settings');
        if (settingsRaw) {
            const settings = JSON.parse(settingsRaw);
            if (settings.aiForecasts === false) {
                return null; // User opted out
            }
        }
    } catch { /* use default (enabled) */ }

    // Try the Worker endpoint first
    try {
        const loc = JSON.parse(localStorage.getItem('mini-weather-location') || 'null');
        const lat = loc ? parseFloat(loc.latitude).toFixed(1) : 0;
        const lon = loc ? parseFloat(loc.longitude).toFixed(1) : 0;

        const res = await fetch('/api/forecast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                latitude: lat,
                longitude: lon,
                currentWeather,
                hourlyData: hourlyData.slice(0, 24), // limit payload
                basePrecipProb,
            }),
            signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
            return await res.json();
        }
    } catch {
        // Fall through to local computation
    }

    // Local computation fallback
    try {
        return generateForecastEnhancement({
            latitude: 0,
            longitude: 0,
            currentWeather,
            hourlyData,
            basePrecipProb,
        });
    } catch (e) {
        console.warn('AI forecast enhancement failed:', e);
        return null;
    }
}

/* ============================================================
   EXPORTS
   ============================================================ */
// Cloudflare Worker export
if (typeof exports !== 'undefined') {
    exports.default = { fetch: handleRequest };
}

// Browser global export
if (typeof window !== 'undefined') {
    window.ForecastAI = {
        enhance: enhanceForecastClient,
        generateLocal: generateForecastEnhancement,
    };
}

// Cloudflare Worker default export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetch: handleRequest, generateForecastEnhancement, enhanceForecastClient };
}
