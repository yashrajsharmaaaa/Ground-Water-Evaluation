import { RAJASTHAN_DISTRICTS } from "../district.js";
import {cache} from "../cache.js"

export function getDistrict(lat, lon) {
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

export function getCoordsFromDistrict(district) {
  const cacheKey = `coords_${district?.toLowerCase()}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const d = RAJASTHAN_DISTRICTS.find(
    (d) => d.name.toLowerCase() === district?.toLowerCase()
  );
  const coords = d ? { lat: d.lat, lon: d.lon } : null;
  if (coords) cache.set(cacheKey, coords);
  return coords;
}

export function getDistrictFromCoords(lat, lon) {
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
