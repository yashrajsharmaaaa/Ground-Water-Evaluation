import { Router } from "express";
import fetch from "node-fetch";
import NodeCache from "node-cache";

const router = Router();
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const RAJASTHAN_DISTRICTS = [
  { name: "Ajmer", lat: 26.45, lon: 74.64 },
  { name: "Alwar", lat: 27.56, lon: 76.60 },
  { name: "Anupgarh", lat: 29.19, lon: 73.21 },
  { name: "Balotra", lat: 25.83, lon: 72.24 },
  { name: "Banswara", lat: 23.55, lon: 74.44 },
  { name: "Baran", lat: 25.10, lon: 76.51 },
  { name: "Barmer", lat: 25.75, lon: 71.42 },
  { name: "Beawar", lat: 26.10, lon: 74.32 },
  { name: "Bharatpur", lat: 27.22, lon: 77.50 },
  { name: "Bhilwara", lat: 25.35, lon: 74.63 },
  { name: "Bikaner", lat: 28.02, lon: 73.31 },
  { name: "Bundi", lat: 25.44, lon: 75.64 },
  { name: "Chittorgarh", lat: 24.89, lon: 74.63 },
  { name: "Churu", lat: 28.30, lon: 74.97 },
  { name: "Dausa", lat: 26.89, lon: 76.34 },
  { name: "Deeg", lat: 27.47, lon: 77.33 },
  { name: "Dholpur", lat: 26.70, lon: 77.89 },
  { name: "Didwana-Kuchaman", lat: 27.40, lon: 74.60 },
  { name: "Dungarpur", lat: 23.84, lon: 73.71 },
  { name: "Gangapur City", lat: 26.47, lon: 76.72 },
  { name: "Hanumangarh", lat: 29.58, lon: 74.33 },
  { name: "Jaipur", lat: 26.91, lon: 75.79 },
  { name: "Jaisalmer", lat: 26.92, lon: 70.90 },
  { name: "Jalore", lat: 25.35, lon: 72.62 },
  { name: "Jhalawar", lat: 24.60, lon: 76.16 },
  { name: "Jhunjhunu", lat: 28.13, lon: 75.40 },
  { name: "Jodhpur", lat: 26.24, lon: 73.02 },
  { name: "Jodhpur Rural", lat: 26.35, lon: 73.05 },
  { name: "Karauli", lat: 26.49, lon: 77.03 },
  { name: "Khairthal-Tijara", lat: 27.80, lon: 76.65 },
  { name: "Kekri", lat: 25.97, lon: 75.15 },
  { name: "Kotputli-Behror", lat: 27.70, lon: 76.20 },
  { name: "Nagaur", lat: 27.20, lon: 73.73 },
  { name: "Neem ka Thana", lat: 27.74, lon: 75.78 },
  { name: "Pali", lat: 25.77, lon: 73.32 },
  { name: "Pratapgarh", lat: 24.03, lon: 74.78 },
  { name: "Rajsamand", lat: 25.07, lon: 73.88 },
  { name: "Salumbar", lat: 24.14, lon: 74.04 },
  { name: "Sanchore", lat: 24.75, lon: 71.77 },
  { name: "Sawai Madhopur", lat: 26.02, lon: 76.34 },
  { name: "Shahpura", lat: 25.63, lon: 74.93 },
  { name: "Sikar", lat: 27.61, lon: 75.14 },
  { name: "Sirohi", lat: 24.88, lon: 72.85 },
  { name: "Sri Ganganagar", lat: 29.90, lon: 73.88 },
  { name: "Tonk", lat: 26.17, lon: 75.79 },
  { name: "Udaipur", lat: 24.58, lon: 73.71 },
  { name: "Neemrana", lat: 27.99, lon: 76.38 },
];


function getDistrict(lat, lon) {
  const cacheKey = `${lat},${lon}`;
  const cachedDistrict = cache.get(cacheKey);
  if (cachedDistrict) return cachedDistrict;

  let nearestDistrict = RAJASTHAN_DISTRICTS[0].name; // Default to first district (Ajmer)
  let minDistance = Infinity;

  for (const district of RAJASTHAN_DISTRICTS) {
    const distance = haversine(lat, lon, district.lat, district.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestDistrict = district.name;
    }
  }

  cache.set(cacheKey, nearestDistrict);
  return nearestDistrict;
}

function computeLinearRegression(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  const slope =
    x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) /
    x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
  const intercept = meanY - slope * meanX;
  return { slope, intercept, fitted: x.map((xi) => slope * xi + intercept) };
}

