import { Router } from "express";
import { getDistrict } from "../utils/helpers/geo.js";
import { wrisCache, generateCacheKey } from "../utils/cache.js";
import { haversine } from "../utils/geo.js";
import { 
  computeFutureWaterLevels, 
  calculateConfidence, 
  predictStressCategoryTransition,
  predictSeasonalLevels 
} from "../utils/predictions.js";
import { calculateRSquared } from "../utils/statistics.js";
import { validatePredictionInputs, validateSeasonalData } from "../utils/validation.js";
import { waterLevelValidation, validate } from "../middleware/validation.js";
const router = Router();

// Least squares linear regression: y = slope * x + intercept
function computeLinearRegression(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const denominator = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
  
  if (denominator === 0) {
    return { slope: 0, intercept: meanY, fitted: y };
  }
  
  const slope = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  return { slope, intercept, fitted: x.map((xi) => slope * xi + intercept) };
}

router.post("/water-levels", waterLevelValidation, validate, async (req, res) => {
  try {
    const { lat, lon, date } = req.body;

    // Validate required fields
    if (!lat || !lon || !date) {
      return res.status(400).json({ error: "lat, lon, and date are required" });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "lat and lon must be valid numbers" });
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ 
        error: "Invalid latitude",
        detail: "Latitude must be between -90 and 90 degrees"
      });
    }
    
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ 
        error: "Invalid longitude",
        detail: "Longitude must be between -180 and 180 degrees"
      });
    }

    // Validate coordinates are within India (covers all 15 states in database)
    const INDIA_BOUNDS = {
      minLat: 6.5, maxLat: 35.5,
      minLon: 68.0, maxLon: 97.5
    };

    if (latitude < INDIA_BOUNDS.minLat || latitude > INDIA_BOUNDS.maxLat ||
        longitude < INDIA_BOUNDS.minLon || longitude > INDIA_BOUNDS.maxLon) {
      return res.status(400).json({
        error: "Coordinates outside India",
        detail: "This service only covers Indian districts. Please provide coordinates within India."
      });
    }

    // Validate date
    if (isNaN(Date.parse(date))) {
      return res
        .status(400)
        .json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    // Check cache first
    const cacheKey = generateCacheKey('water-level', { lat: latitude, lon: longitude, date });
    const cachedData = wrisCache.get(cacheKey);
    if (cachedData) {
      console.log(`✅ Cache hit for ${cacheKey}`);
      return res.json({ ...cachedData, cached: true });
    }

    const districtInfo = await getDistrict(latitude, longitude);
    
    if (!districtInfo || districtInfo.name === "Unknown") {
      return res
        .status(400)
        .json({ error: "Unable to determine district from coordinates" });
    }

    const { name: district, state } = districtInfo;

    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 10); // 10 years of historical data
    const formattedStart = startDate.toISOString().split("T")[0];
    const formattedEnd = endDate.toISOString().split("T")[0];

    const url = `https://indiawris.gov.in/Dataset/Ground%20Water%20Level?stateName=${encodeURIComponent(
      state
    )}&districtName=${encodeURIComponent(
      district
    )}&agencyName=CGWB&startdate=${formattedStart}&enddate=${formattedEnd}&download=false&page=0&size=10000`;
    
    console.log(`🔄 Fetching data for ${district}, ${state}...`);
    
    // Use circuit breaker to prevent cascade failures from WRIS API
    const { circuitBreaker } = await import('../utils/circuitBreaker.js');
    
    let json;
    try {
      json = await circuitBreaker.execute(
        'wris-api',
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => {
            controller.abort();
            console.log(`⏱️ Request timeout for ${district}`);
          }, 90000); // 90 second timeout for slow WRIS API
          
          try {
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
            });
            
            if (!response.ok) {
              throw new Error(`API request failed with status ${response.status}`);
            }
            
            return await response.json();
          } finally {
            clearTimeout(timeout);
          }
        },
        // Fallback to cached data if WRIS API fails
        async () => {
          console.log(`🔄 WRIS API failed, checking cache for ${district}`);
          const cachedData = wrisCache.get(cacheKey);
          if (cachedData) {
            console.log(`✅ Using stale cache for ${district}`);
            return { ...cachedData, stale: true };
          }
          throw new Error('No cached data available');
        }
      );
    } catch (err) {
      if (err.message.includes('Circuit breaker open')) {
        return res.status(503).json({
          error: "Service temporarily unavailable",
          detail: "The water data service is experiencing issues. Please try again in a few moments.",
          timestamp: new Date().toISOString()
        });
      }
      throw err;
    }
    const rawRecords = json.data?.length || 0;
    console.log(`📥 Received ${rawRecords} raw records for ${district}`);

    if (!json.data || json.data.length === 0) {
      return res
        .status(404)
        .json({ error: "No groundwater data found for the specified period" });
    }

    const stations = new Map();
    let validRecords = 0;
    let skippedRecords = { invalidWaterLevel: 0, invalidCoords: 0 };
    
    json.data.forEach((s) => {
      const waterLevel = parseFloat(s.dataValue);
      if (isNaN(waterLevel)) {
        skippedRecords.invalidWaterLevel++;
        return;
      }
      
      const stationLat = parseFloat(s.latitude);
      const stationLon = parseFloat(s.longitude);
      if (isNaN(stationLat) || isNaN(stationLon)) {
        skippedRecords.invalidCoords++;
        return;
      }
      
      validRecords++;

      const stationCode = s.stationCode;
      if (!stations.has(stationCode)) {
        stations.set(stationCode, {
          name: s.stationName,
          latitude: stationLat,
          longitude: stationLon,
          wellType: s.wellType || "Unknown",
          wellDepth: s.wellDepth ? parseFloat(s.wellDepth) : null,
          wellAquiferType: s.wellAquiferType || "Unknown",
          history: [],
          distance: haversine(latitude, longitude, stationLat, stationLon),
        });
      }
      stations.get(stationCode).history.push({
        date: s.dataTime.split("T")[0],
        waterLevel,
      });
    });

    if (stations.size === 0) {
      console.log(`❌ No valid stations. Skipped: ${skippedRecords.invalidWaterLevel} water levels, ${skippedRecords.invalidCoords} coords`);
      return res.status(404).json({ 
        error: "No valid stations found",
        debug: { rawRecords, skippedInvalidWaterLevel: skippedRecords.invalidWaterLevel, skippedInvalidCoords: skippedRecords.invalidCoords }
      });
    }
    
    console.log(`✅ Processed ${validRecords} records from ${stations.size} stations`);

    // Sort history for each station
    for (const station of stations.values()) {
      station.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Find nearest station with at least 10 data points, or fallback to nearest
    const minPoints = 10;
    let candidateStations = Array.from(stations.values())
      .filter((s) => s.history.length >= minPoints)
      .sort((a, b) => a.distance - b.distance);

    let isFallback = false;
    if (candidateStations.length === 0) {
      isFallback = true;
      candidateStations = Array.from(stations.values()).sort(
        (a, b) => a.distance - b.distance
      );
    }

    const nearestStation = candidateStations[0];
    if (!nearestStation) {
      return res.status(404).json({ error: "No suitable station found" });
    }

    let history = nearestStation.history;
    let currentWaterLevel =
      history.length > 0
        ? history[history.length - 1].waterLevel.toFixed(2)
        : null;

    // Fallback to district-level aggregation
    if (history.length < minPoints) {
      isFallback = true;
      const allData = Array.from(stations.values()).flatMap((s) => s.history);
      const groupedByDate = new Map();
      allData.forEach((h) => {
        if (!groupedByDate.has(h.date)) groupedByDate.set(h.date, []);
        groupedByDate.get(h.date).push(h.waterLevel);
      });
      history = Array.from(groupedByDate.entries())
        .map(([date, levels]) => ({
          date,
          waterLevel: levels.reduce((sum, val) => sum + val, 0) / levels.length,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      currentWaterLevel =
        history.length > 0
          ? history[history.length - 1].waterLevel.toFixed(2)
          : null;
    }

    if (history.length === 0) {
      return res
        .status(404)
        .json({ error: "No valid historical data available" });
    }

    // Compute recharge pattern, monthly, and yearly data in a single pass
    const rechargePattern = [];
    const yearlyGroups = new Map();
    const monthlyGroups = new Map();
    const groupedByYear = {};

    history.forEach((record) => {
      const dt = new Date(record.date);
      const year = dt.getFullYear();
      const month = dt.getMonth() + 1;
      const yearMonth = record.date.slice(0, 7);

      // Yearly summary
      if (!yearlyGroups.has(year)) yearlyGroups.set(year, []);
      yearlyGroups.get(year).push(record.waterLevel);

      // Monthly averages
      if (!monthlyGroups.has(yearMonth))
        monthlyGroups.set(yearMonth, new Map());
      if (!monthlyGroups.get(yearMonth).has(record.date))
        monthlyGroups.get(yearMonth).set(record.date, []);
      monthlyGroups.get(yearMonth).get(record.date).push(record.waterLevel);

      // Recharge pattern
      if (!groupedByYear[year]) groupedByYear[year] = { pre: [], post: [] };
      if (month >= 1 && month <= 5)
        groupedByYear[year].pre.push(record.waterLevel);
      else if (month >= 10 && month <= 12)
        groupedByYear[year].post.push(record.waterLevel);
    });

    // Compute recharge pattern
    for (const year in groupedByYear) {
      const preLevels = groupedByYear[year].pre;
      const postLevels = groupedByYear[year].post;
      if (preLevels.length > 0 && postLevels.length > 0) {
        const avgPre =
          preLevels.reduce((sum, val) => sum + val, 0) / preLevels.length;
        const avgPost =
          postLevels.reduce((sum, val) => sum + val, 0) / postLevels.length;
        rechargePattern.push({
          year: parseInt(year),
          preMonsoonDepth: avgPre.toFixed(2),
          postMonsoonDepth: avgPost.toFixed(2),
          rechargeAmount: (avgPre - avgPost).toFixed(2),
        });
      }
    }

    // Recharge trend
    let rechargeTrend = null;
    if (rechargePattern.length > 2) {
      const x = rechargePattern.map((r) => r.year);
      const y = rechargePattern.map((r) => parseFloat(r.rechargeAmount));
      const { slope } = computeLinearRegression(x, y);
      rechargeTrend = {
        annualChange: slope.toFixed(2),
        description: slope > 0 ? "Increasing recharge" : "Decreasing recharge",
      };
    } else if (rechargePattern.length === 0) {
      rechargeTrend = {
        note: "Insufficient pre/post-monsoon data pairs to compute recharge pattern",
      };
    }

    // Stress analysis
    let stressAnalysis = {};
    const preHistory = history.filter(
      (h) =>
        new Date(h.date).getMonth() + 1 >= 1 &&
        new Date(h.date).getMonth() + 1 <= 5
    );
    const postHistory = history.filter(
      (h) =>
        new Date(h.date).getMonth() + 1 >= 10 &&
        new Date(h.date).getMonth() + 1 <= 12
    );

    let preSlope = null;
    if (preHistory.length > 2) {
      const first = new Date(preHistory[0].date).getTime();
      const x = preHistory.map(
        (h) =>
          (new Date(h.date).getTime() - first) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = preHistory.map((h) => h.waterLevel);
      const { slope } = computeLinearRegression(x, y);
      preSlope = slope;
    }

    let postSlope = null;
    if (postHistory.length > 2) {
      const first = new Date(postHistory[0].date).getTime();
      const x = postHistory.map(
        (h) =>
          (new Date(h.date).getTime() - first) / (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = postHistory.map((h) => h.waterLevel);
      const { slope } = computeLinearRegression(x, y);
      postSlope = slope;
    }

    let overallSlope = 0;
    let fittedWaterLevels = [];
    if (history.length > 2) {
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map(
        (h) =>
          (new Date(h.date).getTime() - firstDate) /
          (365.25 * 24 * 60 * 60 * 1000)
      );
      const y = history.map((h) => h.waterLevel);
      const { slope, fitted } = computeLinearRegression(x, y);
      overallSlope = slope;

      fittedWaterLevels = history.map((h, i) => ({
        date: h.date,
        fitted: fitted[i].toFixed(2),
      }));

      let category = "Safe";
      const declineThreshold = 0.1;
      const significantPre =
        preSlope !== null && Math.abs(preSlope) > declineThreshold;
      const significantPost =
        postSlope !== null && Math.abs(postSlope) > declineThreshold;

      if (significantPre && significantPost) {
        category = overallSlope > 0.5 ? "Over-exploited" : "Critical";
      } else if (significantPre || significantPost) {
        category = "Semi-critical";
      }

      stressAnalysis = {
        trend: overallSlope > 0 ? "rising" : "declining",
        annualDeclineRate: Math.abs(overallSlope).toFixed(2),
        preMonsoonDeclineRate: preSlope ? preSlope.toFixed(2) : null,
        postMonsoonDeclineRate: postSlope ? postSlope.toFixed(2) : null,
        category,
      };
    } else {
      stressAnalysis = {
        note: "Insufficient data for trend analysis (need >2 points)",
      };
    }

    // Note: monthlyAverages and yearlySummary removed to reduce payload size
    // Chat helper computes its own monthly averages from raw data when needed

    // Plot data - optimized to only include data used by frontend
    const plotData = {
      historicalWaterLevels: history.map((h) => ({
        date: h.date,
        waterLevel: h.waterLevel.toFixed(2),
      })),
      rechargePattern: rechargePattern.map((r) => ({
        year: r.year,
        recharge: parseFloat(r.rechargeAmount),
      })),
      prePostMonsoon: rechargePattern.map((r) => ({
        year: r.year,
        pre: parseFloat(r.preMonsoonDepth),
        post: parseFloat(r.postMonsoonDepth),
      })),
    };

    const predictions = { errors: [] };
    
    const intercept = fittedWaterLevels.length > 0 ? parseFloat(fittedWaterLevels[0].fitted) - overallSlope * 0 : 0;
    const validationResult = validatePredictionInputs(history, overallSlope, intercept, { minPoints: 3, minSpanYears: 0 });
    
    if (!validationResult.isValid) {
      console.warn(`⚠️ Prediction validation failed: ${validationResult.errors.join('; ')}`);
    } else if (validationResult.validData.length < history.length) {
      console.log(`✅ Validated: ${validationResult.validData.length}/${history.length} records`);
    }
    
    try {
      if (validationResult.isValid && validationResult.validData.length >= 3) {
        const actualValues = validationResult.validData.map(h => h.waterLevel);
        const predictedValues = fittedWaterLevels.slice(0, validationResult.validData.length).map(f => parseFloat(f.fitted));
        const rSquared = calculateRSquared(actualValues, predictedValues);
        const dataSpanYears = validationResult.metrics.dataSpanYears;
        
        const futureResult = computeFutureWaterLevels(validationResult.validData, overallSlope, intercept, new Date(date));
        const confidence = calculateConfidence(validationResult.validData, rSquared, dataSpanYears);
        
        predictions.futureWaterLevels = { ...futureResult, confidence };
      } else {
        predictions.errors.push({
          type: 'insufficient_data',
          message: 'Insufficient historical data for future water level predictions (minimum 3 points required)',
          affectedPredictions: ['futureWaterLevels']
        });
      }
    } catch (error) {
      console.error('❌ Future prediction error:', error.message);
      predictions.errors.push({
        type: 'computation_error',
        message: `Failed to compute future water levels: ${error.message}`,
        affectedPredictions: ['futureWaterLevels']
      });
    }
    
    try {
      if (stressAnalysis.category && validationResult.isValid && currentWaterLevel) {
        const stressResult = predictStressCategoryTransition(
          stressAnalysis.category,
          Math.abs(overallSlope),
          parseFloat(currentWaterLevel)
        );
        
        if (validationResult.validData.length >= 3 && fittedWaterLevels.length > 0) {
          const actualValues = validationResult.validData.map(h => h.waterLevel);
          const predictedValues = fittedWaterLevels.slice(0, validationResult.validData.length).map(f => parseFloat(f.fitted));
          const rSquared = calculateRSquared(actualValues, predictedValues);
          stressResult.confidence = rSquared < 0.5 ? 'low' : (rSquared > 0.7 ? 'high' : 'medium');
        } else {
          stressResult.confidence = 'low';
        }
        
        predictions.stressCategoryTransition = stressResult;
      } else {
        const errorMsg = !validationResult.isValid 
          ? `Data validation failed: ${validationResult.errors.join('; ')}`
          : 'Unable to predict stress category transition - missing required data';
        predictions.errors.push({
          type: 'insufficient_data',
          message: errorMsg,
          affectedPredictions: ['stressCategoryTransition']
        });
      }
    } catch (error) {
      console.error('❌ Stress prediction error:', error.message);
      predictions.errors.push({
        type: 'computation_error',
        message: `Failed to compute stress category transition: ${error.message}`,
        affectedPredictions: ['stressCategoryTransition']
      });
    }
    
    try {
      const seasonalValidation = validateSeasonalData(rechargePattern, 3);
      
      if (validationResult.isValid && seasonalValidation.isValid && validationResult.validData.length >= 3) {
        const seasonalResult = predictSeasonalLevels(validationResult.validData, new Date(date), overallSlope);
        const dataSpanYears = validationResult.metrics.dataSpanYears;
        
        if (seasonalValidation.cycleCount >= 5 && dataSpanYears >= 5) {
          seasonalResult.confidence = 'high';
        } else if (seasonalValidation.cycleCount >= 3 && dataSpanYears >= 3) {
          seasonalResult.confidence = 'medium';
        } else {
          seasonalResult.confidence = 'low';
        }
        
        predictions.seasonalPredictions = seasonalResult;
      } else {
        const errors = [...(seasonalValidation.errors || []), ...(validationResult.isValid ? [] : validationResult.errors)];
        predictions.errors.push({
          type: 'insufficient_data',
          message: errors.length > 0 ? errors.join('; ') : 'Insufficient seasonal data for predictions (minimum 3 complete years required)',
          affectedPredictions: ['seasonalPredictions']
        });
      }
    } catch (error) {
      console.error('❌ Seasonal prediction error:', error.message);
      predictions.errors.push({
        type: 'computation_error',
        message: `Failed to compute seasonal predictions: ${error.message}`,
        affectedPredictions: ['seasonalPredictions']
      });
    }

    const responseData = {
      userLocation: { lat: latitude, lon: longitude, date },
      nearestStation: {
        stationName: nearestStation.name,
        latitude: nearestStation.latitude,
        longitude: nearestStation.longitude,
        distanceKm: nearestStation.distance.toFixed(2),
        wellType: nearestStation.wellType,
        wellDepth: nearestStation.wellDepth,
        wellAquiferType: nearestStation.wellAquiferType,
        note: isFallback
          ? "Using district-level aggregation due to insufficient data at nearest station"
          : null,
      },
      currentWaterLevel,
      historicalLevels: history,
      rechargePattern,
      rechargeTrend,
      stressAnalysis,
      plotData,
      predictions,
    };
    
    // Cache the response
    wrisCache.set(cacheKey, responseData);
    console.log(`💾 Cached response for ${cacheKey}`);
    
    return res.json(responseData);
  } catch (err) {
    console.error("❌ Error:", err.message);
    
    // Handle timeout errors
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: "Request timeout",
        detail: "The WRIS API took too long to respond. Please try again.",
      });
    }
    
    res.status(500).json({
      error: "Failed to fetch or process groundwater data",
      detail: err.message,
    });
  }
});

export default router;
