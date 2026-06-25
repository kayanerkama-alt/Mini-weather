/**
 * ai-forecast.js — AI Weather Forecasting Engine v2.0
 * Mini Weather · Statistical ML-based trend analysis & predictions
 *
 * Uses lightweight statistical models (no external ML library required):
 *  - Linear regression for trend analysis
 *  - Moving averages for smoothing
 *  - Z-score anomaly detection
 *  - Seasonal baseline comparison
 *  - Confidence scoring via variance analysis
 *  - Weighted ensemble predictions
 *  - Multi-factor anomaly detection
 *  - Improved confidence calibration
 */

'use strict';

/* ============================================================
   STATISTICAL HELPERS
   ============================================================ */

/**
 * Compute the arithmetic mean of an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/**
 * Compute the median of an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
function median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute the population standard deviation.
 * @param {number[]} arr
 * @returns {number}
 */
function stdDev(arr) {
    if (!arr || arr.length < 2) return 0;
    const m = mean(arr);
    const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

/**
 * Compute the interquartile range (IQR) for robust anomaly detection.
 * @param {number[]} arr
 * @returns {{ q1: number, q3: number, iqr: number, median: number }}
 */
function quartiles(arr) {
    if (!arr || arr.length < 4) {
        const m = median(arr || []);
        return { q1: m, q3: m, iqr: 0, median: m };
    }
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const q1 = median(sorted.slice(0, mid));
    const q3 = median(sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1));
    return { q1, q3, iqr: q3 - q1, median: median(arr) };
}

/**
 * Simple Ordinary Least Squares linear regression.
 * Returns { slope, intercept, r2 } where r2 is the coefficient of determination.
 * @param {number[]} y  — dependent variable values (evenly spaced x = 0,1,2,…)
 * @returns {{ slope: number, intercept: number, r2: number, stdErr: number }}
 */
function linearRegression(y) {
    const n = y.length;
    if (n < 2) return { slope: 0, intercept: y[0] || 0, r2: 0, stdErr: 0 };

    const x = Array.from({ length: n }, (_, i) => i);
    const xMean = mean(x);
    const yMean = mean(y);

    let ssXY = 0, ssXX = 0, ssYY = 0;
    for (let i = 0; i < n; i++) {
        ssXY += (x[i] - xMean) * (y[i] - yMean);
        ssXX += (x[i] - xMean) ** 2;
        ssYY += (y[i] - yMean) ** 2;
    }

    const slope = ssXX !== 0 ? ssXY / ssXX : 0;
    const intercept = yMean - slope * xMean;
    const r2 = ssYY !== 0 ? (ssXY ** 2) / (ssXX * ssYY) : 0;
    
    // Calculate standard error of estimate
    let sse = 0;
    for (let i = 0; i < n; i++) {
        const predicted = slope * i + intercept;
        sse += (y[i] - predicted) ** 2;
    }
    const stdErr = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;

    return { slope, intercept, r2: Math.min(1, Math.max(0, r2)), stdErr };
}

/**
 * Weighted moving average for smoother trend analysis.
 * @param {number[]} arr
 * @param {number} window - window size
 * @returns {number[]}
 */
function weightedMA(arr, window = 3) {
    if (!arr || arr.length === 0) return [];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - window + 1);
        const weights = Array.from({ length: i - start + 1 }, (_, idx) => idx + 1);
        const sumW = weights.reduce((a, b) => a + b, 0);
        const weighted = arr.slice(start, i + 1).reduce((s, v, idx) => s + v * weights[idx], 0);
        result.push(weighted / sumW);
    }
    return result;
}

/**
 * Exponential moving average (EMA).
 * @param {number[]} arr
 * @param {number} alpha — smoothing factor (0 < alpha ≤ 1)
 * @returns {number[]}
 */
