import { RAJASTHAN_DISTRICTS } from "../district.js";

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getDistrict(lat, lon) {
  let nearestDistrict = RAJASTHAN_DISTRICTS[0].name;
  let minDistance = Infinity;

  for (const district of RAJASTHAN_DISTRICTS) {
    const distance = haversine(lat, lon, district.lat, district.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearestDistrict = district.name;
    }
  }

  return nearestDistrict;
}

export function getCoordsFromDistrict(district) {
  const d = RAJASTHAN_DISTRICTS.find(
    (d) => d.name.toLowerCase() === district?.toLowerCase()
  );
  return d ? { lat: d.lat, lon: d.lon } : null;
}

export function getDistrictFromCoords(lat, lon) {
  let nearest = RAJASTHAN_DISTRICTS[0];
  let minD = Infinity;
  for (const d of RAJASTHAN_DISTRICTS) {
    const dist = haversine(lat, lon, d.lat, d.lon);
    if (dist < minD) {
      minD = dist;
      nearest = d;
    }
  }
  return nearest.name;
}
