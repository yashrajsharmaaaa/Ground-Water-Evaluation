import { ALL_DISTRICTS } from "../../data/districts/index.js";

export function analyzeIntent(message, providedDistrict, lat, lon, date) {
  // Ensure message is a string
  const messageStr = String(message || "");
  const lowerMessage = messageStr.toLowerCase();
  const needsApiCall =
    lowerMessage.includes("highest") ||
    lowerMessage.includes("lowest") ||
    lowerMessage.includes("ground water level") ||
    lowerMessage.includes("water level");
  const isLowest = lowerMessage.includes("lowest");
  const dataType = needsApiCall ? "wris" : "knowledge";
  const missingFields = [];
  let inferredDistrict = null;
  let requestedRange = date ? "custom" : "live";

  // Extract district from message - now searches all India
  for (const d of ALL_DISTRICTS) {
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
  if (lowerMessage.includes("month")) requestedRange = "monthly";

  return {
    needsApiCall,
    dataType,
    missingFields,
    requestedRange,
    inferredDistrict,
    isLowest,
    processedMessage: messageStr,
  };
}