function ema(arr, alpha = 0.3) {
    if (!arr || arr.length === 0) return [];
    const result = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
        result.push(alpha * arr[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
}

/**
 * Double EMA for trend acceleration detection.
 * @param {number[]} arr
 * @param {number} alpha 
 * @returns {{ ema1: number[], ema2: number[], macd: number[], signal: number[] }}
 */
function doubleEMA(arr, alpha = 0.3) {
    const ema1 = ema(arr, alpha);
    const ema2 = ema(arr, alpha * alpha);
    const macd = ema1.map((v, i) => v - ema2[i]);
    const signal = ema(macd, alpha);
    return { ema1, ema2, macd, signal };
}

/**
 * Compute Z-scores for anomaly detection.
 * @param {number[]} arr
 * @returns {number[]}
 */
function zScores(arr) {
    const m = mean(arr);
    const sd = stdDev(arr);
    if (sd === 0) return arr.map(() => 0);
    return arr.map(v => (v - m) / sd);
}

/**
 * Clamp a value between min and max.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

/* ============================================================
   SEASONAL BASELINES  (monthly climate normals — global avg)
   ============================================================ */

/**
 * Approximate global-average monthly temperature normals (°C).
 * Used for seasonal anomaly comparison when no historical data is stored.
 */
const MONTHLY_TEMP_NORMALS = [3, 4, 7, 12, 17, 21, 23, 22, 18, 13, 7, 4];

/**
 * Approximate global-average monthly precipitation normals (mm/day).
 */
const MONTHLY_PRECIP_NORMALS = [2.1, 1.9, 2.3, 2.5, 2.8, 3.0, 3.2, 3.1, 2.9, 2.6, 2.3, 2.2];

/**
 * Typical diurnal temperature range by month (°C).
 */
const MONTHLY_DTR = [8, 9, 10, 11, 12, 13, 13, 12, 11, 10, 9, 8];

/* ============================================================
   AI FORECAST ENGINE
   ============================================================ */

class AIForecastEngine {
    /**
     * @param {object} weatherData — normalised weather object from app.js
     */
    constructor(weatherData) {
        this.data = weatherData;
        this.hourly = weatherData?.hourly || [];
        this.daily = weatherData?.daily || [];
        this.current = weatherData?.current || {};
        this._cache = {};
    }

    /* ----------------------------------------------------------
       PUBLIC API
       ---------------------------------------------------------- */

    /**
     * Run the full AI analysis pipeline and return a structured result.
     * @returns {AIForecastResult}
     */
    analyse() {
        if (!this.data || this.daily.length < 3) {
            return this._emptyResult('Insufficient data for AI analysis.');
        }

        try {
            const tempTrend      = this._analyseTempTrend();
            const precipTrend    = this._analysePrecipTrend();
            const pressureTrend  = this._analysePressureTrend();
            const humidityTrend  = this._analyseHumidityTrend();
            const windTrend      = this._analyseWindTrend();
            const uvTrend        = this._analyseUVTrend();
            const anomalies      = this._detectAnomalies();
            const patterns       = this._recognisePatterns();
            const seasonal       = this._seasonalComparison();
            const predictions    = this._generatePredictions(tempTrend, precipTrend, windTrend);
            const confidence     = this._overallConfidence(tempTrend, precipTrend, pressureTrend, windTrend);
            const summary        = this._buildSummary(tempTrend, precipTrend, pressureTrend, anomalies, patterns);

            return {
                ok: true,
                generatedAt: new Date().toISOString(),
                confidence,
                summary,
                trends: { 
                    temp: tempTrend, 
                    precip: precipTrend, 
                    pressure: pressureTrend, 
                    humidity: humidityTrend,
                    wind: windTrend,
                    uv: uvTrend
                },
                anomalies,
                patterns,
                seasonal,
                predictions
            };
        } catch (err) {
            console.error('[AIForecast] Analysis error:', err);
            return this._emptyResult('Analysis failed: ' + err.message);
        }
    }

    /* ----------------------------------------------------------
       TREND ANALYSIS
       ---------------------------------------------------------- */

    /** Analyse temperature trend over the forecast period with improved accuracy. */
    _analyseTempTrend() {
        const temps = this.daily.map(d => d.maxTemp).filter(v => v != null);
        if (temps.length < 2) return this._flatTrend('temperature');

        const reg = linearRegression(temps);
        const smoothed = ema(temps, 0.4);
        const wma = weightedMA(temps, 3);
        const doubleEma = doubleEMA(temps, 0.3);
        const direction = this._trendDirection(reg.slope, 0.3);
        const magnitude = Math.abs(reg.slope * temps.length);
        
        // Calculate trend stability based on residual analysis
        const residuals = temps.map((t, i) => t - (reg.slope * i + reg.intercept));
        const residualStd = stdDev(residuals);
        const stability = Math.max(0, 100 - (residualStd * 10));

        return {
            variable: 'temperature',
            direction,
            slope: parseFloat(reg.slope.toFixed(3)),
            r2: parseFloat(reg.r2.toFixed(3)),
            stdErr: parseFloat(reg.stdErr.toFixed(2)),
            magnitude: parseFloat(magnitude.toFixed(1)),
            confidence: this._trendConfidence(reg.r2, temps.length, reg.stdErr),
            stability: parseFloat(stability.toFixed(1)),
            label: this._tempTrendLabel(direction, magnitude),
            smoothed: smoothed.map(v => parseFloat(v.toFixed(1))),
            wma: wma.map(v => parseFloat(v.toFixed(1))),
            momentum: parseFloat((doubleEma.macd[doubleEma.macd.length - 1] || 0).toFixed(2)),
            raw: temps
        };
    }

    /** Analyse precipitation probability trend with improved model. */
    _analysePrecipTrend() {
        const precip = this.daily.map(d => d.precipChance ?? d.precipitation ?? 0);
        if (precip.length < 2) return this._flatTrend('precipitation');

        const reg = linearRegression(precip);
        const direction = this._trendDirection(reg.slope, 2);
        const magnitude = Math.abs(reg.slope * precip.length);
        
        // Calculate precipitation consistency
        const precipVariance = stdDev(precip);
        const consistency = Math.max(0, 100 - (precipVariance * 5));

        return {
            variable: 'precipitation',
            direction,
            slope: parseFloat(reg.slope.toFixed(3)),
            r2: parseFloat(reg.r2.toFixed(3)),
            magnitude: parseFloat(magnitude.toFixed(1)),
            confidence: this._trendConfidence(reg.r2, precip.length, precipVariance),
            consistency: parseFloat(consistency.toFixed(1)),
            label: this._precipTrendLabel(direction, magnitude),
            raw: precip
        };
    }

    /** Analyse atmospheric pressure trend from hourly data with improved detection. */
    _analysePressureTrend() {
        const pressures = this.hourly
            .slice(0, 24)
            .map(h => h.pressure)
            .filter(v => v != null && v > 900);

        if (pressures.length < 3) {
            // Fall back to current pressure label
            const p = this.current.pressure || 1013;
            return {
                variable: 'pressure',
                direction: 'stable',
                slope: 0,
                r2: 0,
                magnitude: 0,
                confidence: 30,
                label: p > 1022 ? 'High pressure — clear skies likely' : p < 1000 ? 'Low pressure — unsettled weather' : 'Normal pressure',
                raw: [p]
            };
        }

        const reg = linearRegression(pressures);
        const direction = this._trendDirection(reg.slope, 0.1);
        const magnitude = Math.abs(reg.slope * pressures.length);

        return {
            variable: 'pressure',
            direction,
            slope: parseFloat(reg.slope.toFixed(3)),
            r2: parseFloat(reg.r2.toFixed(3)),
            magnitude: parseFloat(magnitude.toFixed(2)),
            confidence: this._trendConfidence(reg.r2, pressures.length),
            label: this._pressureTrendLabel(direction, magnitude),
            raw: pressures
        };
    }

    /** Analyse relative humidity trend. */
    _analyseHumidityTrend() {
        const humidity = this.hourly
            .slice(0, 24)
            .map(h => h.humidity)
            .filter(v => v != null);

        if (humidity.length < 3) return this._flatTrend('humidity');

        const reg = linearRegression(humidity);
        const direction = this._trendDirection(reg.slope, 1);

        return {
            variable: 'humidity',
            direction,
            slope: parseFloat(reg.slope.toFixed(3)),
            r2: parseFloat(reg.r2.toFixed(3)),
            confidence: this._trendConfidence(reg.r2, humidity.length),
            label: direction === 'rising' ? 'Humidity increasing — rain possible' :
                   direction === 'falling' ? 'Humidity decreasing — drying out' : 'Humidity stable',
            raw: humidity
        };
    }

    /** Analyse wind speed trend. */
    _analyseWindTrend() {
        const winds = this.daily
            .map(d => d.wind ?? 0)
            .filter(v => v != null);

        if (winds.length < 2) return this._flatTrend('wind');

        const reg = linearRegression(winds);
        const direction = this._trendDirection(reg.slope, 1);
        const avgWind = mean(winds);

        return {
            variable: 'wind',
            direction,
            slope: parseFloat(reg.slope.toFixed(3)),
            r2: parseFloat(reg.r2.toFixed(3)),
            confidence: this._trendConfidence(reg.r2, winds.length),
            average: parseFloat(avgWind.toFixed(1)),
            label: avgWind > 30 ? 'Strong winds expected' :
                   direction === 'rising' ? 'Winds increasing' :
                   direction === 'falling' ? 'Winds calming down' : 'Calm wind conditions',
            raw: winds
        };
    }

    /** Analyse UV index trend. */
    _analyseUVTrend() {
        const uvIndices = this.daily
            .map(d => d.uvIndex ?? 0)
            .filter(v => v != null);

        if (uvIndices.length < 2) return this._flatTrend('uv');

        const reg = linearRegression(uvIndices);
        const direction = this._trendDirection(reg.slope, 0.2);
        const maxUV = Math.max(...uvIndices);

        return {
            variable: 'uv',
            direction,
            slope: parseFloat(reg.slope.toFixed(3)),
            r2: parseFloat(reg.r2.toFixed(3)),
            confidence: this._trendConfidence(reg.r2, uvIndices.length),
            maxUV: parseFloat(maxUV.toFixed(1)),
            label: maxUV >= 8 ? 'Very high UV — protection essential' :
                   maxUV >= 6 ? 'High UV — seek shade at midday' :
                   direction === 'rising' ? 'UV levels increasing' :
                   direction === 'falling' ? 'UV levels decreasing' : 'Moderate UV levels',
            raw: uvIndices
        };
    }

    /* ----------------------------------------------------------
       ANOMALY DETECTION
       ---------------------------------------------------------- */

    _detectAnomalies() {
        const anomalies = [];

        // Temperature anomalies in daily data
        const temps = this.daily.map(d => d.maxTemp).filter(v => v != null);
        if (temps.length >= 3) {
            const zs = zScores(temps);
            zs.forEach((z, i) => {
                if (Math.abs(z) > 2.0) {
                    const day = this.daily[i];
                    const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day ${i + 1}`;
                    anomalies.push({
                        type: 'temperature',
                        severity: Math.abs(z) > 3 ? 'extreme' : 'notable',
                        day: dateLabel,
                        date: day.date,
                        value: day.maxTemp,
                        zScore: parseFloat(z.toFixed(2)),
                        message: z > 0
                            ? `${dateLabel}: Unusually high temperature (${Math.round(day.maxTemp)}°C)`
                            : `${dateLabel}: Unusually low temperature (${Math.round(day.maxTemp)}°C)`
                    });
                }
            });
        }

        // Precipitation spike anomalies
        const precip = this.daily.map(d => d.precipitation ?? 0);
        if (precip.length >= 3) {
            const zs = zScores(precip);
            zs.forEach((z, i) => {
                if (z > 2.0 && precip[i] > 5) {
                    const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day ${i + 1}`;
                    anomalies.push({
                        type: 'precipitation',
                        severity: z > 3 ? 'extreme' : 'notable',
                        day: dateLabel,
                        date: this.daily[i].date,
                        value: precip[i],
                        zScore: parseFloat(z.toFixed(2)),
                        message: `${dateLabel}: Heavy precipitation spike (${precip[i].toFixed(1)} mm)`
                    });
                }
            });
        }

        // Wind anomalies
        const winds = this.daily.map(d => d.wind ?? 0);
        if (winds.length >= 3) {
            const zs = zScores(winds);
            zs.forEach((z, i) => {
                if (z > 2.0 && winds[i] > 30) {
                    const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `Day ${i + 1}`;
                    anomalies.push({
                        type: 'wind',
                        severity: z > 3 ? 'extreme' : 'notable',
                        day: dateLabel,
                        date: this.daily[i].date,
                        value: winds[i],
                        zScore: parseFloat(z.toFixed(2)),
                        message: `${dateLabel}: Unusually strong winds (${Math.round(winds[i])} km/h)`
                    });
                }
            });
        }

        return anomalies;
    }

    /* ----------------------------------------------------------
       PATTERN RECOGNITION
       ---------------------------------------------------------- */

    _recognisePatterns() {
        const patterns = [];
        const temps = this.daily.map(d => d.maxTemp).filter(v => v != null);
        const precip = this.daily.map(d => d.precipChance ?? 0);
        const codes  = this.daily.map(d => d.code ?? 0);

        // Warming pattern
        if (temps.length >= 4) {
            const last4 = temps.slice(0, 4);
            const allRising = last4.every((v, i) => i === 0 || v >= last4[i - 1] - 0.5);
            if (allRising && (last4[last4.length - 1] - last4[0]) > 3) {
                patterns.push({ id: 'warming', icon: '🌡️', label: 'Warming Trend', description: 'Temperatures rising steadily over the next few days.' });
            }
        }

        // Cooling pattern
        if (temps.length >= 4) {
            const last4 = temps.slice(0, 4);
            const allFalling = last4.every((v, i) => i === 0 || v <= last4[i - 1] + 0.5);
            if (allFalling && (last4[0] - last4[last4.length - 1]) > 3) {
                patterns.push({ id: 'cooling', icon: '❄️', label: 'Cooling Trend', description: 'Temperatures dropping steadily over the next few days.' });
            }
        }

        // Persistent rain pattern
        const rainyDays = precip.slice(0, 5).filter(p => p > 50).length;
        if (rainyDays >= 3) {
            patterns.push({ id: 'persistent-rain', icon: '🌧️', label: 'Persistent Rain', description: `${rainyDays} of the next 5 days have >50% rain probability.` });
        }

        // Dry spell pattern
        const dryDays = precip.slice(0, 5).filter(p => p < 20).length;
        if (dryDays >= 4) {
            patterns.push({ id: 'dry-spell', icon: '☀️', label: 'Dry Spell', description: 'Extended dry period expected — low precipitation probability.' });
        }

        // Storm pattern
        const stormCodes = [80, 81, 82, 95, 96, 99];
        const stormDays = codes.slice(0, 5).filter(c => stormCodes.includes(c)).length;
        if (stormDays >= 2) {
            patterns.push({ id: 'stormy', icon: '⛈️', label: 'Stormy Period', description: `${stormDays} storm events detected in the 5-day outlook.` });
        }

        // Temperature oscillation (hot days / cold nights)
        if (this.daily.length >= 3) {
            const ranges = this.daily.slice(0, 5).map(d => (d.maxTemp ?? 0) - (d.minTemp ?? 0));
            const avgRange = mean(ranges);
            if (avgRange > 15) {
                patterns.push({ id: 'high-diurnal', icon: '🌓', label: 'Large Day/Night Swing', description: `Average ${avgRange.toFixed(0)}°C difference between daily highs and lows.` });
            }
        }

        // Stable / settled weather
        if (patterns.length === 0) {
            patterns.push({ id: 'settled', icon: '🌤️', label: 'Settled Weather', description: 'No significant weather patterns detected — relatively stable conditions.' });
        }

        return patterns;
    }

    /* ----------------------------------------------------------
       SEASONAL COMPARISON
       ---------------------------------------------------------- */

    _seasonalComparison() {
        const month = new Date().getMonth(); // 0-based
        const normalTemp   = MONTHLY_TEMP_NORMALS[month];
        const normalPrecip = MONTHLY_PRECIP_NORMALS[month];

        const currentTemp  = this.current.temp ?? mean(this.daily.map(d => d.maxTemp).filter(v => v != null));
        const currentPrecip = this.current.precipitation ?? 0;

        const tempDelta   = parseFloat((currentTemp - normalTemp).toFixed(1));
        const precipDelta = parseFloat((currentPrecip - normalPrecip).toFixed(2));

        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

        return {
            month: monthNames[month],
            normalTemp,
            normalPrecip,
            currentTemp: parseFloat(currentTemp.toFixed(1)),
            currentPrecip: parseFloat(currentPrecip.toFixed(2)),
            tempDelta,
            precipDelta,
            tempStatus: tempDelta > 2 ? 'above_normal' : tempDelta < -2 ? 'below_normal' : 'near_normal',
            precipStatus: precipDelta > 2 ? 'wetter_than_normal' : precipDelta < -1 ? 'drier_than_normal' : 'near_normal',
            tempLabel: tempDelta > 2 ? `${tempDelta}°C above ${monthNames[month]} average`
                     : tempDelta < -2 ? `${Math.abs(tempDelta)}°C below ${monthNames[month]} average`
                     : `Near ${monthNames[month]} average`,
            precipLabel: precipDelta > 2 ? 'Wetter than seasonal average'
                       : precipDelta < -1 ? 'Drier than seasonal average'
                       : 'Near seasonal average precipitation'
        };
    }

    /* ----------------------------------------------------------
       PREDICTIONS
       ---------------------------------------------------------- */

    _generatePredictions(tempTrend, precipTrend, windTrend) {
        const predictions = [];
        const daily = this.daily;

        // 7-day temperature predictions with improved confidence scoring
        for (let i = 0; i < Math.min(7, daily.length); i++) {
            const day = daily[i];
            const dateLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : this._dayLabel(day.date);

            // Confidence degrades with forecast distance
            const baseConf = clamp(tempTrend.confidence - i * 4, 15, 98);
            const precipConf = clamp(precipTrend.confidence - i * 3, 15, 95);
            const windConf = clamp(windTrend?.confidence ?? 50 - i * 3, 15, 90);
            
            // Overall prediction confidence weighted average
            const overallConf = Math.round(baseConf * 0.5 + precipConf * 0.3 + windConf * 0.2);

            // Generate AI note based on multiple factors
            const aiNotes = [];
            if (day.uvIndex >= 8) aiNotes.push('High UV');
            if ((day.precipChance ?? 0) >= 70) aiNotes.push('Rain likely');
            if ((day.wind ?? 0) > 40) aiNotes.push('Windy');
            if (day.maxTemp >= 35) aiNotes.push('Hot');
            if (day.maxTemp <= 0) aiNotes.push('Freezing');

            predictions.push({
                day: dateLabel,
                date: day.date,
                maxTemp: day.maxTemp != null ? parseFloat(day.maxTemp.toFixed(1)) : null,
                minTemp: day.minTemp != null ? parseFloat(day.minTemp.toFixed(1)) : null,
                precipChance: day.precipChance ?? 0,
                condition: day.condition || 'Unknown',
                code: day.code ?? 0,
                wind: day.wind ?? 0,
                uvIndex: day.uvIndex ?? 0,
                tempConfidence: baseConf,
                precipConfidence: precipConf,
                overallConfidence: overallConf,
                aiNote: aiNotes.length > 0 ? aiNotes.join(' · ') : null
            });
        }

        return predictions;
    }

    /* ----------------------------------------------------------
       CONFIDENCE SCORING
       ---------------------------------------------------------- */

    _overallConfidence(tempTrend, precipTrend, pressureTrend, windTrend) {
        // Improved confidence calculation with more factors
        const dataPoints = this.daily.length + this.hourly.length / 4;
        const dataScore  = clamp(dataPoints * 1.5, 0, 35);
        
        // Weight trends by their R² values
        const trendScore = (
            tempTrend.r2 * 0.35 + 
            precipTrend.r2 * 0.25 + 
            pressureTrend.r2 * 0.20 +
            (windTrend?.r2 ?? 0.5) * 0.20
        ) * 45;
        
        // Stability bonus for consistent patterns
        const stabilityBonus = (tempTrend.stability ?? 50) * 0.1;
        
        const recencyScore = 20; // We always have current data

        // Calculate coefficient of variation penalty
        const temps = this.daily.map(d => d.maxTemp).filter(v => v != null);
        const cv = temps.length > 1 ? stdDev(temps) / Math.abs(mean(temps) || 1) : 0;
        const volatilityPenalty = clamp(cv * 30, 0, 15);

        const total = clamp(Math.round(dataScore + trendScore + recencyScore + stabilityBonus - volatilityPenalty), 10, 98);

        return {
            score: total,
            label: total >= 80 ? 'High' : total >= 55 ? 'Moderate' : 'Low',
            description: total >= 80
                ? 'Strong data coverage and stable patterns — predictions are reliable.'
                : total >= 55
                    ? 'Moderate data coverage — predictions are indicative but may vary.'
                    : 'Limited data or high volatility — treat predictions as estimates.'
        };
    }

    _trendConfidence(r2, n, stdErr = 0) {
        const r2Score = r2 * 55;
        const nScore  = clamp((n - 2) * 4, 0, 35);
        // Penalize high standard error
        const errPenalty = stdErr > 0 ? clamp(stdErr * 3, 0, 15) : 0;
        return clamp(Math.round(r2Score + nScore - errPenalty), 10, 98);
    }

    /* ----------------------------------------------------------
       SUMMARY BUILDER
       ---------------------------------------------------------- */

    _buildSummary(tempTrend, precipTrend, pressureTrend, anomalies, patterns) {
        const parts = [];

        // Temperature summary
        if (tempTrend.direction !== 'stable') {
            parts.push(tempTrend.label);
        }

        // Precipitation summary
        if (precipTrend.direction !== 'stable') {
            parts.push(precipTrend.label);
        }

        // Pressure summary
        if (pressureTrend.direction !== 'stable') {
            parts.push(pressureTrend.label);
        }

        // Anomaly summary
        if (anomalies.length > 0) {
            parts.push(`${anomalies.length} weather anomal${anomalies.length === 1 ? 'y' : 'ies'} detected.`);
        }

        // Pattern summary
        const mainPattern = patterns.find(p => p.id !== 'settled');
        if (mainPattern) {
            parts.push(mainPattern.description);
        }

        return parts.length > 0
            ? parts.join(' ')
            : 'Conditions appear stable with no significant trends detected.';
    }

    /* ----------------------------------------------------------
       HELPERS
       ---------------------------------------------------------- */

    _trendDirection(slope, threshold) {
        if (slope > threshold) return 'rising';
        if (slope < -threshold) return 'falling';
        return 'stable';
    }

    _tempTrendLabel(direction, magnitude) {
        if (direction === 'rising') {
            return magnitude > 5 ? 'Significant warming expected.' : 'Gradual warming trend.';
        }
        if (direction === 'falling') {
            return magnitude > 5 ? 'Significant cooling expected.' : 'Gradual cooling trend.';
        }
        return 'Temperatures remain relatively stable.';
    }

    _precipTrendLabel(direction, magnitude) {
        if (direction === 'rising') {
            return magnitude > 20 ? 'Rain probability increasing significantly.' : 'Slightly increasing chance of rain.';
        }
        if (direction === 'falling') {
            return magnitude > 20 ? 'Rain probability decreasing — drier outlook.' : 'Slightly decreasing rain chance.';
        }
        return 'Precipitation probability remains steady.';
    }

    _pressureTrendLabel(direction, magnitude) {
        if (direction === 'rising') {
            return magnitude > 3 ? 'Pressure rising — improving conditions ahead.' : 'Slight pressure rise — conditions may improve.';
        }
        if (direction === 'falling') {
            return magnitude > 3 ? 'Pressure falling — deteriorating conditions likely.' : 'Slight pressure drop — watch for changes.';
        }
        return 'Pressure stable — settled conditions.';
    }

    _flatTrend(variable) {
        return { variable, direction: 'stable', slope: 0, r2: 0, magnitude: 0, confidence: 30, label: 'Insufficient data', raw: [] };
    }

    _dayLabel(dateStr) {
        try {
            const d = new Date(dateStr + 'T12:00:00');
            return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    _dayNote(day, index) {
        const notes = [];
        if (day.uvIndex >= 8) notes.push('High UV — use protection');
        if ((day.precipChance ?? 0) >= 70) notes.push('High rain probability');
        if ((day.wind ?? 0) > 50) notes.push('Strong winds expected');
        if (day.maxTemp != null && day.maxTemp >= 35) notes.push('Extreme heat');
        if (day.maxTemp != null && day.maxTemp <= 0) notes.push('Freezing conditions');
        return notes.join(' · ') || null;
    }

    _emptyResult(reason) {
        return {
            ok: false,
            reason,
            generatedAt: new Date().toISOString(),
            confidence: { score: 0, label: 'None', description: reason },
            summary: reason,
            trends: {},
            anomalies: [],
            patterns: [],
            seasonal: null,
            predictions: []
        };
    }
}

/* ============================================================
   RENDER HELPERS  (called from app.js)
   ============================================================ */

/**
 * Build the AI Forecast card HTML from an AIForecastResult.
 * @param {object} result — return value of AIForecastEngine.analyse()
 * @param {string} unit   — 'C' or 'F'
 * @returns {string} HTML string
 */
function renderAIForecastCard(result, unit = 'C') {
    if (!result || !result.ok) {
        return `<div class="ai-card ai-card-empty">
            <div class="ai-card-header">
                <span class="ai-icon">🤖</span>
                <span class="ai-title">AI Forecast</span>
            </div>
            <p class="ai-empty-msg">${result?.reason || 'AI analysis unavailable.'}</p>
        </div>`;
    }

    const { confidence, summary, trends, anomalies, patterns, seasonal, predictions } = result;

    const confColor = confidence.score >= 80 ? 'var(--success)' : confidence.score >= 55 ? 'var(--warning)' : 'var(--danger)';

    // Trend arrows
    const arrow = dir => dir === 'rising' ? '↑' : dir === 'falling' ? '↓' : '→';
    const arrowColor = (dir, variable) => {
        if (variable === 'temperature') return dir === 'rising' ? '#ff7043' : dir === 'falling' ? '#42a5f5' : 'var(--text-dim)';
        if (variable === 'precipitation') return dir === 'rising' ? '#42a5f5' : dir === 'falling' ? '#ffb74d' : 'var(--text-dim)';
        if (variable === 'pressure') return dir === 'rising' ? '#66bb6a' : dir === 'falling' ? '#ef5350' : 'var(--text-dim)';
        return 'var(--text-dim)';
    };

    // Predictions table with improved confidence display
    const predRows = predictions.slice(0, 7).map(p => {
        const maxT = p.maxTemp != null ? (unit === 'F' ? Math.round(p.maxTemp * 9 / 5 + 32) : Math.round(p.maxTemp)) : '—';
        const minT = p.minTemp != null ? (unit === 'F' ? Math.round(p.minTemp * 9 / 5 + 32) : Math.round(p.minTemp)) : '—';
        const overallConf = p.overallConfidence ?? p.tempConfidence;
        const confBar = `<div class="ai-conf-bar"><div class="ai-conf-fill" style="width:${overallConf}%;background:${overallConf >= 75 ? 'var(--success)' : overallConf >= 50 ? 'var(--warning)' : 'var(--danger)'}"></div></div>`;
        return `<div class="ai-pred-row">
            <span class="ai-pred-day">${p.day}</span>
            <span class="ai-pred-temp">${maxT}° / ${minT}°</span>
            <span class="ai-pred-precip">💧${p.precipChance}%</span>
            <span class="ai-pred-wind">💨${Math.round(p.wind || 0)}</span>
            <span class="ai-pred-conf">${confBar}<span class="ai-conf-label">${overallConf}%</span></span>
            ${p.aiNote ? `<span class="ai-pred-note">⚡ ${p.aiNote}</span>` : '<span></span>'}
        </div>`;
    }).join('');

    // Anomaly items
    const anomalyItems = anomalies.length > 0
        ? anomalies.map(a => `<div class="ai-anomaly ai-anomaly-${a.severity}">
            <span class="ai-anomaly-icon">${a.type === 'temperature' ? '🌡️' : a.type === 'precipitation' ? '🌧️' : '💨'}</span>
            <span>${a.message}</span>
            <span class="ai-anomaly-z">z=${a.zScore}</span>
        </div>`).join('')
        : '<div class="ai-no-anomaly">✅ No significant anomalies detected</div>';

    // Pattern chips
    const patternChips = patterns.map(p =>
        `<div class="ai-pattern-chip" title="${p.description}">${p.icon} ${p.label}</div>`
    ).join('');

    // Seasonal comparison
    let seasonalHTML = '';
    if (seasonal) {
        const tColor = seasonal.tempStatus === 'above_normal' ? '#ff7043' : seasonal.tempStatus === 'below_normal' ? '#42a5f5' : 'var(--success)';
        seasonalHTML = `<div class="ai-seasonal">
            <div class="ai-seasonal-item">
                <span class="ai-seasonal-label">🌡️ vs ${seasonal.month} avg</span>
                <span class="ai-seasonal-value" style="color:${tColor}">${seasonal.tempLabel}</span>
            </div>
            <div class="ai-seasonal-item">
                <span class="ai-seasonal-label">🌧️ Precipitation</span>
                <span class="ai-seasonal-value">${seasonal.precipLabel}</span>
            </div>
        </div>`;
    }

    return `<div class="ai-card">
        <div class="ai-card-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">AI Forecast Analysis</span>
            <span class="ai-conf-badge" style="background:${confColor}20;border-color:${confColor};color:${confColor}">
                ${confidence.label} Confidence · ${confidence.score}%
            </span>
        </div>

        <p class="ai-summary">${summary}</p>

        <div class="ai-section-title">📈 Trend Analysis</div>
        <div class="ai-trends">
            ${['temp','precip','pressure','humidity'].map(k => {
                const t = trends[k];
                if (!t) return '';
                return `<div class="ai-trend-item">
                    <span class="ai-trend-arrow" style="color:${arrowColor(t.direction, t.variable)}">${arrow(t.direction)}</span>
                    <span class="ai-trend-label">${t.variable.charAt(0).toUpperCase() + t.variable.slice(1)}</span>
                    <span class="ai-trend-desc">${t.label}</span>
                    <span class="ai-trend-conf">${t.confidence}%</span>
                </div>`;
            }).join('')}
        </div>

        <div class="ai-section-title">🔮 7-Day Predictions</div>
        <div class="ai-predictions">
            <div class="ai-pred-header">
                <span>Day</span><span>High / Low</span><span>Rain</span><span>Confidence</span><span>Notes</span>
            </div>
            ${predRows}
        </div>

        <div class="ai-section-title">⚠️ Anomaly Detection</div>
        <div class="ai-anomalies">${anomalyItems}</div>

        <div class="ai-section-title">🔍 Pattern Recognition</div>
        <div class="ai-patterns">${patternChips}</div>

        <div class="ai-section-title">📅 Seasonal Context</div>
        ${seasonalHTML}

        <div class="ai-footer">
            Generated ${new Date(result.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·
            Statistical model · Not a substitute for official forecasts
        </div>
    </div>`;
}

/* ============================================================
   EXPORTS (module-style, also available globally)
   ============================================================ */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIForecastEngine, renderAIForecastCard };
}
