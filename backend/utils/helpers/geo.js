import { ALL_DISTRICTS, STATS } from "../../data/districts/index.js";
import { haversine } from "../geo.js";

// Log on startup
console.log(`🌍 District database loaded: ${STATS.totalDistricts} districts across ${STATS.totalStates} water-stressed states`);

/**
 * Find nearest district from coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Object} District info with name and state
 */
// Find nearest district using brute-force distance calculation (414 districts, fast enough)
export function getDistrict(lat, lon) {
  let nearestDistrict = ALL_DISTRICTS[0];
  let minDistance = Infinity;

  for (const district of ALL_DISTRICTS) {
    const distance = haversine(lat, lon, district.lat, district.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestDistrict = district;
    }
  }

  return {
    name: nearestDistrict.name,
    state: nearestDistrict.state,
    distance: minDistance.toFixed(2)
  };
}

/**
 * Get coordinates from district name
 * @param {string} districtName - District name
 * @returns {Object|null} Coordinates or null
 */
export function getCoordsFromDistrict(districtName) {
  const d = ALL_DISTRICTS.find(
    (d) => d.name.toLowerCase() === districtName?.toLowerCase()
  );
  return d ? { lat: d.lat, lon: d.lon, state: d.state } : null;
}

/**
 * Get district name from coordinates (legacy function)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {string} District name
 */
export function getDistrictFromCoords(lat, lon) {
  let nearest = ALL_DISTRICTS[0];
  let minD = Infinity;
  for (const d of ALL_DISTRICTS) {
    const dist = haversine(lat, lon, d.lat, d.lon);
    if (dist < minD) {
      minD = dist;
      nearest = d;
    }
  }
  return nearest.name;
}
