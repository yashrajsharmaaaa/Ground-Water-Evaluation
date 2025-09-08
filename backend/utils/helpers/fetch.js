import fetch from "node-fetch";

export async function fetchGroundwaterData(
  { district, start, end },
  retries = 3,
  delay = 1000
) {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  if (!formattedStart || !formattedEnd) {
    throw new Error("Invalid start or end date for WRIS fetch");
  }
  const cacheKey = `wris_${district}_${formattedStart}_${formattedEnd}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `https://indiawris.gov.in/Dataset/Ground%20Water%20Level?stateName=Rajasthan&districtName=${encodeURIComponent(
    district
  )}&agencyName=CGWB&startdate=${formattedStart}&enddate=${formattedEnd}&download=false&page=0&size=1000`;

  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (r.status === 429) {
        await new Promise((resolve) =>
          setTimeout(resolve, delay * Math.pow(2, i))
        );
        continue;
      }
      if (!r.ok) throw new Error(`WRIS API failed (${r.status})`);
      const data = await r.json();
      cache.set(cacheKey, data);
      return data;
    } catch (err) {
      if (i === retries - 1) throw err;
    }
  }
  throw new Error("WRIS API rate limit exceeded after retries");
}

export async function fetchLocalWaterLevel(
  { district, lat, lon, start, end },
  retries = 3,
  delay = 1000
) {
  try {
    const url = `${
      process.env.BASE_URL || "https://3b891c879c8a.ngrok-free.app/"
    }/api/water-levels`;
    for (let i = 0; i < retries; i++) {
      try {
        const resp = await axios.post(
          url,
          {
            district,
            lat,
            lon,
            start: formatDate(start),
            end: formatDate(end),
          },
          { timeout: 10_000 }
        );
        return resp.data;
      } catch (err) {
        if (err.response?.status === 429) {
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, i))
          );
          continue;
        }
        throw err;
      }
    }
    throw new Error("Local API rate limit exceeded after retries");
  } catch (err) {
    console.error("Local water-level fetch error:", err.message || err);
    throw err;
  }
}
