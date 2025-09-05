import { Router } from "express";
import fetch from "node-fetch";
import NodeCache from "node-cache";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"] });

const router = Router();
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

// -------------------- Utilities --------------------
const RAJASTHAN_DISTRICTS = [
  { name: "Ajmer", lat: 26.45, lon: 74.64 },
  { name: "Alwar", lat: 27.56, lon: 76.6 },
  { name: "Anupgarh", lat: 29.19, lon: 73.21 },
  { name: "Balotra", lat: 25.83, lon: 72.24 },
  { name: "Banswara", lat: 23.55, lon: 74.44 },
  { name: "Baran", lat: 25.1, lon: 76.51 },
  { name: "Barmer", lat: 25.75, lon: 71.42 },
  { name: "Beawar", lat: 26.1, lon: 74.32 },
  { name: "Bharatpur", lat: 27.22, lon: 77.5 },
  { name: "Bhilwara", lat: 25.35, lon: 74.63 },
  { name: "Bikaner", lat: 28.02, lon: 73.31 },
  { name: "Bundi", lat: 25.44, lon: 75.64 },
  { name: "Chittorgarh", lat: 24.89, lon: 74.63 },
  { name: "Churu", lat: 28.3, lon: 74.97 },
  { name: "Dausa", lat: 26.89, lon: 76.34 },
  { name: "Deeg", lat: 27.47, lon: 77.33 },
  { name: "Dholpur", lat: 26.7, lon: 77.89 },
  { name: "Didwana-Kuchaman", lat: 27.4, lon: 74.6 },
  { name: "Dungarpur", lat: 23.84, lon: 73.71 },
  { name: "Gangapur City", lat: 26.47, lon: 76.72 },
  { name: "Hanumangarh", lat: 29.58, lon: 74.33 },
  { name: "Jaipur", lat: 26.91, lon: 75.79 },
  { name: "Jaisalmer", lat: 26.92, lon: 70.9 },
  { name: "Jalore", lat: 25.35, lon: 72.62 },
  { name: "Jhalawar", lat: 24.6, lon: 76.16 },
  { name: "Jhunjhunu", lat: 28.13, lon: 75.4 },
  { name: "Jodhpur", lat: 26.24, lon: 73.02 },
  { name: "Jodhpur Rural", lat: 26.35, lon: 73.05 },
  { name: "Karauli", lat: 26.49, lon: 77.03 },
  { name: "Khairthal-Tijara", lat: 27.8, lon: 76.65 },
  { name: "Kekri", lat: 25.97, lon: 75.15 },
  { name: "Kotputli-Behror", lat: 27.7, lon: 76.2 },
  { name: "Nagaur", lat: 27.2, lon: 73.73 },
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
  { name: "Sri Ganganagar", lat: 29.9, lon: 73.88 },
  { name: "Tonk", lat: 26.17, lon: 75.79 },
  { name: "Udaipur", lat: 24.58, lon: 73.71 },
  { name: "Neemrana", lat: 27.99, lon: 76.38 },
];

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistrictFromCoords(lat, lon) {
  const cacheKey = `district_${lat}_${lon}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let nearest = RAJASTHAN_DISTRICTS[0];
  let minD = Infinity;
  for (const d of RAJASTHAN_DISTRICTS) {
    const dist = haversine(lat, lon, d.lat, d.lon);
    if (dist < minD) {
      minD = dist;
      nearest = d;
    }
  }
  cache.set(cacheKey, nearest.name);
  return nearest.name;
}

function getCoordsFromDistrict(district) {
  const cacheKey = `coords_${district?.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const d = RAJASTHAN_DISTRICTS.find(
    (d) => d.name.toLowerCase() === district?.toLowerCase()
  );
  const coords = d ? { lat: d.lat, lon: d.lon } : null;
  if (coords) cache.set(cacheKey, coords);
  return coords;
}

function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function stripCodeFences(s) {
  if (!s) return s;
  return s.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
}

function extractFirstJSONObject(s) {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return s.slice(first, last + 1);
}

function safeParseJSON(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (e) {
    const stripped = stripCodeFences(s);
    try {
      return JSON.parse(stripped);
    } catch (e2) {
      const objText = extractFirstJSONObject(stripped);
      if (!objText) return null;
      return JSON.parse(objText);
    }
  }
}

function getLLMContent(resp) {
  if (!resp) return "";
  if (resp.data && resp.data.choices && resp.data.choices[0]) {
    const c = resp.data.choices[0];
    if (c.message && c.message.content) return c.message.content;
    if (c.text) return c.text;
  }
  if (resp.data && typeof resp.data === "string") return resp.data;
  return "";
}

// -------------------- Intent Analysis --------------------
function analyzeIntent(message, providedDistrict, lat, lon, date) {
  const lowerMessage = message.toLowerCase();
  const needsApiCall = lowerMessage.includes("highest") || lowerMessage.includes("ground water level") || lowerMessage.includes("water level");
  const dataType = needsApiCall ? "wris" : "knowledge";
  const missingFields = [];
  let inferredDistrict = null;
  let requestedRange = date ? "custom" : "live";

  // Extract district from message
  for (const d of RAJASTHAN_DISTRICTS) {
    if (lowerMessage.includes(d.name.toLowerCase())) {
      inferredDistrict = d.name;
      break;
    }
  }

  if (!providedDistrict && !inferredDistrict && !lat && !lon) {
    missingFields.push("district", "lat", "lon");
  } else if (!lat || !lon) {
    missingFields.push("lat", "lon");
  }
  if (!date) missingFields.push("date");

  if (lowerMessage.includes("previous year")) requestedRange = "previous_year";

  return {
    needsApiCall,
    dataType,
    missingFields,
    requestedRange,
    inferredDistrict,
    processedMessage: message,
  };
}

// -------------------- Data Fetch Functions --------------------
async function fetchGroundwaterData({ district, start, end }) {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  if (!formattedStart || !formattedEnd) {
    throw new Error("Invalid start or end date for WRIS fetch");
  }
  const cacheKey = `wris_${district}_${formattedStart}_${formattedEnd}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `https://indiawris.gov.in/Dataset/Ground%20Water%20Level?stateName=Rajasthan&districtName=${encodeURIComponent(
    district
  )}&agencyName=CGWB&startdate=${formattedStart}&enddate=${formattedEnd}&download=false&page=0&size=10000`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`WRIS API failed (${r.status})`);
  const data = await r.json();
  cache.set(cacheKey, data);
  return data;
}

async function fetchLocalWaterLevel({ district, lat, lon, start, end }) {
  try {
    const url = `${process.env.BASE_URL || "http://localhost:3000"}/api/water-levels`;
    const resp = await axios.post(url, {
      district,
      lat,
      lon,
      start: formatDate(start),
      end: formatDate(end),
    }, { timeout: 10_000 });
    return resp.data;
  } catch (err) {
    console.error("Local water-level fetch error:", err.message || err);
    throw err;
  }
}

function summarizeWrisForChat(wrisData = {}, lat, lon, district) {
  const cacheKey = `summary_wris_${district}_${lat || ''}_${lon || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const summary = {
    source: "wris",
    stationsReturned: wrisData.data ? wrisData.data.length : 0,
    district: wrisData.districtName || district || null,
  };

  if (wrisData.data) {
    const stations = new Map();
    for (const s of wrisData.data) {
      const code = s.stationCode || s.stationcode || s.station_code;
      const latS = parseFloat(s.latitude ?? s.lat ?? s.Latitude ?? NaN);
      const lonS = parseFloat(s.longitude ?? s.lon ?? s.Longitude ?? NaN);
      const level = parseFloat(s.dataValue ?? s.waterLevel ?? NaN);
      const t = s.dataTime || s.DataTime || s.timestamp || null;
      if (!code || isNaN(latS) || isNaN(lonS) || isNaN(level) || level <= 0) continue;
      if (!stations.has(code)) {
        stations.set(code, {
          code,
          name: s.stationName || s.stationname || "Unknown",
          latitude: latS,
          longitude: lonS,
          history: [],
          distanceKm: lat && lon ? haversine(lat, lon, latS, lonS) : null,
        });
      }
      stations.get(code).history.push({ date: t ? t.split("T")[0] : null, value: level });
    }

    const arr = Array.from(stations.values()).filter((st) => st.history.length > 0);
    if (arr.length > 0) {
      arr.forEach((st) => {
        st.history.sort((a, b) => new Date(a.date) - new Date(b.date));
      });
      arr.sort((a, b) => {
        const aLatest = a.history[a.history.length - 1]?.value ?? -Infinity;
        const bLatest = b.history[b.history.length - 1]?.value ?? -Infinity;
        return bLatest - aLatest;
      });
      const highest = arr[0];
      const latest = highest.history[highest.history.length - 1];
      summary.highestStation = {
        stationName: highest.name,
        stationCode: highest.code,
        latitude: highest.latitude,
        longitude: highest.longitude,
        distanceKm: highest.distanceKm ? highest.distanceKm.toFixed(2) : null,
        latestDate: latest ? latest.date : null,
        highestWaterLevel: latest && !isNaN(latest.value) ? latest.value.toFixed(2) : null,
        note: "This is a lightweight summary derived from WRIS raw rows.",
      };
      summary.totalStationsWithHistory = arr.length;
    }
  }
  cache.set(cacheKey, summary);
  return summary;
}

