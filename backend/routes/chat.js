import { Router } from "express";
import axios from "axios";
import dotenv from "dotenv";
import {
  getCoordsFromDistrict,
  getDistrictFromCoords,
} from "../utils/helpers/geo.js";
import { analyzeIntent } from "../utils/helpers/intent.js";
{
}
import {
  summarizeContextForChat,
  summarizeLocalForChat,
  summarizeWrisForChat,
} from "../utils/helpers/chat.js";
import {
  fetchGroundwaterData,
  fetchLocalWaterLevel,
} from "../utils/helpers/fetch.js";

dotenv.config({ path: [".env.local", ".env"] });

const router = Router();

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

function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

function stripCodeFences(s) {
  if (!s) return s;
  return s
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
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

router.post("/chat", async (req, res) => {
  try {
    const {
      message,
      lat,
      lon,
      date,
      context,
      language,
      district: providedDistrict,
    } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // Precompute district from lat/lon for fallback
    let precomputedDistrict = null;
    if (
      lat !== undefined &&
      lon !== undefined &&
      !isNaN(Number(lat)) &&
      !isNaN(Number(lon))
    ) {
      try {
        precomputedDistrict = getDistrictFromCoords(Number(lat), Number(lon));
      } catch (e) {
        precomputedDistrict = null;
      }
    }

    let contextRelevant = false;
    // Analyze intent locally
    const analysis = analyzeIntent(message, providedDistrict, lat, lon, date);

    // Determine finalDistrict: providedDistrict > inferredDistrict > precomputedDistrict
    let finalDistrict =
      providedDistrict ||
      analysis.inferredDistrict ||
      precomputedDistrict ||
      null;

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

    let effectiveContext;
    if ("context" in req.body) {
      if (req.body.context === false) {
        effectiveContext = false; // explicitly disabled
      } else {
        effectiveContext = req.body.context; // provided object
      }
    } else {
      effectiveContext = false; // not provided at all → default false
    }

    if (effectiveContext && analysis.inferredDistrict) {
      const contextDistrict = effectiveContext.userLocation
        ? getDistrictFromCoords(
            effectiveContext.userLocation.lat,
            effectiveContext.userLocation.lon
          )
        : null;
      contextRelevant = contextDistrict === analysis.inferredDistrict;
    }

    // If WRIS or local is requested but no district, disable API call
    if (
      analysis.needsApiCall &&
      (analysis.dataType === "wris" || analysis.dataType === "local") &&
      !finalDistrict
    ) {
      console.warn(
        `${analysis.dataType} requested but district unavailable; using knowledge.`
      );
      analysis.needsApiCall = false;
      analysis.dataType = "knowledge";
      analysis.processedMessage = `${message} (no district available, using model knowledge)`;
    }

    // Fetch data if required and context is not relevant
    let apiSummary = null;
    if (analysis.needsApiCall && !contextRelevant) {
      let endDate = date ? new Date(date) : new Date();
      let startDate;

      if (analysis.requestedRange === "previous_year") {
        startDate = new Date(endDate);
        startDate.setFullYear(startDate.getFullYear() - 1);
      } else if (
        analysis.requestedRange === "live" ||
        analysis.requestedRange === "monthly"
      ) {
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
            fetchGroundwaterData({
              district: finalDistrict,
              start: startDate,
              end: endDate,
            }).then((rawWris) => ({
              source: "wris",
              data: summarizeWrisForChat(
                rawWris,
                effectiveLat,
                effectiveLon,
                finalDistrict,
                analysis.isLowest,
                analysis.requestedRange === "monthly" ? "2025" : null
              ),
              rawCount: rawWris.data ? rawWris.data.length : 0,
            }))
          );
        }
        if (analysis.dataType === "local" && finalDistrict) {
          fetchPromises.push(
            fetchLocalWaterLevel({
              district: finalDistrict,
              lat: effectiveLat,
              lon: effectiveLon,
              start: startDate,
              end: endDate,
            }).then((rawLocal) => ({
              source: "local",
              data: summarizeLocalForChat(
                rawLocal,
                effectiveLat,
                effectiveLon,
                finalDistrict,
                analysis.isLowest,
                analysis.requestedRange === "monthly" ? "2025" : null
              ),
              rawCount: rawLocal.data ? rawLocal.data.length : 0,
            }))
          );
        }

        const results = await Promise.race(
          fetchPromises.map((p) => p.catch((e) => ({ error: e })))
        );
        if (results.error) throw results.error;

        apiSummary = results.data;
        apiSummary._rawCount = results.rawCount;
        effectiveContext = JSON.stringify(apiSummary, null, 2);
        req.body.context = effectiveContext;
      } catch (err) {
        console.error("Data fetch error:", err);
        apiSummary = {
          error: "Failed data fetch",
          detail: err.message || String(err),
        };
        effectiveContext = JSON.stringify(apiSummary, null, 2);
        req.body.context = effectiveContext;
        analysis.dataType = "knowledge";
        analysis.processedMessage = `${message} (data fetch failed, using model knowledge)`;
      }
    } else if (
      contextRelevant &&
      effectiveContext &&
      analysis.requestedRange === "monthly"
    ) {
      apiSummary = summarizeContextForChat(
        effectiveContext,
        "2025",
        analysis.isLowest
      );
      effectiveContext = JSON.stringify(apiSummary, null, 2);
      req.body.context = effectiveContext;
    }

    // Generate final response
    const genSystem = `
You are JalMitra 🌊 — a friendly, authoritative groundwater advisor for researchers, planners, and policymakers.
You must produce a concise, actionable reply that:
- Uses available context (the JSON in the "Context" block) when relevant.
- If context was fetched from WRIS, local, or provided context, reference the station or month with the target (highest/lowest) water level, including station name, value, and date or month.
- If data is sparse or fetch failed, state which fields were missing or the error, and make a best-effort reply using model knowledge.
- Add short decision-support notes (2-3 bullet actions for researchers/planners).
- If a district was inferred from the message, mention "inferred district: <name>".
- If district coordinates were used, mention "using district coordinates for <name>".
Keep tone professional, slightly warm. Do NOT reveal chain-of-thought. You may include brief bullet reasoning (not internal chain-of-thought).
`;
    const genUser = `
User message: ${JSON.stringify(analysis.processedMessage)}
Context: ${effectiveContext || "No context available"}
API summary (if any): ${
      apiSummary ? JSON.stringify(apiSummary, null, 2) : "none"
    }
Missing fields: ${JSON.stringify(analysis.missingFields)}
District used: ${finalDistrict || "none"}
Coordinates used: ${
      effectiveLat && effectiveLon
        ? `lat: ${effectiveLat}, lon: ${effectiveLon}`
        : "none"
    }
THE LANGUAGE OF THE OUTPUT IS ${language}
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
      return res.status(500).json({
        error: "Failed to generate response",
        detail: err.message || String(err),
      });
    }

    const finalText =
      getLLMContent(genResp) ||
      "Sorry — I couldn't produce a response right now.";

    return res.json({
      response: finalText,
      meta: {
        usedApi: !!analysis.needsApiCall && !contextRelevant,
        apiSummary: apiSummary || null,
        finalDistrict,
        effectiveLat,
        effectiveLon,
        analysisRaw: analysis,
      },
    });
  } catch (err) {
    console.error("CHAT ROUTE ERROR:", err);
    res.status(500).json({
      error: "Failed to process request",
      detail: err.message || String(err),
    });
  }
});

export default router;