router.post("/water-levels", async (req, res) => {
  try {
    const { lat, lon, date } = req.body;

    if (!lat || !lon || !date) {
      return res.status(400).json({ error: "lat, lon, and date are required" });
    }

    if (isNaN(Date.parse(date))) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const district = await getDistrict(lat, lon);
    if (district === 'Unknown') {
      return res.status(400).json({ error: "Unable to determine district from coordinates" });
    }

    const endDate = new Date(date);
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 10);
    const formattedStart = startDate.toISOString().split("T")[0];
    const formattedEnd = endDate.toISOString().split("T")[0];


    const url = `https://indiawris.gov.in/Dataset/Ground%20Water%20Level?stateName=Rajasthan&districtName=${encodeURIComponent(district)}&agencyName=CGWB&startdate=${formattedStart}&enddate=${formattedEnd}&download=false&page=0&size=10000`;
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const json = await response.json();

    if (!json.data || json.data.length === 0) {
      return res.status(404).json({ error: "No groundwater data found for the specified period" });
    }

    const stations = new Map();
    json.data.forEach((s) => {
      const waterLevel = parseFloat(s.dataValue);
      if (isNaN(waterLevel) || waterLevel <= 0) return; 

      const stationCode = s.stationCode;
      if (!stations.has(stationCode)) {
        stations.set(stationCode, {
          name: s.stationName,
          latitude: parseFloat(s.latitude),
          longitude: parseFloat(s.longitude),
          wellType: s.wellType || "Unknown",
          wellDepth: s.wellDepth ? parseFloat(s.wellDepth) : null,
          wellAquiferType: s.wellAquiferType || "Unknown",
          history: [],
          distance: haversine(lat, lon, parseFloat(s.latitude), parseFloat(s.longitude)),
        });
      }
      stations.get(stationCode).history.push({
        date: s.dataTime.split("T")[0],
        waterLevel,
      });
    });

    if (stations.size === 0) {
      return res.status(404).json({ error: "No valid stations found" });
    }

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
      candidateStations = Array.from(stations.values()).sort((a, b) => a.distance - b.distance);
    }

    const nearestStation = candidateStations[0];
    if (!nearestStation) {
      return res.status(404).json({ error: "No suitable station found" });
    }

    let history = nearestStation.history;
    let currentWaterLevel = history.length > 0 ? history[history.length - 1].waterLevel.toFixed(2) : null;

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
      currentWaterLevel = history.length > 0 ? history[history.length - 1].waterLevel.toFixed(2) : null;
    }

    if (history.length === 0) {
      return res.status(404).json({ error: "No valid historical data available" });
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
      if (!monthlyGroups.has(yearMonth)) monthlyGroups.set(yearMonth, new Map());
      if (!monthlyGroups.get(yearMonth).has(record.date)) monthlyGroups.get(yearMonth).set(record.date, []);
      monthlyGroups.get(yearMonth).get(record.date).push(record.waterLevel);

      // Recharge pattern
      if (!groupedByYear[year]) groupedByYear[year] = { pre: [], post: [] };
      if (month >= 1 && month <= 5) groupedByYear[year].pre.push(record.waterLevel);
      else if (month >= 10 && month <= 12) groupedByYear[year].post.push(record.waterLevel);
    });

    // Compute recharge pattern
    for (const year in groupedByYear) {
      const preLevels = groupedByYear[year].pre;
      const postLevels = groupedByYear[year].post;
      if (preLevels.length > 0 && postLevels.length > 0) {
        const avgPre = preLevels.reduce((sum, val) => sum + val, 0) / preLevels.length;
        const avgPost = postLevels.reduce((sum, val) => sum + val, 0) / postLevels.length;
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
    let rechargeFitted = [];
    if (rechargePattern.length > 2) {
      const x = rechargePattern.map((r) => r.year);
      const y = rechargePattern.map((r) => parseFloat(r.rechargeAmount));
      const { slope, fitted } = computeLinearRegression(x, y);
      rechargeTrend = {
        annualChange: slope.toFixed(2),
        description: slope > 0 ? "Increasing recharge" : "Decreasing recharge",
      };
      rechargeFitted = rechargePattern.map((r, i) => ({
        year: r.year,
        fitted: fitted[i].toFixed(2),
      }));
    } else if (rechargePattern.length === 0) {
      rechargeTrend = { note: "Insufficient pre/post-monsoon data pairs to compute recharge pattern" };
    }

    // Stress analysis
    let stressAnalysis = {};
    const preHistory = history.filter((h) => new Date(h.date).getMonth() + 1 >= 1 && new Date(h.date).getMonth() + 1 <= 5);
    const postHistory = history.filter((h) => new Date(h.date).getMonth() + 1 >= 10 && new Date(h.date).getMonth() + 1 <= 12);

    let preSlope = null;
    if (preHistory.length > 2) {
      const first = new Date(preHistory[0].date).getTime();
      const x = preHistory.map((h) => (new Date(h.date).getTime() - first) / (365.25 * 24 * 60 * 60 * 1000));
      const y = preHistory.map((h) => h.waterLevel);
      const { slope } = computeLinearRegression(x, y);
      preSlope = slope;
    }

    let postSlope = null;
    if (postHistory.length > 2) {
      const first = new Date(postHistory[0].date).getTime();
      const x = postHistory.map((h) => (new Date(h.date).getTime() - first) / (365.25 * 24 * 60 * 60 * 1000));
      const y = postHistory.map((h) => h.waterLevel);
      const { slope } = computeLinearRegression(x, y);
      postSlope = slope;
    }

    let overallSlope = 0;
    let fittedWaterLevels = [];
    if (history.length > 2) {
      const firstDate = new Date(history[0].date).getTime();
      const x = history.map((h) => (new Date(h.date).getTime() - firstDate) / (365.25 * 24 * 60 * 60 * 1000));
      const y = history.map((h) => h.waterLevel);
      const { slope, fitted } = computeLinearRegression(x, y);
      overallSlope = slope;

      fittedWaterLevels = history.map((h, i) => ({
        date: h.date,
        fitted: fitted[i].toFixed(2),
      }));

      let category = "Safe";
      const declineThreshold = 0.1;
      const significantPre = preSlope !== null && Math.abs(preSlope) > declineThreshold;
      const significantPost = postSlope !== null && Math.abs(postSlope) > declineThreshold;

      if (significantPre && significantPost) {
        category = overallSlope > 0.5 ? "Over-exploited" : "Critical";
      } else if (significantPre || significantPost) {
        category = "Semi-critical";
      }

      stressAnalysis = {
        trend: overallSlope > 0 ? "declining" : "rising",
        annualDeclineRate: overallSlope.toFixed(2),
        preMonsoonDeclineRate: preSlope ? preSlope.toFixed(2) : null,
        postMonsoonDeclineRate: postSlope ? postSlope.toFixed(2) : null,
        category,
      };
    } else {
      stressAnalysis = { note: "Insufficient data for trend analysis (need >2 points)" };
    }

    // Monthly averages
    const monthlyAverages = [];
    for (const [yearMonth, dates] of monthlyGroups) {
      for (const [date, levels] of dates) {
        monthlyAverages.push({
          date,
          average: (levels.reduce((sum, val) => sum + val, 0) / levels.length).toFixed(2),
        });
      }
    }
    monthlyAverages.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Full monthly data for 5 years
    const fiveYearStart = new Date(endDate);
    fiveYearStart.setFullYear(fiveYearStart.getFullYear() - 5);
    const fullMonthly = [];
    const dateMap = new Map(monthlyAverages.map((m) => [m.date, m.average]));
    let current = new Date(fiveYearStart);
    while (current <= endDate) {
      const yearMonth = current.toISOString().slice(0, 7);
      const availableDates = monthlyGroups.get(yearMonth) ? Array.from(monthlyGroups.get(yearMonth).keys()) : [];
      if (availableDates.length > 0) {
        availableDates.forEach((date) => {
          fullMonthly.push({ date, average: dateMap.get(date) || null });
        });
      } else {
        fullMonthly.push({ date: null, average: null });
      }
      current.setMonth(current.getMonth() + 1);
    }

    // Yearly summary
    const yearlySummary = Array.from(yearlyGroups.entries())
      .map(([year, levels]) => ({
        year: parseInt(year),
        average: (levels.reduce((sum, val) => sum + val, 0) / levels.length).toFixed(2),
        min: Math.min(...levels).toFixed(2),
        max: Math.max(...levels).toFixed(2),
      }))
      .sort((a, b) => a.year - b.year);

    // Plot data
    const plotData = {
      historicalWaterLevels: history.map((h) => ({ date: h.date, waterLevel: h.waterLevel.toFixed(2) })),
      monthlyAverages,
      yearlySummary,
      rechargePattern: rechargePattern.map((r) => ({ year: r.year, recharge: parseFloat(r.rechargeAmount) })),
      rechargeFitted,
      prePostMonsoon: rechargePattern.map((r) => ({
        year: r.year,
        pre: parseFloat(r.preMonsoonDepth),
        post: parseFloat(r.postMonsoonDepth),
      })),
    };

    return res.json({
      userLocation: { lat, lon, date },
      nearestStation: {
        stationName: nearestStation.name,
        latitude: nearestStation.latitude,
        longitude: nearestStation.longitude,
        distanceKm: nearestStation.distance.toFixed(2),
        wellType: nearestStation.wellType,
        wellDepth: nearestStation.wellDepth,
        wellAquiferType: nearestStation.wellAquiferType,
        note: isFallback ? "Using district-level aggregation due to insufficient data at nearest station" : null,
      },
      currentWaterLevel,
      historicalLevels: history,
      rechargePattern,
      rechargeTrend,
      stressAnalysis,
      plotData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch or process groundwater data" });
  }
});

export default router;