function summarizeLocalForChat(localData = {}, lat, lon, district) {
  const cacheKey = `summary_local_${district}_${lat || ''}_${lon || ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const summary = {
    source: "local",
    stationsReturned: localData.data ? localData.data.length : 0,
    district: localData.district || district || null,
  };

  if (localData.data) {
    const arr = localData.data
      .filter((s) => s.latitude && s.longitude && s.history?.length > 0 && s.history.some(h => h.value > 0))
      .map((s) => ({
        code: s.stationCode,
        name: s.stationName,
        latitude: s.latitude,
        longitude: s.longitude,
        history: s.history || [],
        distanceKm: lat && lon ? haversine(lat, lon, s.latitude, s.longitude) : null,
      }));
    arr.sort((a, b) => {
      const aLatest = a.history[a.history.length - 1]?.value ?? -Infinity;
      const bLatest = b.history[b.history.length - 1]?.value ?? -Infinity;
      return bLatest - aLatest;
    });
    if (arr.length > 0) {
      const highest = arr[0];
      const latest = highest.history[highest.history.length - 1];
      summary.highestStation = {
        stationName: highest.name,
        stationCode: highest.code,
        latitude: highest.latitude,
        longitude: highest.longitude,
        distanceKm: highest.distanceKm ? highest.distanceKm.toFixed(2) : null,
        latestDate: latest ? latest.date : null,
        highestWaterLevel: latest && !isNaN(latest.value) ? latest.value.toFixed(2) : null,
      };
    }
  }
  cache.set(cacheKey, summary);
  return summary;
}

// -------------------- Chat Endpoint --------------------
router.post("/chat", async (req, res) => {
  try {
    const { message, lat, lon, date, context, district: providedDistrict } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Precompute district from lat/lon for fallback
    let precomputedDistrict = null;
    if (lat !== undefined && lon !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      try {
        precomputedDistrict = getDistrictFromCoords(Number(lat), Number(lon));
      } catch (e) {
        precomputedDistrict = null;
      }
    }

    // Analyze intent locally
    const analysis = analyzeIntent(message, providedDistrict, lat, lon, date);

    // Determine finalDistrict: providedDistrict > inferredDistrict > precomputedDistrict
    let finalDistrict = providedDistrict || analysis.inferredDistrict || precomputedDistrict || null;

    // Get coordinates from district if lat/lon not provided
    let effectiveLat = lat;
    let effectiveLon = lon;
    if (!effectiveLat || !effectiveLon) {
      const coords = getCoordsFromDistrict(finalDistrict);
      if (coords) {
        effectiveLat = coords.lat;
        effectiveLon = coords.lon;
        analysis.processedMessage = `${analysis.processedMessage} (using district coordinates for ${finalDistrict})`;
      }
    }

    // If WRIS or local is requested but no district, disable API call
    if (analysis.needsApiCall && (analysis.dataType === "wris" || analysis.dataType === "local") && !finalDistrict) {
      console.warn(`${analysis.dataType} requested but district unavailable; using knowledge.`);
      analysis.needsApiCall = false;
      analysis.dataType = "knowledge";
      analysis.processedMessage = `${message} (no district available, using model knowledge)`;
    }

    // Prepare effectiveContext
    let effectiveContext = context !== undefined ? context : req.session.context || false;

    // Fetch data if required
    let apiSummary = null;
    if (analysis.needsApiCall) {
      let endDate = date ? new Date(date) : new Date();
      let startDate;

      if (analysis.requestedRange === "previous_year") {
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
      } else if (analysis.requestedRange === "live") {
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
      } else {
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 10);
      }

      try {
        const fetchPromises = [];
        if (analysis.dataType === "wris" && finalDistrict) {
          fetchPromises.push(
            fetchGroundwaterData({ district: finalDistrict, start: startDate, end: endDate })
              .then(rawWris => ({
                source: "wris",
                data: summarizeWrisForChat(rawWris, effectiveLat, effectiveLon, finalDistrict),
                rawCount: rawWris.data ? rawWris.data.length : 0,
              }))
          );
        }
        if (analysis.dataType === "local" && finalDistrict) {
          fetchPromises.push(
            fetchLocalWaterLevel({ district: finalDistrict, lat: effectiveLat, lon: effectiveLon, start: startDate, end: endDate })
              .then(rawLocal => ({
                source: "local",
                data: summarizeLocalForChat(rawLocal, effectiveLat, effectiveLon, finalDistrict),
                rawCount: rawLocal.data ? rawLocal.data.length : 0,
              }))
          );
        }

        const results = await Promise.race(fetchPromises.map(p => p.catch(e => ({ error: e }))));
        if (results.error) throw results.error;

        apiSummary = results.data;
        apiSummary._rawCount = results.rawCount;
        effectiveContext = JSON.stringify(apiSummary, null, 2);
        req.session.context = effectiveContext;
      } catch (err) {
        console.error("Data fetch error:", err);
        apiSummary = { error: "Failed data fetch", detail: err.message || String(err) };
        effectiveContext = JSON.stringify(apiSummary, null, 2);
        req.session.context = effectiveContext;
        analysis.dataType = "knowledge";
        analysis.processedMessage = `${message} (data fetch failed, using model knowledge)`;
      }
    }

    // Generate final response
    const genSystem = `
You are JalMitra 🌊 — a friendly, authoritative groundwater advisor for researchers, planners, and policymakers.
You must produce a concise, actionable reply that:
- Uses available context (the JSON in the "Context" block) when relevant.
- If context was fetched from WRIS or local, reference the station with the highest groundwater level (least negative depth), including station name, latest value, and date.
- If data is sparse or fetch failed, state which fields were missing or the error, and make a best-effort reply using model knowledge.
- Add short decision-support notes (2-3 bullet actions for researchers/planners).
- If a district was inferred from the message, mention "inferred district: <name>".
- If district coordinates were used, mention "using district coordinates for <name>".
Keep tone professional, slightly warm. Do NOT reveal chain-of-thought. You may include brief bullet reasoning (not internal chain-of-thought).
`;
    const genUser = `
User message: ${JSON.stringify(analysis.processedMessage)}
Context: ${effectiveContext || "No context available"}
API summary (if any): ${apiSummary ? JSON.stringify(apiSummary, null, 2) : "none"}
Missing fields: ${JSON.stringify(analysis.missingFields)}
District used: ${finalDistrict || "none"}
Coordinates used: ${effectiveLat && effectiveLon ? `lat: ${effectiveLat}, lon: ${effectiveLon}` : "none"}

Task: Provide a helpful answer to the user. If you could not fetch live data because some fields were missing or API failed, say that you made a best-effort reply and list what you would need to fetch live data (district/lat/lon/date). If you used an inferred district, include "inferred district: <name>". If you used district coordinates, include "using district coordinates for <name>".
`;

    let genResp;
    try {
      genResp = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "deepseek/deepseek-chat-v3.1:free",
          messages: [
            { role: "system", content: genSystem },
            { role: "user", content: genUser },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 15_000,
        }
      );
    } catch (err) {
      console.error("LLM generation error:", err);
      return res.status(500).json({ error: "Failed to generate response", detail: err.message || String(err) });
    }

    const finalText = getLLMContent(genResp) || "Sorry — I couldn't produce a response right now.";

    return res.json({
      response: finalText,
      meta: {
        usedApi: !!analysis.needsApiCall,
        apiSummary: apiSummary || null,
        finalDistrict,
        effectiveLat,
        effectiveLon,
        analysisRaw: analysis,
      },
    });
  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);
    res.status(500).json({ error: "Failed to process request", detail: err.message || String(err) });
  }
});

export default router;